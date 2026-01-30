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
  console.log('[v0] Voice process API: Received request')
  
  try {
    const body = await request.json()
    const { mockTranscript, userId, userName, locationGLN } = body

    console.log('[v0] Voice process API: Processing transcript:', mockTranscript)

    // Use mockTranscript for testing
    const transcript = mockTranscript || ''

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: 'No transcript provided' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.log('[v0] Voice process API: No GEMINI_API_KEY, using regex parsing')
      // Fallback to regex parsing if no API key
      const extractedData = parseVietnameseInput(transcript)
      
      if (!extractedData) {
        return NextResponse.json({
          success: false,
          validation: {
            isValid: false,
            errors: ['Không thể phân tích transcript. Vui lòng thử lại với format: "[số lượng] [đơn vị] [tên sản phẩm]"']
          }
        }, { status: 400, headers: CORS_HEADERS })
      }

      // Create EPCIS event
      const eventResult = await createEPCISEvent(extractedData, userId, userName, locationGLN)
      
      return NextResponse.json({
        success: true,
        eventId: eventResult.id,
        extractedData,
        method: 'regex'
      }, { headers: CORS_HEADERS })
    }

    // Use Gemini 2.5 Flash (latest stable model)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Analyze this Vietnamese supply chain input and extract structured data.

Input: "${transcript}"

Extract the following information in JSON format:
{
  "productName": "name of the product",
  "quantity": number,
  "unit": "unit of measurement (kg, g, cái, thùng, etc.)",
  "action": "receive" | "ship" | "transform" | "observe",
  "source": "source location or supplier if mentioned",
  "destination": "destination if mentioned",
  "notes": "any additional notes"
}

If you cannot extract certain fields, use null. Always return valid JSON.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    
    console.log('[v0] Voice process API: Gemini response:', responseText)

    // Parse Gemini response
    let extractedData
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch {
      console.log('[v0] Voice process API: Gemini parse failed, using regex')
      extractedData = parseVietnameseInput(transcript)
    }

    if (!extractedData || !extractedData.productName || !extractedData.quantity) {
      return NextResponse.json({
        success: false,
        validation: {
          isValid: false,
          errors: ['Không thể trích xuất đủ thông tin từ transcript']
        }
      }, { status: 400, headers: CORS_HEADERS })
    }

    // Create EPCIS event
    const eventResult = await createEPCISEvent(extractedData, userId, userName, locationGLN)

    return NextResponse.json({
      success: true,
      eventId: eventResult.id,
      extractedData,
      method: 'gemini'
    }, { headers: CORS_HEADERS })

  } catch (error: any) {
    console.error('[v0] Voice process API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

// Simple Vietnamese regex parser as fallback
function parseVietnameseInput(text: string) {
  // Pattern: [action] [quantity] [unit] [product]
  // Examples: "Nhận 50 kg cà phê", "Xuất 100 thùng sữa"
  
  const patterns = [
    // "Nhận/Xuất/Nhập 50 kg cà phê"
    /(?:nhận|xuất|nhập|giao|lấy)?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|tấn|lít|l|thùng|cái|hộp|bao|túi|chai|lon)\s+(.+)/i,
    // "50 kg cà phê"
    /(\d+(?:[.,]\d+)?)\s*(kg|g|tấn|lít|l|thùng|cái|hộp|bao|túi|chai|lon)\s+(.+)/i,
    // "cà phê 50 kg"
    /(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|tấn|lít|l|thùng|cái|hộp|bao|túi|chai|lon)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const isReversed = pattern === patterns[2]
      return {
        productName: isReversed ? match[1].trim() : match[3].trim(),
        quantity: parseFloat(match[isReversed ? 2 : 1].replace(',', '.')),
        unit: match[isReversed ? 3 : 2].toLowerCase(),
        action: detectAction(text)
      }
    }
  }

  return null
}

function detectAction(text: string): string {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('nhận') || lowerText.includes('nhập')) return 'receive'
  if (lowerText.includes('xuất') || lowerText.includes('giao')) return 'ship'
  if (lowerText.includes('chế biến') || lowerText.includes('sản xuất')) return 'transform'
  return 'observe'
}

async function createEPCISEvent(
  data: { productName: string; quantity: number; unit: string; action?: string },
  userId: string,
  userName: string,
  locationGLN: string
) {
  const now = new Date().toISOString()

  // Build quantity list with correct structure
  const quantityList = [{
    epc_class: `urn:epc:class:lgtin:${locationGLN}.${data.productName.replace(/\s/g, '_')}`,
    quantity: data.quantity,
    uom: data.unit.toUpperCase()
  }]

  // Build EPCIS document with quantity information
  const epcisDocument = {
    '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    creationDate: now,
    epcisBody: {
      eventList: [{
        eventType: 'ObjectEvent',
        eventTime: now,
        eventTimeZoneOffset: '+07:00',
        action: data.action === 'ship' ? 'DELETE' : 'ADD',
        bizStep: data.action === 'receive' ? 'receiving' : data.action === 'ship' ? 'shipping' : 'commissioning',
        disposition: 'active',
        readPoint: { id: locationGLN },
        bizLocation: { id: locationGLN },
        epcList: [`urn:epc:id:sgtin:${locationGLN}.${Date.now()}`],
        quantityList: quantityList
      }]
    }
  }

  const eventData = {
    event_type: 'ObjectEvent',
    action: data.action === 'ship' ? 'DELETE' : 'ADD',
    biz_step: data.action === 'receive' ? 'receiving' : data.action === 'ship' ? 'shipping' : 'commissioning',
    disposition: 'active',
    event_time: now,
    event_timezone_offset: '+07:00',
    read_point: locationGLN,
    biz_location: locationGLN,
    epc_list: [`urn:epc:id:sgtin:${locationGLN}.${Date.now()}`],
    quantity_list: quantityList, // Store in dedicated column
    epcis_document: epcisDocument, // Also store in EPCIS document
    source_type: 'voice_ai',
    user_id: userId,
    user_name: userName,
    ai_metadata: {
      rawInput: data,
      method: 'voice_processing'
    }
  }

  console.log('[v0] Voice process API: Creating event with quantity:', quantityList)
  console.log('[v0] Voice process API: Full eventData:', JSON.stringify(eventData, null, 2))

  const { data: result, error } = await supabase
    .from('events') // Correct table name is 'events', not 'epcis_events'
    .insert(eventData)
    .select()
    .single()

  if (error) {
    console.error('[v0] Voice process API: DB error:', error)
    throw new Error(`Database error: ${error.message}`)
  }

  console.log('[v0] Voice process API: Event created successfully:', result.id)
  console.log('[v0] Voice process API: Result quantity_list:', result.quantity_list)

  return result
}
