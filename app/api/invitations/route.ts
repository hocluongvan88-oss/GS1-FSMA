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
 * GET /api/invitations
 * List all invitations (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationGln = searchParams.get('organization_gln')
    const activeOnly = searchParams.get('active_only') === 'true'

    let query = supabaseAdmin
      .from('invitations')
      .select(`
        *,
        invitation_uses(count)
      `)
      .order('created_at', { ascending: false })

    if (organizationGln) {
      query = query.eq('organization_gln', organizationGln)
    }

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[v0] Error fetching invitations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/invitations
 * Create new invitation code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      organizationGln,
      organizationName,
      invitedRole = 'farmer',
      maxUses = 1,
      expiresInDays = 30,
      notes,
      createdBy
    } = body

    if (!organizationGln || !organizationName || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate invitation code
    const { data: codeData, error: codeError } = await supabaseAdmin
      .rpc('generate_invitation_code', { org_name: organizationName })

    if (codeError || !codeData) {
      console.error('[v0] Error generating code:', codeError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate invitation code' },
        { status: 500 }
      )
    }

    const invitationCode = codeData

    // Calculate expiry date
    const expiresAt = expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Create invitation
    const { data: invitation, error: insertError } = await supabaseAdmin
      .from('invitations')
      .insert({
        invitation_code: invitationCode,
        organization_gln: organizationGln,
        organization_name: organizationName,
        invited_role: invitedRole,
        max_uses: maxUses,
        expires_at: expiresAt,
        notes,
        created_by: createdBy
      })
      .select()
      .single()

    if (insertError) throw insertError

    console.log('[v0] Created invitation:', invitationCode)

    return NextResponse.json({
      success: true,
      data: invitation
    })
  } catch (error) {
    console.error('[v0] Error creating invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/invitations?id={invitationId}
 * Deactivate invitation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')
    const reason = searchParams.get('reason') || 'Deactivated by admin'

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: 'Invitation ID required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('invitations')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: reason
      })
      .eq('id', invitationId)

    if (error) throw error

    console.log('[v0] Deactivated invitation:', invitationId)

    return NextResponse.json({
      success: true,
      message: 'Invitation deactivated'
    })
  } catch (error) {
    console.error('[v0] Error deactivating invitation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate invitation' },
      { status: 500 }
    )
  }
}
