'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Pie, PieChart, Cell, ResponsiveContainer, Legend } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/lib/locale-context'

const STATUS_COLORS = {
  approved: '#10b981',  // Green
  pending: '#f59e0b',   // Orange
  rejected: '#ef4444',  // Red
  recalled: '#6b7280'   // Gray
}

export function QualityMetrics() {
  const [batchStats, setBatchStats] = useState<any>(null)
  const [expiringBatches, setExpiringBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    fetchQualityData()
  }, [])

  async function fetchQualityData() {
    try {
      const response = await fetch('/api/analytics/quality')
      const data = await response.json()

      if (data.success) {
        setBatchStats(data.data.stats)
        setExpiringBatches(data.data.expiring || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching quality data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">{t('analytics.loading.quality')}</div>
  }

  const pieData = batchStats ? [
    { name: t('analytics.quality.pieLabels.approved'), value: batchStats.approved, color: STATUS_COLORS.approved },
    { name: t('analytics.quality.pieLabels.pending'), value: batchStats.pending, color: STATUS_COLORS.pending },
    { name: t('analytics.quality.pieLabels.rejected'), value: batchStats.rejected, color: STATUS_COLORS.rejected },
    { name: t('analytics.quality.pieLabels.recalled'), value: batchStats.recalled, color: STATUS_COLORS.recalled }
  ] : []

  return (
    <div className="space-y-6">
      {/* Section 1: Quality Summary Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.quality.overview')}</h2>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle>{t('analytics.quality.summaryTitle')}</CardTitle>
            <CardDescription>{t('analytics.quality.summaryDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.quality.totalBatches')}</div>
              <div className="text-3xl font-bold text-blue-600">{batchStats?.total || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.quality.approvalRate')}</div>
              <div className="text-3xl font-bold text-green-600">
                {batchStats?.total
                  ? `${((batchStats.approved / batchStats.total) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.quality.totalQuantity')}</div>
              <div className="text-3xl font-bold text-purple-600">
                {batchStats?.totalQuantity?.toLocaleString() || 0}
                <span className="text-base font-normal text-muted-foreground ml-2">{t('analytics.quality.units')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Status Distribution */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.quality.statusDistribution')}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.quality.batchQualityTitle')}</CardTitle>
            <CardDescription>{t('analytics.quality.batchQualityDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                approved: { label: 'Approved', color: STATUS_COLORS.approved },
                pending: { label: 'Pending', color: STATUS_COLORS.pending },
                rejected: { label: 'Rejected', color: STATUS_COLORS.rejected },
                recalled: { label: 'Recalled', color: STATUS_COLORS.recalled }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={{
                      stroke: 'hsl(var(--foreground))',
                      strokeWidth: 1
                    }}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ 
                      color: 'hsl(var(--foreground))',
                      paddingTop: '20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Expiring Batches Alert */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.quality.alertsTitle')}</h2>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle>{t('analytics.quality.expiringTitle')}</CardTitle>
            <CardDescription>{t('analytics.quality.expiringDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringBatches.length === 0 ? (
              <p className="text-muted-foreground">{t('analytics.quality.noExpiring')}</p>
            ) : (
              <div className="space-y-4">
                {expiringBatches.map((batch: any) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{batch.batch_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {batch.products?.name || 'Unknown Product'}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="destructive">
                        {t('analytics.quality.expiresLabel', { date: new Date(batch.expiry_date).toLocaleDateString() })}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {t('analytics.quality.qtyLabel', { quantity: batch.quantity_available })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
