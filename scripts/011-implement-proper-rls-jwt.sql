-- ==============================================================================
-- STEP 1: Create helper functions in PUBLIC schema
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'user_role'),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('system_admin', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_production()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT public.get_jwt_role() IN ('system_admin', 'admin', 'factory_manager');
$$;

-- ==============================================================================
-- STEP 2: Secure Users Table
-- ==============================================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_admin" ON public.users;
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL TO authenticated USING (public.is_admin());

-- ==============================================================================
-- STEP 3: Secure Core Modules (Products, Batches, Locations, Partners)
-- ==============================================================================

DO $$ 
DECLARE
    t text;
BEGIN
    -- List of tables that follow the "authenticated read / manager write" pattern
    FOR t IN SELECT unnest(ARRAY['products', 'batches', 'locations', 'partners', 'certifications', 'shipments']) 
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_policy', t);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read_policy', t);
            
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_policy', t);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_production()) WITH CHECK (public.can_manage_production())', t || '_write_policy', t);
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- STEP 4: Secure EPCIS Events (Audit Trail Logic)
-- ==============================================================================

DO $$ 
BEGIN
    -- Check if table exists under 'epcis_events' or just 'events'
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'epcis_events') THEN
        ALTER TABLE public.epcis_events ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "events_read_policy" ON public.epcis_events;
        CREATE POLICY "events_read_policy" ON public.epcis_events FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS "events_insert_policy" ON public.epcis_events;
        CREATE POLICY "events_insert_policy" ON public.epcis_events FOR INSERT TO authenticated WITH CHECK (public.can_manage_production());

        DROP POLICY IF EXISTS "events_modify_policy" ON public.epcis_events;
        CREATE POLICY "events_modify_policy" ON public.epcis_events FOR ALL TO authenticated USING (public.is_admin());
    
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
        -- Same policies for 'events' table...
        DROP POLICY IF EXISTS "events_read_policy" ON public.events;
        CREATE POLICY "events_read_policy" ON public.events FOR SELECT TO authenticated USING (true);
        DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
        CREATE POLICY "events_insert_policy" ON public.events FOR INSERT TO authenticated WITH CHECK (public.can_manage_production());
        DROP POLICY IF EXISTS "events_modify_policy" ON public.events;
        CREATE POLICY "events_modify_policy" ON public.events FOR ALL TO authenticated USING (public.is_admin());
    END IF;
END $$;

-- ==============================================================================
-- STEP 5: Sync Role Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_sync_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('user_role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_role_change_sync ON public.users;
CREATE TRIGGER on_role_change_sync
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sync_user_role();

-- ==============================================================================
-- STEP 6: Initial Sync
-- ==============================================================================
DO $$
DECLARE
  u RECORD;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    FOR u IN SELECT id, role FROM public.users LOOP
      UPDATE auth.users
      SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('user_role', u.role)
      WHERE id = u.id;
    END LOOP;
  END IF;
END $$;
