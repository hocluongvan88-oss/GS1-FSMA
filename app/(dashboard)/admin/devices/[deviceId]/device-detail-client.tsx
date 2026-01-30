'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Activity, Code, Download, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

type DeviceReading = {
  id: string
  temperature: number | null
  humidity: number | null
  location: { lat: number; lng: number } | null
  metadata: Record<string, any> | null
  created_at: string
}

type Device = {
  id: string
  device_id: string
  name: string
  type: string
  location_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export default function DeviceDetailClient({
  device,
  initialReadings,
}: {
  device: Device
  initialReadings: DeviceReading[]
}) {
  const router = useRouter()
  const [readings, setReadings] = useState<DeviceReading[]>(initialReadings)
  const [isApiDialogOpen, setIsApiDialogOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [supabase] = useState(() => createClient())

  const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/iot/ingest` : ''

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('device-readings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'iot_device_readings',
          filter: `device_id=eq.${device.id}`,
        },
        (payload) => {
          console.log('[v0] New reading received:', payload.new)
          setReadings((prev) => [payload.new as DeviceReading, ...prev])
          toast({
            title: 'New Reading',
            description: 'Device sent new sensor data',
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [device.id, supabase])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    const { data } = await supabase
      .from('iot_device_readings')
      .select('*')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      setReadings(data)
    }
    setIsRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'maintenance':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Success',
      description: 'Copied to clipboard',
    })
  }

  const latestReading = readings[0]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{device.name}</h1>
          <p className="text-muted-foreground">Device ID: {device.device_id}</p>
        </div>
        <Button variant="outline" onClick={() => setIsApiDialogOpen(true)}>
          <Code className="mr-2 h-4 w-4" />
          API Integration
        </Button>
      </div>

      {/* Device Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusColor(device.status)} className="capitalize">
              {device.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Type</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{device.type}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{device.location_id || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{readings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Latest Reading */}
      {latestReading && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Reading</CardTitle>
            <CardDescription>
              {new Date(latestReading.created_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {latestReading.temperature !== null && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Temperature</p>
                  <p className="text-2xl font-bold">{latestReading.temperature}°C</p>
                </div>
              )}
              {latestReading.humidity !== null && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Humidity</p>
                  <p className="text-2xl font-bold">{latestReading.humidity}%</p>
                </div>
              )}
              {latestReading.metadata?.battery && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Battery</p>
                  <p className="text-2xl font-bold">{latestReading.metadata.battery}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Readings History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sensor Readings</CardTitle>
            <CardDescription>Historical data from this device</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {readings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sensor readings available yet
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {readings.map((reading) => (
                <div
                  key={reading.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Time:</span>
                      <br />
                      {new Date(reading.created_at).toLocaleString()}
                    </div>
                    {reading.temperature !== null && (
                      <div>
                        <span className="text-muted-foreground">Temp:</span>
                        <br />
                        <span className="font-semibold">{reading.temperature}°C</span>
                      </div>
                    )}
                    {reading.humidity !== null && (
                      <div>
                        <span className="text-muted-foreground">Humidity:</span>
                        <br />
                        <span className="font-semibold">{reading.humidity}%</span>
                      </div>
                    )}
                    {reading.location && (
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <br />
                        <span className="font-semibold text-xs">
                          {reading.location.lat.toFixed(4)}, {reading.location.lng.toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Integration Dialog */}
      <Dialog open={isApiDialogOpen} onOpenChange={setIsApiDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Integration Guide</DialogTitle>
            <DialogDescription>
              Connect your IoT device to send sensor data to this platform
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="arduino">Arduino</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">API Endpoint</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm">{apiUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(apiUrl)}>
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  Use Bearer token with your Device ID:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm">
                    Authorization: Bearer {device.device_id}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(`Bearer ${device.device_id}`)}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Request Body</h3>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(
                    {
                      temperature: 25.5,
                      humidity: 60,
                      location: { lat: 10.762622, lng: 106.660172 },
                      metadata: { battery: 85 },
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="curl" className="space-y-4">
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {`curl -X POST ${apiUrl} \\
  -H "Authorization: Bearer ${device.device_id}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "temperature": 25.5,
    "humidity": 60,
    "location": { "lat": 10.762622, "lng": 106.660172 },
    "metadata": { "battery": 85 }
  }'`}
              </pre>
              <Button
                variant="outline"
                onClick={() =>
                  copyToClipboard(`curl -X POST ${apiUrl} \\
  -H "Authorization: Bearer ${device.device_id}" \\
  -H "Content-Type: application/json" \\
  -d '{"temperature": 25.5, "humidity": 60}'`)
                }
              >
                Copy cURL Command
              </Button>
            </TabsContent>

            <TabsContent value="python" className="space-y-4">
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {`import requests
import time

device_id = "${device.device_id}"
api_url = "${apiUrl}"

def send_sensor_data(temperature, humidity):
    headers = {
        "Authorization": f"Bearer {device_id}",
        "Content-Type": "application/json"
    }
    
    data = {
        "temperature": temperature,
        "humidity": humidity,
        "metadata": {"battery": 85}
    }
    
    response = requests.post(api_url, json=data, headers=headers)
    return response.json()

# Example usage
while True:
    temp = 25.5  # Replace with actual sensor reading
    humid = 60   # Replace with actual sensor reading
    
    result = send_sensor_data(temp, humid)
    print(result)
    
    time.sleep(60)  # Send data every 60 seconds`}
              </pre>
            </TabsContent>

            <TabsContent value="arduino" className="space-y-4">
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {`#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* deviceId = "${device.device_id}";
const char* apiUrl = "${apiUrl}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
}

void sendSensorData(float temp, float humidity) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + deviceId);
    
    String payload = "{\\"temperature\\":" + String(temp) + 
                     ",\\"humidity\\":" + String(humidity) + "}";
    
    int httpCode = http.POST(payload);
    String response = http.getString();
    
    Serial.println("Response: " + response);
    http.end();
  }
}

void loop() {
  float temperature = 25.5;  // Replace with actual sensor
  float humidity = 60.0;     // Replace with actual sensor
  
  sendSensorData(temperature, humidity);
  delay(60000);  // Send every 60 seconds
}`}
              </pre>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
