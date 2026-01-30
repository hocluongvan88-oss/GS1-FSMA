'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Settings, Save } from 'lucide-react'
import { RequirePermission } from '@/components/auth/permission-gate'

export default function SettingsPage() {
  return (
    <RequirePermission>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Cài đặt hệ thống</h1>
            <p className="text-muted-foreground">Quản lý cấu hình và tùy chọn hệ thống</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình chung</CardTitle>
              <CardDescription>Thiết lập cơ bản cho hệ thống traceability</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Tên công ty</Label>
                <Input id="company-name" placeholder="VD: ABC Manufacturing Co." />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gs1-prefix">GS1 Company Prefix</Label>
                <Input id="gs1-prefix" placeholder="VD: 8934567" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input id="api-endpoint" placeholder="https://api.example.com" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tính năng AI</CardTitle>
              <CardDescription>Bật/tắt các tính năng xử lý AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Voice Input Processing</Label>
                  <p className="text-sm text-muted-foreground">Xử lý nhập liệu bằng giọng nói</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Vision Input Processing</Label>
                  <p className="text-sm text-muted-foreground">Xử lý nhập liệu bằng hình ảnh</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto AI Review</Label>
                  <p className="text-sm text-muted-foreground">Tự động xem xét và phê duyệt</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>QR Code & Traceability</CardTitle>
              <CardDescription>Cấu hình QR code và hiển thị public</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL cho QR Code</Label>
                <Input id="base-url" placeholder="https://trace.example.com" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Public Traceability View</Label>
                  <p className="text-sm text-muted-foreground">Cho phép khách hàng xem lịch sử sản phẩm</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bảo mật</CardTitle>
              <CardDescription>Cài đặt bảo mật và quyền truy cập</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout (phút)</Label>
                <Input id="session-timeout" type="number" defaultValue="30" />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Bắt buộc xác thực 2 yếu tố</Label>
                  <p className="text-sm text-muted-foreground">Yêu cầu 2FA cho tất cả người dùng</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audit Log mọi hành động</Label>
                  <p className="text-sm text-muted-foreground">Ghi lại tất cả thay đổi dữ liệu</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline">Hủy</Button>
            <Button>
              <Save className="w-4 h-4 mr-2" />
              Lưu cài đặt
            </Button>
          </div>
        </div>
      </div>
    </RequirePermission>
  )
}
