-- Auto-create user profile when new auth user is created
-- This trigger ensures users table is populated automatically

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, phone, role, metadata)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'farmer'),
    jsonb_build_object(
      'email', NEW.email,
      'created_via', 'auth_trigger',
      'signup_date', NOW()
    )
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for users table to allow self-insertion during signup
DROP POLICY IF EXISTS "Allow signup user creation" ON users;
CREATE POLICY "Allow signup user creation"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile during login check
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profile in users table when auth user is created';
