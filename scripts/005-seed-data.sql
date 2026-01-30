-- ============================================
-- COMPREHENSIVE SEED DATA
-- Dữ liệu mẫu đầy đủ để test toàn bộ hệ thống
-- ============================================

-- Xóa dữ liệu cũ (nếu có) - CHỈ cho dev/testing
-- TRUNCATE TABLE audit_log, ai_processing_queue, shipments, product_recipes, 
-- certifications, batches, location_hierarchy, partners, digital_links, 
-- ai_processing_logs, events, users, products, locations RESTART IDENTITY CASCADE;

-- ============================================
-- 1. USERS
-- LƯU Ý QUAN TRỌNG:
-- Bảng users extends từ auth.users của Supabase.
-- Users PHẢI được tạo qua trang đăng ký (/auth/signup) trước.
-- Sau khi đăng ký, user profile sẽ tự động được tạo qua trigger.
-- 
-- Để test, vui lòng:
-- 1. Truy cập /auth/signup
-- 2. Tạo user với các thông tin:
--    - Email: admin@test.com, Password: Admin123!
--    - Full name: Admin User, Role: admin
-- ============================================

-- File seed này không tạo users để tránh conflict với auth system

-- ============================================
-- 2. LOCATIONS (GLN Hierarchy)
-- Farm → Factory → Warehouse → Retailer
-- ============================================

INSERT INTO locations (gln, name, type, address, coordinates, metadata) VALUES
  -- Farms
  ('8541111111111', 'Trang trại Cà phê Đà Lạt', 'farm', 
   '{"street": "123 Đường Trần Phú", "city": "Đà Lạt", "province": "Lâm Đồng", "country": "Vietnam"}',
   '{"lat": 11.9404, "lng": 108.4583}',
   '{"area_hectares": 50, "established": 2010, "owner": "Hợp tác xã Nông dân Đà Lạt"}'::jsonb),
  
  ('8541111111112', 'Trang trại Rau sạch Đà Lạt', 'farm',
   '{"street": "456 Đường Xuân Hương", "city": "Đà Lạt", "province": "Lâm Đồng", "country": "Vietnam"}',
   '{"lat": 11.9450, "lng": 108.4500}',
   '{"area_hectares": 20, "established": 2015, "certifications": ["organic", "vietgap"]}'::jsonb),
  
  ('8541111111113', 'Trang trại Chè Bảo Lộc', 'farm',
   '{"street": "789 Quốc lộ 20", "city": "Bảo Lộc", "province": "Lâm Đồng", "country": "Vietnam"}',
   '{"lat": 11.5488, "lng": 107.8086}',
   '{"area_hectares": 30, "established": 2008, "tea_varieties": ["oolong", "green_tea"]}'::jsonb),
  
  -- Factories
  ('8541222222222', 'Nhà máy Chế biến Cà phê XYZ', 'factory',
   '{"street": "1234 Đường Quốc lộ 1A", "district": "Bình Tân", "city": "Hồ Chí Minh", "country": "Vietnam"}',
   '{"lat": 10.7626, "lng": 106.6600}',
   '{"capacity_tons_per_day": 10, "certifications": ["haccp", "iso22000"], "employees": 150}'::jsonb),
  
  ('8541222222223', 'Nhà máy Đóng gói Thực phẩm ABC', 'factory',
   '{"street": "567 Đường Lũy Bán Bích", "district": "Tân Phú", "city": "Hồ Chí Minh", "country": "Vietnam"}',
   '{"lat": 10.7850, "lng": 106.6250}',
   '{"capacity_packages_per_hour": 5000, "certifications": ["gmp", "brc"], "employees": 80}'::jsonb),
  
  -- Warehouses
  ('8541333333333', 'Kho Trung tâm Miền Nam', 'warehouse',
   '{"street": "999 Đường Nguyễn Văn Linh", "district": "Quận 7", "city": "Hồ Chí Minh", "country": "Vietnam"}',
   '{"lat": 10.7323, "lng": 106.7221}',
   '{"capacity_tons": 1000, "cold_storage": true, "temperature_controlled": true}'::jsonb),
  
  ('8541333333334', 'Kho Miền Bắc', 'warehouse',
   '{"street": "888 Đường Giải Phóng", "district": "Hoàng Mai", "city": "Hà Nội", "country": "Vietnam"}',
   '{"lat": 20.9817, "lng": 105.8414}',
   '{"capacity_tons": 800, "cold_storage": false}'::jsonb),
  
  -- Retailers
  ('8541444444444', 'Siêu thị Co.opMart Quận 7', 'retailer',
   '{"street": "123 Nguyễn Thị Thập", "district": "Quận 7", "city": "Hồ Chí Minh", "country": "Vietnam"}',
   '{"lat": 10.7290, "lng": 106.7190}',
   '{"store_size_sqm": 2000, "daily_customers": 5000}'::jsonb),
  
  ('8541444444445', 'Cửa hàng Organic Mart Đà Lạt', 'retailer',
   '{"street": "45 Đường 3 Tháng 2", "city": "Đà Lạt", "province": "Lâm Đồng", "country": "Vietnam"}',
   '{"lat": 11.9380, "lng": 108.4380}',
   '{"specialty": "organic_products", "store_size_sqm": 500}'::jsonb)
ON CONFLICT (gln) DO NOTHING;

-- ============================================
-- 3. LOCATION HIERARCHY
-- ============================================

INSERT INTO location_hierarchy (parent_location_id, child_location_id, relationship_type) 
SELECT 
  p.id, c.id, 'ships_to'
FROM locations p
CROSS JOIN locations c
WHERE (p.gln, c.gln) IN (
  ('8541111111111', '8541222222222'), -- Farm → Factory
  ('8541111111112', '8541222222223'), -- Farm → Factory
  ('8541111111113', '8541222222222'), -- Farm → Factory
  ('8541222222222', '8541333333333'), -- Factory → Warehouse
  ('8541222222223', '8541333333333'), -- Factory → Warehouse
  ('8541333333333', '8541444444444'), -- Warehouse → Retailer
  ('8541333333333', '8541444444445')  -- Warehouse → Retailer
)
ON CONFLICT ON CONSTRAINT unique_location_relationship DO NOTHING;

-- ============================================
-- 4. PRODUCTS (GTIN)
-- ============================================

INSERT INTO products (gtin, name, description, category, unit, metadata) VALUES
  -- Coffee Products
  ('08541000000001', 'Cà phê hạt Arabica nguyên chất', 'Cà phê Arabica 100% từ Đà Lạt, độ cao 1500m', 'coffee', 'kg',
   '{"origin": "Dalat", "altitude_m": 1500, "roast_level": "medium", "flavor_notes": ["chocolate", "caramel", "nutty"]}'::jsonb),
  
  ('08541000000002', 'Cà phê rang xay Premium', 'Cà phê đã rang xay sẵn, đóng gói 500g', 'coffee', 'pack',
   '{"net_weight_g": 500, "roast_date": "2025-01-15", "best_before_months": 6}'::jsonb),
  
  ('08541000000003', 'Cold Brew Coffee Concentrate', 'Cà phê ủ lạnh đậm đặc, pha loãng 1:4', 'coffee', 'bottle',
   '{"volume_ml": 500, "brewing_time_hours": 16, "caffeine_content_mg": 200}'::jsonb),
  
  -- Vegetables
  ('08541000000011', 'Rau cải xanh hữu cơ', 'Rau cải xanh trồng theo phương pháp hữu cơ', 'vegetable', 'kg',
   '{"organic": true, "pesticide_free": true, "harvest_cycle_days": 30}'::jsonb),
  
  ('08541000000012', 'Cà chua bi hữu cơ', 'Cà chua bi đỏ, ngọt tự nhiên', 'vegetable', 'kg',
   '{"organic": true, "variety": "cherry_tomato", "sugar_content_brix": 8}'::jsonb),
  
  ('08541000000013', 'Salad mix hữu cơ', 'Hỗn hợp rau salad đã rửa sạch, đóng gói 200g', 'vegetable', 'pack',
   '{"net_weight_g": 200, "ready_to_eat": true, "shelf_life_days": 5}'::jsonb),
  
  -- Tea Products
  ('08541000000021', 'Trà Oolong Bảo Lộc', 'Trà Oolong cao cấp từ Bảo Lộc', 'tea', 'pack',
   '{"net_weight_g": 100, "fermentation_level": "30%", "harvest_season": "spring"}'::jsonb),
  
  ('08541000000022', 'Trà xanh hữu cơ', 'Trà xanh chất lượng cao, chứng nhận hữu cơ', 'tea', 'pack',
   '{"net_weight_g": 50, "organic": true, "oxidation_level": "0%"}'::jsonb),
  
  -- Processed Foods
  ('08541000000031', 'Mứt dâu tây Đà Lạt', 'Mứt dâu tây tự nhiên, không chất bảo quản', 'processed', 'jar',
   '{"net_weight_g": 250, "sugar_content_percent": 45, "fruit_content_percent": 60}'::jsonb),
  
  ('08541000000032', 'Sữa chua trái cây hữu cơ', 'Sữa chua làm từ sữa tươi và trái cây hữu cơ', 'processed', 'cup',
   '{"volume_ml": 150, "probiotic_count": "1 billion CFU", "shelf_life_days": 14}'::jsonb)
ON CONFLICT (gtin) DO NOTHING;

-- ============================================
-- 5. PARTNERS
-- ============================================

INSERT INTO partners (partner_type, company_name, gln, contact_person, email, phone, address, business_license, status, verified, rating, metadata) VALUES
  ('supplier', 'Hợp tác xã Nông dân Đà Lạt', '8501111111111', 'Nguyễn Văn A', 'contact@dalat-coop.vn', '+84912345001', 
   '{"city": "Đà Lạt", "province": "Lâm Đồng"}'::jsonb, 'BL-2010-001', 'active', TRUE, 4.8,
   '{"total_farmers": 150, "total_area_hectares": 500, "main_products": ["coffee", "vegetables"]}'::jsonb),
  
  ('supplier', 'Cooperative Rau sạch Lâm Đồng', '8501111111112', 'Trần Thị B', 'info@veggie-coop.vn', '+84912345002',
   '{"city": "Đà Lạt", "province": "Lâm Đồng"}'::jsonb, 'BL-2015-002', 'active', TRUE, 4.9,
   '{"total_farmers": 80, "organic_certified": true, "certifications": ["vietgap", "organic"]}'::jsonb),
  
  ('manufacturer', 'Công ty TNHH Chế biến XYZ', '8502222222222', 'Lê Văn C', 'sales@xyz-processing.vn', '+84912345003',
   '{"city": "Hồ Chí Minh", "district": "Bình Tân"}'::jsonb, 'BL-2012-003', 'active', TRUE, 4.7,
   '{"production_capacity_tons_per_month": 300, "export_markets": ["USA", "EU", "Japan"]}'::jsonb),
  
  ('distributor', 'Công ty Phân phối Thực phẩm DEF', '8503333333333', 'Phạm Thị D', 'logistics@def-distro.vn', '+84912345004',
   '{"city": "Hồ Chí Minh", "district": "Quận 7"}'::jsonb, 'BL-2018-004', 'active', TRUE, 4.6,
   '{"warehouse_locations": 5, "delivery_fleet": 50, "coverage": "nationwide"}'::jsonb),
  
  ('retailer', 'Siêu thị Co.opMart', '8504444444444', 'Hoàng Văn E', 'purchasing@coopmart.vn', '+84912345005',
   '{"city": "Hồ Chí Minh"}'::jsonb, 'BL-2005-005', 'active', TRUE, 4.9,
   '{"total_stores": 100, "customer_base": 2000000, "store_format": "supermarket"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. CERTIFICATIONS
-- ============================================

INSERT INTO certifications (certification_type, certification_body, certificate_number, issued_to_type, issued_to_id, issue_date, expiry_date, status, certificate_url, metadata) 
SELECT 
  'organic',
  'USDA Organic',
  'CERT-ORG-2024-' || LPAD(ROW_NUMBER() OVER()::TEXT, 3, '0'),
  'location',
  l.id,
  CURRENT_DATE - INTERVAL '6 months',
  CURRENT_DATE + INTERVAL '18 months',
  'active',
  'https://certificates.usda.gov/example',
  '{"scope": "coffee_production", "inspector": "John Smith", "audit_date": "2024-07-15"}'::jsonb
FROM locations l
WHERE l.gln IN ('8541111111111', '8541111111112')
ON CONFLICT (certificate_number) DO NOTHING;

INSERT INTO certifications (certification_type, certification_body, certificate_number, issued_to_type, issued_to_id, issue_date, expiry_date, status, metadata)
SELECT 
  'haccp',
  'HACCP International',
  'CERT-HACCP-2024-001',
  'location',
  l.id,
  CURRENT_DATE - INTERVAL '1 year',
  CURRENT_DATE + INTERVAL '2 years',
  'active',
  '{"scope": "food_processing", "critical_control_points": 12}'::jsonb
FROM locations l
WHERE l.gln = '8541222222222'
ON CONFLICT (certificate_number) DO NOTHING;

INSERT INTO certifications (certification_type, certification_body, certificate_number, issued_to_type, issued_to_id, issue_date, expiry_date, status, metadata)
SELECT 
  'fair_trade',
  'Fair Trade International',
  'CERT-FT-2024-001',
  'product',
  p.id,
  CURRENT_DATE - INTERVAL '3 months',
  CURRENT_DATE + INTERVAL '21 months',
  'active',
  '{"premium_percentage": 10, "community_projects": ["school", "clean_water"]}'::jsonb
FROM products p
WHERE p.gtin = '08541000000001'
ON CONFLICT (certificate_number) DO NOTHING;

-- ============================================
-- 7. BATCHES
-- ============================================

INSERT INTO batches (batch_number, product_id, location_id, production_date, expiry_date, quantity_produced, quantity_available, unit_of_measure, quality_status, quality_tested_at, quality_notes, metadata)
SELECT 
  p.gtin || '-BATCH-' || TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYYMMDD'),
  p.id,
  l.id,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '12 months',
  1000,
  850,
  'kg',
  'approved',
  CURRENT_DATE - INTERVAL '29 days',
  '{"moisture_content": 12.5, "defect_rate": 0.5, "cup_score": 86}'::jsonb,
  '{"harvest_date": "2024-12-01", "processing_method": "washed", "drying_days": 14}'::jsonb
FROM products p
CROSS JOIN locations l
WHERE p.gtin = '08541000000001' AND l.gln = '8541222222222'
ON CONFLICT (batch_number) DO NOTHING;

INSERT INTO batches (batch_number, product_id, location_id, production_date, expiry_date, quantity_produced, quantity_available, unit_of_measure, quality_status, quality_tested_at, metadata)
SELECT 
  p.gtin || '-BATCH-' || TO_CHAR(CURRENT_DATE - INTERVAL '7 days', 'YYYYMMDD'),
  p.id,
  l.id,
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '6 months',
  500,
  500,
  'pack',
  'approved',
  CURRENT_DATE - INTERVAL '6 days',
  '{"roast_profile": "medium", "batch_temperature": 220, "roast_time_minutes": 15}'::jsonb
FROM products p
CROSS JOIN locations l
WHERE p.gtin = '08541000000002' AND l.gln = '8541222222222'
ON CONFLICT (batch_number) DO NOTHING;

INSERT INTO batches (batch_number, product_id, location_id, production_date, expiry_date, quantity_produced, quantity_available, unit_of_measure, quality_status, quality_tested_at, metadata)
SELECT 
  p.gtin || '-BATCH-' || TO_CHAR(CURRENT_DATE - INTERVAL '2 days', 'YYYYMMDD'),
  p.id,
  l.id,
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '5 days',
  200,
  180,
  'kg',
  'approved',
  CURRENT_DATE - INTERVAL '1 day',
  '{"freshness_score": 9.5, "visual_inspection": "excellent", "no_defects": true}'::jsonb
FROM products p
CROSS JOIN locations l
WHERE p.gtin = '08541000000011' AND l.gln = '8541111111112'
ON CONFLICT (batch_number) DO NOTHING;

-- ============================================
-- 8. EVENTS (EPCIS 2.0)
-- ============================================

-- Event 1: ObjectEvent - Coffee harvest
INSERT INTO events (
  event_type, event_time, epc_list, biz_step, disposition,
  read_point, biz_location, source_type,
  epcis_document, ai_metadata
)
SELECT 
  'ObjectEvent',
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  '["urn:epc:id:sgtin:0854100.000000.12345"]'::jsonb,
  'commissioning',
  'active',
  l.gln,
  l.gln,
  'manual',
  jsonb_build_object(
    '@context', 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonb',
    'type', 'ObjectEvent',
    'eventTime', TO_CHAR(CURRENT_TIMESTAMP - INTERVAL '30 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'action', 'OBSERVE',
    'bizStep', 'commissioning',
    'disposition', 'active',
    'readPoint', jsonb_build_object('id', 'urn:epc:id:sgln:' || l.gln),
    'epcList', jsonb_build_array('urn:epc:id:sgtin:0854100.000000.12345'),
    'quantityList', jsonb_build_array(
      jsonb_build_object(
        'epcClass', 'urn:epc:class:lgtin:' || p.gtin,
        'quantity', 1000,
        'uom', 'KGM'
      )
    )
  ),
  '{"weather": "sunny", "harvest_team_size": 20, "notes": "Good harvest season"}'::jsonb
FROM locations l
CROSS JOIN products p
WHERE l.gln = '8541111111111' AND p.gtin = '08541000000001'
LIMIT 1;

-- Event 2: TransformationEvent - Coffee processing
INSERT INTO events (
  event_type, event_time, biz_step, disposition,
  read_point, biz_location, source_type,
  input_epc_list, output_epc_list,
  input_quantity, output_quantity,
  epcis_document, ai_metadata
)
SELECT 
  'TransformationEvent',
  CURRENT_TIMESTAMP - INTERVAL '25 days',
  'transforming',
  'in_progress',
  l.gln,
  l.gln,
  'manual',
  '["urn:epc:id:sgtin:0854100.000000.12345"]'::jsonb,
  '["urn:epc:id:sgtin:0854100.000001.67890"]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('value', 1000, 'uom', 'KGM', 'gtin', '08541000000001')
  ),
  jsonb_build_array(
    jsonb_build_object('value', 500, 'uom', 'PACK', 'gtin', '08541000000002')
  ),
  jsonb_build_object(
    '@context', 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonb',
    'type', 'TransformationEvent',
    'eventTime', TO_CHAR(CURRENT_TIMESTAMP - INTERVAL '25 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'bizStep', 'transforming',
    'disposition', 'in_progress',
    'readPoint', jsonb_build_object('id', 'urn:epc:id:sgln:' || l.gln),
    'inputQuantityList', jsonb_build_array(
      jsonb_build_object('epcClass', 'urn:epc:class:lgtin:08541000000001', 'quantity', 1000, 'uom', 'KGM')
    ),
    'outputQuantityList', jsonb_build_array(
      jsonb_build_object('epcClass', 'urn:epc:class:lgtin:08541000000002', 'quantity', 500, 'uom', 'PACK')
    )
  ),
  '{"roasting_temperature": 220, "roasting_time_minutes": 15, "operator": "Nguyen Van B"}'::jsonb
FROM locations l
WHERE l.gln = '8541222222222'
LIMIT 1;

-- Event 3: AggregationEvent - Packaging
INSERT INTO events (
  event_type, event_time, epc_list, biz_step, disposition,
  read_point, biz_location, source_type,
  epcis_document, ai_metadata
)
SELECT 
  'AggregationEvent',
  CURRENT_TIMESTAMP - INTERVAL '20 days',
  '["urn:epc:id:sgtin:0854100.000001.67890", "urn:epc:id:sgtin:0854100.000001.67891"]'::jsonb,
  'packing',
  'in_progress',
  l.gln,
  l.gln,
  'vision_ai',
  jsonb_build_object(
    '@context', 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonb',
    'type', 'AggregationEvent',
    'eventTime', TO_CHAR(CURRENT_TIMESTAMP - INTERVAL '20 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'action', 'ADD',
    'bizStep', 'packing',
    'disposition', 'in_progress',
    'readPoint', jsonb_build_object('id', 'urn:epc:id:sgln:' || l.gln),
    'parentID', 'urn:epc:id:sscc:0854100.1234567890',
    'childEPCs', jsonb_build_array(
      'urn:epc:id:sgtin:0854100.000001.67890',
      'urn:epc:id:sgtin:0854100.000001.67891'
    )
  ),
  '{"pallet_id": "SSCC-0854100-1234567890", "total_packages": 50}'::jsonb
FROM locations l
WHERE l.gln = '8541222222223'
LIMIT 1;

-- Event 4: TransactionEvent - Shipment
INSERT INTO events (
  event_type, event_time, epc_list, biz_step, disposition,
  read_point, biz_location, source_type,
  epcis_document, ai_metadata
)
SELECT 
  'TransactionEvent',
  CURRENT_TIMESTAMP - INTERVAL '15 days',
  '["urn:epc:id:sscc:0854100.1234567890"]'::jsonb,
  'shipping',
  'in_transit',
  l_from.gln,
  l_from.gln,
  'manual',
  jsonb_build_object(
    '@context', 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonb',
    'type', 'TransactionEvent',
    'eventTime', TO_CHAR(CURRENT_TIMESTAMP - INTERVAL '15 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'action', 'ADD',
    'bizStep', 'shipping',
    'disposition', 'in_transit',
    'bizTransactionList', jsonb_build_array(
      jsonb_build_object('type', 'po', 'bizTransaction', 'PO-2025-001'),
      jsonb_build_object('type', 'desadv', 'bizTransaction', 'DESADV-2025-001')
    ),
    'sourceList', jsonb_build_array(
      jsonb_build_object('type', 'owning_party', 'source', 'urn:epc:id:sgln:' || l_from.gln)
    ),
    'destinationList', jsonb_build_array(
      jsonb_build_object('type', 'owning_party', 'destination', 'urn:epc:id:sgln:' || l_to.gln)
    )
  ),
  '{"carrier": "Viettel Post", "tracking_number": "VTP-2025-12345", "estimated_delivery": "2025-01-30"}'::jsonb
FROM locations l_from
CROSS JOIN locations l_to
WHERE l_from.gln = '8541222222222' AND l_to.gln = '8541333333333'
LIMIT 1;

-- ============================================
-- 9. SHIPMENTS
-- ============================================

INSERT INTO shipments (
  shipment_number, from_location_id, to_location_id, carrier_partner_id,
  items, status, dispatched_at, tracking_number, metadata
)
SELECT 
  'SHIP-2025-' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
  l_from.id,
  l_to.id,
  p.id,
  jsonb_build_array(
    jsonb_build_object(
      'batch_id', b.id,
      'batch_number', b.batch_number,
      'product_name', pr.name,
      'quantity', 100,
      'unit', 'kg'
    )
  ),
  'in_transit',
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  'TRACK-' || LPAD((RANDOM() * 1000000)::INTEGER::TEXT, 10, '0'),
  '{"vehicle_type": "refrigerated_truck", "driver": "Tran Van C", "driver_phone": "+84912345678"}'::jsonb
FROM locations l_from
CROSS JOIN locations l_to
CROSS JOIN partners p
CROSS JOIN batches b
CROSS JOIN products pr
WHERE l_from.gln = '8541222222222' 
  AND l_to.gln = '8541333333333'
  AND p.partner_type = 'distributor'
  AND b.product_id = pr.id
LIMIT 1
ON CONFLICT (shipment_number) DO NOTHING;

-- ============================================
-- 10. AI PROCESSING QUEUE
-- ============================================

INSERT INTO ai_processing_queue (
  job_type, status, priority, input_data, location_gln,
  confidence_threshold, metadata
) VALUES
  ('voice_transcription', 'pending', 5,
   '{"audio_url": "https://storage.example.com/audio/voice-input-001.m4a", "language": "vi", "duration_seconds": 45}'::jsonb,
   '8541111111111', 0.85,
   '{"device": "mobile", "app": "zalo_mini_app"}'::jsonb),
  
  ('vision_ocr', 'pending', 3,
   '{"image_url": "https://storage.example.com/images/label-scan-001.jpg", "detection_type": "gtin"}'::jsonb,
   '8541222222222', 0.90,
   '{"camera_quality": "high", "lighting": "good"}'::jsonb),
  
  ('vision_counting', 'review_required', 5,
   '{"image_url": "https://storage.example.com/images/package-count-001.jpg", "expected_range": [45, 55]}'::jsonb,
   '8541222222223', 0.85,
   '{"ai_count": 48, "confidence": 0.78, "below_threshold": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. DIGITAL LINKS (QR Codes)
-- ============================================

INSERT INTO digital_links (short_url, gtin, lot, metadata)
SELECT 
  'dl' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
  p.gtin,
  b.batch_number,
  jsonb_build_object(
    'product_name', p.name,
    'production_date', b.production_date,
    'origin', 'Đà Lạt, Vietnam'
  )
FROM batches b
JOIN products p ON b.product_id = p.id
LIMIT 5
ON CONFLICT (short_url) DO NOTHING;

-- ============================================
-- 12. PRODUCT RECIPES
-- ============================================

INSERT INTO product_recipes (
  output_product_id, recipe_name, recipe_version,
  input_products, process_steps, estimated_time_minutes, yield_percentage, status
)
SELECT 
  p_output.id,
  'Coffee Roasting Process',
  '1.0',
  jsonb_build_array(
    jsonb_build_object('product_id', p_input.id, 'product_name', p_input.name, 'quantity', 1000, 'unit', 'kg')
  ),
  jsonb_build_array(
    jsonb_build_object('step', 1, 'name', 'Cleaning', 'duration_minutes', 30, 'temperature_c', null),
    jsonb_build_object('step', 2, 'name', 'Roasting', 'duration_minutes', 15, 'temperature_c', 220),
    jsonb_build_object('step', 3, 'name', 'Cooling', 'duration_minutes', 10, 'temperature_c', 25),
    jsonb_build_object('step', 4, 'name', 'Grinding', 'duration_minutes', 20, 'grind_size', 'medium'),
    jsonb_build_object('step', 5, 'name', 'Packaging', 'duration_minutes', 25, 'package_size_g', 500)
  ),
  100,
  50.00,
  'active'
FROM products p_input
CROSS JOIN products p_output
WHERE p_input.gtin = '08541000000001' AND p_output.gtin = '08541000000002'
LIMIT 1;

-- ============================================
-- SUMMARY
-- ============================================

DO $$
DECLARE
  loc_count INTEGER;
  prod_count INTEGER;
  batch_count INTEGER;
  event_count INTEGER;
  cert_count INTEGER;
  partner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO loc_count FROM locations;
  SELECT COUNT(*) INTO prod_count FROM products;
  SELECT COUNT(*) INTO batch_count FROM batches;
  SELECT COUNT(*) INTO event_count FROM events;
  SELECT COUNT(*) INTO cert_count FROM certifications;
  SELECT COUNT(*) INTO partner_count FROM partners;
  
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'SEED DATA IMPORTED SUCCESSFULLY';
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Locations: %', loc_count;
  RAISE NOTICE 'Products: %', prod_count;
  RAISE NOTICE 'Batches: %', batch_count;
  RAISE NOTICE 'Events (EPCIS): %', event_count;
  RAISE NOTICE 'Certifications: %', cert_count;
  RAISE NOTICE 'Partners: %', partner_count;
  RAISE NOTICE '=====================================';
END $$;

-- Comprehensive seed data covering full supply chain: farms → factories → warehouses → retailers with EPCIS 2.0 events
