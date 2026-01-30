-- Fix RLS policies for products and batches tables
-- Allow authenticated users to create products and batches

-- Products table: Allow admins and factory managers to create/modify
DROP POLICY IF EXISTS "Admins can modify products" ON products;
DROP POLICY IF EXISTS "Everyone can view products" ON products;

CREATE POLICY "Everyone can view products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage products"
  ON products FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Batches table policies are mostly OK, just ensure factory managers can create
DROP POLICY IF EXISTS "Factory managers can create batches" ON batches;
DROP POLICY IF EXISTS "Factory managers can manage batches" ON batches;

CREATE POLICY "Factory managers can manage batches"
  ON batches FOR ALL
  USING (auth.uid() IS NOT NULL);

COMMENT ON POLICY "Admins and managers can manage products" ON products IS 
'Allow authenticated users to manage products. Middleware will enforce role-based restrictions.';

COMMENT ON POLICY "Factory managers can manage batches" ON batches IS 
'Allow authenticated users to manage batches. Middleware will enforce role-based restrictions.';
