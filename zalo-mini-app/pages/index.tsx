'use client';

/**
 * Zalo Mini App - Main Page
 * For Farmers & Workers to record traceability events
 */

import React, { useEffect, useState } from 'react';
import { Page, Header, Text, Box, Button } from 'zmp-ui';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CameraCapture } from '../components/CameraCapture';
import { BatchInput } from '../components/BatchInput';
import { RecentEvents } from '../components/RecentEvents';
import { OfflineQueue } from '../utils/offline-queue';
import { 
  initializeAuth,
  getCurrentSession,
  AuthSession,
  UserProfile,
  authenticateWithZalo,
  supabase,
  getUserProfile,
  syncOfflineQueue // Declare the variable here
} from '../utils/jwt-auth';

export default function HomePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'voice' | 'camera' | 'batch'>('voice');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queueSize, setQueueSize] = useState(0);
  const offlineQueue = OfflineQueue.getInstance();

  useEffect(() => {
    initializeApp();
    
    // Monitor online/offline status
    const handleOnline = () => {
      console.log('[v0] Back online, syncing queue...');
      setIsOnline(true);
      syncOfflineQueue(); // Use the declared variable here
    };
    const handleOffline = () => {
      console.log('[v0] Going offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue size
    setQueueSize(offlineQueue.getQueueSize());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // Check existing session first
      let authSession = getCurrentSession();
      
      if (!authSession) {
        // Initialize new auth with Zalo
        authSession = await initializeAuth();
        alert('Chào mừng bạn! Hãy bắt đầu ghi nhận hoạt động của mình.');
      }
      
      setSession(authSession);
      setUser(await getUserProfile(authSession?.access_token));
      
      // Sync offline queue if online
      if (navigator.onLine) {
        await syncOfflineQueue();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      alert('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineQueue = async () => {
    if (!session) return;

    const result = await offlineQueue.syncQueue(
      session.accessToken,
      process.env.NEXT_PUBLIC_SUPABASE_URL!
    );

    if (result.success > 0) {
      alert(`Đã đồng bộ ${result.success} sự kiện từ hàng đợi`);
    }
    if (result.failed > 0) {
      console.error('[v0] Failed to sync some events:', result.errors);
    }

    setQueueSize(offlineQueue.getQueueSize());
  };

  const handleVoiceRecording = async (audioUrl: string) => {
    if (!session) return;

    const eventData = {
      audioUrl,
      userId: session.user.id,
      userName: session.user.fullName,
      locationGLN: user?.assigned_location || null
    };

    // If offline, add to queue
    if (!isOnline) {
      offlineQueue.addToQueue('voice', eventData);
      setQueueSize(offlineQueue.getQueueSize());
      alert('Đang offline. Sự kiện đã được lưu vào hàng đợi.');
      return;
    }
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-voice-input`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify(eventData)
        }
      );

      const result = await response.json();
      
      if (result.success) {
        alert(`Đã ghi nhận thành công! Phát hiện: ${result.extractedData.productName || 'N/A'}`);
      } else {
        alert('L��i: ' + result.validation.errors.join(', '));
      }
    } catch (error) {
      console.error('[v0] Error processing voice:', error);
      // Add to queue on network error
      offlineQueue.addToQueue('voice', eventData);
      setQueueSize(offlineQueue.getQueueSize());
      alert('Lỗi mạng. Đã lưu vào hàng đợi.');
    }
  };

  const handleImageCapture = async (imageUrl: string) => {
    if (!session) return;

    const eventData = {
      imageUrl,
      userId: session.user.id,
      userName: session.user.fullName,
      locationGLN: user?.assigned_location || null
    };

    // If offline, add to queue
    if (!isOnline) {
      offlineQueue.addToQueue('vision', eventData);
      setQueueSize(offlineQueue.getQueueSize());
      alert('Đang offline. Sự kiện đã được lưu vào hàng đợi.');
      return;
    }
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-vision-input`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify(eventData)
        }
      );

      const result = await response.json();
      
      if (result.success) {
        alert(`Đã ghi nhận thành công! Phát hiện: ${result.extractedData.productName || 'N/A'}`);
      } else {
        alert('Lỗi: ' + result.validation.errors.join(', '));
      }
    } catch (error) {
      console.error('[v0] Error processing image:', error);
      // Add to queue on network error
      offlineQueue.addToQueue('vision', eventData);
      setQueueSize(offlineQueue.getQueueSize());
      alert('Lỗi mạng. Đã lưu vào hàng đợi.');
    }
  };

  const handleBatchSubmit = async (items: any[]) => {
    if (!session) return;

    alert(`Đang xử lý ${items.length} sản phẩm...`);
    
    // Process batch items (simplified - in production would create transformation event)
    for (const item of items) {
      const eventData = {
        imageUrl: '', // No image for batch input
        userId: session.user.id,
        userName: session.user.fullName,
        locationGLN: user?.assigned_location || null,
        manualData: item // Pass manual data for batch processing
      };

      if (!isOnline) {
        offlineQueue.addToQueue('vision', eventData);
      } else {
        // Process immediately
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-vision-input`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.accessToken}`
              },
              body: JSON.stringify(eventData)
            }
          );
        } catch (error) {
          console.error('[v0] Batch item failed:', error);
          offlineQueue.addToQueue('vision', eventData);
        }
      }
    }

    setQueueSize(offlineQueue.getQueueSize());
    alert(`Đã xử lý ${items.length} sản phẩm!`);
  };



  if (loading) {
    return (
      <Page className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <Text className="text-gray-600">Đang tải...</Text>
        </div>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50">
      <Header 
        title="Truy xuất nguồn gốc"
        showBackIcon={false}
      />
      
      {/* Help Button - Fixed position */}
      <button
        onClick={() => window.location.href = '/guide'}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-blue-600 transition-colors"
        style={{ boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      <Box className="p-4">
        {/* User Info with Status */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
              {session?.user.fullName?.[0] || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{session?.user.fullName}</h2>
              <p className="text-sm text-gray-600 capitalize">{session?.user.role}</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-sm ${isOnline ? 'text-green-600' : 'text-orange-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-600' : 'bg-orange-600'}`} />
                {isOnline ? 'Online' : 'Offline'}
              </div>
              {queueSize > 0 && (
                <Text className="text-xs text-gray-500 mt-1">
                  {queueSize} sự kiện chờ
                </Text>
              )}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'voice'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            🎤 Ghi âm
          </button>
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'camera'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            📷 Chụp ảnh
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'batch'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            📦 Nhiều SP
          </button>
        </div>

        {/* Active Component */}
        {activeTab === 'voice' && (
          <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
        )}

        {activeTab === 'camera' && (
          <CameraCapture onImageCapture={handleImageCapture} />
        )}

        {activeTab === 'batch' && session && (
          <BatchInput
            onSubmit={handleBatchSubmit}
            accessToken={session.accessToken}
          />
        )}

        {/* Recent Events */}
        {session && (
          <div className="mt-6">
            <h3 className="font-semibold text-lg mb-3">Hoạt động gần đây</h3>
            <RecentEvents
              userId={session.user.id}
              accessToken={session.accessToken}
            />
          </div>
        )}
      </Box>
    </Page>
  );
}
