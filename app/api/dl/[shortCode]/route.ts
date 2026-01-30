/**
 * GS1 Digital Link Resolver
 * Route: /api/dl/{shortCode}
 * Resolves short URLs to product traceability information
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const { shortCode } = params

    // Resolve short code to digital link data
    const { data: linkData, error: linkError } = await supabase
      .from('digital_links')
      .select('*')
      .eq('short_url', shortCode)
      .single()

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Increment access count
    await supabase
      .from('digital_links')
      .update({ access_count: linkData.access_count + 1 })
      .eq('id', linkData.id)

    // Get product information
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('gtin', linkData.gtin)
      .single()

    if (productError) {
      return NextResponse.json(
        { error: 'Product information not found' },
        { status: 404 }
      )
    }

    // Get traceability events for this product
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .contains('epc_list', [linkData.epc])
      .order('event_time', { ascending: false })
      .limit(20)

    // Build GS1 Digital Link response
    const digitalLinkResponse = {
      '@context': 'https://ref.gs1.org/standards/digital-link/1.1',
      'identifier': {
        'gtin': linkData.gtin,
        'lot': linkData.lot,
        'serial': linkData.serial
      },
      'product': {
        'gtin': productData.gtin,
        'name': productData.name,
        'description': productData.description,
        'category': productData.category,
        'metadata': productData.metadata
      },
      'traceability': {
        'events': eventsData || [],
        'totalEvents': eventsData?.length || 0
      },
      'links': [
        {
          'rel': 'gs1:certificationInfo',
          'href': `/api/certification/${linkData.gtin}`
        },
        {
          'rel': 'gs1:sustainabilityInfo',
          'href': `/api/sustainability/${linkData.gtin}`
        },
        {
          'rel': 'gs1:traceability',
          'href': `/api/traceability/${linkData.gtin}`
        }
      ],
      'accessInfo': {
        'accessCount': linkData.access_count + 1,
        'shortUrl': `${request.nextUrl.origin}/dl/${shortCode}`
      }
    }

    return NextResponse.json(digitalLinkResponse)

  } catch (error) {
    console.error('[Digital Link] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
