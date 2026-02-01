'use client';

/**
 * Hướng dẫn chụp ảnh chi tiết
 */

import React from 'react';
import { Page, Header, Box, Button } from 'zmp-ui';
import { useNavigate } from 'react-router-dom';

export default function GuidePhotoPage() {
  const navigate = useNavigate();

  return (
    <Page className="bg-gray-50">
      <Header 
        title="Hướng dẫn chụp ảnh"
        showBackIcon={true}
        onBackClick={() => navigate('/guide')}
      />

      <Box className="p-4">
        {/* Hero */}
        <div className="bg-green-500 rounded-lg p-6 text-white mb-6">
          <div className="text-4xl mb-2">📷</div>
          <h1 className="text-2xl font-bold mb-2">Cách chụp ảnh đúng</h1>
          <p className="text-green-50">
            AI sẽ tự động đọc mã vạch và đếm số lượng sản phẩm
          </p>
        </div>

        {/* 3 loại ảnh */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4">3 loại ảnh cần chụp</h3>

          {/* Loại 1: Mã vạch */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</span>
              <h4 className="font-bold text-lg">Ảnh có mã vạch / QR code</h4>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg mb-3">
              <p className="font-semibold text-blue-900 mb-2">Mục đích:</p>
              <p className="text-sm text-blue-800">Đọc GTIN (mã sản phẩm), Batch number, Serial number</p>
            </div>

            <div className="space-y-2 text-sm mb-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Chụp vuông góc với mã vạch (90 độ)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Đủ sáng, tránh bóng che</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Mã vạch chiếm 40-60% khung hình</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Focus rõ nét, không bị mờ</span>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
              <p className="text-red-800"><span className="font-bold">✗ Tránh:</span> Chụp xiên góc, mờ, thiếu sáng, quá xa</p>
            </div>
          </div>

          {/* Loại 2: Đếm số lượng */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">2</span>
              <h4 className="font-bold text-lg">Ảnh đếm số lượng</h4>
            </div>
            
            <div className="bg-orange-50 p-3 rounded-lg mb-3">
              <p className="font-semibold text-orange-900 mb-2">Mục đích:</p>
              <p className="text-sm text-orange-800">AI đếm số thùng, bao, kiện sản phẩm</p>
            </div>

            <div className="space-y-2 text-sm mb-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Chụp từ trên cao (bird's eye view)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Các sản phẩm không che khuất nhau</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Toàn bộ sản phẩm nằm trong khung hình</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Background đơn giản, ít nhiễu</span>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
              <p className="text-red-800"><span className="font-bold">✗ Tránh:</span> Góc nghiêng, sản phẩm chồng lên nhau, bị cắt khung</p>
            </div>
          </div>

          {/* Loại 3: Ghi nhận hoạt động */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">3</span>
              <h4 className="font-bold text-lg">Ảnh hoạt động</h4>
            </div>
            
            <div className="bg-purple-50 p-3 rounded-lg mb-3">
              <p className="font-semibold text-purple-900 mb-2">Mục đích:</p>
              <p className="text-sm text-purple-800">Ghi nhận các hoạt động: nhận hàng, xuất hàng, sản xuất, đóng gói, kiểm tra</p>
            </div>

            <div className="space-y-2 text-sm mb-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Chụp cảnh tổng thể hoạt động</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Thấy rõ sản phẩm và người thực hiện</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Nếu có biển số xe, chụp rõ biển số</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Location sign nếu có (tên kho, xưởng)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Yêu cầu kỹ thuật */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span>⚙️</span> Yêu cầu kỹ thuật
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Độ phân giải</span>
              <span className="font-semibold">≥ 1280x720px</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Định dạng</span>
              <span className="font-semibold">JPG, PNG</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Dung lượng</span>
              <span className="font-semibold">≤ 5MB</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Ánh sáng</span>
              <span className="font-semibold">Sáng, không bị tối</span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 mb-6 text-white">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <span>💡</span> Mẹo chụp ảnh tốt
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Giữ điện thoại ổn định, tránh rung lắc</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Lau sạch camera trước khi chụp</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Chụp nhiều góc nếu cần (app sẽ tự chọn ảnh tốt nhất)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Kiểm tra ảnh trước khi gửi, chụp lại nếu mờ</span>
            </li>
          </ul>
        </div>

        {/* Flow */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold mb-3">🔄 Quy trình xử lý</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div className="text-sm">
                <p className="font-semibold">Chụp ảnh</p>
                <p className="text-gray-600">Camera mở tự động</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div className="text-sm">
                <p className="font-semibold">AI xử lý</p>
                <p className="text-gray-600">Gemini Vision phân tích ảnh (2-3 giây)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div className="text-sm">
                <p className="font-semibold">Xác nhận</p>
                <p className="text-gray-600">Kiểm tra và sửa nếu cần</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">✓</div>
              <div className="text-sm">
                <p className="font-semibold">Lưu dữ liệu</p>
                <p className="text-gray-600">Ghi vào hệ thống truy xuất</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button
            fullWidth
            className="bg-green-500 text-white"
            onClick={() => navigate('/')}
          >
            Bắt đầu chụp ảnh ngay
          </Button>
          <Button
            fullWidth
            onClick={() => navigate('/guide')}
          >
            Quay lại hướng dẫn tổng quan
          </Button>
        </div>
      </Box>
    </Page>
  );
}
