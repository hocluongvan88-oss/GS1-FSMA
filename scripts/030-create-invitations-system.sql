-- ==============================================================================
-- Invitation System for Farmer Onboarding
-- ==============================================================================
-- Purpose: Allow factory managers to invite farmers to join their organization
-- Flow: Factory creates invite → Farmer uses code in Zalo app → Auto-assigned
-- ==============================================================================

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Invitation details
  invitation_code TEXT UNIQUE NOT NULL, -- e.g., "NM-COFFEE-2026-ABC123"
  
  -- Organization details
  organization_gln TEXT NOT NULL REFERENCES public.locations(gln),
  organization_name TEXT NOT NULL,
  
  -- Invite configuration  
  invited_role TEXT NOT NULL DEFAULT 'farmer' CHECK (invited_role IN ('farmer', 'worker')),
  max_uses INTEGER DEFAULT 1, -- How many times can this code be used (-1 for unlimited)
  uses_count INTEGER DEFAULT 0, -- How many times has it been used
  
  -- Metadata
  created_by UUID NOT NULL, -- Admin/manager who created the invite
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL means never expires
  notes TEXT, -- Optional notes about this invitation
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,
  deactivation_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_invitations_code ON public.invitations(invitation_code) WHERE is_active = true;
CREATE INDEX idx_invitations_org ON public.invitations(organization_gln);
CREATE INDEX idx_invitations_created_by ON public.invitations(created_by);
CREATE INDEX idx_invitations_expires ON public.invitations(expires_at) WHERE expires_at IS NOT NULL;

-- Track invitation usage
CREATE TABLE IF NOT EXISTS public.invitation_uses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  invitation_code TEXT NOT NULL,
  
  -- User who used the invite
  user_id UUID NOT NULL REFERENCES public.users(id),
  zalo_id TEXT,
  user_name TEXT,
  
  -- Metadata
  used_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_invitation_uses_invitation ON public.invitation_uses(invitation_id);
CREATE INDEX idx_invitation_uses_user ON public.invitation_uses(user_id);
CREATE INDEX idx_invitation_uses_code ON public.invitation_uses(invitation_code);

-- ==============================================================================
-- RLS Policies for invitations
-- ==============================================================================

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_uses ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "invitations_service_role_all" ON public.invitations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "invitation_uses_service_role_all" ON public.invitation_uses
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can SELECT active invitations (for redemption)
CREATE POLICY "invitations_select_active" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses = -1 OR uses_count < max_uses)
  );

-- Users can view their own invitation usage history
CREATE POLICY "invitation_uses_select_own" ON public.invitation_uses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ==============================================================================
-- Helper Functions
-- ==============================================================================

-- Function to generate unique invitation code
CREATE OR REPLACE FUNCTION public.generate_invitation_code(org_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  prefix TEXT;
  random_suffix TEXT;
  attempt INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Create prefix from organization name (first 3-4 chars, uppercase)
  prefix := UPPER(SUBSTRING(REGEXP_REPLACE(org_name, '[^A-Za-z0-9]', '', 'g'), 1, 4));
  
  LOOP
    -- Generate random 6-character suffix
    random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    
    -- Combine: PREFIX-YEAR-SUFFIX (e.g., "CAFE-2026-A1B2C3")
    code := prefix || '-' || EXTRACT(YEAR FROM NOW()) || '-' || random_suffix;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.invitations WHERE invitation_code = code) THEN
      RETURN code;
    END IF;
    
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique invitation code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Function to validate and redeem invitation
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_invitation_code TEXT,
  p_user_id UUID,
  p_zalo_id TEXT,
  p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_result JSONB;
BEGIN
  -- Find and validate invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE invitation_code = p_invitation_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses = -1 OR uses_count < max_uses)
  FOR UPDATE; -- Lock row for atomic update
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation code'
    );
  END IF;
  
  -- Check if user already used this code
  IF EXISTS (
    SELECT 1 FROM public.invitation_uses 
    WHERE invitation_id = v_invitation.id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already used this invitation code'
    );
  END IF;
  
  -- Update user profile with organization info
  UPDATE public.users
  SET 
    role = v_invitation.invited_role,
    assigned_location = v_invitation.organization_gln,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Record invitation use
  INSERT INTO public.invitation_uses (
    invitation_id,
    invitation_code,
    user_id,
    zalo_id,
    user_name
  ) VALUES (
    v_invitation.id,
    p_invitation_code,
    p_user_id,
    p_zalo_id,
    p_user_name
  );
  
  -- Increment uses count
  UPDATE public.invitations
  SET uses_count = uses_count + 1
  WHERE id = v_invitation.id;
  
  -- Return success with organization details
  RETURN jsonb_build_object(
    'success', true,
    'organization', jsonb_build_object(
      'gln', v_invitation.organization_gln,
      'name', v_invitation.organization_name
    ),
    'role', v_invitation.invited_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invitation_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation TO authenticated;

-- ==============================================================================
-- Comments
-- ==============================================================================

COMMENT ON TABLE public.invitations IS 'Invitation codes for onboarding farmers and workers';
COMMENT ON TABLE public.invitation_uses IS 'Track who used which invitation codes';
COMMENT ON FUNCTION public.generate_invitation_code IS 'Generate unique invitation code with organization prefix';
COMMENT ON FUNCTION public.redeem_invitation IS 'Validate and apply invitation code to user account';

-- ==============================================================================
-- Sample Data (Optional - for testing)
-- ==============================================================================

-- Create a test invitation for a coffee factory
-- INSERT INTO public.invitations (
--   invitation_code,
--   organization_gln,
--   organization_name,
--   invited_role,
--   max_uses,
--   created_by,
--   expires_at
-- ) VALUES (
--   'CAFE-2026-TEST01',
--   '8412345678901',
--   'Nhà máy Chế biến Cà phê XYZ',
--   'farmer',
--   10,
--   '00000000-0000-0000-0000-000000000001', -- Replace with actual admin user ID
--   NOW() + INTERVAL '30 days'
-- );
