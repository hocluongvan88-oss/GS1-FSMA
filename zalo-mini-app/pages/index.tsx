'use client';

/**
 * Zalo Mini App - Main Page
 * For Farmers & Workers to record traceability events
 */

import React, { useEffect, useState } from 'react';
import { Page, Header, Text, Box, Button } from 'zmp-ui';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { CameraCapture } from '../components/CameraCapture';
import { 
  authenticateWithZalo, 
  getCurrentUser, 
  UserProfile,
  supabase 
} from '../utils/zalo-auth';

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'voice' | 'camera'>('voice');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // Authenticate with Zalo
      const { supabaseUser, isNewUser } = await authenticateWithZalo();
      setUser(supabaseUser);

      if (isNewUser) {
        // Show onboarding for new users
        alert('Chào mừng bạn! Hãy bắt đầu ghi nhận hoạt động của mình.');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      alert('Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecording = async (audioUrl: string, transcript?: string) => {
    try {
      // Parse transcript to create EPCIS event
      const eventData = parseVoiceInput(transcript || '');
      
      // Create event in database
      await createEvent({
        ...eventData,
        source_type: 'voice_ai',
        user_id: user?.id,
        user_name: user?.full_name,
        ai_metadata: {
          transcript,
          audioUrl,
          confidence: 0.85 // From AI API
        }
      });

      alert('Đã ghi nhận thành công!');
    } catch (error) {
      console.error('Error creating voice event:', error);
      alert('Lỗi khi lưu dữ liệu.');
    }
  };

  const handleImageCapture = async (imageUrl: string, aiResult?: any) => {
    try {
      // Create event from vision AI result
      await createEvent({
        event_type: 'ObjectEvent',
        event_time: new Date().toISOString(),
        biz_step: 'observing',
        disposition: 'active',
        read_point: user?.assigned_location,
        source_type: 'vision_ai',
        user_id: user?.id,
        user_name: user?.full_name,
        ai_metadata: {
          imageUrl,
          detectedText: aiResult?.ocr,
          objectCount: aiResult?.count,
          confidence: aiResult?.confidence
        },
        epcis_document: generateEPCISDocument({
          eventType: 'ObjectEvent',
          bizStep: 'observing',
          aiResult
        })
      });

      alert('Đã ghi nhận thành công!');
    } catch (error) {
      console.error('Error creating vision event:', error);
      alert('Lỗi khi lưu dữ liệu.');
    }
  };

  const createEvent = async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const parseVoiceInput = (transcript: string): any => {
    // Simple parsing logic - in production use NLP/LLM
    // Example: "Thu hoạch 50 kg cà phê tại vườn A"
    return {
      event_type: 'ObjectEvent',
      event_time: new Date().toISOString(),
      biz_step: 'commissioning',
      disposition: 'active',
      read_point: user?.assigned_location
    };
  };

  const generateEPCISDocument = (params: any): any => {
    // Generate GS1 EPCIS 2.0 JSON-LD document
    return {
      '@context': 'https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld',
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: new Date().toISOString(),
      epcisBody: {
        eventList: [
          {
            type: params.eventType,
            eventTime: new Date().toISOString(),
            eventTimeZoneOffset: '+07:00',
            bizStep: params.bizStep,
            disposition: 'active'
          }
        ]
      }
    };
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

      <Box className="p-4">
        {/* User Info */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow">
          <div className="flex items-center gap-3">
            <img 
              src={user?.avatar_url || '/default-avatar.png'} 
              alt="Avatar"
              className="w-12 h-12 rounded-full"
            />
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{user?.full_name}</h2>
              <p className="text-sm text-gray-600 capitalize">{user?.role}</p>
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
            Ghi âm
          </button>
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'camera'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            Chụp ảnh
          </button>
        </div>

        {/* Active Component */}
        {activeTab === 'voice' && (
          <VoiceRecorder onRecordingComplete={handleVoiceRecording} />
        )}

        {activeTab === 'camera' && (
          <CameraCapture onImageCapture={handleImageCapture} />
        )}

        {/* Recent Events */}
        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-3">Hoạt động gần đây</h3>
          <div className="bg-white rounded-lg divide-y">
            {/* Placeholder for recent events list */}
            <div className="p-4 text-center text-gray-500 text-sm">
              Chưa có hoạt động nào
            </div>
          </div>
        </div>
      </Box>
    </Page>
  );
}
