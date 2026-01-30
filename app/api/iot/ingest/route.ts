import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * IoT Data Ingestion Endpoint
 * 
 * This endpoint receives sensor data from IoT devices.
 * 
 * Usage:
 * POST /api/iot/ingest
 * Headers: 
 *   - Authorization: Bearer {device_id}
 *   - Content-Type: application/json
 * 
 * Body:
 * {
 *   "temperature": 25.5,
 *   "humidity": 60,
 *   "location": { "lat": 10.762622, "lng": 106.660172 },
 *   "metadata": { "battery": 85 }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get device ID from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Bearer {device_id}' },
        { status: 401 }
      )
    }

    const deviceId = authHeader.replace('Bearer ', '').trim()
    
    // Parse request body
    const body = await request.json()
    const { temperature, humidity, location, metadata } = body

    // Validate required fields
    if (!temperature && !humidity && !location) {
      return NextResponse.json(
        { error: 'At least one sensor value (temperature, humidity, or location) is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify device exists and is active
    const { data: device, error: deviceError } = await supabase
      .from('iot_devices')
      .select('id, status')
      .eq('device_id', deviceId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { error: 'Device not found. Please register your device first.' },
        { status: 404 }
      )
    }

    if (device.status !== 'active') {
      return NextResponse.json(
        { error: `Device is ${device.status}. Only active devices can send data.` },
        { status: 403 }
      )
    }

    // Insert sensor reading
    const { data: reading, error: insertError } = await supabase
      .from('iot_device_readings')
      .insert({
        device_id: device.id,
        temperature,
        humidity,
        location,
        metadata
      })
      .select()
      .single()

    if (insertError) {
      console.error('[IoT Ingest] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to store sensor data' },
        { status: 500 }
      )
    }

    // Update device last_reading timestamp
    await supabase
      .from('iot_devices')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', device.id)

    return NextResponse.json({
      success: true,
      reading_id: reading.id,
      timestamp: reading.created_at,
      message: 'Data received successfully'
    })

  } catch (error) {
    console.error('[IoT Ingest] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint for API documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/iot/ingest',
    method: 'POST',
    description: 'Receive sensor data from IoT devices',
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer {device_id}',
      example: 'Authorization: Bearer TEMP-001'
    },
    request_body: {
      temperature: 'number (optional) - Temperature in Celsius',
      humidity: 'number (optional) - Humidity percentage',
      location: 'object (optional) - { lat: number, lng: number }',
      metadata: 'object (optional) - Additional sensor data'
    },
    example_curl: `curl -X POST https://your-domain.com/api/iot/ingest \\
  -H "Authorization: Bearer TEMP-001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "temperature": 25.5,
    "humidity": 60,
    "location": { "lat": 10.762622, "lng": 106.660172 },
    "metadata": { "battery": 85 }
  }'`,
    example_python: `import requests

device_id = "TEMP-001"
url = "https://your-domain.com/api/iot/ingest"
headers = {
    "Authorization": f"Bearer {device_id}",
    "Content-Type": "application/json"
}
data = {
    "temperature": 25.5,
    "humidity": 60,
    "location": {"lat": 10.762622, "lng": 106.660172},
    "metadata": {"battery": 85}
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`,
    example_arduino: `// Arduino/ESP32 Example
#include <WiFi.h>
#include <HTTPClient.h>

const char* deviceId = "TEMP-001";
const char* apiUrl = "https://your-domain.com/api/iot/ingest";

void sendSensorData(float temp, float humidity) {
  HTTPClient http;
  http.begin(apiUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + deviceId);
  
  String payload = "{\\"temperature\\":" + String(temp) + 
                   ",\\"humidity\\":" + String(humidity) + "}";
  
  int httpCode = http.POST(payload);
  String response = http.getString();
  
  Serial.println(response);
  http.end();
}`
  })
}
