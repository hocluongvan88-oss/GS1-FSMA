-- ==============================================================================
-- FIX: Infinite recursion in users table RLS policies
-- ==============================================================================
-- Problem: The is_admin() function is used in users table RLS policy,
-- but when any query touches users table (even indirectly), it triggers
-- the RLS policy which calls is_admin() -> potentially causing recursion
-- when the function itself needs to check user permissions.
--
-- Solution: 
-- 1. Make trace functions SECURITY DEFINER to bypass RLS
-- 2. Simplify users table policies to avoid recursion
-- ==============================================================================

-- Step 1: Drop problematic policies on users table
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;

-- Step 2: Create simple non-recursive policies for users table
-- Policy 1: Users can always read their own record (using auth.uid() directly)
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Service role can do everything (for admin operations via server)
DROP POLICY IF EXISTS "users_service_role" ON public.users;
CREATE POLICY "users_service_role" ON public.users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 3: Allow authenticated users to read basic user info for display purposes
-- This is safe because it doesn't query users table recursively
DROP POLICY IF EXISTS "users_read_basic" ON public.users;
CREATE POLICY "users_read_basic" ON public.users
  FOR SELECT TO authenticated
  USING (true);  -- Allow reading all users (for admin panels, user lists, etc.)

-- Step 3: Drop existing trace functions first (to avoid return type conflict)
DROP FUNCTION IF EXISTS get_trace_chain(TEXT, INTEGER);
DROP FUNCTION IF EXISTS find_linked_events(UUID, TEXT);

-- Step 4: Update trace functions to be SECURITY DEFINER
-- This allows them to bypass RLS and run with elevated privileges

-- Update get_trace_chain function
CREATE OR REPLACE FUNCTION get_trace_chain(
  p_identifier TEXT,
  p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_time TIMESTAMPTZ,
  biz_step TEXT,
  disposition TEXT,
  read_point TEXT,  -- GLN (TEXT), not UUID
  epc_list JSONB,
  input_epc_list JSONB,
  output_epc_list JSONB,
  depth INTEGER,
  path UUID[],
  location_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with owner privileges, bypassing RLS
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE trace_chain AS (
    -- Base case: Find starting event(s) containing the identifier
    SELECT 
      e.id,
      e.event_type,
      e.event_time,
      e.biz_step,
      e.disposition,
      e.read_point,
      e.epc_list,
      e.input_epc_list,
      e.output_epc_list,
      e.batch_id,
      1 as depth,
      ARRAY[e.id] as path
    FROM events e
    WHERE 
      (e.epc_list IS NOT NULL AND e.epc_list ? p_identifier)
      OR (e.input_epc_list IS NOT NULL AND e.input_epc_list ? p_identifier)
      OR (e.output_epc_list IS NOT NULL AND e.output_epc_list ? p_identifier)
      OR (e.batch_id IS NOT NULL AND e.batch_id::text = p_identifier)
      OR e.id::text = p_identifier
    
    UNION ALL
    
    -- Recursive case: Find linked events
    SELECT 
      e.id,
      e.event_type,
      e.event_time,
      e.biz_step,
      e.disposition,
      e.read_point,
      e.epc_list,
      e.input_epc_list,
      e.output_epc_list,
      e.batch_id,
      tc.depth + 1,
      tc.path || e.id
    FROM trace_chain tc
    JOIN events e ON e.id != tc.id AND NOT (e.id = ANY(tc.path))
    WHERE tc.depth < p_max_depth
      AND e.event_time < tc.event_time
      AND (
        -- Link by input_epc_list -> output_epc_list/epc_list
        (
          tc.input_epc_list IS NOT NULL 
          AND (
            (e.output_epc_list IS NOT NULL AND e.output_epc_list ?| (
              SELECT array_agg(value::text) FROM jsonb_array_elements_text(tc.input_epc_list)
            ))
            OR 
            (e.epc_list IS NOT NULL AND e.epc_list ?| (
              SELECT array_agg(value::text) FROM jsonb_array_elements_text(tc.input_epc_list)
            ))
          )
        )
        OR
        -- Link by epc_list -> output_epc_list (for non-transformation events)
        (
          tc.input_epc_list IS NULL 
          AND tc.epc_list IS NOT NULL
          AND e.output_epc_list IS NOT NULL 
          AND e.output_epc_list ?| (
            SELECT array_agg(value::text) FROM jsonb_array_elements_text(tc.epc_list)
          )
        )
        OR
        -- Link by batch_id
        (tc.batch_id IS NOT NULL AND e.batch_id = tc.batch_id AND e.event_time < tc.event_time)
      )
  )
  SELECT 
    tc.id as event_id,
    tc.event_type,
    tc.event_time,
    tc.biz_step,
    tc.disposition,
    tc.read_point,
    tc.epc_list,
    tc.input_epc_list,
    tc.output_epc_list,
    tc.depth,
    tc.path,
    l.name as location_name
  FROM trace_chain tc
  LEFT JOIN locations l ON l.gln = tc.read_point  -- JOIN on gln (TEXT), not id (UUID)
  ORDER BY tc.depth, tc.event_time DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_trace_chain(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trace_chain(TEXT, INTEGER) TO anon;

-- Step 4: Update find_linked_events function to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION find_linked_events(
  p_event_id UUID,
  p_direction TEXT DEFAULT 'both'  -- 'upstream', 'downstream', or 'both'
)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_time TIMESTAMPTZ,
  link_type TEXT,
  linked_epc TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_epc TEXT;
BEGIN
  -- Get the source event
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find upstream events (events that produced inputs for this event)
  IF p_direction IN ('upstream', 'both') THEN
    -- From input_epc_list
    IF v_event.input_epc_list IS NOT NULL THEN
      FOR v_epc IN SELECT jsonb_array_elements_text(v_event.input_epc_list)
      LOOP
        RETURN QUERY
        SELECT 
          e.id,
          e.event_type,
          e.event_time,
          'upstream_input'::TEXT,
          v_epc
        FROM events e
        WHERE e.id != p_event_id
          AND e.event_time < v_event.event_time
          AND (
            (e.output_epc_list IS NOT NULL AND e.output_epc_list ? v_epc)
            OR (e.epc_list IS NOT NULL AND e.epc_list ? v_epc)
          )
        ORDER BY e.event_time DESC
        LIMIT 5;
      END LOOP;
    END IF;
    
    -- From epc_list (for non-transformation events)
    IF v_event.epc_list IS NOT NULL AND v_event.input_epc_list IS NULL THEN
      FOR v_epc IN SELECT jsonb_array_elements_text(v_event.epc_list)
      LOOP
        RETURN QUERY
        SELECT 
          e.id,
          e.event_type,
          e.event_time,
          'upstream_epc'::TEXT,
          v_epc
        FROM events e
        WHERE e.id != p_event_id
          AND e.event_time < v_event.event_time
          AND e.output_epc_list IS NOT NULL 
          AND e.output_epc_list ? v_epc
        ORDER BY e.event_time DESC
        LIMIT 5;
      END LOOP;
    END IF;
  END IF;
  
  -- Find downstream events (events that used outputs from this event)
  IF p_direction IN ('downstream', 'both') THEN
    IF v_event.output_epc_list IS NOT NULL THEN
      FOR v_epc IN SELECT jsonb_array_elements_text(v_event.output_epc_list)
      LOOP
        RETURN QUERY
        SELECT 
          e.id,
          e.event_type,
          e.event_time,
          'downstream_output'::TEXT,
          v_epc
        FROM events e
        WHERE e.id != p_event_id
          AND e.event_time > v_event.event_time
          AND (
            (e.input_epc_list IS NOT NULL AND e.input_epc_list ? v_epc)
            OR (e.epc_list IS NOT NULL AND e.epc_list ? v_epc)
          )
        ORDER BY e.event_time ASC
        LIMIT 5;
      END LOOP;
    END IF;
    
    IF v_event.epc_list IS NOT NULL THEN
      FOR v_epc IN SELECT jsonb_array_elements_text(v_event.epc_list)
      LOOP
        RETURN QUERY
        SELECT 
          e.id,
          e.event_type,
          e.event_time,
          'downstream_epc'::TEXT,
          v_epc
        FROM events e
        WHERE e.id != p_event_id
          AND e.event_time > v_event.event_time
          AND e.input_epc_list IS NOT NULL 
          AND e.input_epc_list ? v_epc
        ORDER BY e.event_time ASC
        LIMIT 5;
      END LOOP;
    END IF;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_linked_events(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION find_linked_events(UUID, TEXT) TO anon;

-- Step 5: Create a simple function to refresh materialized view (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION refresh_event_trace_paths()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_trace_paths;
EXCEPTION WHEN OTHERS THEN
  -- If concurrent refresh fails, do a regular refresh
  REFRESH MATERIALIZED VIEW event_trace_paths;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_event_trace_paths() TO authenticated;

-- Step 6: Verify the fix
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Test get_trace_chain function
  SELECT COUNT(*) INTO v_count 
  FROM get_trace_chain('urn:epc:id:sgtin:0854100.000001.67890', 10);
  
  RAISE NOTICE 'get_trace_chain returned % rows', v_count;
  
  IF v_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Traceability functions are working correctly';
  ELSE
    RAISE NOTICE 'WARNING: No trace results found - this may be expected if no matching data exists';
  END IF;
END $$;
