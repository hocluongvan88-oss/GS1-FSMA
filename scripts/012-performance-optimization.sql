-- Performance Optimization: Table Partitioning and Query Optimization
-- Addresses scalability concerns for millions of EPCIS events
-- Combined: High-performance Traceback + Robust Partitioning Logic
-- Fixed: Added explicit JSONB casting to resolve operator 42883 (boolean -> unknown)

DO $$ 
DECLARE
    target_table text;
    partitioned_table text := 'epcis_events_partitioned';
    has_product_id boolean;
    has_batch_id boolean;
    has_location_id boolean;
BEGIN
    -- STEP 1: Identify the source table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'epcis_events') THEN
        target_table := 'epcis_events';
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        target_table := 'events';
    ELSE
        RAISE NOTICE 'No events table found. Skipping partitioning logic.';
        RETURN;
    END IF;

    -- STEP 2: Create partitioned table structure
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I (LIKE %I INCLUDING ALL EXCLUDING INDEXES EXCLUDING CONSTRAINTS) 
         PARTITION BY RANGE (event_time)', 
        partitioned_table, target_table
    );

    -- STEP 3: Fix Primary Key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = partitioned_table || '_pkey') THEN
        EXECUTE format(
            'ALTER TABLE %I ADD PRIMARY KEY (id, event_time)',
            partitioned_table
        );
    END IF;

    -- STEP 4: Create partitions for the last year and next 6 months
    DECLARE
        start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months');
        end_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '6 months');
        curr_date DATE := start_date;
        p_name TEXT;
    BEGIN
        WHILE curr_date < end_date LOOP
            p_name := partitioned_table || '_' || TO_CHAR(curr_date, 'YYYY_MM');
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                p_name, partitioned_table, curr_date, curr_date + INTERVAL '1 month'
            );
            curr_date := curr_date + INTERVAL '1 month';
        END LOOP;
    END;

    -- STEP 5: Create optimized indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_part_time_desc ON %I (event_time DESC)', partitioned_table);
    
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = target_table AND column_name = 'product_id') INTO has_product_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = target_table AND column_name = 'batch_id') INTO has_batch_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = target_table AND column_name = 'location_id') INTO has_location_id;

    IF has_product_id THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_part_product_id ON %I (product_id)', partitioned_table);
    END IF;

    IF has_batch_id THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_part_batch_id ON %I (batch_id)', partitioned_table);
    END IF;

    IF has_location_id THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_part_location_id ON %I (location_id)', partitioned_table);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = target_table AND column_name = 'epcis_document') THEN
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_part_epcis_gin ON %I USING GIN (epcis_document)', partitioned_table);
    END IF;
    
    -- STEP 6: Migration Logic
    EXECUTE format('INSERT INTO %I SELECT * FROM %I ON CONFLICT DO NOTHING', partitioned_table, target_table);

    RAISE NOTICE 'Partitioning and Migration completed for: %', target_table;
END $$;

-- ==============================================================================
-- STEP 7: Materialized View for Fast Trace Paths
-- FIXED: Added explicit ::jsonb casting to all operators to prevent type inference errors
-- ==============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.event_trace_paths;
CREATE MATERIALIZED VIEW public.event_trace_paths AS
WITH RECURSIVE trace AS (
    -- Base: Root events
    SELECT 
        id,
        event_type,
        event_time,
        ARRAY[id] as path,
        1 as depth,
        epcis_document::jsonb as doc
    FROM public.epcis_events_partitioned
    
    UNION ALL
    
    -- Recursive: Follow lineage
    SELECT 
        e.id,
        e.event_type,
        e.event_time,
        t.path || e.id,
        t.depth + 1,
        e.epcis_document::jsonb
    FROM public.epcis_events_partitioned e
    INNER JOIN trace t ON (
        e.id != t.id AND NOT (e.id = ANY(t.path)) AND (
            -- 1. Transformation: Any EPC in current input was an input in previous
            EXISTS (
                SELECT 1 FROM jsonb_array_elements((e.epcis_document::jsonb)->'inputEPCList') AS inp
                WHERE (t.doc::jsonb->'outputEPCList') @> jsonb_build_array(inp)
            )
            OR
            -- 2. Aggregation: Child EPCs match parent/previous EPCs
            ((e.epcis_document::jsonb->'childEPCs') @> (t.doc::jsonb->'epcList') 
             AND (t.doc->'epcList') IS NOT NULL)
            OR
            -- 3. Simple ParentID link
            (e.epcis_document->>'parentID' = t.doc->>'parentID' 
             AND e.epcis_document->>'parentID' IS NOT NULL)
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

CREATE INDEX IF NOT EXISTS idx_trace_paths_id ON public.event_trace_paths (id);

-- ==============================================================================
-- STEP 8: Optimized Trace-back Function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_product_trace(
    p_identifier TEXT,
    p_max_depth INT DEFAULT 10
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_time TIMESTAMPTZ,
    depth INT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE trace_tree AS (
        -- Start: Find starting events for the identifier
        SELECT 
            e.id,
            e.event_type,
            e.event_time,
            0 as depth
        FROM public.epcis_events_partitioned e
        WHERE 
            (e.epcis_document->>'product_id' = p_identifier)
            OR (e.epcis_document->>'gtin' = p_identifier)
            OR (e.epcis_document::jsonb->'epcList' @> jsonb_build_array(p_identifier))
            OR (e.epcis_document::jsonb->'inputEPCList' @> jsonb_build_array(p_identifier))
            OR (e.epcis_document::jsonb->'outputEPCList' @> jsonb_build_array(p_identifier))
            OR (e.epcis_document::jsonb->'childEPCs' @> jsonb_build_array(p_identifier))
        
        UNION ALL
        
        -- Follow precomputed paths
        SELECT 
            e.id,
            e.event_type,
            e.event_time,
            t.depth + 1
        FROM trace_tree t
        INNER JOIN public.event_trace_paths etp ON etp.id = t.id
        INNER JOIN public.epcis_events_partitioned e ON e.id = ANY(etp.path)
        WHERE t.depth < p_max_depth
          AND e.id != t.id
    )
    SELECT DISTINCT ON (id) id as event_id, event_type, event_time, depth 
    FROM trace_tree
    ORDER BY id, depth, event_time DESC;
END;
$$;

-- ==============================================================================
-- STEP 9: Maintenance Automation
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.maintain_traceability_system()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    next_month DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    p_name TEXT := 'epcis_events_partitioned_' || TO_CHAR(next_month, 'YYYY_MM');
BEGIN
    IF NOT EXISTS (SELECT FROM pg_class WHERE relname = p_name) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF epcis_events_partitioned FOR VALUES FROM (%L) TO (%L)',
            p_name, next_month, next_month + INTERVAL '1 month'
        );
    END IF;
    
    REFRESH MATERIALIZED VIEW public.event_trace_paths;
END;
$$;

ANALYZE public.epcis_events_partitioned;
ANALYZE public.event_trace_paths;
