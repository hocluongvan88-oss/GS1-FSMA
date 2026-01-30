-- Refresh audit_statistics view to populate data
-- This should be run periodically or when audit logs are empty

-- Drop and recreate the audit_statistics view with proper aggregation
DROP VIEW IF EXISTS audit_statistics CASCADE;

CREATE OR REPLACE VIEW audit_statistics AS
SELECT 
  COALESCE(COUNT(DISTINCT block_number), 0) AS total_blocks,
  COALESCE(COUNT(DISTINCT block_number) FILTER (WHERE is_verified = true), 0) AS verified_blocks,
  COALESCE(COUNT(DISTINCT user_id), 0) AS unique_users,
  COALESCE(COUNT(DISTINCT entity_type), 0) AS entity_types_tracked,
  COALESCE(MIN(created_at), NOW()) AS chain_start,
  COALESCE(MAX(created_at), NOW()) AS chain_end
FROM audit_log;

-- Grant permissions
GRANT SELECT ON audit_statistics TO anon, authenticated;

-- Add comment
COMMENT ON VIEW audit_statistics IS 'Real-time aggregated statistics for audit log blockchain';

-- Optionally: Create a function to get stats (better for performance)
CREATE OR REPLACE FUNCTION get_audit_statistics()
RETURNS TABLE(
  total_blocks BIGINT,
  verified_blocks BIGINT,
  unique_users BIGINT,
  entity_types_tracked BIGINT,
  chain_start TIMESTAMPTZ,
  chain_end TIMESTAMPTZ
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE(COUNT(DISTINCT block_number), 0)::BIGINT AS total_blocks,
    COALESCE(COUNT(DISTINCT block_number) FILTER (WHERE is_verified = true), 0)::BIGINT AS verified_blocks,
    COALESCE(COUNT(DISTINCT user_id), 0)::BIGINT AS unique_users,
    COALESCE(COUNT(DISTINCT entity_type), 0)::BIGINT AS entity_types_tracked,
    COALESCE(MIN(created_at), NOW()) AS chain_start,
    COALESCE(MAX(created_at), NOW()) AS chain_end
  FROM audit_log;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_audit_statistics() TO anon, authenticated;
