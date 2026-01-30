-- ============================================
-- SPRINT 2: HIGH PRIORITY ENHANCEMENTS
-- Destroying/Void, Shipping/Receiving, Inspection
-- ============================================

-- Temporarily disable activity logging triggers
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_events_activity') THEN
    ALTER TABLE events DISABLE TRIGGER log_events_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_shipments_activity') THEN
    ALTER TABLE shipments DISABLE TRIGGER log_shipments_activity;
  END IF;
END $$;

-- ============================================
-- TASK 4: DESTROYING & VOID EVENTS
-- ============================================

-- Step 4.1: Document destroying and void_shipping biz_steps
-- Note: events.biz_step is TEXT, accepts any value

COMMENT ON COLUMN events.biz_step IS 
'Business step: commissioning, receiving, shipping, transforming, packing, cooling, inspecting, sampling, destroying, void_shipping';

-- Step 4.2: Create destroying event function
CREATE OR REPLACE FUNCTION create_destroying_event(
  p_epc_list JSONB,
  p_batch_id UUID,
  p_location_gln TEXT,
  p_user_id UUID,
  p_reason TEXT,
  p_destruction_method TEXT DEFAULT 'disposal',
  p_certificate_number TEXT DEFAULT NULL,
  p_witness_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_batch_record RECORD;
BEGIN
  -- Validate batch exists
  SELECT * INTO v_batch_record
  FROM batches
  WHERE id = p_batch_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch % not found', p_batch_id;
  END IF;
  
  -- Generate event ID
  v_event_id := gen_random_uuid();
  
  -- Insert destroying event
  INSERT INTO events (
    id,
    event_type,
    event_time,
    biz_step,
    disposition,
    read_point,
    biz_location,
    epc_list,
    batch_id,
    user_id,
    source_type,
    ai_metadata,
    epcis_document
  ) VALUES (
    v_event_id,
    'ObjectEvent',
    NOW(),
    'destroying',
    'destroyed',
    p_location_gln,
    p_location_gln,
    p_epc_list,
    p_batch_id,
    p_user_id,
    'manual',
    jsonb_build_object(
      'destruction_reason', p_reason,
      'destruction_method', p_destruction_method,
      'certificate_number', p_certificate_number,
      'witness_name', p_witness_name,
      'batch_number', v_batch_record.batch_number,
      'traceability_lot_code', v_batch_record.traceability_lot_code
    ),
    jsonb_build_object(
      'eventType', 'ObjectEvent',
      'action', 'DELETE',
      'bizStep', 'destroying',
      'disposition', 'destroyed',
      'epcList', p_epc_list,
      'eventTime', NOW(),
      'eventTimeZoneOffset', '+07:00',
      'readPoint', jsonb_build_object('id', p_location_gln),
      'bizLocation', jsonb_build_object('id', p_location_gln)
    )
  );
  
  -- Mark batch as destroyed if all items destroyed
  UPDATE batches
  SET 
    quality_status = 'destroyed',
    quantity_available = 0,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'destruction_event_id', v_event_id,
      'destruction_reason', p_reason,
      'destruction_date', NOW()
    )
  WHERE id = p_batch_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_destroying_event IS
'Creates a destroying event for product disposal/destruction with proper documentation';

-- Step 4.3: Create void shipping event function
CREATE OR REPLACE FUNCTION void_shipping_event(
  p_original_event_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_void_event_id UUID;
  v_original_event RECORD;
BEGIN
  -- Get original event
  SELECT * INTO v_original_event
  FROM events
  WHERE id = p_original_event_id
    AND biz_step = 'shipping';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original shipping event % not found', p_original_event_id;
  END IF;
  
  -- Generate void event ID
  v_void_event_id := gen_random_uuid();
  
  -- Insert void event
  INSERT INTO events (
    id,
    event_type,
    event_time,
    biz_step,
    disposition,
    read_point,
    biz_location,
    epc_list,
    batch_id,
    user_id,
    source_type,
    ai_metadata,
    epcis_document
  ) VALUES (
    v_void_event_id,
    v_original_event.event_type,
    NOW(),
    'void_shipping',
    'cancelled',
    v_original_event.read_point,
    v_original_event.biz_location,
    v_original_event.epc_list,
    v_original_event.batch_id,
    p_user_id,
    'manual',
    jsonb_build_object(
      'voided_event_id', p_original_event_id,
      'void_reason', p_reason,
      'original_event_time', v_original_event.event_time
    ),
    jsonb_build_object(
      'eventType', v_original_event.event_type,
      'action', 'DELETE',
      'bizStep', 'void_shipping',
      'disposition', 'cancelled',
      'correctiveEventID', p_original_event_id,
      'eventTime', NOW()
    )
  );
  
  -- Update shipment status if linked
  UPDATE shipments
  SET 
    status = 'cancelled',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'void_event_id', v_void_event_id,
      'void_reason', p_reason,
      'voided_at', NOW()
    )
  WHERE metadata->>'original_event_id' = p_original_event_id::text;
  
  RETURN v_void_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION void_shipping_event IS
'Voids a shipping event (cancels shipment) with proper corrective event';


-- ============================================
-- TASK 5: SHIPPING/RECEIVING VERIFICATION
-- ============================================

-- Step 5.1: Add receiving verification fields to shipments
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS receiving_event_id UUID REFERENCES events(id),
ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS receiving_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS receiving_discrepancy JSONB,
ADD COLUMN IF NOT EXISTS two_party_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN shipments.receiving_event_id IS 'Link to receiving event for 2-party verification';
COMMENT ON COLUMN shipments.two_party_verified IS 'TRUE when both shipping and receiving events exist';

-- Step 5.2: Create 2-party verification function
CREATE OR REPLACE FUNCTION verify_shipment_receipt(
  p_shipment_id UUID,
  p_receiving_event_id UUID,
  p_received_by UUID,
  p_received_quantity INTEGER,
  p_discrepancy JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_shipment RECORD;
  v_expected_quantity INTEGER;
BEGIN
  -- Get shipment details
  SELECT * INTO v_shipment
  FROM shipments
  WHERE id = p_shipment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment % not found', p_shipment_id;
  END IF;
  
  -- Calculate expected quantity from items
  SELECT COALESCE(SUM((item->>'quantity')::integer), 0)
  INTO v_expected_quantity
  FROM jsonb_array_elements(v_shipment.items) AS item;
  
  -- Update shipment with receiving verification
  UPDATE shipments
  SET 
    receiving_event_id = p_receiving_event_id,
    received_by = p_received_by,
    receiving_verified = TRUE,
    two_party_verified = (dispatched_at IS NOT NULL),
    receiving_discrepancy = CASE
      WHEN p_received_quantity != v_expected_quantity THEN
        jsonb_build_object(
          'expected_quantity', v_expected_quantity,
          'received_quantity', p_received_quantity,
          'difference', p_received_quantity - v_expected_quantity,
          'notes', p_discrepancy
        )
      ELSE NULL
    END,
    status = CASE
      WHEN p_received_quantity = v_expected_quantity THEN 'delivered'
      ELSE 'delivered_with_discrepancy'
    END,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_shipment_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_shipment_receipt IS
'Verifies shipment receipt and enables 2-party verification (shipper + receiver)';

-- Step 5.3: Create view for unverified shipments
CREATE OR REPLACE VIEW v_unverified_shipments AS
SELECT 
  s.id,
  s.shipment_number,
  s.status,
  s.from_location_id,
  s.to_location_id,
  fl.name AS from_location_name,
  tl.name AS to_location_name,
  s.dispatched_at,
  s.items,
  s.tracking_number,
  COALESCE(
    (SELECT SUM((item->>'quantity')::integer)
     FROM jsonb_array_elements(s.items) AS item),
    0
  ) AS expected_quantity,
  EXTRACT(DAY FROM NOW() - s.dispatched_at) AS days_in_transit,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - s.dispatched_at) > 7 THEN 'urgent'
    WHEN EXTRACT(DAY FROM NOW() - s.dispatched_at) > 3 THEN 'warning'
    ELSE 'normal'
  END AS alert_level
FROM shipments s
LEFT JOIN locations fl ON s.from_location_id = fl.id
LEFT JOIN locations tl ON s.to_location_id = tl.id
WHERE s.status = 'in_transit'
  AND s.receiving_verified = FALSE
  AND s.dispatched_at IS NOT NULL
ORDER BY s.dispatched_at ASC;

COMMENT ON VIEW v_unverified_shipments IS
'Shipments in transit without receiving verification (alerts for delays)';

-- Step 5.4: Create receiving event helper function
CREATE OR REPLACE FUNCTION create_receiving_event(
  p_epc_list JSONB,
  p_batch_id UUID,
  p_location_gln TEXT,
  p_user_id UUID,
  p_shipment_id UUID,
  p_received_quantity INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  v_event_id := gen_random_uuid();
  
  -- Insert receiving event
  INSERT INTO events (
    id,
    event_type,
    event_time,
    biz_step,
    disposition,
    read_point,
    biz_location,
    epc_list,
    batch_id,
    user_id,
    source_type,
    ai_metadata,
    epcis_document
  ) VALUES (
    v_event_id,
    'ObjectEvent',
    NOW(),
    'receiving',
    'in_progress',
    p_location_gln,
    p_location_gln,
    p_epc_list,
    p_batch_id,
    p_user_id,
    'manual',
    jsonb_build_object(
      'shipment_id', p_shipment_id,
      'received_quantity', p_received_quantity
    ),
    jsonb_build_object(
      'eventType', 'ObjectEvent',
      'action', 'OBSERVE',
      'bizStep', 'receiving',
      'disposition', 'in_progress',
      'epcList', p_epc_list,
      'eventTime', NOW()
    )
  );
  
  -- Trigger 2-party verification
  PERFORM verify_shipment_receipt(
    p_shipment_id,
    v_event_id,
    p_user_id,
    p_received_quantity
  );
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_receiving_event IS
'Creates receiving event and triggers 2-party shipment verification';


-- ============================================
-- TASK 6: INSPECTING/SAMPLING EVENTS
-- ============================================

-- Step 6.1: Create inspection event function (AI-triggered)
CREATE OR REPLACE FUNCTION create_inspection_event(
  p_epc_list JSONB,
  p_batch_id UUID,
  p_location_gln TEXT,
  p_user_id UUID,
  p_inspection_type TEXT,
  p_ai_job_id UUID DEFAULT NULL,
  p_defects_found JSONB DEFAULT NULL,
  p_pass BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_ai_metadata JSONB;
BEGIN
  v_event_id := gen_random_uuid();
  
  -- Build AI metadata if AI job provided
  IF p_ai_job_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'ai_job_id', p_ai_job_id,
      'inspection_type', p_inspection_type,
      'defects_found', p_defects_found,
      'pass_status', p_pass,
      'confidence_score', q.confidence_score,
      'processing_time_ms', q.processing_time_ms,
      'result', q.result
    ) INTO v_ai_metadata
    FROM ai_processing_queue q
    WHERE q.id = p_ai_job_id;
  ELSE
    v_ai_metadata := jsonb_build_object(
      'inspection_type', p_inspection_type,
      'defects_found', p_defects_found,
      'pass_status', p_pass,
      'manual_inspection', true
    );
  END IF;
  
  -- Insert inspection event
  INSERT INTO events (
    id,
    event_type,
    event_time,
    biz_step,
    disposition,
    read_point,
    biz_location,
    epc_list,
    batch_id,
    user_id,
    source_type,
    ai_metadata,
    epcis_document
  ) VALUES (
    v_event_id,
    'ObjectEvent',
    NOW(),
    'inspecting',
    CASE WHEN p_pass THEN 'conformant' ELSE 'non_conformant' END,
    p_location_gln,
    p_location_gln,
    p_epc_list,
    p_batch_id,
    p_user_id,
    CASE WHEN p_ai_job_id IS NOT NULL THEN 'vision_ai' ELSE 'manual' END,
    v_ai_metadata,
    jsonb_build_object(
      'eventType', 'ObjectEvent',
      'action', 'OBSERVE',
      'bizStep', 'inspecting',
      'disposition', CASE WHEN p_pass THEN 'conformant' ELSE 'non_conformant' END,
      'epcList', p_epc_list,
      'eventTime', NOW()
    )
  );
  
  -- Update batch quality if failed inspection
  IF NOT p_pass THEN
    UPDATE batches
    SET 
      quality_status = 'rejected',
      quality_tested_at = NOW(),
      quality_notes = COALESCE(quality_notes, '{}'::jsonb) || jsonb_build_object(
        'inspection_event_id', v_event_id,
        'defects_found', p_defects_found,
        'inspection_type', p_inspection_type
      )
    WHERE id = p_batch_id;
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_inspection_event IS
'Creates inspection/sampling event, can be triggered by AI Vision or manual';

-- Step 6.2: Create trigger to auto-create inspection event from AI queue
CREATE OR REPLACE FUNCTION trigger_inspection_from_ai()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_location_gln TEXT;
  v_epc_list JSONB;
  v_defects_found JSONB;
  v_pass BOOLEAN;
BEGIN
  -- Only process vision inspection jobs that are completed
  IF NEW.job_type = 'vision_ocr' 
     AND NEW.status = 'completed' 
     AND NEW.result IS NOT NULL THEN
    
    -- Extract batch info from input_data
    v_batch_id := (NEW.input_data->>'batch_id')::UUID;
    v_location_gln := NEW.location_gln;
    v_epc_list := NEW.input_data->'epc_list';
    
    -- Check if defects found in AI result
    v_defects_found := NEW.result->'defects';
    v_pass := COALESCE((NEW.result->>'pass')::boolean, TRUE);
    
    -- Create inspection event if defects found or explicit inspection flag
    IF v_defects_found IS NOT NULL OR (NEW.result->>'create_inspection')::boolean THEN
      PERFORM create_inspection_event(
        v_epc_list,
        v_batch_id,
        v_location_gln,
        NEW.user_id,
        'vision_ai_inspection',
        NEW.id,
        v_defects_found,
        v_pass
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_inspection_from_ai
  AFTER UPDATE ON ai_processing_queue
  FOR EACH ROW
  WHEN (OLD.status != NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION trigger_inspection_from_ai();

COMMENT ON TRIGGER auto_create_inspection_from_ai ON ai_processing_queue IS
'Automatically creates inspection event when AI Vision detects defects';


-- ============================================
-- RE-ENABLE TRIGGERS
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_events_activity') THEN
    ALTER TABLE events ENABLE TRIGGER log_events_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_shipments_activity') THEN
    ALTER TABLE shipments ENABLE TRIGGER log_shipments_activity;
  END IF;
END $$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION create_destroying_event TO authenticated;
GRANT EXECUTE ON FUNCTION void_shipping_event TO authenticated;
GRANT EXECUTE ON FUNCTION verify_shipment_receipt TO authenticated;
GRANT EXECUTE ON FUNCTION create_receiving_event TO authenticated;
GRANT EXECUTE ON FUNCTION create_inspection_event TO authenticated;
GRANT SELECT ON v_unverified_shipments TO authenticated;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Sprint 2 Migration Complete!';
  RAISE NOTICE 'Added: Destroying & Void Shipping events';
  RAISE NOTICE 'Added: 2-party Shipping/Receiving verification';
  RAISE NOTICE 'Added: Inspection events with AI Vision integration';
END $$;
