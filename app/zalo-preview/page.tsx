'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Mic, Camera, Package, Clock, Wifi, WifiOff } from 'lucide-react'

export default function ZaloPreviewPage() {
  const [activeTab, setActiveTab] = useState('voice')
  const [isOnline, setIsOnline] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [queueSize] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <div className="bg-emerald-600 text-white p-4 shadow-lg">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-bold mb-1">Truy xuất nguồn gốc</h1>
          <p className="text-sm text-emerald-100">GS1 EPCIS 2.0 Platform</p>
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
              <p className="text-sm text-muted-foreground capitalize">Nông dân</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm ${isOnline ? 'text-emerald-600' : 'text-orange-600'}`}>
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
                Nhi���u SP
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
                  onClick={() => setIsRecording(!isRecording)}
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

                <div className="text-center">
                  {isRecording ? (
                    <p className="text-red-500 font-medium animate-pulse">
                      Đang ghi âm...
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nhấn để bắt đầu ghi âm
                    </p>
                  )}
                </div>

                <div className="w-full p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Ví dụ:</p>
                  <p className="text-sm italic">
                    "Thu hoạch 50 kg cà phê Arabica tại vườn A, chất lượng tốt"
                  </p>
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

                <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nhấn nút để chụp ảnh
                    </p>
                  </div>
                </div>

                <Button className="w-full gap-2 h-12 text-base" size="lg">
                  <Camera className="w-5 h-5" />
                  Chụp ảnh
                </Button>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="font-semibold text-emerald-600 mb-1">OCR</div>
                    <div className="text-muted-foreground">Nhận diện mã</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="font-semibold text-emerald-600 mb-1">Counting</div>
                    <div className="text-muted-foreground">Đếm số lượng</div>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <div className="font-semibold text-emerald-600 mb-1">AI</div>
                    <div className="text-muted-foreground">Tự động</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="batch" className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Nhập nhiều sản phẩm</h3>
                  <p className="text-sm text-muted-foreground">
                    Thêm nhiều sản phẩm trong một lần
                  </p>
                </div>

                <div className="space-y-3">
                  <Card className="p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Cà phê Arabica</p>
                        <p className="text-sm text-muted-foreground">50 kg</p>
                      </div>
                      <Badge variant="secondary">GTIN: 8934567890123</Badge>
                    </div>
                  </Card>

                  <Card className="p-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Gạo ST25</p>
                        <p className="text-sm text-muted-foreground">100 kg</p>
                      </div>
                      <Badge variant="secondary">GTIN: 8934567890456</Badge>
                    </div>
                  </Card>
                </div>

                <Button className="w-full gap-2" size="lg">
                  <Package className="w-5 h-5" />
                  Thêm sản phẩm
                </Button>

                <Button variant="outline" className="w-full bg-transparent" size="lg">
                  Gửi tất cả (2 sản phẩm)
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Recent Events */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Hoạt động gần đây
            </h3>
          </div>
          <div className="divide-y">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Thu hoạch Cà phê</p>
                  <p className="text-sm text-muted-foreground">50 kg - Vườn A</p>
                  <p className="text-xs text-muted-foreground mt-1">5 phút trước</p>
                </div>
                <Badge className="bg-emerald-500">Thành công</Badge>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Vận chuyển Gạo</p>
                  <p className="text-sm text-muted-foreground">100 kg - Kho B</p>
                  <p className="text-xs text-muted-foreground mt-1">1 giờ trước</p>
                </div>
                <Badge className="bg-blue-500">Thành công</Badge>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Kiểm tra chất lượng</p>
                  <p className="text-sm text-muted-foreground">Thủy sản - Lô C</p>
                  <p className="text-xs text-muted-foreground mt-1">3 giờ trước</p>
                </div>
                <Badge variant="outline">Chờ xử lý</Badge>
              </div>
            </div>
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
              <p className="font-medium mb-1">Powered by Gemini 2.0 Flash</p>
              <p className="text-xs text-emerald-700">
                AI xử lý giọng nói và hình ảnh thông minh, tuân thủ chuẩn GS1 EPCIS 2.0
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
