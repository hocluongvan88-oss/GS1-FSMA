/**
 * Supabase Edge Function: Process Voice Input with Gemini 2.0 Flash
 * Uses Gemini 2.0 Flash for native audio processing + transcription + EPCIS extraction
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0'
import { Deno } from 'https://deno.land/std@0.168.0/io/mod.ts'

const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// CORS Headers - Required for browser/Zalo access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(geminiApiKey!)

interface VoiceProcessingRequest {
  audioUrl: string
  userId: string
  userName: string
  locationGLN?: string
}

interface VoiceResult {
  success: boolean
  extractedData: {
    transcription: string
    eventType: string
    action: string
    productName?: string
    quantity?: number
    unit?: string
    location?: string
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

    const { audioUrl, userId, userName, locationGLN } = await req.json() as VoiceProcessingRequest

    if (!audioUrl || !userId) {
      return new Response(
        JSON.stringify({ error: 'audioUrl and userId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[Voice AI] Processing audio with Gemini 2.0 Flash:', audioUrl)
    
    const startTime = Date.now()

    // Process audio with Gemini 2.0 Flash
    const aiResult = await processAudioWithGemini(audioUrl)
    
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
          console.error('[Voice AI] Failed to save event:', eventError)
          validation.errors.push('Failed to save event to database')
          validation.valid = false
        } else {
          console.log('[Voice AI] Event saved:', eventData.id)
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
        processing_type: 'voice',
        input_data: { audioUrl },
        ai_provider: 'gemini',
        raw_response: aiResult,
        confidence_score: aiResult.confidence,
        processing_time_ms: processingTime,
        status: validation.valid ? 'completed' : 'failed',
        error_message: validation.errors.join('; ') || null
      })
      .select()
      .single()

    const result: VoiceResult = {
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
    console.error('[Voice AI] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Voice processing failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Process audio using Gemini 2.0 Flash with native audio support
 */
async function processAudioWithGemini(audioUrl: string) {
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

    // Fetch audio and convert to base64
    const audioResponse = await fetch(audioUrl)
    const audioBuffer = await audioResponse.arrayBuffer()
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))

    const prompt = `Transcribe this Vietnamese audio and extract supply chain event information. Extract:
1. Full transcription (in Vietnamese)
2. Event type (nhận hàng/receiving, xuất hàng/shipping, sản xuất/production, đóng gói/packing, kiểm tra/inspection)
3. Product information (tên sản phẩm, số lượng, đơn vị)
4. Location if mentioned

Respond with ONLY valid JSON in this exact format:
{
  "transcription": "full transcription text",
  "eventType": "ObjectEvent or TransformationEvent",
  "action": "receiving/shipping/production/packing/inspection",
  "productName": "product name or null",
  "quantity": number or null,
  "unit": "kg/bao/thùng/cái or null",
  "location": "location name or null",
  "confidence": 0.0-1.0
}`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'audio/mp3',
          data: base64Audio
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

  // Required fields
  if (!data.transcription || data.transcription.length < 10) {
    errors.push('Transcription too short or missing')
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
            recordedBy: userName,
            sourceSystem: 'voice_ai',
            aiConfidence: aiData.confidence,
            transcription: aiData.transcription
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
      source_type: 'voice_ai',
      input_epc_list: null,
      output_epc_list: null,
      input_quantity: null,
      output_quantity: aiData.quantity ? [{
        value: aiData.quantity,
        uom: aiData.unit
      }] : null,
      ai_metadata: {
        confidence_score: aiData.confidence,
        transcription: aiData.transcription,
        raw_ai_output: aiData
      },
      epcis_document: epcisDocument
    }
  } catch (error) {
    console.error('[EPCIS Mapping] Error:', error)
    return null
  }
}
