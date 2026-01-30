'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, CheckCircle, XCircle, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useLocale } from '@/lib/locale-context'

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [verification, setVerification] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchEntity, setSearchEntity] = useState('')
  const { t } = useLocale()

  useEffect(() => {
    fetchAuditData()
    verifyChain() // Auto-verify chain on page load
  }, [])

  async function fetchAuditData() {
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/audit?limit=50'),
        fetch('/api/audit?action=stats')
      ])

      const logsData = await logsRes.json()
      const statsData = await statsRes.json()

      if (logsData.success) {
        setAuditLogs(logsData.data)
      }
      if (statsData.success) {
        setStats(statsData.data)
      }
    } catch (error) {
      console.error('[v0] Error fetching audit data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function verifyChain() {
    setLoading(true)
    try {
      const response = await fetch('/api/audit?action=verify-chain')
      const data = await response.json()

      if (data.success) {
        setVerification(data.data)
      }
    } catch (error) {
      console.error('[v0] Error verifying chain:', error)
    } finally {
      setLoading(false)
    }
  }

  async function searchAuditTrail() {
    if (!searchEntity) return

    const [entityType, entityId] = searchEntity.split(':')
    if (!entityType || !entityId) {
      alert('Format: entityType:entityId (e.g., events:uuid)')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/audit?action=trail&entityType=${entityType}&entityId=${entityId}`
      )
      const data = await response.json()

      if (data.success) {
        setAuditLogs(data.data.trail)
      }
    } catch (error) {
      console.error('[v0] Error searching audit trail:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('audit.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              {t('audit.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('audit.subtitle')}
            </p>
          </div>
          <Button onClick={verifyChain} disabled={loading}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {t('audit.verifyChain')}
          </Button>
        </div>

        {verification && (
          <Card className={verification.invalidBlocks > 0 ? 'border-destructive' : 'border-green-600'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {verification.invalidBlocks === 0 ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    {t('audit.chainVerified')}
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    {t('audit.chainIssues')}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">{t('audit.totalBlocks')}</div>
                  <div className="text-2xl font-bold">{verification.totalBlocks}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('audit.validBlocks')}</div>
                  <div className="text-2xl font-bold text-green-600">{verification.validBlocks}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('audit.invalidBlocks')}</div>
                  <div className="text-2xl font-bold text-destructive">{verification.invalidBlocks}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.totalBlocks')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total_blocks || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.entityTypes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.entity_types_tracked || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.uniqueUsers')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.unique_users || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.verified')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats?.verified_blocks || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('audit.searchTitle')}</CardTitle>
            <CardDescription>{t('audit.searchDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder={t('audit.searchPlaceholder')}
                value={searchEntity}
                onChange={(e) => setSearchEntity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchAuditTrail()}
              />
              <Button onClick={searchAuditTrail} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('audit.recentLogs')}</CardTitle>
            <CardDescription>{t('audit.recentLogsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b pb-3 last:border-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Block #{log.block_number}</Badge>
                      <span className="font-medium capitalize">{log.action_type.replace('_', ' ')}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.entity_type} • {log.entity_id.slice(0, 8)}...
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      Hash: {log.current_hash.slice(0, 16)}...
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    {log.is_verified && (
                      <Badge variant="success" className="text-xs">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
