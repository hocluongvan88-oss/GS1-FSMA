'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function ComplianceReport() {
  const [certifications, setCertifications] = useState<any[]>([])
  const [complianceScore, setComplianceScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    fetchComplianceData()
  }, [])

  async function fetchComplianceData() {
    try {
      const response = await fetch('/api/analytics/compliance')
      const data = await response.json()

      if (data.success) {
        setCertifications(data.data.certifications || [])
        setComplianceScore(data.data.score || 0)
      }
    } catch (error) {
      console.error('[v0] Error fetching compliance data:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportReport() {
    // Generate and download compliance report
    const report = {
      generated_at: new Date().toISOString(),
      compliance_score: complianceScore,
      certifications: certifications,
      summary: {
        total: certifications.length,
        active: certifications.filter((c) => c.status === 'active').length,
        expired: certifications.filter((c) => c.status === 'expired').length,
        expiring_soon: certifications.filter((c) => {
          const expiryDate = new Date(c.expiry_date)
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0
        }).length
      }
    }

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-muted-foreground">{t('analytics.loading.compliance')}</div>
  }

  const activeCerts = certifications.filter((c) => c.status === 'active')
  const expiredCerts = certifications.filter((c) => c.status === 'expired')
  const expiringCerts = certifications.filter((c) => {
    const expiryDate = new Date(c.expiry_date)
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  })

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('analytics.compliance.title')}</CardTitle>
            <CardDescription>{t('analytics.compliance.subtitle')}</CardDescription>
          </div>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.compliance.exportReport')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{t('analytics.compliance.score')}</div>
              <div className="text-4xl font-bold text-green-600">
                {complianceScore}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{t('analytics.compliance.activeCerts')}</div>
              <div className="text-4xl font-bold">{activeCerts.length}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{t('analytics.compliance.expiringSoon')}</div>
              <div className="text-4xl font-bold text-yellow-600">{expiringCerts.length}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{t('analytics.compliance.expired')}</div>
              <div className="text-4xl font-bold text-red-600">{expiredCerts.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.compliance.activeCertsTitle')}</CardTitle>
            <CardDescription>{t('analytics.compliance.activeCertsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {activeCerts.length === 0 ? (
              <p className="text-muted-foreground">{t('analytics.compliance.noActiveCerts')}</p>
            ) : (
              <div className="space-y-4">
                {activeCerts.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="flex items-start justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium capitalize">{cert.certification_type}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{cert.certification_body}</div>
                      <div className="text-xs text-muted-foreground">
                        Cert #: {cert.certificate_number}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="success">Active</Badge>
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(cert.expiry_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.compliance.attentionTitle')}</CardTitle>
            <CardDescription>{t('analytics.compliance.attentionDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringCerts.length === 0 && expiredCerts.length === 0 ? (
              <p className="text-muted-foreground">{t('analytics.compliance.noAttention')}</p>
            ) : (
              <div className="space-y-4">
                {expiringCerts.map((cert: any) => {
                  const daysUntilExpiry = Math.floor(
                    (new Date(cert.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div
                      key={cert.id}
                      className="flex items-start justify-between border-b pb-3 last:border-0"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium capitalize">{cert.certification_type}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{cert.certification_body}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="warning">{t('analytics.compliance.statusExpiringSoon')}</Badge>
                        <div className="text-xs text-muted-foreground">
                          {t('analytics.compliance.daysLeft', { days: daysUntilExpiry })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {expiredCerts.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="flex items-start justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium capitalize">{cert.certification_type}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{cert.certification_body}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="destructive">{t('analytics.compliance.statusExpired')}</Badge>
                      <div className="text-xs text-muted-foreground">
                        {new Date(cert.expiry_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
