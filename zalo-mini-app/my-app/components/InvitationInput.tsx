'use client';

import React, { useState } from 'react'
import { Input, Button, Box, Text } from 'zmp-ui'

interface InvitationInputProps {
  onInvitationRedeemed: (organizationName: string, role: string) => void
  userId: string
  zaloId: string
  userName: string
}

export const InvitationInput: React.FC<InvitationInputProps> = ({
  onInvitationRedeemed,
  userId,
  zaloId,
  userName
}) => {
  const [invitationCode, setInvitationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const [validInvitation, setValidInvitation] = useState<any>(null)

  const validateCode = async (code: string) => {
    if (!code || code.length < 10) {
      setValidInvitation(null)
      return
    }

    setValidating(true)
    setError('')

    try {
      const response = await fetch(`/api/invitations/redeem?code=${code}`)
      const result = await response.json()

      if (result.success) {
        setValidInvitation(result.invitation)
      } else {
        setError(result.error)
        setValidInvitation(null)
      }
    } catch (err) {
      console.error('[Zalo] Error validating invitation:', err)
      setError('Không thể kiểm tra mã mời')
      setValidInvitation(null)
    } finally {
      setValidating(false)
    }
  }

  const handleRedeem = async () => {
    if (!invitationCode || !userId) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/invitations/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invitationCode,
          userId,
          zaloId,
          userName
        })
      })

      const result = await response.json()

      if (result.success) {
        onInvitationRedeemed(
          result.organization.name,
          result.role
        )
      } else {
        setError(result.error || 'Không thể sử dụng mã mời')
      }
    } catch (err) {
      console.error('[Zalo] Error redeeming invitation:', err)
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box p={4} className="bg-white rounded-lg shadow">
      <Text size="large" bold className="mb-3">
        Nhập mã mời từ nhà máy
      </Text>
      
      <Text size="small" className="mb-4 text-gray-600">
        Nhập mã mời mà bạn nhận được từ nhà máy để tham gia hệ thống truy xuất nguồn gốc
      </Text>

      <Input
        type="text"
        placeholder="VD: CAFE-2026-ABC123"
        value={invitationCode}
        onChange={(e) => {
          const code = e.target.value.toUpperCase()
          setInvitationCode(code)
          if (code.length >= 10) {
            validateCode(code)
          }
        }}
        className="mb-3"
      />

      {validating && (
        <Text size="xSmall" className="text-blue-500 mb-2">
          Đang kiểm tra mã mời...
        </Text>
      )}

      {validInvitation && (
        <Box className="bg-green-50 p-3 rounded mb-3">
          <Text size="small" bold className="text-green-700 mb-1">
            ✓ Mã hợp lệ
          </Text>
          <Text size="xSmall" className="text-green-600">
            Nhà máy: {validInvitation.organizationName}
          </Text>
          <Text size="xSmall" className="text-green-600">
            Vai trò: {validInvitation.role === 'farmer' ? 'Nông dân' : 'Công nhân'}
          </Text>
          {validInvitation.usesRemaining > 0 && validInvitation.usesRemaining !== -1 && (
            <Text size="xSmall" className="text-green-600">
              Số lượt còn lại: {validInvitation.usesRemaining}
            </Text>
          )}
        </Box>
      )}

      {error && (
        <Box className="bg-red-50 p-3 rounded mb-3">
          <Text size="small" className="text-red-600">
            {error}
          </Text>
        </Box>
      )}

      <Button
        fullWidth
        onClick={handleRedeem}
        disabled={!validInvitation || loading}
        loading={loading}
      >
        {loading ? 'Đang xử lý...' : 'Xác nhận và Tham gia'}
      </Button>

      <Text size="xSmall" className="text-gray-500 text-center mt-3">
        Nếu chưa có mã mời, vui lòng liên hệ với nhà máy của bạn
      </Text>
    </Box>
  )
}
