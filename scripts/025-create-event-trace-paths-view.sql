-- ============================================================
-- 025: Create Event Trace Paths Materialized View
-- This script creates the event_trace_paths materialized view
-- required for traceability functionality
-- ============================================================

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.event_trace_paths CASCADE;

-- Create the materialized view for trace paths
CREATE MATERIALIZED VIEW public.event_trace_paths AS
WITH RECURSIVE trace AS (
  -- Base: All events (starting points)
  SELECT
    e.id,
    e.event_type,
    e.event_time,
    e.epc_list,
    e.input_epc_list,
    e.output_epc_list,
    e.epcis_document,
    ARRAY[e.id] as path,
    1 as depth
  FROM events e
  
  UNION ALL
  
  -- Recursive: Link to parent events through EPC matching
  SELECT
    parent.id,
    parent.event_type,
    parent.event_time,
    parent.epc_list,
    parent.input_epc_list,
    parent.output_epc_list,
    parent.epcis_document,
    t.path || parent.id,
    t.depth + 1
  FROM trace t
  INNER JOIN events parent ON (
    -- Link through input_epc_list matching current epc_list
    (parent.input_epc_list IS NOT NULL AND t.epc_list IS NOT NULL 
     AND parent.input_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.epc_list)))
    OR
    -- Link through output_epc_list matching current input_epc_list  
    (parent.output_epc_list IS NOT NULL AND t.input_epc_list IS NOT NULL
     AND parent.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
    OR
    -- Link through epc_list matching current input_epc_list
    (parent.epc_list IS NOT NULL AND t.input_epc_list IS NOT NULL
     AND parent.epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
  )
  WHERE 
    t.depth < 10  -- Prevent infinite recursion
    AND NOT parent.id = ANY(t.path)  -- Prevent cycles
)
SELECT DISTINCT ON (id, depth)
  id,
  event_type,
  event_time,
  epc_list,
  input_epc_list,
  output_epc_list,
  epcis_document,
  path,
  depth
FROM trace
ORDER BY id, depth DESC;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_trace_paths_id ON public.event_trace_paths (id);
CREATE INDEX IF NOT EXISTS idx_event_trace_paths_depth ON public.event_trace_paths (depth);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_trace_paths()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.event_trace_paths;
END;
$$;

-- Create function for RPC call (used by app)
CREATE OR REPLACE FUNCTION public.refresh_event_trace_paths()
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

-- Grant permissions
GRANT SELECT ON public.event_trace_paths TO authenticated;
GRANT SELECT ON public.event_trace_paths TO anon;
GRANT EXECUTE ON FUNCTION refresh_trace_paths() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_event_trace_paths() TO authenticated;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.event_trace_paths;

-- Add comments
COMMENT ON MATERIALIZED VIEW public.event_trace_paths IS 'Pre-computed trace paths for EPCIS events. Refresh after bulk imports or use refresh_event_trace_paths() function.';
COMMENT ON FUNCTION refresh_trace_paths() IS 'Manually refresh the event trace paths materialized view';
COMMENT ON FUNCTION refresh_event_trace_paths() IS 'RPC function to refresh event trace paths (can be called from app)';

-- Verify creation
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.event_trace_paths;
  RAISE NOTICE 'Event trace paths created: % records', v_count;
  
  SELECT COUNT(*) INTO v_count FROM public.event_trace_paths WHERE depth > 1;
  RAISE NOTICE 'Events with traced parents (depth > 1): %', v_count;
END $$;
