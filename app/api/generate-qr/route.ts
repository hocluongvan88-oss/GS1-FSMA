/**
 * QR Code Generator for GS1 Digital Links
 * Creates QR codes with GS1 Digital Link URIs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const { gtin, lot, serial, metadata } = await request.json()

    if (!gtin) {
      return NextResponse.json(
        { error: 'GTIN is required' },
        { status: 400 }
      )
    }

    // Verify product exists
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('gtin', gtin)
      .single()

    if (productError || !productData) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Generate short code
    let shortCode = generateShortCode()
    let attempts = 0
    
    // Ensure uniqueness
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('digital_links')
        .select('id')
        .eq('short_url', shortCode)
        .single()

      if (!existing) break
      shortCode = generateShortCode()
      attempts++
    }

    // Create EPC (Electronic Product Code)
    const epc = `urn:epc:id:sgtin:${gtin.substring(1, 7)}.${gtin.substring(7, 13)}.${serial || '0'}`

    // Store digital link
    console.log('[v0] Inserting digital link with shortCode:', shortCode)
    
    const { data: linkData, error: linkError } = await supabase
      .from('digital_links')
      .insert({
        short_url: shortCode,
        gtin,
        lot,
        serial,
        epc,
        metadata
      })
      .select()
      .single()

    console.log('[v0] Insert result:', { linkData, linkError })

    if (linkError) {
      console.error('[QR Generator] Error creating link:', linkError)
      return NextResponse.json(
        { error: 'Failed to create digital link' },
        { status: 500 }
      )
    }

    // Build GS1 Digital Link URI
    const baseUrl = request.nextUrl.origin
    const digitalLinkUri = `${baseUrl}/01/${gtin}/10/${lot || '000'}/21/${serial || '000'}`
    const shortUrl = `${baseUrl}/dl/${shortCode}`

    // Generate QR code URL using a service
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shortUrl)}&format=svg`

    return NextResponse.json({
      success: true,
      digitalLink: {
        id: linkData.id,
        shortCode,
        shortUrl,
        digitalLinkUri,
        qrCodeUrl,
        gtin,
        lot,
        serial,
        epc,
        product: {
          name: productData.name,
          description: productData.description
        }
      }
    })

  } catch (error) {
    console.error('[QR Generator] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
