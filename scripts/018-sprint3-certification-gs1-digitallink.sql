-- ============================================
-- SPRINT 3: CERTIFICATION VALIDATION + GS1 DIGITAL LINK
-- GS1 EPCIS 2.0 Compliance Enhancement
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_events_activity') THEN
    ALTER TABLE events DISABLE TRIGGER log_events_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_certifications_activity') THEN
    ALTER TABLE certifications DISABLE TRIGGER log_certifications_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_digital_links_activity') THEN
    ALTER TABLE digital_links DISABLE TRIGGER log_digital_links_activity;
  END IF;
END $$;

-- ============================================
-- TASK 7: CERTIFICATION VALIDATION
-- ============================================

-- Function: Validate certifications when creating event
CREATE OR REPLACE FUNCTION validate_event_certifications()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cert_id UUID;
  v_cert_status TEXT;
  v_cert_expiry DATE;
  v_cert_type TEXT;
  v_issued_to_type TEXT;
  v_issued_to_id UUID;
  v_location_id UUID;
  v_batch_id UUID;
  v_invalid_certs TEXT[] := '{}';
BEGIN
  -- Skip validation if no certifications provided
  IF NEW.certification_ids IS NULL OR array_length(NEW.certification_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get event context
  v_location_id := (SELECT id FROM locations WHERE gln = NEW.biz_location LIMIT 1);
  v_batch_id := NEW.batch_id;

  -- Validate each certification
  FOREACH v_cert_id IN ARRAY NEW.certification_ids
  LOOP
    -- Get certification details
    SELECT status, expiry_date, certification_type, issued_to_type, issued_to_id
    INTO v_cert_status, v_cert_expiry, v_cert_type, v_issued_to_type, v_issued_to_id
    FROM certifications
    WHERE id = v_cert_id;

    -- Check if certification exists
    IF NOT FOUND THEN
      v_invalid_certs := array_append(v_invalid_certs, 
        v_cert_id::TEXT || ' (not found)');
      CONTINUE;
    END IF;

    -- Check if certification is active
    IF v_cert_status != 'active' THEN
      v_invalid_certs := array_append(v_invalid_certs, 
        v_cert_id::TEXT || ' (status: ' || v_cert_status || ')');
      CONTINUE;
    END IF;

    -- Check if certification is expired
    IF v_cert_expiry < CURRENT_DATE THEN
      v_invalid_certs := array_append(v_invalid_certs, 
        v_cert_id::TEXT || ' (expired on ' || v_cert_expiry || ')');
      CONTINUE;
    END IF;

    -- Validate scope: certification must be issued to related entity
    IF v_issued_to_type = 'location' AND v_issued_to_id != v_location_id THEN
      v_invalid_certs := array_append(v_invalid_certs, 
        v_cert_id::TEXT || ' (not valid for this location)');
      CONTINUE;
    ELSIF v_issued_to_type = 'batch' AND v_issued_to_id != v_batch_id THEN
      v_invalid_certs := array_append(v_invalid_certs, 
        v_cert_id::TEXT || ' (not valid for this batch)');
      CONTINUE;
    END IF;
  END LOOP;

  -- Raise error if any invalid certifications found
  IF array_length(v_invalid_certs, 1) > 0 THEN
    RAISE EXCEPTION 'Event validation failed: Invalid certifications: %', 
      array_to_string(v_invalid_certs, ', ')
    USING HINT = 'Ensure all certifications are active, not expired, and applicable to this event';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for certification validation
DROP TRIGGER IF EXISTS validate_certifications_on_event ON events;
CREATE TRIGGER validate_certifications_on_event
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  WHEN (NEW.certification_ids IS NOT NULL)
  EXECUTE FUNCTION validate_event_certifications();

COMMENT ON FUNCTION validate_event_certifications() IS 
'GS1 EPCIS 2.0: Validates that all certifications referenced in an event are active, not expired, and applicable to the event context';

-- ============================================
-- VIEW: Expiring Certifications (Already exists, enhance it)
-- ============================================

-- Drop existing view to allow column structure changes
DROP VIEW IF EXISTS v_expiring_certifications CASCADE;

CREATE VIEW v_expiring_certifications AS
SELECT 
  c.id,
  c.certification_type,
  c.certification_body,
  c.certificate_number,
  c.issued_to_type,
  c.issued_to_id,
  c.issue_date,
  c.expiry_date,
  c.status,
  c.certificate_url,
  c.verification_url,
  c.created_at,
  (c.expiry_date - CURRENT_DATE) AS days_until_expiry,
  CASE 
    WHEN c.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN c.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'critical'
    WHEN c.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'warning'
    ELSE 'ok'
  END AS alert_level,
  CASE c.issued_to_type
    WHEN 'location' THEN (SELECT name FROM locations WHERE id = c.issued_to_id)
    WHEN 'batch' THEN (SELECT batch_number FROM batches WHERE id = c.issued_to_id)
    WHEN 'partner' THEN (SELECT company_name FROM partners WHERE id = c.issued_to_id)
    ELSE 'Unknown'
  END AS issued_to_name
FROM certifications c
WHERE c.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
  OR c.status != 'active'
ORDER BY c.expiry_date ASC;

COMMENT ON VIEW v_expiring_certifications IS 
'Shows certifications expiring within 90 days with alert levels (critical: <30 days, warning: <90 days)';

-- ============================================
-- TASK 8: GS1 DIGITAL LINK ENHANCEMENT
-- ============================================

-- First, add missing columns to digital_links table
DO $$ 
BEGIN
  -- Add batch_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'digital_links' AND column_name = 'batch_number'
  ) THEN
    ALTER TABLE digital_links ADD COLUMN batch_number TEXT;
    CREATE INDEX IF NOT EXISTS idx_digital_links_batch_number ON digital_links(batch_number);
  END IF;

  -- Add link_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'digital_links' AND column_name = 'link_type'
  ) THEN
    ALTER TABLE digital_links ADD COLUMN link_type TEXT DEFAULT 'pip';
  END IF;

  -- Add target_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'digital_links' AND column_name = 'target_url'
  ) THEN
    ALTER TABLE digital_links ADD COLUMN target_url TEXT;
  END IF;

  -- Add qr_code_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'digital_links' AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE digital_links ADD COLUMN qr_code_data TEXT;
  END IF;

  -- Add expiry_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'digital_links' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE digital_links ADD COLUMN expiry_date DATE;
  END IF;
END $$;

-- Function: Generate GS1 Digital Link URL
-- Standard format: https://id.gs1.org/01/{GTIN}/10/{LOT}/21/{SERIAL}?linkType={type}
DROP FUNCTION IF EXISTS generate_gs1_digital_link CASCADE;
CREATE FUNCTION generate_gs1_digital_link(
  p_gtin TEXT,
  p_lot TEXT DEFAULT NULL,
  p_serial TEXT DEFAULT NULL,
  p_link_type TEXT DEFAULT 'pip', -- 'pip' (product info), 'certificationInfo', 'traceability'
  p_target_url TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL
)
RETURNS TABLE (
  digital_link_id UUID,
  gs1_url TEXT,
  short_url TEXT,
  qr_code_data TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_link_id UUID;
  v_gs1_url TEXT;
  v_short_url TEXT;
  v_base_url TEXT := 'https://id.gs1.org';
  v_target_url TEXT;
  v_batch_id UUID;
  v_batch_number TEXT;
BEGIN
  -- Validate GTIN
  IF p_gtin IS NULL OR length(p_gtin) NOT IN (8, 12, 13, 14) THEN
    RAISE EXCEPTION 'Invalid GTIN: must be 8, 12, 13, or 14 digits';
  END IF;

  -- Get batch info if lot is provided
  IF p_lot IS NOT NULL THEN
    SELECT id, batch_number INTO v_batch_id, v_batch_number
    FROM batches 
    WHERE batch_number = p_lot
    LIMIT 1;
  END IF;

  -- Build GS1 Digital Link URL
  -- Format: https://id.gs1.org/01/{GTIN}/10/{LOT}/21/{SERIAL}
  v_gs1_url := v_base_url || '/01/' || p_gtin;
  
  IF p_lot IS NOT NULL THEN
    v_gs1_url := v_gs1_url || '/10/' || p_lot;
  END IF;
  
  IF p_serial IS NOT NULL THEN
    v_gs1_url := v_gs1_url || '/21/' || p_serial;
  END IF;

  -- Add query parameters
  v_target_url := COALESCE(p_target_url, 
    'https://' || current_setting('app.settings.domain', true) || '/product/' || p_gtin);
  
  v_gs1_url := v_gs1_url || '?linkType=' || p_link_type;

  -- Generate short URL (8 random alphanumeric chars)
  v_short_url := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

  -- Insert into digital_links table
  INSERT INTO digital_links (
    gtin,
    lot,
    serial,
    link_type,
    target_url,
    short_url,
    qr_code_data,
    expiry_date,
    batch_number,
    epc,
    metadata
  )
  VALUES (
    p_gtin,
    p_lot,
    p_serial,
    p_link_type,
    v_target_url,
    v_short_url,
    v_gs1_url, -- Store GS1 URL as QR code data
    p_expiry_date,
    v_batch_number,
    CASE 
      WHEN p_serial IS NOT NULL THEN 'urn:epc:id:sgtin:' || substring(p_gtin from 1 for 6) || '.' || substring(p_gtin from 7) || '.' || p_serial
      ELSE NULL
    END,
    jsonb_build_object(
      'gs1_url', v_gs1_url,
      'created_by', 'system',
      'batch_id', v_batch_id
    )
  )
  RETURNING id INTO v_link_id;

  -- Return result
  RETURN QUERY
  SELECT 
    v_link_id,
    v_gs1_url,
    v_short_url,
    v_gs1_url; -- QR code should encode the GS1 Digital Link URL
END;
$$;

COMMENT ON FUNCTION generate_gs1_digital_link IS 
'GS1 Digital Link: Generates standard GS1 Digital Link URL with format https://id.gs1.org/01/{GTIN}/10/{LOT}/21/{SERIAL}?linkType={type}';

-- Function: Resolve GS1 Digital Link short URL
CREATE OR REPLACE FUNCTION resolve_digital_link(p_short_url TEXT)
RETURNS TABLE (
  gtin TEXT,
  lot TEXT,
  serial TEXT,
  link_type TEXT,
  target_url TEXT,
  gs1_url TEXT,
  batch_info JSONB,
  product_info JSONB,
  access_count INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_link digital_links%ROWTYPE;
BEGIN
  -- Get digital link
  SELECT * INTO v_link
  FROM digital_links
  WHERE short_url = p_short_url;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Digital link not found: %', p_short_url;
  END IF;

  -- Update access count
  UPDATE digital_links
  SET access_count = access_count + 1,
      updated_at = NOW()
  WHERE short_url = p_short_url;

  -- Return comprehensive data
  RETURN QUERY
  SELECT 
    v_link.gtin,
    v_link.lot,
    v_link.serial,
    v_link.link_type,
    v_link.target_url,
    v_link.qr_code_data AS gs1_url,
    (
      SELECT jsonb_build_object(
        'batch_id', b.id,
        'batch_number', b.batch_number,
        'production_date', b.production_date,
        'expiry_date', b.expiry_date,
        'quality_status', b.quality_status,
        'traceability_lot_code', b.traceability_lot_code
      )
      FROM batches b
      WHERE b.batch_number = v_link.lot
      LIMIT 1
    ) AS batch_info,
    (
      SELECT jsonb_build_object(
        'gtin', p.gtin,
        'name', p.name,
        'description', p.description,
        'category', p.category
      )
      FROM products p
      WHERE p.gtin = v_link.gtin
      LIMIT 1
    ) AS product_info,
    v_link.access_count + 1;
END;
$$;

COMMENT ON FUNCTION resolve_digital_link IS 
'Resolves a short URL to full GS1 Digital Link with product and batch information';

-- Function: Auto-generate digital links for new batches
CREATE OR REPLACE FUNCTION auto_generate_digital_link_for_batch()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_gtin TEXT;
  v_result RECORD;
BEGIN
  -- Get product GTIN
  SELECT gtin INTO v_gtin
  FROM products
  WHERE id = NEW.product_id;

  IF v_gtin IS NULL THEN
    RETURN NEW;
  END IF;

  -- Generate GS1 Digital Link for this batch
  SELECT * INTO v_result
  FROM generate_gs1_digital_link(
    p_gtin := v_gtin,
    p_lot := NEW.batch_number,
    p_serial := NULL,
    p_link_type := 'pip', -- Product Information Page
    p_target_url := NULL, -- Use default
    p_expiry_date := NEW.expiry_date
  );

  RAISE NOTICE 'Auto-generated GS1 Digital Link for batch %: % (short: %)', 
    NEW.batch_number, v_result.gs1_url, v_result.short_url;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate digital links for new batches
DROP TRIGGER IF EXISTS auto_generate_batch_digital_link ON batches;
CREATE TRIGGER auto_generate_batch_digital_link
  AFTER INSERT ON batches
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_digital_link_for_batch();

COMMENT ON FUNCTION auto_generate_digital_link_for_batch IS 
'Automatically generates GS1 Digital Link when a new batch is created';

-- ============================================
-- ENHANCED VIEW: Digital Links with Full Info
-- ============================================

DROP VIEW IF EXISTS v_digital_links_full CASCADE;
CREATE VIEW v_digital_links_full AS
SELECT 
  dl.id,
  dl.gtin,
  dl.lot,
  dl.serial,
  dl.batch_number,
  dl.link_type,
  dl.target_url,
  dl.short_url,
  dl.qr_code_data AS gs1_digital_link_url,
  dl.expiry_date,
  dl.access_count,
  dl.metadata,
  dl.created_at,
  dl.updated_at,
  
  -- Product info
  p.name AS product_name,
  
  -- Batch info
  b.id AS batch_id,
  b.traceability_lot_code,
  b.production_date AS batch_production_date,
  b.quality_status AS batch_quality_status
  
FROM digital_links dl
LEFT JOIN products p ON p.gtin = dl.gtin
LEFT JOIN batches b ON b.batch_number = dl.batch_number
ORDER BY dl.created_at DESC;

COMMENT ON VIEW v_digital_links_full IS 
'Complete view of digital links with product and batch information for QR code generation';

-- ============================================
-- COMPLIANCE VIEW: Sprint 3 Status
-- ============================================

CREATE OR REPLACE VIEW v_sprint3_compliance_summary AS
SELECT 
  'Certification Validation' AS feature,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_certifications_on_event') 
    THEN 'Implemented' 
    ELSE 'Missing' 
  END AS status,
  'Validates certifications on event creation - checks active status, expiry, and scope' AS details
UNION ALL
SELECT 
  'Expiring Certifications View',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_expiring_certifications') 
    THEN 'Implemented' 
    ELSE 'Missing' 
  END,
  (SELECT COUNT(*)::TEXT || ' certifications expiring within 90 days' 
   FROM v_expiring_certifications 
   WHERE alert_level IN ('critical', 'warning'))
UNION ALL
SELECT 
  'GS1 Digital Link Generation',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_gs1_digital_link') 
    THEN 'Implemented' 
    ELSE 'Missing' 
  END,
  'Generates standard GS1 Digital Link URLs with format https://id.gs1.org/01/{GTIN}/10/{LOT}'
UNION ALL
SELECT 
  'Auto Digital Link for Batches',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_generate_batch_digital_link') 
    THEN 'Implemented' 
    ELSE 'Missing' 
  END,
  'Automatically creates GS1 Digital Links when new batches are created'
UNION ALL
SELECT 
  'Digital Link Resolution',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_digital_link') 
    THEN 'Implemented' 
    ELSE 'Missing' 
  END,
  'Resolves short URLs to full product/batch data with access tracking';

-- ============================================
-- RE-ENABLE TRIGGERS
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_events_activity') THEN
    ALTER TABLE events ENABLE TRIGGER log_events_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_certifications_activity') THEN
    ALTER TABLE certifications ENABLE TRIGGER log_certifications_activity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_digital_links_activity') THEN
    ALTER TABLE digital_links ENABLE TRIGGER log_digital_links_activity;
  END IF;
END $$;

-- ============================================
-- VALIDATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Sprint 3 Migration Complete!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Task 7: Certification Validation';
  RAISE NOTICE '  ✓ validate_event_certifications() function';
  RAISE NOTICE '  ✓ Trigger on events table';
  RAISE NOTICE '  ✓ v_expiring_certifications view';
  RAISE NOTICE '';
  RAISE NOTICE 'Task 8: GS1 Digital Link Enhancement';
  RAISE NOTICE '  ✓ generate_gs1_digital_link() function';
  RAISE NOTICE '  ✓ resolve_digital_link() function';
  RAISE NOTICE '  ✓ auto_generate_batch_digital_link trigger';
  RAISE NOTICE '  ✓ v_digital_links_full view';
  RAISE NOTICE '';
  RAISE NOTICE 'Check compliance: SELECT * FROM v_sprint3_compliance_summary;';
  RAISE NOTICE '==============================================';
END $$;
