import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Supabase client with service role for bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Initialize Gemini AI with v1 API (stable)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  console.log('[v0] Vision process API: Received request')
  
  try {
    const body = await request.json()
    const { imageUrl, userId, userName, locationGLN } = body

    console.log('[v0] Vision process API: Processing image')

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.log('[v0] Vision process API: No GEMINI_API_KEY')
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY not configured. Please add it to your environment variables.',
        validation: {
          isValid: false,
          errors: ['GEMINI_API_KEY is required for vision processing']
        }
      }, { status: 500, headers: CORS_HEADERS })
    }

    // Use Gemini Vision with gemini-1.5-flash-latest (supported by v1 API)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })
    
    // Extract base64 data from data URL
    let imageData: string
    let mimeType: string = 'image/jpeg'
    
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:(.+);base64,(.+)$/)
      if (matches) {
        mimeType = matches[1]
        imageData = matches[2]
      } else {
        throw new Error('Invalid base64 image format')
      }
    } else {
      // If it's a URL, fetch it
      const response = await fetch(imageUrl)
      const arrayBuffer = await response.arrayBuffer()
      imageData = Buffer.from(arrayBuffer).toString('base64')
      mimeType = response.headers.get('content-type') || 'image/jpeg'
    }

    const prompt = `Analyze this image of a product or supply chain item. Extract the following information in JSON format:

{
  "productName": "name of the product visible",
  "quantity": number or null if not visible,
  "unit": "unit if visible (kg, pieces, boxes, etc.)",
  "brand": "brand name if visible",
  "batchNumber": "batch/lot number if visible",
  "expiryDate": "expiry date if visible",
  "barcode": "barcode number if visible",
  "condition": "good" | "damaged" | "unknown",
  "notes": "any additional observations"
}

If you cannot determine certain fields, use null. Always return valid JSON.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageData
        }
      }
    ])

    const responseText = result.response.text()
    console.log('[v0] Vision process API: Gemini response:', responseText)

    // Parse Gemini response
    let extractedData
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch {
      console.log('[v0] Vision process API: Failed to parse Gemini response')
      return NextResponse.json({
        success: false,
        validation: {
          isValid: false,
          errors: ['Could not parse image analysis results']
        }
      }, { status: 400, headers: CORS_HEADERS })
    }

    if (!extractedData.productName) {
      return NextResponse.json({
        success: false,
        validation: {
          isValid: false,
          errors: ['Could not identify product in image']
        }
      }, { status: 400, headers: CORS_HEADERS })
    }

    // Create EPCIS event
    const eventResult = await createEPCISEvent(extractedData, userId, userName, locationGLN)

    return NextResponse.json({
      success: true,
      eventId: eventResult.id,
      extractedData,
      method: 'gemini-vision'
    }, { headers: CORS_HEADERS })

  } catch (error: any) {
    console.error('[v0] Vision process API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

async function createEPCISEvent(
  data: { 
    productName: string
    quantity?: number | null
    unit?: string | null
    batchNumber?: string | null
    condition?: string 
  },
  userId: string,
  userName: string,
  locationGLN: string
) {
  const now = new Date().toISOString()

  // Build EPCIS 2.0 JSON-LD document
  const epcisDocument = {
    '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    creationDate: now,
    epcisBody: {
      eventList: [{
        type: 'ObjectEvent',
        eventTime: now,
        eventTimeZoneOffset: '+07:00',
        action: 'OBSERVE',
        bizStep: 'inspecting',
        disposition: data.condition === 'damaged' ? 'damaged' : 'active',
        readPoint: { id: `urn:epc:id:sgln:${locationGLN}` },
        bizLocation: { id: `urn:epc:id:sgln:${locationGLN}` },
        epcList: [`urn:epc:id:sgtin:${locationGLN}.${Date.now()}`],
        quantityList: data.quantity ? [{
          epcClass: `urn:epc:class:lgtin:${locationGLN}.${data.productName.replace(/\s/g, '_')}`,
          quantity: data.quantity,
          uom: (data.unit || 'EA').toUpperCase()
        }] : undefined
      }]
    }
  }

  // Match the actual database schema from 001-create-epcis-schema.sql
  const eventData = {
    event_type: 'ObjectEvent',
    event_time: now,
    event_timezone: 'Asia/Ho_Chi_Minh',
    biz_step: 'inspecting',
    disposition: data.condition === 'damaged' ? 'damaged' : 'active',
    read_point: locationGLN,
    biz_location: locationGLN,
    epc_list: [`urn:epc:id:sgtin:${locationGLN}.${Date.now()}`],
    user_id: userId,
    user_name: userName,
    source_type: 'vision_ai',  // Valid value per database constraint
    ai_metadata: {
      method: 'gemini_vision',
      extractedData: data,
      confidence: 0.90
    },
    epcis_document: epcisDocument
  }

  console.log('[v0] Vision process API: Creating event')

  const { data: result, error } = await supabase
    .from('events')  // Correct table name
    .insert(eventData)
    .select()
    .single()

  if (error) {
    console.error('[v0] Vision process API: DB error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return result
}
