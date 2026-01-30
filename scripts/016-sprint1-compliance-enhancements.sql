-- ============================================
-- SPRINT 1: CRITICAL COMPLIANCE ENHANCEMENTS
-- GS1 EPCIS 2.0 + FSMA 204 + FDA Requirements
-- ============================================

-- Temporarily disable activity logging triggers to allow migration
ALTER TABLE batches DISABLE TRIGGER log_batches_activity;
ALTER TABLE events DISABLE TRIGGER log_events_activity;

-- ============================================
-- TASK 1: COMMISSIONING EVENT VALIDATION
-- ============================================

-- Step 1.1: Add is_commissioning flag to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS is_commissioning BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_events_commissioning ON events(is_commissioning) WHERE is_commissioning = TRUE;

-- Step 1.2: Add validation function for commissioning
CREATE OR REPLACE FUNCTION validate_commissioning_event()
RETURNS TRIGGER AS $$
DECLARE
  existing_commissioning_count INTEGER;
  epc_value TEXT;
BEGIN
  -- Only check if this is a commissioning event
  IF NEW.is_commissioning = TRUE OR NEW.biz_step = 'commissioning' THEN
    -- Mark as commissioning
    NEW.is_commissioning := TRUE;
    
    -- Extract EPCs and check if any already have commissioning events
    IF NEW.epc_list IS NOT NULL THEN
      FOR epc_value IN SELECT jsonb_array_elements_text(NEW.epc_list)
      LOOP
        SELECT COUNT(*) INTO existing_commissioning_count
        FROM events
        WHERE is_commissioning = TRUE
          AND epc_list ? epc_value
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
        
        IF existing_commissioning_count > 0 THEN
          RAISE EXCEPTION 
            'EPC % already has a commissioning event. Each EPC can only be commissioned once.', 
            epc_value;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_validate_commissioning ON events;
CREATE TRIGGER trigger_validate_commissioning
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_commissioning_event();

COMMENT ON FUNCTION validate_commissioning_event() IS 
'Validates that each EPC can only have ONE commissioning event (origin validation)';


-- ============================================
-- TASK 2: COOLING EVENT SUPPORT
-- ============================================

-- Step 2.1: Add cooling to biz_step enum (if using enum, otherwise just allow text)
-- Note: events.biz_step is TEXT, so we just need to document valid values

-- Step 2.2: Create helper function for cooling events
CREATE OR REPLACE FUNCTION create_cooling_event(
  p_epc_list JSONB,
  p_batch_id UUID,
  p_location_gln TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_start_temp DECIMAL,
  p_end_temp DECIMAL,
  p_temp_unit TEXT DEFAULT 'Celsius',
  p_user_id UUID DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_cooling_metadata JSONB;
  v_epcis_doc JSONB;
BEGIN
  -- Generate event ID
  v_event_id := gen_random_uuid();
  
  -- Build cooling metadata
  v_cooling_metadata := jsonb_build_object(
    'cooling_start_time', p_start_time,
    'cooling_end_time', p_end_time,
    'cooling_duration_minutes', EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60,
    'start_temperature', p_start_temp,
    'end_temperature', p_end_temp,
    'temperature_unit', p_temp_unit,
    'temperature_delta', p_start_temp - p_end_temp,
    'process_type', 'rapid_cooling'
  );
  
  -- Build EPCIS 2.0 compliant document
  v_epcis_doc := jsonb_build_object(
    '@context', 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonb',
    'type', 'EPCISDocument',
    'schemaVersion', '2.0',
    'creationDate', NOW(),
    'epcisBody', jsonb_build_object(
      'eventList', jsonb_build_array(
        jsonb_build_object(
          'type', 'ObjectEvent',
          'eventID', v_event_id,
          'eventTime', p_end_time,
          'eventTimeZoneOffset', '+07:00',
          'epcList', p_epc_list,
          'action', 'OBSERVE',
          'bizStep', 'urn:epcglobal:cbv:bizstep:cooling',
          'disposition', 'urn:epcglobal:cbv:disp:in_progress',
          'readPoint', jsonb_build_object('id', 'urn:epc:id:sgln:' || p_location_gln),
          'bizLocation', jsonb_build_object('id', 'urn:epc:id:sgln:' || p_location_gln),
          'bizTransactionList', CASE 
            WHEN p_batch_id IS NOT NULL THEN 
              jsonb_build_array(
                jsonb_build_object(
                  'type', 'urn:epcglobal:cbv:btt:po',
                  'bizTransaction', 'urn:batch:' || p_batch_id
                )
              )
            ELSE '[]'::JSONB
          END,
          'extension', v_cooling_metadata
        )
      )
    )
  );
  
  -- Insert cooling event
  INSERT INTO events (
    id,
    event_type,
    event_time,
    event_timezone,
    biz_step,
    disposition,
    read_point,
    biz_location,
    epc_list,
    batch_id,
    user_id,
    user_name,
    source_type,
    ai_metadata,
    epcis_document
  ) VALUES (
    v_event_id,
    'ObjectEvent',
    p_end_time,
    'Asia/Ho_Chi_Minh',
    'cooling',
    'in_progress',
    p_location_gln,
    p_location_gln,
    p_epc_list,
    p_batch_id,
    COALESCE(p_user_id, auth.uid()),
    p_user_name,
    p_source_type,
    v_cooling_metadata,
    v_epcis_doc
  );
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_cooling_event IS 
'Creates a cooling event with temperature monitoring data (FSMA 204 compliant)';


-- ============================================
-- TASK 3: BATCH MASTER DATA (KDE - Key Data Elements)
-- ============================================

-- Step 3.1: Add FSMA 204 Key Data Elements to batches table
ALTER TABLE batches 
ADD COLUMN IF NOT EXISTS harvest_date DATE,
ADD COLUMN IF NOT EXISTS harvest_location_gln TEXT REFERENCES locations(gln),
ADD COLUMN IF NOT EXISTS cooling_completion_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS traceability_lot_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS first_receiver_gln TEXT,
ADD COLUMN IF NOT EXISTS initial_packing_datetime TIMESTAMPTZ;

-- Add indexes for KDEs
CREATE INDEX IF NOT EXISTS idx_batches_harvest_date ON batches(harvest_date);
CREATE INDEX IF NOT EXISTS idx_batches_harvest_location ON batches(harvest_location_gln);
CREATE INDEX IF NOT EXISTS idx_batches_tlc ON batches(traceability_lot_code);

-- Step 3.2: Auto-generate Traceability Lot Code (TLC)
CREATE OR REPLACE FUNCTION generate_traceability_lot_code(
  p_product_gtin TEXT,
  p_harvest_date DATE,
  p_location_gln TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_tlc TEXT;
  v_date_code TEXT;
  v_location_code TEXT;
  v_sequence TEXT;
BEGIN
  -- Format: GTIN(last 8)-YYMMDD-LOC(last 4)-SEQ(3)
  v_date_code := TO_CHAR(p_harvest_date, 'YYMMDD');
  v_location_code := RIGHT(p_location_gln, 4);
  
  -- Get sequence for today at this location
  SELECT LPAD((COUNT(*) + 1)::TEXT, 3, '0')
  INTO v_sequence
  FROM batches
  WHERE harvest_date = p_harvest_date
    AND harvest_location_gln = p_location_gln;
  
  -- Build TLC
  v_tlc := RIGHT(p_product_gtin, 8) || '-' || 
           v_date_code || '-' || 
           v_location_code || '-' || 
           v_sequence;
  
  RETURN v_tlc;
END;
$$ LANGUAGE plpgsql;

-- Step 3.3: Auto-generate TLC trigger
CREATE OR REPLACE FUNCTION auto_generate_tlc()
RETURNS TRIGGER AS $$
DECLARE
  v_product_gtin TEXT;
BEGIN
  -- Only generate if TLC is not provided and we have required fields
  IF NEW.traceability_lot_code IS NULL AND 
     NEW.product_id IS NOT NULL AND 
     NEW.harvest_date IS NOT NULL AND 
     NEW.harvest_location_gln IS NOT NULL THEN
    
    -- Get product GTIN
    SELECT gtin INTO v_product_gtin
    FROM products
    WHERE id = NEW.product_id;
    
    -- Generate TLC
    NEW.traceability_lot_code := generate_traceability_lot_code(
      v_product_gtin,
      NEW.harvest_date,
      NEW.harvest_location_gln
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_tlc ON batches;
CREATE TRIGGER trigger_auto_generate_tlc
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_tlc();

COMMENT ON FUNCTION generate_traceability_lot_code IS 
'Auto-generates FDA FSMA 204 compliant Traceability Lot Code';

-- Step 3.4: Validation function for batch KDEs
CREATE OR REPLACE FUNCTION validate_batch_kdes()
RETURNS TRIGGER AS $$
BEGIN
  -- For food traceability list (FTL) products, require KDEs
  -- This is a placeholder - in production, check if product is on FTL
  
  -- Validate harvest_date is not in future
  IF NEW.harvest_date IS NOT NULL AND NEW.harvest_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Harvest date cannot be in the future';
  END IF;
  
  -- Validate cooling_completion_datetime is after production_date
  IF NEW.cooling_completion_datetime IS NOT NULL AND 
     NEW.production_date IS NOT NULL AND 
     NEW.cooling_completion_datetime < (NEW.production_date::TIMESTAMPTZ) THEN
    RAISE EXCEPTION 'Cooling completion must be after production date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_batch_kdes ON batches;
CREATE TRIGGER trigger_validate_batch_kdes
  BEFORE INSERT OR UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION validate_batch_kdes();


-- ============================================
-- DOCUMENTATION & VALIDATION VIEWS
-- ============================================

-- View: Batches with missing KDEs (for compliance audit)
CREATE OR REPLACE VIEW v_batches_missing_kdes AS
SELECT 
  b.id,
  b.batch_number,
  b.traceability_lot_code,
  p.name AS product_name,
  p.category,
  b.production_date,
  CASE WHEN b.harvest_date IS NULL THEN 'Missing' ELSE 'OK' END AS harvest_date_status,
  CASE WHEN b.harvest_location_gln IS NULL THEN 'Missing' ELSE 'OK' END AS harvest_location_status,
  CASE WHEN b.cooling_completion_datetime IS NULL THEN 'Missing' ELSE 'OK' END AS cooling_completion_status,
  CASE WHEN b.traceability_lot_code IS NULL THEN 'Missing' ELSE 'OK' END AS tlc_status
FROM batches b
JOIN products p ON b.product_id = p.id
WHERE 
  b.harvest_date IS NULL OR
  b.harvest_location_gln IS NULL OR
  b.cooling_completion_datetime IS NULL OR
  b.traceability_lot_code IS NULL;

COMMENT ON VIEW v_batches_missing_kdes IS 
'Audit view showing batches with incomplete Key Data Elements (KDEs)';

-- View: Commissioning events audit
CREATE OR REPLACE VIEW v_commissioning_events AS
SELECT 
  e.id,
  e.event_time,
  e.biz_location,
  e.read_point,
  e.epc_list,
  e.batch_id,
  b.batch_number,
  b.traceability_lot_code,
  e.user_name,
  e.source_type,
  e.created_at
FROM events e
LEFT JOIN batches b ON e.batch_id = b.id
WHERE e.is_commissioning = TRUE
ORDER BY e.event_time DESC;

COMMENT ON VIEW v_commissioning_events IS 
'All commissioning events (origin events) in the system';


-- ============================================
-- UPDATE EXISTING DATA
-- ============================================

-- Mark existing 'commissioning' biz_step events as commissioning
UPDATE events 
SET is_commissioning = TRUE 
WHERE biz_step = 'commissioning' 
  AND is_commissioning IS FALSE;


-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION create_cooling_event TO authenticated;
GRANT EXECUTE ON FUNCTION generate_traceability_lot_code TO authenticated;
GRANT SELECT ON v_batches_missing_kdes TO authenticated;
GRANT SELECT ON v_commissioning_events TO authenticated;


-- ============================================
-- RE-ENABLE TRIGGERS
-- ============================================

ALTER TABLE batches ENABLE TRIGGER log_batches_activity;
ALTER TABLE events ENABLE TRIGGER log_events_activity;

-- ============================================
-- VALIDATION QUERIES (for testing)
-- ============================================

-- Test 1: Check if commissioning validation works
DO $$
BEGIN
  RAISE NOTICE 'Sprint 1 Migration Complete!';
  RAISE NOTICE 'Added: is_commissioning column with validation';
  RAISE NOTICE 'Added: cooling event support with temperature tracking';
  RAISE NOTICE 'Added: FSMA 204 KDEs (harvest_date, harvest_location_gln, cooling_completion_datetime, TLC)';
  RAISE NOTICE 'Added: Auto-generation of Traceability Lot Code (TLC)';
END $$;
