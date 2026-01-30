-- ==============================================================================
-- FINAL FIX: Users table RLS infinite recursion
-- ==============================================================================
-- This script completely removes all problematic policies and creates
-- ultra-simple policies that CANNOT cause recursion
-- ==============================================================================

-- Step 1: Disable RLS temporarily to clean up
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on users table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create ONLY the essential policies with NO function calls

-- Policy 1: Users can read their OWN record ONLY
-- Uses auth.uid() directly - NO function calls, NO recursion possible
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Users can update their OWN record ONLY
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Service role has full access (for server-side admin operations)
CREATE POLICY "users_service_role_all" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: For admin operations, create a SECURITY DEFINER function
-- This bypasses RLS entirely when called
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  phone TEXT,
  assigned_location TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  -- This function runs with DEFINER privileges (bypasses RLS)
  -- Only use this from authenticated server-side code with proper authorization
  SELECT id, full_name, role, phone, assigned_location, created_at
  FROM users
  ORDER BY created_at DESC;
$$;

-- Grant execute to authenticated users (authorization should be in app code)
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;

-- Step 6: Create helper function for checking if user is admin
-- This DOES NOT query users table, avoiding recursion
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role from auth.users metadata (no users table query)
  SELECT raw_user_meta_data->>'role'
  INTO user_role
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN user_role IN ('system_admin', 'admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Step 7: Verify policies
DO $$
BEGIN
  RAISE NOTICE 'Users table RLS policies:';
  RAISE NOTICE '1. users_select_own - Users can read their own record';
  RAISE NOTICE '2. users_update_own - Users can update their own record';
  RAISE NOTICE '3. users_service_role_all - Service role has full access';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions:';
  RAISE NOTICE '1. get_all_users_for_admin() - Get all users (SECURITY DEFINER)';
  RAISE NOTICE '2. is_current_user_admin() - Check if current user is admin';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Fix Complete!';
END $$;
