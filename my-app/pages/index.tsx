import React, { useEffect, useState } from 'react';
import { Page, Header, Text, Box } from 'zmp-ui';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CameraCapture } from '../components/CameraCapture';
import { BatchInput } from '../components/BatchInput';
import { RecentEvents } from '../components/RecentEvents';
import { OfflineQueue } from '../utils/offline-queue';
import { 
  initializeAuth, 
  getCurrentSession, 
  getUserProfile, 
  syncOfflineQueue as syncService, // Đổi tên để tránh trùng với hàm nội bộ
  AuthSession, 
  UserProfile 
} from '../utils/jwt-auth';

export default function HomePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'voice' | 'camera' | 'batch'>('voice');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const offlineQueue = OfflineQueue.getInstance();

  // Cấu hình URL trực tiếp vì Vite không dùng process.env như Next.js
  const SUPABASE_URL = "https://your-project-id.supabase.co"; 

  useEffect(() => {
    initializeApp();
    
    const handleOnline = () => {
      setIsOnline(true);
      handleSync(); 
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setQueueSize(offlineQueue.getQueueSize());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      let authSession = getCurrentSession();
      
      if (!authSession) {
        authSession = await initializeAuth();
      }
      
      setSession(authSession);
      if (authSession?.access_token) {
        const profile = await getUserProfile(authSession.access_token);
        setUser(profile);
      }
      
      if (navigator.onLine) {
        await handleSync();
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncService(); 
      if (result && result.success > 0) {
        alert(`Đã đồng bộ ${result.success} dữ liệu ngoại tuyến`);
      }
      setQueueSize(offlineQueue.getQueueSize());
    } catch (e) {
      console.error("Sync failed", e);
    }
  };

  const handleVoiceRecording = async (transcript: string, extractedData?: any) => {
    if (!session) return alert('Vui lòng đăng nhập');
    if (extractedData) {
      alert(`✅ Vexim ghi nhận: ${extractedData.productName || 'Sản phẩm mới'}`);
    }
  };

  const handleImageCapture = async (imageUrl: string, result?: any) => {
    if (!session) return alert('Vui lòng đăng nhập');
    alert(result?.success ? '✅ Xử lý dữ liệu ảnh thành công' : '❌ Vui lòng chụp lại');
  };

  const handleBatchSubmit = async (items: any[]) => {
    if (!session) return;
    alert(`Đang xử lý lô hàng ${items.length} sản phẩm...`);
    // Thực hiện logic gửi dữ liệu batch tại đây
  };

  if (loading) {
    return (
      <Page className="flex items-center justify-center h-screen">
        <Box className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <Text>Đang khởi động Vexim GS1...</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50">
      <Header title="Vexim Global - GS1 Traceability" showBackIcon={false} />
      
      <Box className="p-4">
        {/* User Status Card */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-inner">
              {session?.user?.fullName?.[0] || 'V'}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-800">{session?.user?.fullName || 'Thành viên Vexim'}</h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
                <Text size="small" className="text-gray-500">
                  {isOnline ? 'Đang trực tuyến' : 'Chế độ ngoại tuyến'}
                </Text>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Control */}
        <div className="flex gap-2 mb-6 bg-gray-200 p-1 rounded-xl">
          {(['voice', 'camera', 'batch'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab === 'voice' && '🎤 Ghi âm'}
              {tab === 'camera' && '📷 Chụp ảnh'}
              {tab === 'batch' && '📦 Lô hàng'}
            </button>
          ))}
        </div>

        {/* Main Interface */}
        <div className="min-h-[300px]">
          {activeTab === 'voice' && <VoiceRecorder onRecordingComplete={handleVoiceRecording} />}
          {activeTab === 'camera' && <CameraCapture onImageCapture={handleImageCapture} />}
          {activeTab === 'batch' && session && (
            <BatchInput onSubmit={handleBatchSubmit} accessToken={session.access_token} />
          )}
        </div>

        {/* Recent History */}
        {session && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <Text className="font-bold text-gray-700">Lịch sử ghi nhận</Text>
              {queueSize > 0 && <Text size="xxxSmall" className="bg-orange-100 text-orange-600 px-2 py-1 rounded">Chờ bộ: {queueSize}</Text>}
            </div>
            <RecentEvents userId={session.user.id} accessToken={session.access_token} />
          </div>
        )}
      </Box>
    </Page>
  );
}
