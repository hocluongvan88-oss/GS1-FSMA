/**
 * Supabase Edge Function: Process Vision Input with Gemini 2.0 Flash
 * Uses Google Gemini 2.0 Flash for native vision + OCR + validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0'
import { env } from 'https://deno.land/std@0.168.0/env/mod.ts';

const geminiApiKey = env.get('GEMINI_API_KEY')
const supabaseUrl = env.get('SUPABASE_URL')!
const supabaseServiceKey = env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(geminiApiKey!)

interface VisionProcessingRequest {
  imageUrl: string
  userId: string
  userName: string
  locationGLN?: string
}

interface VisionResult {
  success: boolean
  extractedData: {
    eventType: string
    action: string
    productName?: string
    quantity?: number
    unit?: string
    location?: string
    barcodeData?: string
    detectedObjects: string[]
    confidence: number
  }
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  epcisEvent?: any
  logId?: string
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        } 
      })
    }

    const { imageUrl, userId, userName, locationGLN } = await req.json() as VisionProcessingRequest

    if (!imageUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'imageUrl and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Vision AI] Processing image with Gemini 2.0 Flash:', imageUrl)
    
    const startTime = Date.now()

    // Process image with Gemini 2.0 Flash
    const aiResult = await processImageWithGemini(imageUrl)
    
    const processingTime = Date.now() - startTime

    // Validate extracted data
    const validation = validateExtractedData(aiResult)

    // Map to EPCIS if validation passed
    let epcisEvent = null
    if (validation.valid) {
      epcisEvent = await mapToEPCIS(aiResult, userId, userName, locationGLN)
      
      // Save event to database
      if (epcisEvent) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert(epcisEvent)
          .select()
          .single()
        
        if (eventError) {
          console.error('[Vision AI] Failed to save event:', eventError)
          validation.errors.push('Failed to save event to database')
          validation.valid = false
        } else {
          console.log('[Vision AI] Event saved:', eventData.id)
          epcisEvent.id = eventData.id
        }
      }
    }

    // Log AI processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: logData } = await supabase
      .from('ai_processing_logs')
      .insert({
        event_id: epcisEvent?.id || null,
        processing_type: 'vision',
        input_data: { imageUrl },
        ai_provider: 'gemini',
        raw_response: aiResult,
        confidence_score: aiResult.confidence,
        processing_time_ms: processingTime,
        status: validation.valid ? 'completed' : 'failed',
        error_message: validation.errors.join('; ') || null
      })
      .select()
      .single()

    const result: VisionResult = {
      success: validation.valid,
      extractedData: aiResult,
      validation,
      epcisEvent: epcisEvent || undefined,
      logId: logData?.id
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    console.error('[Vision AI] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Vision processing failed' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})

/**
 * Process image using Gemini 2.0 Flash with native vision
 */
async function processImageWithGemini(imageUrl: string) {
  try {
    // Initialize model with JSON response config
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    })

    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))

    const prompt = `CRITICAL: First determine if this image is relevant to supply chain/traceability.

REJECT if image contains:
- Faces, people, selfies
- Landscapes, scenery, nature
- Personal items (phones, clothes, furniture)
- Random objects unrelated to products/packaging
- Food on plates (not packaged products)
- Pets, animals

ACCEPT if image shows:
- Product packages, boxes, bags
- Barcodes, QR codes, labels
- Products on shelves, pallets, warehouses
- Manufacturing/production activities
- Shipping/receiving areas
- Agricultural products (raw materials)

Analyze this image and extract:
1. Is this supply chain relevant? (true/false)
2. Event type (receiving, shipping, production, packing, inspection)
3. Product information (name, quantity, unit)
4. Any visible barcodes, QR codes, GTIN numbers, batch/lot numbers
5. Location information if visible
6. Count of items/packages

Respond with ONLY valid JSON in this exact format:
{
  "isRelevant": true or false,
  "rejectionReason": "reason if not relevant, null otherwise",
  "eventType": "ObjectEvent or TransformationEvent",
  "action": "receiving/shipping/production/packing/inspection",
  "productName": "product name or null",
  "quantity": number or null,
  "unit": "kg/bags/boxes/pcs or null",
  "location": "location name or null",
  "barcodeData": "detected barcode/QR data or null",
  "detectedObjects": ["list", "of", "detected", "items"],
  "confidence": 0.0-1.0
}`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ])

    const response = await result.response
    const text = response.text()
    const extractedData = JSON.parse(text)

    console.log('[Gemini] Extracted data:', extractedData)

    return extractedData
  } catch (error) {
    console.error('[Gemini] Processing error:', error)
    throw error
  }
}

/**
 * Validate extracted data
 */
function validateExtractedData(data: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // CRITICAL: Check image relevance first
  if (data.isRelevant === false) {
    errors.push(`Image rejected: ${data.rejectionReason || 'Not supply chain related'}`)
    console.log('[Vision AI] Image rejected as irrelevant:', data.rejectionReason)
    return {
      valid: false,
      errors,
      warnings: ['This image does not appear to be supply chain related']
    }
  }

  // If isRelevant field is missing, check for supply chain indicators
  if (data.isRelevant === undefined || data.isRelevant === null) {
    // Auto-detect relevance based on detected objects and context
    const supplyChainKeywords = ['box', 'package', 'pallet', 'barcode', 'qr', 'warehouse', 'product', 'label', 'shipping']
    const irrelevantKeywords = ['person', 'face', 'selfie', 'landscape', 'pet', 'animal', 'furniture', 'phone']
    
    const hasSupplyChainIndicators = data.detectedObjects?.some((obj: string) => 
      supplyChainKeywords.some(keyword => obj.toLowerCase().includes(keyword))
    )
    
    const hasIrrelevantIndicators = data.detectedObjects?.some((obj: string) => 
      irrelevantKeywords.some(keyword => obj.toLowerCase().includes(keyword))
    )
    
    if (hasIrrelevantIndicators || !hasSupplyChainIndicators) {
      errors.push('Image does not appear to contain supply chain related content')
      warnings.push('Detected objects: ' + (data.detectedObjects?.join(', ') || 'none'))
      return {
        valid: false,
        errors,
        warnings
      }
    }
  }

  // Required fields
  if (!data.eventType) {
    errors.push('Event type is required')
  }

  if (!data.action) {
    errors.push('Action is required')
  }

  // Check confidence score
  if (data.confidence < 0.6) {
    warnings.push(`Low confidence score: ${data.confidence}. Consider manual review.`)
  }

  // Validate quantity and unit together
  if (data.quantity && !data.unit) {
    warnings.push('Quantity specified without unit')
  }

  // Validate barcode if present
  if (data.barcodeData) {
    // Basic GS1 validation
    const gtinMatch = data.barcodeData.match(/\d{8,14}/)
    if (!gtinMatch) {
      warnings.push('Barcode data does not contain valid GTIN format')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Map AI data to EPCIS event structure
 */
async function mapToEPCIS(aiData: any, userId: string, userName: string, locationGLN?: string) {
  try {
    // Determine event type and business step
    let eventType = 'ObjectEvent'
    let bizStep = 'observing'
    let disposition = 'active'

    const action = aiData.action.toLowerCase()
    
    if (action.includes('receive')) {
      bizStep = 'receiving'
      disposition = 'in_progress'
    } else if (action.includes('ship')) {
      bizStep = 'shipping'
      disposition = 'in_transit'
    } else if (action.includes('production') || action.includes('transform')) {
      eventType = 'TransformationEvent'
      bizStep = 'commissioning'
    } else if (action.includes('pack')) {
      eventType = 'AggregationEvent'
      bizStep = 'packing'
    } else if (action.includes('inspect')) {
      bizStep = 'inspecting'
    }

    // Build EPC from barcode if available
    let epcList: string[] = []
    if (aiData.barcodeData) {
      const gtinMatch = aiData.barcodeData.match(/\d{14}/)
      if (gtinMatch) {
        const epc = `urn:epc:id:sgtin:${gtinMatch[0].substring(1, 8)}.${gtinMatch[0].substring(8, 13)}.${Date.now()}`
        epcList.push(epc)
      }
    }

    // Build EPCIS document
    const eventId = `urn:uuid:${crypto.randomUUID()}`
    const eventTime = new Date().toISOString()

    const epcisDocument = {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: eventTime,
      epcisBody: {
        eventList: [{
          eventID: eventId,
          type: eventType,
          action: 'OBSERVE',
          eventTime,
          eventTimeZoneOffset: '+07:00',
          recordTime: eventTime,
          epcList: epcList.length > 0 ? epcList : undefined,
          bizStep: `https://ns.gs1.org/voc/Bizstep-${bizStep}`,
          disposition: `https://ns.gs1.org/voc/Disp-${disposition}`,
          bizLocation: locationGLN ? {
            id: `urn:epc:id:sgln:${locationGLN.replace(/\D/g, '')}.0`
          } : undefined,
          ilmd: {
            productName: aiData.productName,
            quantity: aiData.quantity,
            uom: aiData.unit,
            recordedBy: userName,
            sourceSystem: 'vision_ai',
            aiConfidence: aiData.confidence
          }
        }]
      }
    }

    return {
      event_type: eventType,
      event_time: eventTime,
      event_timezone: 'Asia/Ho_Chi_Minh',
      epc_list: epcList.length > 0 ? epcList : null,
      biz_step: bizStep,
      disposition,
      read_point: null,
      biz_location: locationGLN || null,
      user_id: userId,
      user_name: userName,
      source_type: 'vision_ai',
      input_epc_list: null,
      output_epc_list: null,
      input_quantity: null,
      output_quantity: aiData.quantity ? [{
        value: aiData.quantity,
        uom: aiData.unit
      }] : null,
      ai_metadata: {
        confidence_score: aiData.confidence,
        detected_objects: aiData.detectedObjects,
        barcode_data: aiData.barcodeData,
        raw_ai_output: aiData
      },
      epcis_document: epcisDocument
    }
  } catch (error) {
    console.error('[EPCIS Mapping] Error:', error)
    return null
  }
}
