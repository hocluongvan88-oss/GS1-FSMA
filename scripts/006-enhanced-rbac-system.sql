-- ============================================
-- Enhanced RBAC System for Traceability Platform
-- Hệ thống phân quyền nâng cao
-- ============================================

-- Drop existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Update role enum with new roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN (
    'system_admin',      -- Quản trị hệ thống
    'admin',             -- Quản trị doanh nghiệp  
    'factory_manager',   -- Quản lý nhà máy
    'quality_inspector', -- Thanh tra chất lượng
    'logistics_manager', -- Quản lý vận chuyển
    'worker',            -- Công nhân
    'farmer',            -- Nông dân
    'auditor',           -- Kiểm toán viên
    'customer'           -- Khách hàng
  ));

-- ============================================
-- User Activity Logs Table
-- Theo dõi hoạt động của users
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'login', 'logout', 'create', 'update', 'delete', 'view'
  resource_type TEXT, -- 'event', 'batch', 'product', etc.
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX idx_user_activity_logs_resource ON user_activity_logs(resource_type, resource_id);

-- ============================================
-- Role Permissions Table (Optional - for dynamic permissions)
-- Bảng quyền động, có thể cấu hình runtime
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(role, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- ============================================
-- Enhanced RLS Policies
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Users can view all events" ON events;
DROP POLICY IF EXISTS "Users can update their own events" ON events;

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;

-- New Event Policies
CREATE POLICY "Users can create events based on role"
  ON events FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager', 'worker', 'farmer', 'logistics_manager')
    )
  );

CREATE POLICY "Everyone can view events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own events or admins can update all"
  ON events FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager')
    )
  );

CREATE POLICY "Only admins can delete events"
  ON events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin')
    )
  );

-- New User Policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins and system admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('system_admin', 'admin')
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Users can't change their own role
    role = (SELECT role FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Only system admins can change user roles"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'system_admin'
    )
  );

CREATE POLICY "System admins can create users"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'system_admin'
    )
  );

-- Location Policies
DROP POLICY IF EXISTS "Anyone can view locations" ON locations;
DROP POLICY IF EXISTS "Only admins can modify locations" ON locations;

CREATE POLICY "Everyone can view locations"
  ON locations FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify locations"
  ON locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager')
    )
  );

-- Product Policies  
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

CREATE POLICY "Everyone can view products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager')
    )
  );

-- Batch Policies
DROP POLICY IF EXISTS "Users can view all batches" ON batches;
DROP POLICY IF EXISTS "Factory managers can create batches" ON batches;
DROP POLICY IF EXISTS "Admins can modify batches" ON batches;

CREATE POLICY "Users can view all batches"
  ON batches FOR SELECT
  USING (true);

CREATE POLICY "Factory managers can create batches"
  ON batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager')
    )
  );

CREATE POLICY "Admins can modify batches"
  ON batches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager', 'quality_inspector')
    )
  );

-- Partner Policies
DROP POLICY IF EXISTS "Users can view all partners" ON partners;
DROP POLICY IF EXISTS "Admins can manage partners" ON partners;

CREATE POLICY "Users can view all partners"
  ON partners FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage partners"
  ON partners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'factory_manager')
    )
  );

-- User Activity Logs Policies
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs"
  ON user_activity_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity logs"
  ON user_activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('system_admin', 'admin', 'auditor')
    )
  );

CREATE POLICY "System can insert activity logs"
  ON user_activity_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Functions for Activity Logging
-- ============================================

CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'timestamp', NOW(),
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers for important tables
CREATE TRIGGER log_events_activity
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION log_user_activity();

CREATE TRIGGER log_batches_activity
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW EXECUTE FUNCTION log_user_activity();

CREATE TRIGGER log_products_activity
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION log_user_activity();

-- ============================================
-- Seed Default System Admin
-- LƯU Ý: Tạo user qua /auth/signup trước, sau đó update role
-- ============================================

COMMENT ON TABLE user_activity_logs IS 'Audit trail for user activities';
COMMENT ON TABLE role_permissions IS 'Dynamic role-permission mappings (optional)';
COMMENT ON TABLE users IS 'Extended user profiles with enhanced RBAC roles';
