import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * POST /api/invitations/redeem
 * Redeem invitation code (for Zalo Mini App users)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invitationCode, userId, zaloId, userName } = body

    if (!invitationCode || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[v0] Redeeming invitation:', { invitationCode, userId, userName })

    // Call database function to redeem invitation
    const { data: result, error } = await supabaseAdmin
      .rpc('redeem_invitation', {
        p_invitation_code: invitationCode,
        p_user_id: userId,
        p_zalo_id: zaloId,
        p_user_name: userName
      })

    if (error) {
      console.error('[v0] Redeem error:', error)
      throw error
    }

    console.log('[v0] Redeem result:', result)

    // Result is JSONB from function
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation redeemed successfully',
      organization: result.organization,
      role: result.role
    })
  } catch (error) {
    console.error('[v0] Error redeeming invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to redeem invitation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/invitations/redeem?code={invitationCode}
 * Validate invitation code (check if valid before redeeming)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationCode = searchParams.get('code')

    if (!invitationCode) {
      return NextResponse.json(
        { success: false, error: 'Invitation code required' },
        { status: 400 }
      )
    }

    // Fetch invitation details
    const { data: invitation, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('invitation_code', invitationCode)
      .eq('is_active', true)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation code' },
        { status: 404 }
      )
    }

    // Check expiry
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invitation code has expired' },
        { status: 400 }
      )
    }

    // Check max uses
    if (invitation.max_uses !== -1 && invitation.uses_count >= invitation.max_uses) {
      return NextResponse.json(
        { success: false, error: 'Invitation code has reached maximum uses' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      invitation: {
        code: invitation.invitation_code,
        organizationName: invitation.organization_name,
        role: invitation.invited_role,
        expiresAt: invitation.expires_at,
        usesRemaining: invitation.max_uses === -1 
          ? -1 
          : invitation.max_uses - invitation.uses_count
      }
    })
  } catch (error) {
    console.error('[v0] Error validating invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to validate invitation' },
      { status: 500 }
    )
  }
}
