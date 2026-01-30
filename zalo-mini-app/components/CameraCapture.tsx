'use client';

/**
 * Camera Capture Component for Zalo Mini App
 * Captures images for Vision AI processing (OCR, object counting)
 */

import React, { useState } from 'react';
import { chooseImage } from 'zmp-sdk/apis';
import { supabase } from '../utils/zalo-auth';

interface CameraCaptureProps {
  onImageCapture: (imageUrl: string, aiResult?: any) => void;
  processingType?: 'ocr' | 'counting' | 'both';
  disabled?: boolean;
}

export function CameraCapture({ 
  onImageCapture, 
  processingType = 'both',
  disabled 
}: CameraCaptureProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const captureImage = async () => {
    try {
      // Use Zalo SDK to choose image from camera or gallery
      const { filePaths } = await chooseImage({
        sourceType: ['camera', 'album'],
        count: 1,
        cameraType: 'back'
      });

      if (filePaths && filePaths.length > 0) {
        const localPath = filePaths[0];
        setPreviewUrl(localPath);
        await uploadAndProcessImage(localPath);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      alert('Không thể truy cập camera. Vui lòng cấp quyền.');
    }
  };

  const uploadAndProcessImage = async (localPath: string) => {
    setIsProcessing(true);
    try {
      // Convert local path to blob
      const response = await fetch(localPath);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const fileName = `image-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Call Vision AI Edge Function
      const { data: aiResult, error: aiError } = await supabase.functions.invoke(
        'process-vision-input',
        {
          body: { 
            imageUrl: publicUrl,
            processingType 
          }
        }
      );

      if (aiError) throw aiError;

      onImageCapture(publicUrl, aiResult);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Lỗi xử lý hình ảnh. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Chụp ảnh sản phẩm</h3>
        <p className="text-sm text-gray-600 mb-2">
          Chụp để nhận diện số lượng và mã sản phẩm
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-left">
          <p className="font-semibold text-blue-900 mb-1">💡 Mẹo chụp ảnh:</p>
          <ul className="text-blue-800 space-y-1">
            <li>• Chụp vuông góc với mã vạch</li>
            <li>• Đủ sáng, tránh bóng che</li>
            <li>• Giữ điện thoại ổn định</li>
          </ul>
        </div>
      </div>

      {previewUrl && (
        <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
          <img 
            src={previewUrl || "/placeholder.svg"} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
          {isProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white font-medium">Đang xử lý...</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={captureImage}
        disabled={disabled || isProcessing}
        className={`
          flex items-center justify-center gap-2 px-6 py-3 rounded-lg
          bg-emerald-500 text-white font-medium
          hover:bg-emerald-600 transition-colors
          ${(disabled || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {isProcessing ? 'Đang xử lý...' : 'Chụp ảnh'}
      </button>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
        <div className="text-center">
          <div className="font-semibold text-emerald-600">OCR</div>
          <div>Nhận diện mã</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-emerald-600">Counting</div>
          <div>Đếm số lượng</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-emerald-600">AI</div>
          <div>Tự động</div>
        </div>
      </div>
    </div>
  );
}
