'use client'

import React, { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Package, AlertTriangle } from 'lucide-react'

interface EventStats {
  totalEvents: number
  todayEvents: number
  transformationEvents: number
  massBalanceViolations: number
  avgProcessingTime: number
  topProducts: Array<{ name: string; count: number }>
}

interface AnalyticsDashboardProps {
  accessToken: string
}

export function AnalyticsDashboard({ accessToken }: AnalyticsDashboardProps) {
  const [stats, setStats] = useState<EventStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      // Mock data for demo - replace with actual API call
      const mockStats: EventStats = {
        totalEvents: 1247,
        todayEvents: 45,
        transformationEvents: 123,
        massBalanceViolations: 3,
        avgProcessingTime: 2.4,
        topProducts: [
          { name: 'Cà phê Arabica', count: 342 },
          { name: 'Lúa ST25', count: 289 },
          { name: 'Tôm sú', count: 156 },
        ]
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800))
      setStats(mockStats)
    } catch (error) {
      console.error('[v0] Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-xl p-6 shadow text-center text-gray-500">
        Không thể tải thống kê
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-2 bg-white rounded-xl p-2 shadow">
        {(['today', 'week', 'month'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {range === 'today' ? 'Hôm nay' : range === 'week' ? 'Tuần' : 'Tháng'}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Events */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
              <div className="text-xs text-gray-500">Tổng sự kiện</div>
            </div>
          </div>
        </div>

        {/* Today Events */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.todayEvents}</div>
              <div className="text-xs text-gray-500">Hôm nay</div>
            </div>
          </div>
        </div>

        {/* Transformation Events */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.transformationEvents}</div>
              <div className="text-xs text-gray-500">Chế biến</div>
            </div>
          </div>
        </div>

        {/* Mass Balance Violations */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-gray-900">{stats.massBalanceViolations}</div>
              <div className="text-xs text-gray-500">Cảnh báo</div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Time */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h3 className="font-semibold text-gray-900 mb-3">Hiệu suất xử lý</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Thời gian trung bình</span>
          <span className="text-lg font-bold text-emerald-600">{stats.avgProcessingTime}s</span>
        </div>
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min((3 / stats.avgProcessingTime) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl p-4 shadow">
        <h3 className="font-semibold text-gray-900 mb-3">Sản phẩm phổ biến</h3>
        <div className="space-y-3">
          {stats.topProducts.map((product, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-600">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                <div className="text-xs text-gray-500">{product.count} sự kiện</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
