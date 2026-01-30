-- ============================================
-- BLOCKCHAIN-INSPIRED AUDIT LOG
-- Immutable audit trail with cryptographic hashing
-- ============================================

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. AUDIT LOG TABLE (Immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_number BIGSERIAL UNIQUE NOT NULL,
  
  -- Data
  event_id UUID REFERENCES events(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'event_created', 'event_updated', 'event_deleted',
    'batch_created', 'batch_updated', 'batch_quality_changed',
    'certification_issued', 'certification_expired',
    'shipment_created', 'shipment_delivered',
    'ai_job_completed', 'ai_job_reviewed'
  )),
  entity_type TEXT NOT NULL, -- 'event', 'batch', 'certification', etc.
  entity_id UUID NOT NULL,
  
  -- Payload
  payload JSONB NOT NULL, -- Full snapshot of data at this point
  metadata JSONB, -- Additional context
  
  -- Actor
  user_id UUID REFERENCES users(id),
  user_role TEXT,
  ip_address INET,
  user_agent TEXT,
  
  -- Blockchain-like Properties
  previous_hash TEXT, -- Hash of previous block
  current_hash TEXT NOT NULL, -- Hash of this block
  merkle_root TEXT, -- Merkle root if batching multiple transactions
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Verification
  is_verified BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_block_number ON audit_log(block_number);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_id ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- 2. HASH GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_audit_hash(
  block_num BIGINT,
  prev_hash TEXT,
  entity_type_val TEXT,
  entity_id_val UUID,
  payload_val JSONB,
  timestamp_val TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      block_num::TEXT || 
      COALESCE(prev_hash, '') || 
      entity_type_val || 
      entity_id_val::TEXT || 
      payload_val::TEXT || 
      timestamp_val::TEXT,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. AUTO-CREATE AUDIT LOG TRIGGER
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash_val TEXT;
  new_hash TEXT;
  action_type_val TEXT;
BEGIN
  -- Get previous hash
  SELECT current_hash INTO prev_hash_val
  FROM audit_log
  ORDER BY block_number DESC
  LIMIT 1;
  
  -- Determine action type with proper mapping
  IF TG_OP = 'INSERT' THEN
    CASE TG_TABLE_NAME
      WHEN 'events' THEN action_type_val := 'event_created';
      WHEN 'batches' THEN action_type_val := 'batch_created';
      WHEN 'certifications' THEN action_type_val := 'certification_issued';
      WHEN 'shipments' THEN action_type_val := 'shipment_created';
      ELSE action_type_val := TG_TABLE_NAME || '_created';
    END CASE;
  ELSIF TG_OP = 'UPDATE' THEN
    CASE TG_TABLE_NAME
      WHEN 'events' THEN action_type_val := 'event_updated';
      WHEN 'batches' THEN 
        -- Check if quality_status changed
        IF (OLD.quality_status IS DISTINCT FROM NEW.quality_status) THEN
          action_type_val := 'batch_quality_changed';
        ELSE
          action_type_val := 'batch_updated';
        END IF;
      WHEN 'certifications' THEN 
        IF (NEW.status = 'expired') THEN
          action_type_val := 'certification_expired';
        ELSE
          action_type_val := 'certification_issued';
        END IF;
      WHEN 'shipments' THEN
        IF (NEW.status = 'delivered') THEN
          action_type_val := 'shipment_delivered';
        ELSE
          action_type_val := 'shipment_created';
        END IF;
      ELSE action_type_val := TG_TABLE_NAME || '_updated';
    END CASE;
  ELSIF TG_OP = 'DELETE' THEN
    CASE TG_TABLE_NAME
      WHEN 'events' THEN action_type_val := 'event_deleted';
      ELSE action_type_val := TG_TABLE_NAME || '_deleted';
    END CASE;
  END IF;
  
  -- Generate hash for new block
  new_hash := generate_audit_hash(
    (SELECT COALESCE(MAX(block_number), 0) + 1 FROM audit_log),
    prev_hash_val,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    to_jsonb(COALESCE(NEW, OLD)),
    NOW()
  );
  
  -- Insert audit log
  INSERT INTO audit_log (
    event_id,
    action_type,
    entity_type,
    entity_id,
    payload,
    user_id,
    previous_hash,
    current_hash
  ) VALUES (
    CASE WHEN TG_TABLE_NAME = 'events' THEN COALESCE(NEW.id, OLD.id) ELSE NULL END,
    action_type_val,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    to_jsonb(COALESCE(NEW, OLD)),
    auth.uid(), -- Use auth.uid() directly since not all tables have user_id column
    prev_hash_val,
    new_hash
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. ATTACH TRIGGERS TO CRITICAL TABLES

-- Events
DROP TRIGGER IF EXISTS audit_events_changes ON events;
CREATE TRIGGER audit_events_changes
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Batches
DROP TRIGGER IF EXISTS audit_batches_changes ON batches;
CREATE TRIGGER audit_batches_changes
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Certifications
DROP TRIGGER IF EXISTS audit_certifications_changes ON certifications;
CREATE TRIGGER audit_certifications_changes
  AFTER INSERT OR UPDATE OR DELETE ON certifications
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Shipments
DROP TRIGGER IF EXISTS audit_shipments_changes ON shipments;
CREATE TRIGGER audit_shipments_changes
  AFTER INSERT OR UPDATE OR DELETE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- 5. VERIFICATION FUNCTIONS

-- Verify integrity of entire chain
CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS TABLE(
  block_number BIGINT,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  rec RECORD;
  expected_hash TEXT;
BEGIN
  FOR rec IN 
    SELECT 
      a.block_number,
      a.previous_hash,
      a.current_hash,
      a.entity_type,
      a.entity_id,
      a.payload,
      a.created_at
    FROM audit_log a
    ORDER BY a.block_number
  LOOP
    -- Calculate expected hash
    expected_hash := generate_audit_hash(
      rec.block_number,
      rec.previous_hash,
      rec.entity_type,
      rec.entity_id,
      rec.payload,
      rec.created_at
    );
    
    -- Check if hash matches
    IF expected_hash = rec.current_hash THEN
      RETURN QUERY SELECT rec.block_number, TRUE, NULL::TEXT;
    ELSE
      RETURN QUERY SELECT 
        rec.block_number, 
        FALSE, 
        'Hash mismatch: expected ' || expected_hash || ' but got ' || rec.current_hash;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verify single block
CREATE OR REPLACE FUNCTION verify_audit_block(block_num BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  rec RECORD;
  expected_hash TEXT;
BEGIN
  SELECT * INTO rec
  FROM audit_log
  WHERE block_number = block_num;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  expected_hash := generate_audit_hash(
    rec.block_number,
    rec.previous_hash,
    rec.entity_type,
    rec.entity_id,
    rec.payload,
    rec.created_at
  );
  
  RETURN expected_hash = rec.current_hash;
END;
$$ LANGUAGE plpgsql;

-- Get audit trail for specific entity
CREATE OR REPLACE FUNCTION get_audit_trail(
  entity_type_param TEXT,
  entity_id_param UUID
)
RETURNS TABLE(
  block_number BIGINT,
  action_type TEXT,
  payload JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ,
  current_hash TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.block_number,
    a.action_type,
    a.payload,
    a.user_id,
    a.created_at,
    a.current_hash
  FROM audit_log a
  WHERE a.entity_type = entity_type_param
    AND a.entity_id = entity_id_param
  ORDER BY a.block_number ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS POLICIES

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- Users can view audit logs for their own actions
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_log;
CREATE POLICY "Users can view their own audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- NO INSERT/UPDATE/DELETE policies - audit log is append-only and immutable
-- Only triggers can insert

-- 7. PREVENT DIRECT MODIFICATIONS

-- Revoke direct modification rights
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon;

-- 8. STATISTICS VIEW

CREATE OR REPLACE VIEW audit_statistics AS
SELECT 
  COUNT(*) as total_blocks,
  MIN(created_at) as chain_start,
  MAX(created_at) as chain_end,
  COUNT(DISTINCT entity_type) as entity_types_tracked,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN is_verified THEN 1 END) as verified_blocks
FROM audit_log;

COMMENT ON TABLE audit_log IS 'Immutable blockchain-inspired audit trail với cryptographic hashing';
COMMENT ON FUNCTION generate_audit_hash IS 'Tạo SHA-256 hash cho audit block';
COMMENT ON FUNCTION verify_audit_chain IS 'Xác minh toàn bộ chuỗi audit log';
COMMENT ON FUNCTION verify_audit_block IS 'Xác minh một block cụ thể';
COMMENT ON FUNCTION get_audit_trail IS 'Lấy lịch sử audit của một entity';
