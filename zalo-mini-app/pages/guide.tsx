'use client';

/**
 * Hướng dẫn sử dụng Zalo Mini App - Tổng quan
 */

import React from 'react';
import { Page, Header, Box, Button } from 'zmp-ui';
import { useNavigate } from 'react-router-dom';

export default function GuidePage() {
  const navigate = useNavigate();

  return (
    <Page className="bg-gray-50">
      <Header 
        title="Hướng dẫn sử dụng"
        showBackIcon={true}
        onBackClick={() => navigate('/')}
      />

      <Box className="p-4">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-6 text-white mb-6">
          <h1 className="text-2xl font-bold mb-2">Chào mừng đến với</h1>
          <h2 className="text-3xl font-bold mb-3">Hệ thống Truy xuất nguồn gốc</h2>
          <p className="text-emerald-50">
            Ghi nhận hoạt động nông nghiệp dễ d��ng bằng giọng nói và hình ảnh
          </p>
        </div>

        {/* 3 Cách thức sử dụng */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">3 cách ghi nhận hoạt động</h3>
          
          <div className="space-y-4">
            {/* Voice */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎤</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">1. Ghi âm giọng nói</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Phù hợp khi đang làm việc, không rảnh tay
                  </p>
                  <div className="bg-blue-50 p-3 rounded text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Ví dụ nói:</p>
                    <p className="text-blue-800">"Hôm nay nhận 50 kg cà phê Arabica từ vườn Đà Lạt"</p>
                    <p className="text-blue-800">"Đã đóng gói 100 bao gạo ST25 5kg"</p>
                  </div>
                  <Button
                    size="small"
                    className="mt-3"
                    onClick={() => navigate('/guide-voice')}
                  >
                    Xem hướng dẫn chi tiết
                  </Button>
                </div>
              </div>
            </div>

            {/* Camera */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📷</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">2. Chụp ảnh sản phẩm</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    AI tự động đọc mã vạch và đếm số lượng
                  </p>
                  <div className="bg-green-50 p-3 rounded text-sm space-y-2">
                    <p className="font-semibold text-green-900">Chụp 3 loại ảnh:</p>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span className="text-green-800">Ảnh có mã vạch/QR code rõ nét</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span className="text-green-800">Ảnh đếm số lượng từ trên cao</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span className="text-green-800">Ảnh hoạt động (nhận/xuất/đóng gói)</span>
                    </div>
                  </div>
                  <Button
                    size="small"
                    className="mt-3"
                    onClick={() => navigate('/guide-photo')}
                  >
                    Xem hướng dẫn chụp ảnh
                  </Button>
                </div>
              </div>
            </div>

            {/* Batch */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">3. Nhập nhiều sản phẩm</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Ghi nhận hàng loạt khi có nhiều sản phẩm
                  </p>
                  <div className="bg-purple-50 p-3 rounded text-sm">
                    <p className="text-purple-800">Tự động gợi ý sản phẩm từ hệ thống</p>
                    <p className="text-purple-800">Nhanh chóng thêm nhiều dòng cùng lúc</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tính năng nổi bật */}
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Tính năng nổi bật</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-lg text-center shadow-sm">
              <div className="text-3xl mb-2">🤖</div>
              <p className="font-semibold text-sm">AI tự động</p>
              <p className="text-xs text-gray-600">Nhận diện thông minh</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center shadow-sm">
              <div className="text-3xl mb-2">📡</div>
              <p className="font-semibold text-sm">Offline mode</p>
              <p className="text-xs text-gray-600">Làm việc không cần mạng</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center shadow-sm">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-semibold text-sm">Xác nhận trước</p>
              <p className="text-xs text-gray-600">Sửa nếu AI sai</p>
            </div>
            <div className="bg-white p-4 rounded-lg text-center shadow-sm">
              <div className="text-3xl mb-2">📊</div>
              <p className="font-semibold text-sm">Lịch sử đầy đủ</p>
              <p className="text-xs text-gray-600">Xem hoạt động gần đây</p>
            </div>
          </div>
        </div>

        {/* Tips quan trọng */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-bold text-yellow-900 mb-2">Lưu ý quan trọng</h4>
              <ul className="space-y-1 text-sm text-yellow-800">
                <li>• Luôn kiểm tra thông tin AI trích xuất trước khi lưu</li>
                <li>• Chụp ảnh rõ nét, tránh mờ hoặc thiếu sáng</li>
                <li>• Nói rõ ràng khi ghi âm, tránh ồn xung quanh</li>
                <li>• Dữ liệu sẽ tự động đồng bộ khi có mạng</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            fullWidth
            className="bg-emerald-500 text-white"
            onClick={() => navigate('/')}
          >
            Bắt đầu sử dụng ngay
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate('/guide-voice')}
              className="bg-white border border-gray-300"
            >
              Hướng dẫn Ghi âm
            </Button>
            <Button
              onClick={() => navigate('/guide-photo')}
              className="bg-white border border-gray-300"
            >
              Hướng dẫn Chụp ảnh
            </Button>
          </div>
        </div>
      </Box>
    </Page>
  );
}
