'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mic, Camera, Package, Wifi, WifiOff, CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react'

export default function VoiceTestPanel() {
  const [testResults, setTestResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [voiceInput, setVoiceInput] = useState('')
  
  // Camera test state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  
  // Batch test state
  const [batchItems, setBatchItems] = useState([
    { productName: 'Cà phê Arabica', quantity: 100, unit: 'kg' }
  ])

  // Database verification
  const [dbEvents, setDbEvents] = useState<any[]>([])
  
  // Online status state
  const [isOnline, setIsOnline] = useState(true)
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('voice')
  
  // Generate a valid UUID for testing
  const testUserId = '00000000-0000-0000-0000-000000000001'

  const addTestResult = (result: any) => {
    setTestResults(prev => [{
      ...result,
      timestamp: new Date().toISOString()
    }, ...prev])
  }

  // Test Voice Input - using Next.js API route
  const testVoiceInput = async () => {
    if (!voiceInput.trim()) {
      alert('Vui lòng nhập transcript để test')
      return
    }

    setLoading(true)
    console.log('[v0] Testing voice input:', voiceInput)

    try {
      // Use Next.js API route with updated Gemini model
      const response = await fetch('/api/voice/process-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mockTranscript: voiceInput,
          userId: testUserId,
          userName: 'Test User',
          locationGLN: '8412345678901'
        })
      })

      const result = await response.json()
      console.log('[v0] Voice test result:', result)

      addTestResult({
        type: 'voice',
        input: voiceInput,
        success: result.success,
        data: result,
        status: response.status
      })

      if (result.success) {
        alert(`Thanh cong! Event ID: ${result.eventId}\nSan pham: ${result.extractedData?.productName}\nMethod: ${result.method}`)
        await fetchRecentEvents()
      } else {
        alert(`Loi: ${result.validation?.errors?.join(', ') || result.error}`)
      }
    } catch (error: any) {
      console.error('[v0] Voice test error:', error)
      addTestResult({
        type: 'voice',
        input: voiceInput,
        success: false,
        error: error.message
      })
      alert('Loi ket noi: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Test Camera/Vision Input - using Next.js API route
  const testVisionInput = async () => {
    if (!imageFile) {
      alert('Vui lòng chon anh de test')
      return
    }

    setLoading(true)
    console.log('[v0] Testing vision input:', imageFile.name)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Image = reader.result as string

        // Use Next.js API route instead of Supabase Edge Function
        const response = await fetch('/api/vision/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrl: base64Image,
            userId: testUserId,
            userName: 'Test User',
            locationGLN: '8412345678901'
          })
        })

        const result = await response.json()
        console.log('[v0] Vision test result:', result)

        addTestResult({
          type: 'vision',
          input: imageFile.name,
          success: result.success,
          data: result,
          status: response.status
        })

        if (result.success) {
          alert(`Thanh cong! Event ID: ${result.eventId}\nSan pham: ${result.extractedData?.productName}\nMethod: ${result.method}`)
          await fetchRecentEvents()
        } else {
          alert(`Loi: ${result.validation?.errors?.join(', ') || result.error}`)
        }

        setLoading(false)
      }
      reader.readAsDataURL(imageFile)
    } catch (error: any) {
      console.error('[v0] Vision test error:', error)
      addTestResult({
        type: 'vision',
        input: imageFile.name,
        success: false,
        error: error.message
      })
      alert('Loi: ' + error.message)
      setLoading(false)
    }
  }

  // Test Batch Input - using test endpoint instead of auth-protected transformation
  const testBatchInput = async () => {
    if (batchItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 sản phẩm')
      return
    }

    setLoading(true)
    console.log('[v0] Testing batch input:', batchItems)

    try {
      // Use test endpoint that bypasses auth for testing purposes
      const response = await fetch('/api/events/transformation/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Match the expected API schema
          inputProducts: batchItems.map(item => ({
            gtin: '08712345678901',
            quantity: item.quantity,
            uom: item.unit
          })),
          outputProducts: [{
            gtin: '08712345678902',
            quantity: batchItems.reduce((sum, item) => sum + item.quantity, 0) * 0.8,
            uom: 'KGM' // ISO unit code
          }],
          location: '8412345678901',
          bizStep: 'commissioning',
          productType: 'coffee',
          // Test user info (used by test endpoint)
          testUserId: testUserId,
          testUserName: 'Test User'
        })
      })

      const result = await response.json()
      console.log('[v0] Batch test result:', result)

      addTestResult({
        type: 'batch',
        input: `${batchItems.length} items`,
        success: result.success,
        data: result,
        status: response.status
      })

      if (result.success) {
        alert(`✅ Thành công! Event ID: ${result.event?.id || 'N/A'}`)
        await fetchRecentEvents()
      } else {
        alert(`❌ Lỗi: ${result.error}`)
      }
    } catch (error: any) {
      console.error('[v0] Batch test error:', error)
      addTestResult({
        type: 'batch',
        input: `${batchItems.length} items`,
        success: false,
        error: error.message
      })
      alert('❌ Lỗi: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch recent events from database
  const fetchRecentEvents = async () => {
    try {
      console.log('[v0] Fetching recent events from test endpoint...')
      const response = await fetch('/api/events/test?limit=5')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('[v0] Recent events response:', data)
      
      if (data.success) {
        setDbEvents(data.data || [])
      } else {
        console.error('[v0] Error from API:', data.error)
        alert(`Lỗi load events: ${data.error}\n${data.hint || ''}`)
      }
    } catch (error: any) {
      console.error('[v0] Failed to fetch events:', error)
      alert(`Không thể kết nối API: ${error.message}`)
    }
  }

  useEffect(() => {
    fetchRecentEvents()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-6 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Zalo Mini App Test Environment</h1>
              <p className="text-sm text-gray-600 mt-1">Test các chức năng trước khi deploy lên Zalo</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOnline(!isOnline)}
              className="gap-2"
            >
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-orange-600" />
                  <span>Offline</span>
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab('voice')}
            variant={activeTab === 'voice' ? 'default' : 'outline'}
            className="flex-1 gap-2"
          >
            <Mic className="w-4 h-4" />
            Voice Test
          </Button>
          <Button
            onClick={() => setActiveTab('camera')}
            variant={activeTab === 'camera' ? 'default' : 'outline'}
            className="flex-1 gap-2"
          >
            <Camera className="w-4 h-4" />
            Camera Test
          </Button>
          <Button
            onClick={() => setActiveTab('batch')}
            variant={activeTab === 'batch' ? 'default' : 'outline'}
            className="flex-1 gap-2"
          >
            <Package className="w-4 h-4" />
            Batch Test
          </Button>
        </div>

        {/* Test Content */}
        <Card className="p-6 bg-white/90 backdrop-blur">
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Test Voice/Audio Input</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mock Transcript (Tiếng Việt)</label>
                <Textarea
                  value={voiceInput}
                  onChange={(e) => setVoiceInput(e.target.value)}
                  placeholder="VD: Nhận 50 kg cà phê Arabica từ nhà máy A"
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
              <Button 
                onClick={testVoiceInput} 
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? 'Đang xử lý...' : '🎤 Test Voice Processing'}
              </Button>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Test Camera/Vision Input</h3>
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload Test Image</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                {imagePreview && (
                  <div className="mt-4">
                    <img src={imagePreview || "/placeholder.svg"} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  </div>
                )}
              </div>
              <Button 
                onClick={testVisionInput} 
                disabled={loading || !imageFile}
                className="w-full gap-2"
              >
                {loading ? 'Đang xử lý...' : '📷 Test Vision Processing'}
              </Button>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Test Batch/Transformation Input</h3>
              <div className="space-y-2">
                {batchItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Tên sản phẩm"
                      value={item.productName}
                      onChange={(e) => {
                        const newItems = [...batchItems]
                        newItems[index].productName = e.target.value
                        setBatchItems(newItems)
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="SL"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...batchItems]
                        newItems[index].quantity = Number(e.target.value)
                        setBatchItems(newItems)
                      }}
                      className="w-24"
                    />
                    <Input
                      placeholder="Unit"
                      value={item.unit}
                      onChange={(e) => {
                        const newItems = [...batchItems]
                        newItems[index].unit = e.target.value
                        setBatchItems(newItems)
                      }}
                      className="w-20"
                    />
                  </div>
                ))}
              </div>
              <Button 
                onClick={testBatchInput} 
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? 'Đang xử lý...' : '📦 Test Batch Processing'}
              </Button>
            </div>
          )}
        </Card>

        {/* Test Results */}
        <Card className="p-6 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Test Results</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestResults([])}
            >
              Clear
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Chưa có test nào</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={result.type === 'voice' ? 'default' : result.type === 'camera' ? 'secondary' : 'outline'}>
                        {result.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-gray-700 truncate">{result.input}</p>
                    {result.data?.extractedData && (
                      <p className="text-xs text-green-600 mt-1">
                        → {result.data.extractedData.productName} ({result.data.extractedData.quantity} {result.data.extractedData.unit})
                      </p>
                    )}
                    {result.error && (
                      <p className="text-xs text-red-600 mt-1">Error: {result.error}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Database Events */}
        <Card className="p-6 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Database Events</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecentEvents}
            >
              Refresh
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dbEvents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Chưa có events trong database</p>
            ) : (
              dbEvents.map((event, index) => (
                <div key={event.id || index} className="p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>{event.event_type}</Badge>
                    <span className="text-xs text-gray-600">{event.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Action:</span> {event.action || 'N/A'}
                    </div>
                    <div>
                      <span className="text-gray-600">Source:</span> {event.source_type || 'N/A'}
                    </div>
                    <div>
                      <span className="text-gray-600">Time:</span> {event.event_time ? new Date(event.event_time).toLocaleString('vi-VN') : 'N/A'}
                    </div>
                    <div>
                      <span className="text-gray-600">Products:</span> {event.epc_list?.length || 0} items
                    </div>
                    {(event.quantity_list || event.input_quantity || event.output_quantity) && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Quantity:</span>{' '}
                        {Array.isArray(event.quantity_list) && event.quantity_list.length > 0 && (
                          <span className="font-medium text-green-600">
                            {event.quantity_list.map((q: any, i: number) => (
                              <span key={i}>
                                {i > 0 && ', '}
                                {q.quantity} {q.uom}
                                {q.epcClass && ` (${q.epcClass.split('.').pop()?.replace(/_/g, ' ')})`}
                              </span>
                            ))}
                          </span>
                        )}
                        {event.input_quantity && (
                          <span>Input: <span className="font-medium text-blue-600">{JSON.stringify(event.input_quantity)}</span></span>
                        )}
                        {event.output_quantity && (
                          <span> Output: <span className="font-medium text-purple-600">{JSON.stringify(event.output_quantity)}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 bg-amber-50 border-amber-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-2">
              <p className="font-semibold">Hướng dẫn test:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Test từng tab để kiểm tra API endpoint hoạt động</li>
                <li>Kiểm tra Test Results để xem response từ server</li>
                <li>Kiểm tra Database Events để verify dữ liệu đã lưu đúng</li>
                <li>Test offline mode bằng cách toggle nút Wifi</li>
                <li>Mở Console (F12) để xem debug logs chi tiết</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
