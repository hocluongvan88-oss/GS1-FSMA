-- ============================================================
-- GS1 EPCIS 2.0 Database Schema for Traceability Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. LOCATIONS TABLE (GS1 GLN - Global Location Number)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gln TEXT UNIQUE NOT NULL, -- GS1 Global Location Number
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('farm', 'factory', 'warehouse', 'retailer')),
  address JSONB, -- Địa chỉ chi tiết
  coordinates JSONB, -- {lat, lng}
  parent_gln TEXT REFERENCES locations(gln), -- Hierarchy support
  metadata JSONB, -- Thông tin bổ sung
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locations_gln ON locations(gln);
CREATE INDEX idx_locations_type ON locations(type);

-- ============================================================
-- 2. PRODUCTS TABLE (GS1 GTIN - Global Trade Item Number)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gtin TEXT UNIQUE NOT NULL, -- GS1 Global Trade Item Number (14 digits)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., 'coffee', 'rice', 'vegetables'
  unit TEXT DEFAULT 'kg', -- Đơn vị tính
  metadata JSONB, -- Thông tin bổ sung (hình ảnh, certifications, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_gtin ON products(gtin);
CREATE INDEX idx_products_category ON products(category);

-- ============================================================
-- 3. EPCIS EVENTS TABLE (Core Traceability Events)
-- Standard: GS1 EPCIS 2.0 JSON-LD format
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- EPCIS Core Fields
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ObjectEvent',      -- Tạo/Quan sát đối tượng
    'AggregationEvent', -- Đóng gói/Mở gói
    'TransactionEvent', -- Giao dịch/Chuyển quyền sở hữu
    'TransformationEvent' -- Chế biến/Biến đổi
  )),
  
  event_time TIMESTAMPTZ NOT NULL,
  event_timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  
  -- What: EPC List (Sản phẩm liên quan)
  epc_list JSONB, -- Array of EPCs (Electronic Product Codes)
  
  -- Why: Business Step & Disposition
  biz_step TEXT, -- e.g., 'commissioning', 'receiving', 'shipping', 'transforming'
  disposition TEXT, -- e.g., 'active', 'in_transit', 'in_progress', 'completed'
  
  -- Where: Location (GLN)
  read_point TEXT REFERENCES locations(gln), -- Nơi sự kiện xảy ra
  biz_location TEXT REFERENCES locations(gln), -- Vị trí kinh doanh
  
  -- Who: User/Actor
  user_id UUID, -- ID người thực hiện (từ Zalo auth)
  user_name TEXT, -- Tên người thực hiện
  
  -- How: Source System (Voice AI, Vision AI, Manual)
  source_type TEXT CHECK (source_type IN ('voice_ai', 'vision_ai', 'manual', 'system')),
  
  -- Quantity for ObjectEvent/AggregationEvent
  quantity_list JSONB DEFAULT '[]'::jsonb, -- [{epc_class: string, quantity: number, uom: string}]
  
  -- Input/Output for TransformationEvent
  input_epc_list JSONB, -- Nguyên liệu đầu vào
  output_epc_list JSONB, -- Sản phẩm đầu ra
  input_quantity JSONB, -- {value: number, uom: string, gtin: string}[]
  output_quantity JSONB, -- {value: number, uom: string, gtin: string}[]
  
  -- AI Metadata
  ai_metadata JSONB, -- Confidence scores, transcription, detected objects, etc.
  
  -- Full EPCIS 2.0 JSON-LD Event
  epcis_document JSONB NOT NULL, -- Chuẩn GS1 EPCIS 2.0 JSON-LD
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_time ON events(event_time DESC);
CREATE INDEX idx_events_biz_step ON events(biz_step);
CREATE INDEX idx_events_read_point ON events(read_point);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_source_type ON events(source_type);

-- GIN index for JSONB queries
CREATE INDEX idx_events_epc_list ON events USING GIN (epc_list);
CREATE INDEX idx_events_epcis_document ON events USING GIN (epcis_document);

-- ============================================================
-- 4. USERS TABLE (Extended from Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  zalo_id TEXT UNIQUE, -- Zalo User ID
  phone TEXT,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'worker', 'factory_manager', 'admin')),
  assigned_location TEXT REFERENCES locations(gln), -- Location assigned to user
  avatar_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_zalo_id ON users(zalo_id);

-- ============================================================
-- 5. DIGITAL_LINKS TABLE (GS1 Digital Link Resolver)
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_url TEXT UNIQUE NOT NULL, -- e.g., 'abc123'
  gtin TEXT NOT NULL REFERENCES products(gtin),
  lot TEXT, -- Batch/Lot number
  serial TEXT, -- Serial number
  epc TEXT, -- Full EPC if available
  metadata JSONB, -- Additional parameters
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_digital_links_short_url ON digital_links(short_url);
CREATE INDEX idx_digital_links_gtin ON digital_links(gtin);

-- ============================================================
-- 6. AI_PROCESSING_LOGS TABLE (Track AI processing)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_processing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  processing_type TEXT NOT NULL CHECK (processing_type IN ('voice', 'vision')),
  input_data JSONB, -- Audio file URL, Image URL, etc.
  ai_provider TEXT, -- 'openai', 'google', 'gemini', etc.
  raw_response JSONB, -- Full AI API response
  confidence_score DECIMAL(3,2), -- 0.00 - 1.00
  processing_time_ms INTEGER,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_logs_event_id ON ai_processing_logs(event_id);
CREATE INDEX idx_ai_logs_type ON ai_processing_logs(processing_type);
CREATE INDEX idx_ai_logs_status ON ai_processing_logs(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_logs ENABLE ROW LEVEL SECURITY;

-- Locations: Public read, Admin write
CREATE POLICY "Anyone can view locations"
  ON locations FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify locations"
  ON locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'factory_manager')
    )
  );

-- Products: Public read, Admin write
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'factory_manager')
    )
  );

-- Events: Authenticated users can create, view their own or public events
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view all events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (user_id = auth.uid());

-- Users: Users can view and update their own profile
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Digital Links: Public read
CREATE POLICY "Anyone can view digital links"
  ON digital_links FOR SELECT
  USING (true);

CREATE POLICY "System can create digital links"
  ON digital_links FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- AI Processing Logs: Users can view logs for their events
CREATE POLICY "Users can view AI logs for their events"
  ON ai_processing_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = ai_processing_logs.event_id
      AND events.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digital_links_updated_at BEFORE UPDATE ON digital_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA (Sample data for testing)
-- ============================================================

-- Sample Locations
INSERT INTO locations (gln, name, type, address, coordinates) VALUES
  ('8541234567890', 'Trang trại Cà phê Đà Lạt', 'farm', '{"city": "Đà Lạt", "province": "Lâm Đồng"}', '{"lat": 11.9404, "lng": 108.4583}'),
  ('8541234567891', 'Nhà máy chế biến XYZ', 'factory', '{"city": "Hồ Chí Minh", "district": "Bình Tân"}', '{"lat": 10.7626, "lng": 106.6600}'),
  ('8541234567892', 'Kho trung tâm Miền Nam', 'warehouse', '{"city": "Hồ Chí Minh", "district": "Quận 7"}', '{"lat": 10.7323, "lng": 106.7221}')
ON CONFLICT (gln) DO NOTHING;

-- Sample Products
INSERT INTO products (gtin, name, description, category, unit) VALUES
  ('08541234567890', 'Cà phê hạt Arabica', 'Cà phê Arabica nguyên chất từ Đà Lạt', 'coffee', 'kg'),
  ('08541234567891', 'Cà phê rang xay', 'Cà phê đã rang xay, đóng gói 500g', 'coffee', 'gói'),
  ('08541234567892', 'Gạo ST25', 'Gạo thơm ST25 cao cấp', 'rice', 'kg')
ON CONFLICT (gtin) DO NOTHING;

COMMENT ON TABLE locations IS 'GS1 GLN-based locations (farms, factories, warehouses)';
COMMENT ON TABLE products IS 'GS1 GTIN-based product catalog';
COMMENT ON TABLE events IS 'EPCIS 2.0 compliant traceability events';
COMMENT ON TABLE users IS 'Extended user profiles from Supabase Auth';
COMMENT ON TABLE digital_links IS 'GS1 Digital Link resolver data';
COMMENT ON TABLE ai_processing_logs IS 'AI processing audit trail';
