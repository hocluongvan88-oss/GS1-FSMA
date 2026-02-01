'use client'

import React, { useState } from 'react'
import { Search, ChevronRight, MapPin, Calendar, Package } from 'lucide-react'

interface TraceNode {
  id: string
  eventType: string
  bizStep: string
  eventTime: string
  location?: string
  productName?: string
  quantity?: number
  children?: TraceNode[]
}

interface TraceabilityQueryProps {
  accessToken: string
}

export function TraceabilityQuery({ accessToken }: TraceabilityQueryProps) {
  const [searchValue, setSearchValue] = useState('')
  const [searchType, setSearchType] = useState<'gtin' | 'batch' | 'epc'>('gtin')
  const [loading, setLoading] = useState(false)
  const [traceData, setTraceData] = useState<TraceNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Vui lòng nhập mã tìm kiếm')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/traceability/${encodeURIComponent(searchValue)}?type=${searchType}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      const result = await response.json()

      if (result.success) {
        // Mock trace data for demo
        const mockTrace: TraceNode[] = [
          {
            id: '1',
            eventType: 'ObjectEvent',
            bizStep: 'commissioning',
            eventTime: '2024-01-15T08:30:00Z',
            location: 'Vườn cà phê Đà Lạt',
            productName: 'Cà phê Arabica',
            quantity: 500,
            children: [
              {
                id: '2',
                eventType: 'TransformationEvent',
                bizStep: 'processing',
                eventTime: '2024-01-16T10:00:00Z',
                location: 'Nhà máy chế biến HCM',
                productName: 'Cà phê rang xay',
                quantity: 450
              }
            ]
          }
        ]
        setTraceData(mockTrace)
      } else {
        setError(result.error || 'Không tìm thấy dữ liệu')
      }
    } catch (err) {
      console.error('[v0] Traceability query error:', err)
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const renderTraceNode = (node: TraceNode, level: number = 0) => {
    const indent = level * 16

    return (
      <div key={node.id} style={{ marginLeft: `${indent}px` }}>
        <div className="bg-white rounded-lg p-4 mb-2 shadow border-l-4 border-emerald-500">
          {/* Event Type */}
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-gray-900">
              {node.eventType === 'ObjectEvent' ? 'Sự kiện vật thể' : 'Chuyển đổi'}
            </span>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {node.bizStep}
            </span>
          </div>

          {/* Product Info */}
          {node.productName && (
            <div className="text-sm text-gray-700 mb-1">
              📦 {node.productName} ({node.quantity || 0} kg)
            </div>
          )}

          {/* Location */}
          {node.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <MapPin className="w-3 h-3" />
              {node.location}
            </div>
          )}

          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            {new Date(node.eventTime).toLocaleString('vi-VN')}
          </div>
        </div>

        {/* Children */}
        {node.children && node.children.map(child => renderTraceNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Type Selector */}
      <div className="bg-white rounded-xl p-4 shadow">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Loại tìm kiếm
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['gtin', 'batch', 'epc'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                searchType === type
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {type === 'gtin' ? 'GTIN' : type === 'batch' ? 'Batch' : 'EPC'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-xl p-4 shadow">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Nhập mã tìm kiếm
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={
              searchType === 'gtin' ? 'Ví dụ: 08935049501234' :
              searchType === 'batch' ? 'Ví dụ: BATCH001' :
              'Ví dụ: urn:epc:id:sgtin:...'
            }
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Trace Results */}
      {traceData && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Chuỗi truy xuất</h3>
            <span className="text-xs text-gray-500">
              {traceData.length} sự kiện
            </span>
          </div>
          <div className="space-y-2">
            {traceData.map(node => renderTraceNode(node))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !traceData && (
        <div className="bg-white rounded-xl p-8 shadow text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Nhập mã để tra cứu chuỗi truy xuất nguồn gốc
          </p>
        </div>
      )}
    </div>
  )
}
