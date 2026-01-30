import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateTransformationEvent, type QuantityItem } from '@/lib/utils/mass-balance'
import { TraceabilityService } from '@/lib/services/traceability'

/**
 * Test endpoint for transformation events
 * This bypasses authentication for testing purposes only
 * DO NOT use in production - this is only for the /zalo-test page
 */
export async function POST(request: Request) {
  try {
    console.log('[v0] Test transformation endpoint called')
    
    const body = await request.json()
    console.log('[v0] Request body:', JSON.stringify(body, null, 2))
    
    const {
      inputProducts,
      outputProducts,
      location,
      bizStep,
      productType,
      customConversionFactor,
      testUserId,
      testUserName
    } = body

    // Validate required fields
    if (!inputProducts || !Array.isArray(inputProducts) || inputProducts.length === 0) {
      console.log('[v0] Validation error: missing inputProducts')
      return NextResponse.json(
        { success: false, error: 'Input products are required' },
        { status: 400 }
      )
    }

    if (!outputProducts || !Array.isArray(outputProducts) || outputProducts.length === 0) {
      console.log('[v0] Validation error: missing outputProducts')
      return NextResponse.json(
        { success: false, error: 'Output products are required' },
        { status: 400 }
      )
    }

    if (!location) {
      console.log('[v0] Validation error: missing location')
      return NextResponse.json(
        { success: false, error: 'Location (GLN) is required' },
        { status: 400 }
      )
    }

    // Convert to EPC URIs and quantities
    const inputEpcList: string[] = []
    const inputQuantity: QuantityItem[] = []
    
    for (const input of inputProducts) {
      if (!input.gtin || !input.quantity || !input.uom) {
        console.log('[v0] Validation error: invalid input product', input)
        return NextResponse.json(
          { success: false, error: 'Each input must have gtin, quantity, and uom' },
          { status: 400 }
        )
      }
      
      // Generate EPC URI
      const epcUri = `urn:epc:id:sgtin:${input.gtin}.${Date.now()}`
      inputEpcList.push(epcUri)
      
      inputQuantity.push({
        value: input.quantity,
        uom: input.uom,
        gtin: input.gtin
      })
    }

    const outputEpcList: string[] = []
    const outputQuantity: QuantityItem[] = []
    
    for (const output of outputProducts) {
      if (!output.gtin || !output.quantity || !output.uom) {
        console.log('[v0] Validation error: invalid output product', output)
        return NextResponse.json(
          { success: false, error: 'Each output must have gtin, quantity, and uom' },
          { status: 400 }
        )
      }
      
      const epcUri = `urn:epc:id:sgtin:${output.gtin}.${Date.now()}`
      outputEpcList.push(epcUri)
      
      outputQuantity.push({
        value: output.quantity,
        uom: output.uom,
        gtin: output.gtin
      })
    }

    // Validate mass balance
    const validation = validateTransformationEvent({
      inputQuantities: inputQuantity,
      outputQuantities: outputQuantity,
      productType,
      customConversionFactor
    })

    console.log('[v0] Mass balance validation:', validation)

    // Create Supabase admin client to bypass RLS for test endpoint
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

    // Create transformation event directly with admin client
    const eventTime = new Date().toISOString()
    const eventId = `urn:uuid:${crypto.randomUUID()}`

    const epcisDocument = {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: eventTime,
      epcisBody: {
        eventList: [
          {
            eventID: eventId,
            type: 'TransformationEvent',
            eventTime,
            eventTimeZoneOffset: '+07:00',
            inputEPCList: inputEpcList,
            outputEPCList: outputEpcList,
            inputQuantityList: inputQuantity.map(q => ({
              epcClass: `urn:epc:class:lgtin:${q.gtin}.batch123`,
              quantity: q.value,
              uom: q.uom
            })),
            outputQuantityList: outputQuantity.map(q => ({
              epcClass: `urn:epc:class:lgtin:${q.gtin}.batch456`,
              quantity: q.value,
              uom: q.uom
            })),
            bizStep: bizStep || 'commissioning',
            readPoint: { id: `urn:epc:id:sgln:${location}` }
          }
        ]
      }
    }

    const { data: event, error: insertError } = await supabaseAdmin
      .from('events')
      .insert({
        // Note: 'id' is auto-generated by database, not 'event_id'
        event_type: 'TransformationEvent',
        event_time: eventTime,
        biz_step: bizStep || 'commissioning',
        read_point: location,
        input_epc_list: inputEpcList,
        output_epc_list: outputEpcList,
        input_quantity_list: inputQuantity,
        output_quantity_list: outputQuantity,
        epcis_document: epcisDocument,
        user_id: testUserId || '00000000-0000-0000-0000-000000000001',
        user_name: testUserName || 'Test User',
        source_type: 'manual',
        ai_metadata: {
          massBalance: {
            conversionFactor: validation.conversionFactor,
            valid: validation.valid,
            anomalies: validation.anomalies,
            warnings: validation.warnings
          },
          isTestData: true
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('[v0] Insert error:', insertError)
      throw insertError
    }

    console.log('[v0] Event created successfully:', event.id)

    return NextResponse.json({
      success: true,
      event,
      validation: {
        conversionFactor: validation.conversionFactor,
        valid: validation.valid,
        anomalies: validation.anomalies,
        warnings: validation.warnings
      }
    })
  } catch (error) {
    console.error('[v0] Test transformation event error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
