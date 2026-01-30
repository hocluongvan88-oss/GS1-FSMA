import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Supabase client with service role for bypassing RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Initialize Gemini AI
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
  console.log('[v0] Voice process API: Received request')
  
  try {
    const body = await request.json()
    const { mockTranscript, userId, userName, locationGLN } = body

    console.log('[v0] Voice process API: Processing transcript:', mockTranscript)

    if (!mockTranscript) {
      return NextResponse.json(
        { success: false, error: 'No transcript provided' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    let extractedData
    let method = 'regex'

    // Try Gemini AI if available
    if (process.env.GEMINI_API_KEY) {
      try {
        // Using updated model gemini-2.0-flash
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        
        const prompt = `Analyze this Vietnamese voice transcript about supply chain/product information and extract data.

Transcript: "${mockTranscript}"

Extract and return JSON format:
{
  "productName": "product name mentioned",
  "quantity": number or null,
  "unit": "unit mentioned (kg, thung, bao, etc.)",
  "action": "nhap" | "xuat" | "kiem_tra" | "che_bien",
  "batchNumber": "batch/lot number if mentioned",
  "supplier": "supplier name if mentioned",
  "notes": "additional info"
}

Common Vietnamese patterns:
- "nhap X kg/thung/bao Y" = receiving X amount of Y
- "xuat X kg/thung/bao Y" = shipping X amount of Y
- "kiem tra lo hang" = inspecting shipment
- "che bien" = processing/transformation

Always return valid JSON only.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        console.log('[v0] Voice process API: Gemini response:', responseText)

        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
          method = 'gemini-ai'
        }
      } catch (aiError) {
        console.log('[v0] Voice process API: Gemini failed, falling back to regex:', aiError)
      }
    }

    // Fallback to regex parsing
    if (!extractedData) {
      extractedData = parseVietnameseTranscript(mockTranscript)
    }

    if (!extractedData.productName) {
      return NextResponse.json({
        success: false,
        validation: {
          isValid: false,
          errors: ['Could not extract product information from transcript']
        }
      }, { status: 400, headers: CORS_HEADERS })
    }

    // Create EPCIS event
    const eventResult = await createEPCISEvent(extractedData, userId, userName, locationGLN)

    return NextResponse.json({
      success: true,
      eventId: eventResult.id,
      extractedData,
      method
    }, { headers: CORS_HEADERS })

  } catch (error: any) {
    console.error('[v0] Voice process API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

function parseVietnameseTranscript(transcript: string) {
  const text = transcript.toLowerCase()
  
  const patterns = {
    receive: /nh[aậ]p\s+(\d+)\s*(kg|thùng|bao|hộp|chai|lon|gói|kiện)?\s*(.+)/i,
    ship: /xu[aấ]t\s+(\d+)\s*(kg|thùng|bao|hộp|chai|lon|gói|kiện)?\s*(.+)/i,
    inspect: /ki[eể]m tra\s*(.+)?/i,
    process: /ch[eế] bi[eế]n\s*(.+)?/i,
    quantity: /(\d+)\s*(kg|thùng|bao|hộp|chai|lon|gói|kiện)/i
  }

  let action = 'observe'
  let quantity: number | null = null
  let unit: string | null = null
  let productName: string | null = null

  let match = text.match(patterns.receive)
  if (match) {
    action = 'nhap'
    quantity = parseInt(match[1])
    unit = match[2] || 'kg'
    productName = match[3]?.trim() || null
  }

  if (!productName) {
    match = text.match(patterns.ship)
    if (match) {
      action = 'xuat'
      quantity = parseInt(match[1])
      unit = match[2] || 'kg'
      productName = match[3]?.trim() || null
    }
  }

  if (!productName) {
    match = text.match(patterns.inspect)
    if (match) {
      action = 'kiem_tra'
      productName = match[1]?.trim() || 'lo hang'
    }
  }

  if (!productName) {
    match = text.match(patterns.process)
    if (match) {
      action = 'che_bien'
      productName = match[1]?.trim() || 'nguyen lieu'
    }
  }

  if (!quantity) {
    match = text.match(patterns.quantity)
    if (match) {
      quantity = parseInt(match[1])
      unit = match[2]
    }
  }

  if (!productName && text.length > 0) {
    productName = text.replace(/nh[aậ]p|xu[aấ]t|ki[eể]m tra|ch[eế] bi[eế]n|\d+|kg|thùng|bao/gi, '').trim()
  }

  return {
    productName: productName || null,
    quantity,
    unit,
    action,
    batchNumber: null,
    supplier: null,
    notes: `Parsed from transcript: ${transcript}`
  }
}

async function createEPCISEvent(
  data: { 
    productName: string
    quantity?: number | null
    unit?: string | null
    action?: string
    batchNumber?: string | null
  },
  userId: string,
  userName: string,
  locationGLN: string
) {
  const eventId = `urn:uuid:${crypto.randomUUID()}`
  const now = new Date().toISOString()

  const bizStepMap: Record<string, string> = {
    'nhap': 'receiving',
    'xuat': 'shipping',
    'kiem_tra': 'inspecting',
    'che_bien': 'commissioning',
    'observe': 'observing'
  }

  const actionMap: Record<string, string> = {
    'nhap': 'ADD',
    'xuat': 'DELETE',
    'kiem_tra': 'OBSERVE',
    'che_bien': 'TRANSFORM',
    'observe': 'OBSERVE'
  }

  const eventData = {
    id: eventId,
    event_type: 'ObjectEvent',
    action: actionMap[data.action || 'observe'] || 'OBSERVE',
    biz_step: bizStepMap[data.action || 'observe'] || 'observing',
    disposition: 'active',
    event_time: now,
    event_timezone_offset: '+07:00',
    read_point: locationGLN,
    biz_location: locationGLN,
    epc_list: [`urn:epc:id:sgtin:${locationGLN}.${Date.now()}`],
    quantity_list: data.quantity ? [{
      epc_class: `urn:epc:class:lgtin:${locationGLN}.${data.productName.replace(/\s/g, '_')}`,
      quantity: data.quantity,
      uom: (data.unit || 'KGM').toUpperCase()
    }] : null,
    source_type: 'voice_input',
    created_by: userId,
    user_name: userName,
    raw_input: JSON.stringify(data),
    ilmd: data.batchNumber ? { lotNumber: data.batchNumber } : null
  }

  console.log('[v0] Voice process API: Creating event:', eventId)

  const { data: result, error } = await supabase
    .from('epcis_events')
    .insert(eventData)
    .select()
    .single()

  if (error) {
    console.error('[v0] Voice process API: DB error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  return result
}
