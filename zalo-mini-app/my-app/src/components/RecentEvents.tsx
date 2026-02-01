'use client';

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'zmp-ui';

interface Event {
  id: string;
  event_type: string;
  event_time: string;
  biz_step: string;
  source_type: string;
  ai_metadata: {
    productName?: string;
    quantity?: number;
    confidence?: number;
  };
}

interface RecentEventsProps {
  userId: string;
  accessToken: string;
}

export const RecentEvents: React.FC<RecentEventsProps> = ({ userId, accessToken }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentEvents();
  }, [userId]);

  const loadRecentEvents = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?created_by=eq.${userId}&order=event_time.desc&limit=10`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('[v0] Failed to load recent events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatEventType = (type: string): string => {
    const types: Record<string, string> = {
      'ObjectEvent': 'Ghi nhận',
      'TransformationEvent': 'Chế biến',
      'AggregationEvent': 'Đóng gói',
      'TransactionEvent': 'Giao dịch'
    };
    return types[type] || type;
  };

  const formatBizStep = (step: string): string => {
    const steps: Record<string, string> = {
      'commissioning': 'Thu hoạch',
      'packing': 'Đóng gói',
      'shipping': 'Vận chuyển',
      'receiving': 'Nhận hàng',
      'observing': 'Quan sát'
    };
    return steps[step] || step;
  };

  const formatTime = (time: string): string => {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
  };

  const getSourceIcon = (sourceType: string): string => {
    if (sourceType === 'voice_ai') return '🎤';
    if (sourceType === 'vision_ai') return '📷';
    return '📝';
  };

  if (loading) {
    return (
      <Box className="bg-white rounded-lg p-4">
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <Text className="mt-2 text-sm">Đang tải...</Text>
        </div>
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box className="bg-white rounded-lg p-4">
        <div className="text-center text-gray-500">
          <Text>Chưa có hoạt động nào</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className="bg-white rounded-lg divide-y">
      {events.map((event) => (
        <div key={event.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{getSourceIcon(event.source_type)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <Text className="font-medium">
                  {formatBizStep(event.biz_step)}
                </Text>
                <Text className="text-xs text-gray-500">
                  {formatTime(event.event_time)}
                </Text>
              </div>
              {event.ai_metadata?.productName && (
                <Text className="text-sm text-gray-700 mb-1">
                  {event.ai_metadata.productName}
                  {event.ai_metadata.quantity && ` • ${event.ai_metadata.quantity} kg`}
                </Text>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                  {formatEventType(event.event_type)}
                </span>
                {event.ai_metadata?.confidence && (
                  <span className="text-xs text-gray-500">
                    {Math.round(event.ai_metadata.confidence * 100)}% độ chính xác
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </Box>
  );
};
