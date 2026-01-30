-- ============================================
-- FIX AUDIT HASH FUNCTION TYPE CASTING
-- Sửa lỗi: function generate_audit_hash yêu cầu UUID nhưng nhận TEXT
-- Solution: Change function signature to accept TEXT for entity_id
-- ============================================

-- Drop và tạo lại trigger function với type casting đúng
DROP TRIGGER IF EXISTS audit_events_changes ON events;
DROP TRIGGER IF EXISTS audit_batches_changes ON batches;
DROP TRIGGER IF EXISTS audit_certifications_changes ON certifications;
DROP TRIGGER IF EXISTS audit_shipments_changes ON shipments;

DROP FUNCTION IF EXISTS create_audit_log() CASCADE;
DROP FUNCTION IF EXISTS generate_audit_hash(BIGINT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ) CASCADE;

-- 1. RECREATE HASH FUNCTION WITH TEXT FOR ENTITY_ID
CREATE OR REPLACE FUNCTION generate_audit_hash(
  block_num BIGINT,
  prev_hash TEXT,
  entity_type_val TEXT,
  entity_id_val TEXT,  -- Changed from UUID to TEXT
  payload_val JSONB,
  timestamp_val TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      block_num::TEXT || 
      COALESCE(prev_hash, 'genesis') || 
      entity_type_val || 
      entity_id_val || 
      payload_val::TEXT || 
      extract(epoch from timestamp_val)::TEXT,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. AUTO-CREATE AUDIT LOG TRIGGER (với type casting)
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
  
  -- Generate hash for new block (cast both TG_TABLE_NAME and id to TEXT)
  new_hash := generate_audit_hash(
    (SELECT COALESCE(MAX(block_number), 0) + 1 FROM audit_log),
    prev_hash_val,
    TG_TABLE_NAME::TEXT,  -- Cast NAME to TEXT
    COALESCE(NEW.id, OLD.id)::TEXT,  -- Cast ID to TEXT
    to_jsonb(COALESCE(NEW, OLD)),
    NOW()
  );
  
  -- Insert audit log (cast all IDs to TEXT for consistency)
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
    CASE WHEN TG_TABLE_NAME = 'events' THEN COALESCE(NEW.id, OLD.id)::TEXT ELSE NULL END,  -- Cast to TEXT
    action_type_val,
    TG_TABLE_NAME::TEXT,  -- Cast NAME to TEXT
    COALESCE(NEW.id, OLD.id)::TEXT,  -- Cast ID to TEXT
    to_jsonb(COALESCE(NEW, OLD)),
    auth.uid(),
    prev_hash_val,
    new_hash
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. RE-ATTACH TRIGGERS TO CRITICAL TABLES

-- Events
CREATE TRIGGER audit_events_changes
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Batches
CREATE TRIGGER audit_batches_changes
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Certifications
CREATE TRIGGER audit_certifications_changes
  AFTER INSERT OR UPDATE OR DELETE ON certifications
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- Shipments
CREATE TRIGGER audit_shipments_changes
  AFTER INSERT OR UPDATE OR DELETE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();

-- 5. UPDATE VERIFY FUNCTIONS (v���i type casting)

DROP FUNCTION IF EXISTS verify_audit_chain();
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
      a.entity_type::TEXT,  -- Cast to TEXT
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

DROP FUNCTION IF EXISTS verify_audit_block(BIGINT);
CREATE OR REPLACE FUNCTION verify_audit_block(block_num BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  rec RECORD;
  expected_hash TEXT;
BEGIN
  SELECT 
    block_number,
    previous_hash,
    current_hash,
    entity_type::TEXT as entity_type,  -- Cast to TEXT
    entity_id,
    payload,
    created_at
  INTO rec
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

COMMENT ON FUNCTION generate_audit_hash IS 'Updated to accept TEXT for entity_id (supports UUID, BIGINT, etc)';
COMMENT ON FUNCTION create_audit_log IS 'Fixed version with proper type casting for TG_TABLE_NAME and entity_id';
