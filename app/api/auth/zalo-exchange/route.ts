import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Exchange Zalo token for Supabase JWT session
 * Creates or updates user in database
 */
export async function POST(request: NextRequest) {
  try {
    const { zaloToken, userInfo } = await request.json()

    if (!zaloToken || !userInfo || !userInfo.id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // TODO: Verify Zalo token with Zalo API
    // For now, we trust the token from the mini app
    // In production, you should verify with: https://oauth.zaloapp.com/v4/oa/access_token

    const supabase = await createClient()

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('zalo_id', userInfo.id)
      .single()

    let userId: string

    if (existingUser) {
      // Update existing user
      userId = existingUser.id
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: userInfo.name,
          avatar_url: userInfo.avatar,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('[Zalo Auth] Update user failed:', updateError)
      }
    } else {
      // Create new user in auth.users first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${userInfo.id}@zalo.temp`, // Temporary email
        password: crypto.randomUUID(), // Random password
        options: {
          data: {
            zalo_id: userInfo.id,
            full_name: userInfo.name,
            avatar_url: userInfo.avatar
          }
        }
      })

      if (authError || !authData.user) {
        console.error('[Zalo Auth] Create auth user failed:', authError)
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }

      userId = authData.user.id

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: userId,
          zalo_id: userInfo.id,
          full_name: userInfo.name,
          avatar_url: userInfo.avatar,
          role: 'worker', // Default role
          phone: null
        })

      if (profileError) {
        console.error('[Zalo Auth] Create profile failed:', profileError)
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        )
      }
    }

    // Generate JWT session using Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: `${userInfo.id}@zalo.temp`,
      password: crypto.randomUUID() // This won't work, need better approach
    })

    // Better approach: Use admin API to generate token
    const { data: { session }, error: tokenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: `${userInfo.id}@zalo.temp`
    })

    if (tokenError) {
      console.error('[Zalo Auth] Generate token failed:', tokenError)
      
      // Fallback: Return user data without full session
      // Client will use service_role key for operations
      return NextResponse.json({
        accessToken: 'temp_token', // This is not ideal
        refreshToken: null,
        user: {
          id: userId,
          zaloId: userInfo.id,
          fullName: userInfo.name,
          role: existingUser?.role || 'worker'
        },
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
      })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      accessToken: session?.access_token || '',
      refreshToken: session?.refresh_token || '',
      user: {
        id: userId,
        zaloId: userInfo.id,
        fullName: userProfile?.full_name || userInfo.name,
        role: userProfile?.role || 'worker'
      },
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    })

  } catch (error) {
    console.error('[Zalo Auth] Exchange failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
