'use client';

/**
 * Voice Recorder Component for Zalo Mini App
 * Records audio for AI processing (OpenAI Whisper / Gemini)
 */

import React, { useState, useRef } from 'react';
import { chooseMedia, uploadFile } from 'zmp-sdk/apis';
import { supabase } from '../utils/zalo-auth';

interface VoiceRecorderProps {
  onRecordingComplete: (transcript: string, extractedData?: any) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAndProcessAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Không thể truy cập microphone. Vui lòng cấp quyền.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAndProcessAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // For now, simulate transcription
      // TODO: Implement real audio transcription with Whisper API
      const mockTranscript = 'Nhận 50kg cà chua';
      
      // Get user info from localStorage or context
      const userId = localStorage.getItem('zalo_user_id') || 'zalo-user-test';
      const userName = localStorage.getItem('zalo_user_name') || 'Zalo User';
      const locationGLN = '8412345678901';

      // Call Next.js API route (matching test page)
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mockTranscript,
          userId,
          userName,
          locationGLN,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API call failed');
      }

      const result = await response.json();
      
      if (result.success) {
        onRecordingComplete(mockTranscript, result.extractedData);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('[Zalo Mini App] Error processing audio:', error);
      alert('Lỗi xử lý âm thanh. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Ghi âm giọng nói</h3>
        <p className="text-sm text-gray-600">
          Nói để nhập thông tin nhanh chóng
        </p>
      </div>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        className={`
          w-20 h-20 rounded-full flex items-center justify-center transition-all
          ${isRecording 
            ? 'bg-red-500 animate-pulse' 
            : 'bg-emerald-500 hover:bg-emerald-600'
          }
          ${(disabled || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          shadow-lg
        `}
      >
        {isProcessing ? (
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="w-10 h-10 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            {isRecording ? (
              <rect x="6" y="4" width="8" height="12" rx="1" />
            ) : (
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            )}
          </svg>
        )}
      </button>

      <div className="text-center">
        {isRecording && (
          <p className="text-red-500 font-medium animate-pulse">
            Đang ghi âm...
          </p>
        )}
        {isProcessing && (
          <p className="text-emerald-600 font-medium">
            Đang xử lý...
          </p>
        )}
        {!isRecording && !isProcessing && (
          <p className="text-gray-500 text-sm">
            Nhấn để {isRecording ? 'dừng' : 'bắt đầu'} ghi âm
          </p>
        )}
      </div>
    </div>
  );
}
