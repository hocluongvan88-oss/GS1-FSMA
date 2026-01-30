import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TraceabilityService } from '@/lib/services/traceability-service'
import { validateTransformationEvent, type QuantityItem } from '@/lib/utils/mass-balance'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      inputProducts,
      outputProducts,
      location,
      bizStep,
      productType,
      customConversionFactor
    } = body

    // Validate required fields
    if (!inputProducts || !Array.isArray(inputProducts) || inputProducts.length === 0) {
      return NextResponse.json(
        { error: 'Input products are required' },
        { status: 400 }
      )
    }

    if (!outputProducts || !Array.isArray(outputProducts) || outputProducts.length === 0) {
      return NextResponse.json(
        { error: 'Output products are required' },
        { status: 400 }
      )
    }

    if (!location) {
      return NextResponse.json(
        { error: 'Location (GLN) is required' },
        { status: 400 }
      )
    }

    // Convert to EPC URIs and quantities
    const inputEpcList: string[] = []
    const inputQuantity: QuantityItem[] = []
    
    for (const input of inputProducts) {
      if (!input.gtin || !input.quantity || !input.uom) {
        return NextResponse.json(
          { error: 'Each input must have gtin, quantity, and uom' },
          { status: 400 }
        )
      }
      
      // Generate EPC URI (simplified - in production use proper batch/serial)
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
        return NextResponse.json(
          { error: 'Each output must have gtin, quantity, and uom' },
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

    // Get user profile for userName
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Create transformation event
    const traceabilityService = new TraceabilityService()
    const event = await traceabilityService.createTransformationEvent({
      inputEpcList,
      outputEpcList,
      inputQuantity,
      outputQuantity,
      bizStep: bizStep || 'commissioning',
      location,
      userId: user.id,
      userName: profile?.full_name || user.email || 'Unknown',
      sourceType: 'manual',
      aiMetadata: {
        massBalance: {
          conversionFactor: validation.conversionFactor,
          valid: validation.valid,
          anomalies: validation.anomalies,
          warnings: validation.warnings
        }
      }
    })

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
    console.error('[v0] Transformation event error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
