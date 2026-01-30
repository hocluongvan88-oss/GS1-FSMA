/**
 * Supabase Edge Function: Process Vision Input with Gemini 2.0 Flash
 * Uses Gemini 2.0 Flash for native vision processing + OCR + EPCIS extraction
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0'
// Note: Deno is a global object in Deno runtime, no import needed

// CORS Headers - Required for browser/Zalo access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VisionProcessingRequest {
  imageUrl: string
  userId: string
  userName: string
  locationGLN?: string
}

interface VisionResult {
  success: boolean
  extractedData: {
    description: string
    eventType: string
    action: string
    productName?: string
    quantity?: number
    unit?: string
    batchNumber?: string
    location?: string
    isRelevant?: boolean
    rejectionReason?: string
    detectedObjects?: string[]
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
  // Handle CORS preflight immediately - CRITICAL for browser/Zalo access
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize environment variables and Gemini AFTER OPTIONS check
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    
    const genAI = new GoogleGenerativeAI(geminiApiKey)

    const { imageUrl, userId, userName, locationGLN } = await req.json() as VisionProcessingRequest

    if (!imageUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'imageUrl and userId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[Vision AI] Processing image with Gemini 2.0 Flash:', imageUrl)
    
    const startTime = Date.now()

    // Process image with Gemini 2.0 Flash
    const aiResult = await processImageWithGemini(imageUrl, genAI)
    
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Process image using Gemini 2.0 Flash with native vision
 */
async function processImageWithGemini(imageUrl: string, genAI: GoogleGenerativeAI) {
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

    const prompt = `Analyze this supply chain image and extract information. Look for:
1. Product information (tên sản phẩm, labels, packaging)
2. Quantities (số lượng visible in the image)
3. Batch/lot numbers (mã lô, batch code)
4. Event type (receiving, shipping, inspection, production)
5. Location or warehouse information if visible

Respond with ONLY valid JSON in this exact format:
{
  "description": "detailed description of what you see",
  "isRelevant": true or false,
  "rejectionReason": "reason if not relevant, null otherwise",
  "eventType": "ObjectEvent or TransformationEvent",
  "action": "receiving/shipping/production/packing/inspection",
  "productName": "product name or null",
  "quantity": number or null,
  "unit": "kg/bao/thùng/cái or null",
  "batchNumber": "batch code or null",
  "location": "location name or null",
  "detectedObjects": ["list", "of", "objects"],
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
    const text = await response.text()
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

  // Check image relevance first
  if (data.isRelevant === false) {
    errors.push(`Image rejected: ${data.rejectionReason || 'Not supply chain related'}`)
    return { valid: false, errors, warnings }
  }

  // Required fields
  if (!data.description || data.description.length < 20) {
    errors.push('Description too short or missing')
  }

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
          bizStep: `https://ns.gs1.org/voc/Bizstep-${bizStep}`,
          disposition: `https://ns.gs1.org/voc/Disp-${disposition}`,
          bizLocation: locationGLN ? {
            id: `urn:epc:id:sgln:${locationGLN.replace(/\D/g, '')}.0`
          } : undefined,
          ilmd: {
            productName: aiData.productName,
            quantity: aiData.quantity,
            uom: aiData.unit,
            batchNumber: aiData.batchNumber,
            recordedBy: userName,
            sourceSystem: 'vision_ai',
            aiConfidence: aiData.confidence,
            description: aiData.description
          }
        }]
      }
    }

    return {
      event_type: eventType,
      event_time: eventTime,
      event_timezone: 'Asia/Ho_Chi_Minh',
      epc_list: null,
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
        description: aiData.description,
        batch_number: aiData.batchNumber,
        detected_objects: aiData.detectedObjects,
        raw_ai_output: aiData
      },
      epcis_document: epcisDocument
    }
  } catch (error) {
    console.error('[EPCIS Mapping] Error:', error)
    return null
  }
}
