/**
 * Supabase Edge Function: Process Vision Input
 * Uses Google Vision API for OCR and OpenAI GPT-4o for object counting
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { env } from 'https://deno.land/std@0.168.0/dotenv/mod.ts'

await env.load()

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
const googleCloudApiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface VisionProcessingRequest {
  imageUrl: string
  processingType: 'ocr' | 'counting' | 'both'
  userId?: string
}

interface VisionResult {
  ocr?: {
    text: string
    codes: string[] // GTIN, serial numbers, lot numbers
    confidence: number
  }
  counting?: {
    count: number
    objectType: string
    confidence: number
  }
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

    const { imageUrl, processingType = 'both', userId } = await req.json() as VisionProcessingRequest

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Vision AI] Processing image:', imageUrl, 'Type:', processingType)

    const result: VisionResult = {}

    // Process OCR if needed
    if (processingType === 'ocr' || processingType === 'both') {
      result.ocr = await processOCR(imageUrl)
    }

    // Process object counting if needed
    if (processingType === 'counting' || processingType === 'both') {
      result.counting = await processObjectCounting(imageUrl)
    }

    // Log AI processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: logData, error: logError } = await supabase
      .from('ai_processing_logs')
      .insert({
        processing_type: 'vision',
        input_data: { imageUrl, processingType },
        ai_provider: processingType === 'ocr' ? 'google' : 'openai',
        raw_response: result,
        confidence_score: result.ocr?.confidence || result.counting?.confidence || 0.8,
        processing_time_ms: 0,
        status: 'completed'
      })
      .select()
      .single()

    if (logError) {
      console.error('[Vision AI] Logging error:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
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
 * Process OCR using Google Cloud Vision API
 */
async function processOCR(imageUrl: string) {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${googleCloudApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 10 },
                { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 }
              ]
            }
          ]
        })
      }
    )

    if (!response.ok) {
      throw new Error('Google Vision API failed')
    }

    const data = await response.json()
    const textAnnotations = data.responses[0]?.textAnnotations || []
    
    const fullText = textAnnotations[0]?.description || ''
    
    // Extract GS1 codes (GTIN, SSCC, GLN, etc.)
    const gtinRegex = /\b\d{8,14}\b/g
    const codes = fullText.match(gtinRegex) || []

    console.log('[Vision AI] OCR detected text:', fullText)
    console.log('[Vision AI] OCR detected codes:', codes)

    return {
      text: fullText,
      codes: [...new Set(codes)], // Remove duplicates
      confidence: textAnnotations[0]?.confidence || 0.8
    }
  } catch (error) {
    console.error('[Vision AI] OCR error:', error)
    throw error
  }
}

/**
 * Process object counting using GPT-4o Vision
 */
async function processObjectCounting(imageUrl: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert at counting objects in images for supply chain management. Count the number of items/products visible and identify what they are. Respond ONLY with valid JSON: {"count": number, "objectType": "description", "confidence": 0.0-1.0}'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Count the number of items in this image and identify what they are.'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Vision AI] GPT-4o error:', error)
      throw new Error('Object counting failed')
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log('[Vision AI] Counting result:', result)

    return {
      count: result.count || 0,
      objectType: result.objectType || 'unknown',
      confidence: result.confidence || 0.7
    }
  } catch (error) {
    console.error('[Vision AI] Counting error:', error)
    throw error
  }
}
