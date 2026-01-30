-- ============================================
-- ALTER AUDIT_LOG ENTITY_ID TO TEXT
-- Change entity_id column from UUID to TEXT to support multiple ID types
-- ============================================

-- Step 1: Drop dependent functions first
DROP FUNCTION IF EXISTS get_audit_trail(TEXT, UUID) CASCADE;

-- Step 2: Alter the column type
ALTER TABLE audit_log 
  ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT;

-- Step 3: Alter event_id as well for consistency
ALTER TABLE audit_log 
  ALTER COLUMN event_id TYPE TEXT USING event_id::TEXT;

-- Step 4: Recreate get_audit_trail function with TEXT parameter
CREATE OR REPLACE FUNCTION get_audit_trail(
  entity_type_param TEXT,
  entity_id_param TEXT  -- Changed from UUID to TEXT
)
RETURNS TABLE(
  block_number BIGINT,
  action_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ,
  user_id UUID,
  current_hash TEXT,
  previous_hash TEXT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.block_number,
    a.action_type::TEXT,
    a.payload,
    a.created_at,
    a.user_id,
    a.current_hash,
    a.previous_hash
  FROM audit_log a
  WHERE a.entity_type = entity_type_param
    AND a.entity_id = entity_id_param
  ORDER BY a.block_number ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_audit_trail IS 'Get audit trail for an entity (now accepts TEXT for entity_id)';

-- Step 5: Update indexes if needed (they should adapt automatically)
-- Verify indexes are still optimal
REINDEX TABLE audit_log;

-- Confirmation
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_log' 
  AND column_name IN ('entity_id', 'event_id')
ORDER BY ordinal_position;
