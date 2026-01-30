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
      .select('id, event_type, action, source_type, event_time, epc_list, quantity_list, epcis_document, input_quantity, output_quantity')
      .order('event_time', { ascending: false })
      .limit(Number.parseInt(limit))

    if (error) {
      console.error('[v0] Supabase error:', error)
      throw error
    }

    // Extract quantity from epcis_document if quantity_list is empty
    const enrichedEvents = events?.map(event => {
      let quantityList = event.quantity_list || []
      
      // If quantity_list is empty, try to get from epcis_document
      if ((!quantityList || quantityList.length === 0) && event.epcis_document) {
        const doc = event.epcis_document as any
        if (doc?.epcisBody?.eventList?.[0]?.quantityList) {
          quantityList = doc.epcisBody.eventList[0].quantityList
        }
      }
      
      // For transformation events, use input/output quantities
      if (event.event_type === 'TransformationEvent') {
        if (event.input_quantity || event.output_quantity) {
          quantityList = {
            input: event.input_quantity,
            output: event.output_quantity
          }
        }
      }
      
      return {
        ...event,
        quantity_list: quantityList
      }
    }) || []

    console.log('[v0] Successfully fetched events:', enrichedEvents.length)
    console.log('[v0] First event quantity_list:', enrichedEvents[0]?.quantity_list)

    return NextResponse.json({
      success: true,
      data: enrichedEvents,
      count: enrichedEvents.length,
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
