import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Test endpoint to fetch events without authentication
 * Uses service role key to bypass RLS for testing
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') || '5'

    console.log('[v0] Test endpoint: Fetching events with service role')

    // Create Supabase client with service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: events, error } = await supabase
      .from('events')
      .select('id, event_type, action, source_type, event_time, epc_list, quantity_list')
      .order('event_time', { ascending: false })
      .limit(Number.parseInt(limit))

    if (error) {
      console.error('[v0] Supabase error:', error)
      throw error
    }

    console.log('[v0] Successfully fetched events:', events?.length || 0)

    return NextResponse.json({
      success: true,
      data: events || [],
      count: events?.length || 0,
      message: 'Fetched using service role (test only)'
    })
  } catch (error: any) {
    console.error('[v0] Test endpoint error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch events',
        details: error.details || null,
        hint: 'This is a test endpoint. Check your Supabase connection and environment variables.'
      },
      { status: 500 }
    )
  }
}
