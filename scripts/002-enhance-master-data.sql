-- ============================================
-- GS1 MASTER DATA MANAGEMENT ENHANCEMENT
-- Thêm GLN Hierarchy, Batch/Lot, Certifications
-- ============================================

-- 1. GLN HIERARCHY (Parent-Child Locations)
CREATE TABLE IF NOT EXISTS location_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  child_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'contains', 'managed_by', 'ships_to'
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_location_relationship UNIQUE(parent_location_id, child_location_id, relationship_type)
);

CREATE INDEX idx_location_hierarchy_parent ON location_hierarchy(parent_location_id);
CREATE INDEX idx_location_hierarchy_child ON location_hierarchy(child_location_id);

-- 2. BATCH/LOT MANAGEMENT
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE, -- GTIN + Batch Number format
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id),
  
  -- Batch Details
  production_date DATE NOT NULL,
  expiry_date DATE,
  best_before_date DATE,
  quantity_produced INTEGER NOT NULL,
  quantity_available INTEGER NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'unit', -- 'kg', 'liter', 'unit', etc.
  
  -- Quality Control
  quality_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'recalled'
  quality_tested_at TIMESTAMPTZ,
  quality_tested_by UUID REFERENCES users(id),
  quality_notes JSONB,
  
  -- Compliance
  certifications JSONB, -- Array of certification IDs
  regulatory_info JSONB, -- FDA, USDA, etc.
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_product ON batches(product_id);
CREATE INDEX idx_batches_location ON batches(location_id);
CREATE INDEX idx_batches_status ON batches(quality_status);
CREATE INDEX idx_batches_dates ON batches(production_date, expiry_date);

-- 3. CERTIFICATIONS
CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_type TEXT NOT NULL, -- 'organic', 'fair_trade', 'halal', 'kosher', 'vegan', etc.
  certification_body TEXT NOT NULL, -- 'USDA', 'EU Organic', 'Fair Trade USA'
  certificate_number TEXT NOT NULL UNIQUE,
  
  -- Scope
  issued_to_type TEXT NOT NULL, -- 'location', 'product', 'batch'
  issued_to_id UUID NOT NULL,
  
  -- Validity
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'suspended', 'revoked'
  
  -- Documentation
  certificate_url TEXT,
  verification_url TEXT,
  documents JSONB, -- Array of document URLs
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certifications_type ON certifications(certification_type);
CREATE INDEX idx_certifications_issued_to ON certifications(issued_to_type, issued_to_id);
CREATE INDEX idx_certifications_status ON certifications(status);
CREATE INDEX idx_certifications_dates ON certifications(issue_date, expiry_date);

-- 4. SUPPLY CHAIN PARTNERS
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_type TEXT NOT NULL, -- 'supplier', 'manufacturer', 'distributor', 'retailer'
  company_name TEXT NOT NULL,
  gln TEXT, -- GS1 Global Location Number
  
  -- Contact Info
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  
  -- Business Details
  tax_id TEXT,
  business_license TEXT,
  certifications UUID[] DEFAULT '{}', -- Array of certification IDs
  
  -- Performance Metrics
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_transactions INTEGER DEFAULT 0,
  quality_score DECIMAL(3,2) DEFAULT 5.00,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'blacklisted'
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_type ON partners(partner_type);
CREATE INDEX idx_partners_status ON partners(status);
CREATE INDEX idx_partners_gln ON partners(gln);

-- 5. ENHANCE EVENTS TABLE với Batch Tracking
ALTER TABLE events ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS certification_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_events_batch ON events(batch_id);
CREATE INDEX IF NOT EXISTS idx_events_partner ON events(partner_id);

-- 6. SHIPMENTS TABLE
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT NOT NULL UNIQUE,
  
  -- Route
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id UUID NOT NULL REFERENCES locations(id),
  carrier_partner_id UUID REFERENCES partners(id),
  
  -- Items
  items JSONB NOT NULL, -- Array of {batch_id, quantity, unit}
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_transit', 'delivered', 'cancelled'
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Tracking
  tracking_number TEXT,
  vehicle_info JSONB,
  temperature_log JSONB, -- For cold chain
  
  -- Documents
  documents JSONB, -- Bill of lading, customs docs, etc.
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_from ON shipments(from_location_id);
CREATE INDEX idx_shipments_to ON shipments(to_location_id);
CREATE INDEX idx_shipments_status ON shipments(status);

-- 7. PRODUCT RECIPES (for TransformationEvents)
CREATE TABLE IF NOT EXISTS product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_product_id UUID NOT NULL REFERENCES products(id),
  recipe_name TEXT NOT NULL,
  recipe_version TEXT DEFAULT '1.0',
  
  -- Inputs
  input_products JSONB NOT NULL, -- Array of {product_id, quantity, unit}
  
  -- Process
  process_steps JSONB, -- Array of manufacturing steps
  estimated_time_minutes INTEGER,
  yield_percentage DECIMAL(5,2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'deprecated'
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_recipes_output ON product_recipes(output_product_id);
CREATE INDEX idx_product_recipes_status ON product_recipes(status);

-- 8. AUTO-UPDATE TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_location_hierarchy_updated_at BEFORE UPDATE ON location_hierarchy FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_recipes_updated_at BEFORE UPDATE ON product_recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. RLS POLICIES

-- Location Hierarchy
ALTER TABLE location_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view location hierarchy"
  ON location_hierarchy FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage location hierarchy"
  ON location_hierarchy FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- Batches
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view batches"
  ON batches FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Factory managers can manage batches"
  ON batches FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- Certifications
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active certifications"
  ON certifications FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Admins can manage certifications"
  ON certifications FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Partners
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view partners"
  ON partners FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins can manage partners"
  ON partners FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- Shipments
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipments"
  ON shipments FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Factory managers can manage shipments"
  ON shipments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- Product Recipes
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recipes"
  ON product_recipes FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Factory managers can manage recipes"
  ON product_recipes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'factory_manager'))
  );

-- 10. SAMPLE DATA

-- Insert sample location hierarchy
INSERT INTO location_hierarchy (parent_location_id, child_location_id, relationship_type)
SELECT 
  (SELECT id FROM locations WHERE name = 'Nhà máy chế biến XYZ'),
  (SELECT id FROM locations WHERE name = 'Trang trại Cà phê Đà Lạt'),
  'ships_to'
WHERE NOT EXISTS (SELECT 1 FROM location_hierarchy LIMIT 1);

-- Insert sample batch
INSERT INTO batches (
  batch_number, product_id, location_id, 
  production_date, expiry_date, 
  quantity_produced, quantity_available,
  quality_status
)
SELECT 
  '08541234567890-BATCH-001',
  p.id,
  l.id,
  CURRENT_DATE - INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '365 days',
  1000,
  1000,
  'approved'
FROM products p
CROSS JOIN locations l
WHERE p.gtin = '08541234567890' 
  AND l.name = 'Nhà máy chế biến XYZ'
  AND NOT EXISTS (SELECT 1 FROM batches LIMIT 1);

-- Insert sample certification
INSERT INTO certifications (
  certification_type, certification_body, certificate_number,
  issued_to_type, issued_to_id,
  issue_date, expiry_date,
  status
)
SELECT 
  'organic',
  'USDA Organic',
  'CERT-ORG-2025-001',
  'location',
  id,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE + INTERVAL '365 days',
  'active'
FROM locations
WHERE name = 'Trang trại Cà phê Đà Lạt'
  AND NOT EXISTS (SELECT 1 FROM certifications LIMIT 1);

-- Insert sample partner
INSERT INTO partners (
  partner_type, company_name, gln,
  contact_person, email, phone,
  status, verified
)
VALUES 
  ('supplier', 'Cooperative Nông dân Đà Lạt', '8501234567890', 'Nguyễn Văn A', 'contact@dalat-coop.vn', '+84912345678', 'active', TRUE)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE location_hierarchy IS 'Quản lý cấu trúc phân cấp địa điểm (trang trại → nhà máy → kho → cửa hàng)';
COMMENT ON TABLE batches IS 'Quản lý lô/batch sản xuất theo GTIN + Batch Number';
COMMENT ON TABLE certifications IS 'Chứng nhận chất lượng (Organic, Fair Trade, Halal, etc.)';
COMMENT ON TABLE partners IS 'Danh sách đối tác trong chuỗi cung ứng';
COMMENT ON TABLE shipments IS 'Theo dõi vận chuyển giữa các địa điểm';
COMMENT ON TABLE product_recipes IS 'Công thức sản xuất cho TransformationEvents';
