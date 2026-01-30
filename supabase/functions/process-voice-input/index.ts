/**
 * Supabase Edge Function: Process Voice Input
 * Uses OpenAI Whisper for speech-to-text and GPT for parsing
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { env } from 'https://deno.land/std@0.168.0/dotenv/mod.ts'

const envData = await env()
const openaiApiKey = envData['OPENAI_API_KEY']
const supabaseUrl = envData['SUPABASE_URL']!
const supabaseServiceKey = envData['SUPABASE_SERVICE_ROLE_KEY']!

interface VoiceProcessingRequest {
  audioUrl: string
  userId?: string
  location?: string
}

interface ParsedEventData {
  action: string // 'harvest', 'pack', 'ship', 'transform', etc.
  quantity?: number
  unit?: string
  product?: string
  location?: string
  notes?: string
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', { 
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        } 
      })
    }

    const { audioUrl, userId, location } = await req.json() as VoiceProcessingRequest

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: 'audioUrl is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Voice AI] Processing audio from:', audioUrl)

    // Step 1: Download audio file
    const audioResponse = await fetch(audioUrl)
    const audioBlob = await audioResponse.blob()
    const audioBuffer = await audioBlob.arrayBuffer()

    // Step 2: Transcribe with OpenAI Whisper
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'vi') // Vietnamese
    formData.append('response_format', 'json')

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    })

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text()
      console.error('[Voice AI] Transcription error:', error)
      throw new Error('Transcription failed')
    }

    const transcription = await transcriptionResponse.json()
    const transcript = transcription.text

    console.log('[Voice AI] Transcript:', transcript)

    // Step 3: Parse transcript with GPT to extract structured data
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an assistant that extracts structured data from farmer/worker voice input for a traceability system.
Extract the following information from the transcript:
- action: harvest, pack, ship, receive, transform, inspect (map to EPCIS bizStep)
- quantity: number
- unit: kg, ton, box, bag, etc.
- product: product name (coffee, rice, etc.)
- location: location mentioned
- notes: any additional information

Respond ONLY with valid JSON. Example:
{"action": "harvest", "quantity": 50, "unit": "kg", "product": "cà phê", "location": "vườn A", "notes": "chất lượng tốt"}`
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    })

    if (!parseResponse.ok) {
      console.error('[Voice AI] Parse error:', await parseResponse.text())
      throw new Error('Parsing failed')
    }

    const parseResult = await parseResponse.json()
    const parsedData: ParsedEventData = JSON.parse(parseResult.choices[0].message.content)

    console.log('[Voice AI] Parsed data:', parsedData)

    // Step 4: Map to EPCIS business step
    const bizStepMap: Record<string, string> = {
      'harvest': 'commissioning',
      'pack': 'packing',
      'ship': 'shipping',
      'receive': 'receiving',
      'transform': 'transforming',
      'inspect': 'inspecting',
      'observe': 'observing'
    }

    const bizStep = bizStepMap[parsedData.action?.toLowerCase()] || 'observing'

    // Step 5: Log AI processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: logData, error: logError } = await supabase
      .from('ai_processing_logs')
      .insert({
        processing_type: 'voice',
        input_data: { audioUrl, transcript },
        ai_provider: 'openai',
        raw_response: { transcription, parsedData },
        confidence_score: 0.85, // Could extract from Whisper confidence
        processing_time_ms: 0, // Calculate actual time
        status: 'completed'
      })
      .select()
      .single()

    if (logError) {
      console.error('[Voice AI] Logging error:', logError)
    }

    // Return structured result
    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        parsedData,
        bizStep,
        confidence: 0.85,
        logId: logData?.id
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})
