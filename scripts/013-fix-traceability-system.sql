-- ============================================================
-- Script 013: FIX TRACEABILITY SYSTEM
-- Fixes Materialized View and trace functions to work with 
-- correct table structure and EPCIS 2.0 data format
-- ============================================================

-- ============================================================
-- STEP 1: Drop broken materialized view and functions
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.event_trace_paths CASCADE;
DROP FUNCTION IF EXISTS public.get_product_trace(TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.maintain_traceability_system() CASCADE;

-- ============================================================
-- STEP 2: Create correct Materialized View for Trace Paths
-- IMPORTANT: Uses bảng `events` (not epcis_events_partitioned)
-- Follows EPC chain through columns: epc_list, input_epc_list, output_epc_list
-- ============================================================

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
    FROM public.events e
    
    UNION ALL
    
    -- Recursive: Follow lineage through EPC connections
    SELECT 
        e.id,
        e.event_type,
        e.event_time,
        e.epc_list,
        e.input_epc_list,
        e.output_epc_list,
        e.epcis_document,
        t.path || e.id,
        t.depth + 1
    FROM public.events e
    INNER JOIN trace t ON (
        e.id != t.id 
        AND NOT (e.id = ANY(t.path))
        AND e.event_time < (SELECT event_time FROM events WHERE id = t.path[1])
        AND (
            -- Case 1: TransformationEvent - input EPCs came from previous event's output or epc_list
            (
                t.input_epc_list IS NOT NULL 
                AND jsonb_array_length(t.input_epc_list) > 0
                AND (
                    -- Previous event's output_epc_list contains any of current input_epc_list
                    (e.output_epc_list IS NOT NULL AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
                    OR
                    -- Previous event's epc_list contains any of current input_epc_list
                    (e.epc_list IS NOT NULL AND e.epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
                )
            )
            OR
            -- Case 2: ObjectEvent/TransactionEvent - epc_list came from previous output
            (
                t.epc_list IS NOT NULL 
                AND t.input_epc_list IS NULL
                AND jsonb_array_length(t.epc_list) > 0
                AND e.output_epc_list IS NOT NULL 
                AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.epc_list))
            )
            OR
            -- Case 3: AggregationEvent - childEPCs from epcis_document came from previous output
            (
                t.event_type = 'AggregationEvent'
                AND t.epcis_document->'childEPCs' IS NOT NULL
                AND e.output_epc_list IS NOT NULL
                AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.epcis_document->'childEPCs'))
            )
            OR
            -- Case 4: TransactionEvent - SSCC in epc_list matches parentID of AggregationEvent
            (
                t.event_type = 'TransactionEvent'
                AND t.epc_list IS NOT NULL
                AND e.event_type = 'AggregationEvent'
                AND e.epcis_document->>'parentID' IS NOT NULL
                AND t.epc_list ? (e.epcis_document->>'parentID')
            )
        )
    )
    WHERE t.depth < 10
)
SELECT DISTINCT ON (id) 
    id, 
    event_type, 
    event_time, 
    path, 
    depth
FROM trace
ORDER BY id, depth DESC;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_trace_paths_id ON public.event_trace_paths (id);
CREATE INDEX IF NOT EXISTS idx_event_trace_paths_depth ON public.event_trace_paths (depth);

-- ============================================================
-- STEP 3: Create optimized trace-back function
-- Uses columns directly from `events` table
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_product_trace(
    p_identifier TEXT,
    p_max_depth INT DEFAULT 10
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_time TIMESTAMPTZ,
    biz_step TEXT,
    disposition TEXT,
    read_point TEXT,
    epc_list JSONB,
    input_epc_list JSONB,
    output_epc_list JSONB,
    depth INT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE trace_tree AS (
        -- Base: Find starting events for the identifier
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
            0 as depth
        FROM public.events e
        WHERE 
            -- Search in epc_list
            (e.epc_list IS NOT NULL AND e.epc_list ? p_identifier)
            OR
            -- Search in input_epc_list
            (e.input_epc_list IS NOT NULL AND e.input_epc_list ? p_identifier)
            OR
            -- Search in output_epc_list
            (e.output_epc_list IS NOT NULL AND e.output_epc_list ? p_identifier)
            OR
            -- Search in epcis_document childEPCs
            (e.epcis_document->'childEPCs' IS NOT NULL AND e.epcis_document->'childEPCs' ? p_identifier)
            OR
            -- Search in epcis_document parentID
            (e.epcis_document->>'parentID' = p_identifier)
        
        UNION ALL
        
        -- Recursive: Find parent events
        SELECT 
            parent.id,
            parent.event_type,
            parent.event_time,
            parent.biz_step,
            parent.disposition,
            parent.read_point,
            parent.epc_list,
            parent.input_epc_list,
            parent.output_epc_list,
            t.depth + 1
        FROM trace_tree t
        CROSS JOIN LATERAL (
            SELECT DISTINCT e.*
            FROM public.events e
            WHERE e.id != t.id
              AND e.event_time < t.event_time
              AND (
                -- TransformationEvent: input came from previous output/epc_list
                (
                    t.input_epc_list IS NOT NULL 
                    AND (
                        (e.output_epc_list IS NOT NULL AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
                        OR (e.epc_list IS NOT NULL AND e.epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.input_epc_list)))
                    )
                )
                OR
                -- Other events: epc_list came from previous output
                (
                    t.input_epc_list IS NULL 
                    AND t.epc_list IS NOT NULL 
                    AND e.output_epc_list IS NOT NULL 
                    AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(t.epc_list))
                )
              )
            LIMIT 10
        ) parent
        WHERE t.depth < p_max_depth
    )
    SELECT DISTINCT ON (tt.id) 
        tt.id as event_id, 
        tt.event_type, 
        tt.event_time,
        tt.biz_step,
        tt.disposition,
        tt.read_point,
        tt.epc_list,
        tt.input_epc_list,
        tt.output_epc_list,
        tt.depth
    FROM trace_tree tt
    ORDER BY tt.id, tt.depth, tt.event_time DESC;
END;
$$;

-- ============================================================
-- STEP 4: Create helper function to get full trace chain
-- Returns events in chronological order (oldest first = origin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_trace_chain(
    p_identifier TEXT,
    p_max_depth INT DEFAULT 10
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_time TIMESTAMPTZ,
    biz_step TEXT,
    disposition TEXT,
    location_gln TEXT,
    location_name TEXT,
    epc_list JSONB,
    input_epc_list JSONB,
    output_epc_list JSONB,
    depth INT,
    chain_position INT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.event_id,
        t.event_type,
        t.event_time,
        t.biz_step,
        t.disposition,
        t.read_point as location_gln,
        l.name as location_name,
        t.epc_list,
        t.input_epc_list,
        t.output_epc_list,
        t.depth,
        ROW_NUMBER() OVER (ORDER BY t.event_time ASC)::INT as chain_position
    FROM public.get_product_trace(p_identifier, p_max_depth) t
    LEFT JOIN public.locations l ON l.gln = t.read_point
    ORDER BY t.event_time ASC;
END;
$$;

-- ============================================================
-- STEP 5: Create maintenance function
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_trace_paths()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.event_trace_paths;
END;
$$;

-- ============================================================
-- STEP 6: Create trigger to auto-refresh on event insert
-- (Concurrent refresh to avoid locking)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_refresh_trace_paths()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Use CONCURRENTLY if possible (requires unique index)
    REFRESH MATERIALIZED VIEW public.event_trace_paths;
    RETURN NULL;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_refresh_trace_paths ON public.events;

-- Create trigger (fires after insert, but not too frequently)
-- Note: For high-volume systems, use a scheduled job instead
CREATE TRIGGER trg_refresh_trace_paths
AFTER INSERT ON public.events
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_trace_paths();

-- ============================================================
-- STEP 7: Initial refresh of materialized view
-- ============================================================

REFRESH MATERIALIZED VIEW public.event_trace_paths;

-- ============================================================
-- STEP 8: Verify the fix with sample query
-- ============================================================

-- Test: Get trace for EPC from seed data
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.event_trace_paths;
    RAISE NOTICE 'Event trace paths created: % records', v_count;
    
    SELECT COUNT(*) INTO v_count FROM public.event_trace_paths WHERE depth > 1;
    RAISE NOTICE 'Events with traced parents (depth > 1): %', v_count;
END $$;

COMMENT ON MATERIALIZED VIEW public.event_trace_paths IS 'Pre-computed trace paths for EPCIS events. Refresh after bulk imports.';
COMMENT ON FUNCTION public.get_product_trace IS 'Get all events in the supply chain for a given EPC identifier.';
COMMENT ON FUNCTION public.get_trace_chain IS 'Get trace chain with location names, ordered chronologically.';
