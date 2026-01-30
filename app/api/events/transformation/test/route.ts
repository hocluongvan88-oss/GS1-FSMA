import { NextResponse } from 'next/server'
import { TraceabilityService } from '@/lib/services/traceability-service'
import { validateTransformationEvent, type QuantityItem } from '@/lib/utils/mass-balance'

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

    // Create transformation event using test user info
    const traceabilityService = new TraceabilityService()
    const event = await traceabilityService.createTransformationEvent({
      inputEpcList,
      outputEpcList,
      inputQuantity,
      outputQuantity,
      bizStep: bizStep || 'commissioning',
      location,
      userId: testUserId || 'test-user',
      userName: testUserName || 'Test User',
      sourceType: 'manual',
      aiMetadata: {
        massBalance: {
          conversionFactor: validation.conversionFactor,
          valid: validation.valid,
          anomalies: validation.anomalies,
          warnings: validation.warnings
        },
        isTestData: true
      }
    })

    console.log('[v0] Event created:', event.id)

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
