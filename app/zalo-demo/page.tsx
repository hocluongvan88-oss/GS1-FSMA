'use client'

import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Mic, Camera, Package, Clock, Wifi, WifiOff, X, Check, Search } from 'lucide-react'

interface BatchItem {
  id: string
  productName: string
  gtin: string
  quantity: number
  unit: string
}

interface Event {
  id: string
  type: string
  productName: string
  quantity: string
  location: string
  time: string
  status: 'success' | 'pending'
  source: 'voice' | 'vision' | 'manual'
}

export default function ZaloDemoPage() {
  const [activeTab, setActiveTab] = useState('voice')
  const [isOnline, setIsOnline] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [queueSize, setQueueSize] = useState(0)
  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      type: 'Thu hoạch',
      productName: 'Cà phê Arabica',
      quantity: '50 kg',
      location: 'Vườn A',
      time: '5 phút trước',
      status: 'success',
      source: 'voice'
    },
    {
      id: '2',
      type: 'Vận chuyển',
      productName: 'Gạo ST25',
      quantity: '100 kg',
      location: 'Kho B',
      time: '1 giờ trước',
      status: 'success',
      source: 'vision'
    }
  ])

  // Voice Recording
  const [transcript, setTranscript] = useState('')
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)

  const handleStartRecording = () => {
    setIsRecording(true)
    setRecordingTime(0)
    setTranscript('Đang ghi âm...')
    
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)

    // Simulate transcript after 3 seconds
    setTimeout(() => {
      setTranscript('"Thu hoạch 30 kg cà phê Arabica tại vườn số 5, chất lượng tốt"')
    }, 3000)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current)
    }

    if (recordingTime >= 2) {
      // Process the recording
      addEvent({
        id: Date.now().toString(),
        type: 'Thu hoạch',
        productName: 'Cà phê Arabica',
        quantity: '30 kg',
        location: 'Vườn số 5',
        time: 'Vừa xong',
        status: 'success',
        source: 'voice'
      })
      
      alert('✅ Đã ghi nhận thành công!\n\nPhát hiện:\n- Sản phẩm: Cà phê Arabica\n- Số lượng: 30 kg\n- Địa điểm: Vườn số 5\n- Loại sự kiện: Thu hoạch (commissioning)')
      setTranscript('')
    } else {
      setTranscript('')
    }
  }

  // Camera Capture
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleCapture = () => {
    setProcessing(true)
    setCapturedImage('https://via.placeholder.com/400x300?text=Coffee+Beans+50kg')
    
    setTimeout(() => {
      setProcessing(false)
      addEvent({
        id: Date.now().toString(),
        type: 'Đóng gói',
        productName: 'Cà phê rang xay',
        quantity: '20 kg',
        location: 'Nhà máy',
        time: 'Vừa xong',
        status: 'success',
        source: 'vision'
      })
      
      alert('✅ Đã nhận diện thành công!\n\nPhát hiện:\n- Sản phẩm: Cà phê rang xay\n- Số lượng: 20 kg (đếm từ ảnh)\n- GTIN: 8934567890123\n- Mã QR: Đã quét')
      setCapturedImage(null)
    }, 2000)
  }

  // Batch Input
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [currentItem, setCurrentItem] = useState({
    productName: '',
    gtin: '',
    quantity: '',
    unit: 'kg'
  })

  const products = [
    { name: 'Cà phê Arabica', gtin: '8934567890123', unit: 'kg' },
    { name: 'Cà phê Robusta', gtin: '8934567890456', unit: 'kg' },
    { name: 'Gạo ST25', gtin: '8934567890789', unit: 'kg' },
    { name: 'Gạo Jasmine', gtin: '8934567891011', unit: 'kg' },
    { name: 'Tôm sú', gtin: '8934567891234', unit: 'kg' },
  ]

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const addBatchItem = () => {
    if (!currentItem.productName || !currentItem.quantity) {
      alert('Vui lòng nhập đầy đủ thông tin')
      return
    }

    setBatchItems([
      ...batchItems,
      {
        id: Date.now().toString(),
        ...currentItem,
        quantity: parseFloat(currentItem.quantity)
      }
    ])

    setCurrentItem({ productName: '', gtin: '', quantity: '', unit: 'kg' })
    setSearchQuery('')
  }

  const removeBatchItem = (id: string) => {
    setBatchItems(batchItems.filter(item => item.id !== id))
  }

  const submitBatch = () => {
    batchItems.forEach((item, index) => {
      setTimeout(() => {
        addEvent({
          id: Date.now().toString() + index,
          type: 'Chế biến',
          productName: item.productName,
          quantity: `${item.quantity} ${item.unit}`,
          location: 'Nhà máy',
          time: 'Vừa xong',
          status: 'success',
          source: 'manual'
        })
      }, index * 100)
    })

    alert(`��� Đã ghi nhận ${batchItems.length} sản phẩm thành công!`)
    setBatchItems([])
  }

  const addEvent = (event: Event) => {
    setEvents([event, ...events])
  }

  const toggleOffline = () => {
    setIsOnline(!isOnline)
    if (isOnline) {
      setQueueSize(2)
      alert('📶 Chuyển sang chế độ Offline\n\nCác sự kiện sẽ được lưu vào hàng đợi và tự động đồng bộ khi online.')
    } else {
      alert('✅ Đã online!\n\nĐang đồng bộ 2 sự kiện từ hàng đợi...')
      setTimeout(() => {
        setQueueSize(0)
        alert('✅ Đã đồng bộ thành công 2 sự kiện!')
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white pb-20">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold mb-1">Truy xuất nguồn gốc</h1>
            <p className="text-sm text-emerald-100">GS1 EPCIS 2.0 Platform</p>
          </div>
          <button
            onClick={toggleOffline}
            className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* User Info Card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
              N
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Người dùng Demo</h2>
              <p className="text-sm text-muted-foreground capitalize">Nông dân • GLN: 8934567000000</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm font-medium ${isOnline ? 'text-emerald-600' : 'text-orange-600'}`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                {isOnline ? 'Online' : 'Offline'}
              </div>
              {queueSize > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {queueSize} sự kiện chờ
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Main Input Tabs */}
        <Card className="overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="voice" className="gap-2">
                <Mic className="w-4 h-4" />
                Ghi âm
              </TabsTrigger>
              <TabsTrigger value="camera" className="gap-2">
                <Camera className="w-4 h-4" />
                Chụp ảnh
              </TabsTrigger>
              <TabsTrigger value="batch" className="gap-2">
                <Package className="w-4 h-4" />
                Nhiều SP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="voice" className="p-6">
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Ghi âm giọng nói</h3>
                  <p className="text-sm text-muted-foreground">
                    Nói để nhập thông tin nhanh chóng
                  </p>
                </div>

                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`
                    w-24 h-24 rounded-full flex items-center justify-center transition-all transform
                    ${isRecording 
                      ? 'bg-red-500 animate-pulse scale-110' 
                      : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-105'
                    }
                    shadow-xl
                  `}
                >
                  <Mic className="w-12 h-12 text-white" />
                </button>

                <div className="text-center min-h-[60px]">
                  {isRecording ? (
                    <>
                      <p className="text-red-500 font-medium animate-pulse mb-2">
                        Đang ghi âm... {recordingTime}s
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nhấn lại để dừng
                      </p>
                    </>
                  ) : transcript ? (
                    <p className="text-sm text-emerald-700 italic px-4">
                      {transcript}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nhấn để bắt đầu ghi âm
                    </p>
                  )}
                </div>

                <div className="w-full p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2 font-semibold">Ví dụ:</p>
                  <p className="text-sm italic text-foreground">
                    "Thu hoạch 50 kg cà phê Arabica tại vườn A, chất lượng tốt"
                  </p>
                </div>

                <div className="w-full grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-200">
                    <div className="font-semibold text-emerald-700 mb-1">Gemini 2.0</div>
                    <div className="text-muted-foreground">AI Voice</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-200">
                    <div className="font-semibold text-emerald-700 mb-1">Tiếng Việt</div>
                    <div className="text-muted-foreground">Native</div>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 rounded border border-emerald-200">
                    <div className="font-semibold text-emerald-700 mb-1">EPCIS</div>
                    <div className="text-muted-foreground">Auto Map</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="camera" className="p-6">
              <div className="flex flex-col gap-6">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Chụp ảnh sản phẩm</h3>
                  <p className="text-sm text-muted-foreground">
                    Chụp để nhận diện mã và số lượng
                  </p>
                </div>

                <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20 overflow-hidden relative">
                  {capturedImage ? (
                    <>
                      <img src={capturedImage || "/placeholder.svg"} alt="Captured" className="w-full h-full object-cover" />
                      {processing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="text-center text-white">
                            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm font-medium">Đang xử lý AI...</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-16 h-16 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nhấn nút để chụp ảnh
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleCapture} 
                  className="w-full gap-2 h-12 text-base bg-emerald-600 hover:bg-emerald-700" 
                  size="lg"
                  disabled={processing}
                >
                  <Camera className="w-5 h-5" />
                  {processing ? 'Đang xử lý...' : 'Chụp ảnh'}
                </Button>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-1">OCR</div>
                    <div className="text-muted-foreground">Nhận diện mã</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-1">Counting</div>
                    <div className="text-muted-foreground">Đếm số lượng</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-700 mb-1">QR/Barcode</div>
                    <div className="text-muted-foreground">Quét tự động</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="batch" className="p-6">
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-lg mb-2">Nhập nhiều sản phẩm</h3>
                  <p className="text-sm text-muted-foreground">
                    Thêm nhiều sản phẩm trong một lần
                  </p>
                </div>

                {/* Add Item Form */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <div className="relative">
                    <Input
                      placeholder="Tìm sản phẩm..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setShowSuggestions(true)
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="pr-10"
                    />
                    <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                    
                    {showSuggestions && searchQuery && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.gtin}
                            className="w-full text-left px-4 py-2 hover:bg-muted/50 border-b last:border-b-0"
                            onClick={() => {
                              setCurrentItem({
                                ...currentItem,
                                productName: product.name,
                                gtin: product.gtin,
                                unit: product.unit
                              })
                              setSearchQuery(product.name)
                              setShowSuggestions(false)
                            }}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">GTIN: {product.gtin}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Số lượng"
                      value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                      className="flex-1"
                    />
                    <select
                      value={currentItem.unit}
                      onChange={(e) => setCurrentItem({ ...currentItem, unit: e.target.value })}
                      className="px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="piece">Cái</option>
                      <option value="box">Thùng</option>
                    </select>
                  </div>

                  <Button onClick={addBatchItem} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Package className="w-4 h-4" />
                    Thêm vào danh sách
                  </Button>
                </div>

                {/* Batch Items List */}
                {batchItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Danh sách ({batchItems.length} sản phẩm)
                    </p>
                    {batchItems.map((item) => (
                      <Card key={item.id} className="p-3 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} {item.unit} • GTIN: {item.gtin}
                            </p>
                          </div>
                          <button
                            onClick={() => removeBatchItem(item.id)}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </Card>
                    ))}

                    <Button onClick={submitBatch} className="w-full gap-2 h-12 bg-blue-600 hover:bg-blue-700">
                      <Check className="w-5 h-5" />
                      Ghi nhận {batchItems.length} sản phẩm
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Recent Events */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Hoạt động gần đây ({events.length})
            </h3>
          </div>
          <div className="divide-y max-h-96 overflow-auto">
            {events.map((event) => (
              <div key={event.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    event.source === 'voice' ? 'bg-emerald-100 text-emerald-600' :
                    event.source === 'vision' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {event.source === 'voice' ? <Mic className="w-5 h-5" /> :
                     event.source === 'vision' ? <Camera className="w-5 h-5" /> :
                     <Package className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{event.type} • {event.productName}</p>
                    <p className="text-sm text-muted-foreground">{event.quantity} • {event.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                  </div>
                  <Badge className={event.status === 'success' ? 'bg-emerald-500' : 'bg-orange-500'}>
                    {event.status === 'success' ? 'Thành công' : 'Chờ xử lý'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex gap-3">
            <div className="text-emerald-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-emerald-800">
              <p className="font-medium mb-1">Interactive Demo - Test tính năng</p>
              <ul className="text-xs text-emerald-700 space-y-1 list-disc list-inside">
                <li>Nhấn biểu tượng Wifi để test chế độ offline</li>
                <li>Ghi âm để tạo event từ giọng nói (Gemini AI)</li>
                <li>Chụp ảnh để nhận diện sản phẩm tự động</li>
                <li>Thêm nhiều sản phẩm qua batch input</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
