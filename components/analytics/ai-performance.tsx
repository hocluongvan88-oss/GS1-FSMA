'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/lib/locale-context'

export function AIPerformance() {
  const [queueStats, setQueueStats] = useState<any>(null)
  const [reviewJobs, setReviewJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    fetchAIData()
  }, [])

  async function fetchAIData() {
    try {
      const [statsRes, reviewRes] = await Promise.all([
        fetch('/api/ai-queue?action=stats'),
        fetch('/api/ai-queue?action=review&limit=10')
      ])

      const statsData = await statsRes.json()
      const reviewData = await reviewRes.json()

      if (statsData.success) {
        setQueueStats(statsData.data)
      }
      if (reviewData.success) {
        setReviewJobs(reviewData.data)
      }
    } catch (error) {
      console.error('[v0] Error fetching AI performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">{t('analytics.loading.ai')}</div>
  }

  const statusData = queueStats ? [
    { status: t('analytics.ai.statusLabels.completed'), count: queueStats.completed },
    { status: t('analytics.ai.statusLabels.processing'), count: queueStats.processing },
    { status: t('analytics.ai.statusLabels.pending'), count: queueStats.pending },
    { status: t('analytics.ai.statusLabels.failed'), count: queueStats.failed },
    { status: t('analytics.ai.statusLabels.reviewRequired'), count: queueStats.review_required }
  ] : []

  return (
    <div className="space-y-6">
      {/* Section 1: Performance Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.ai.overview')}</h2>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle>{t('analytics.ai.performanceTitle')}</CardTitle>
            <CardDescription>{t('analytics.ai.performanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.ai.totalProcessed')}</div>
              <div className="text-3xl font-bold text-purple-600">{queueStats?.total || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.ai.avgConfidence')}</div>
              <div className="text-3xl font-bold text-blue-600">
                {queueStats?.avgConfidence
                  ? `${(queueStats.avgConfidence * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.ai.avgTime')}</div>
              <div className="text-3xl font-bold text-orange-600">
                {queueStats?.avgProcessingTime
                  ? `${(queueStats.avgProcessingTime / 1000).toFixed(2)}s`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t('analytics.ai.successRate')}</div>
              <div className="text-3xl font-bold text-green-600">
                {queueStats?.total > 0
                  ? `${((queueStats.completed / queueStats.total) * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Queue Status Chart */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.ai.statusDistTitle')}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.ai.queueStatusTitle')}</CardTitle>
            <CardDescription>{t('analytics.ai.queueStatusDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: {
                  label: 'Jobs',
                  color: 'hsl(var(--chart-1))'
                }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    type="number"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    type="category"
                    dataKey="status"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    stroke="hsl(var(--border))"
                    width={120}
                  />
                  <ChartTooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#8b5cf6"
                    name="Jobs"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Review Queue */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.ai.reviewTitle')}</h2>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle>{t('analytics.ai.reviewQueueTitle')}</CardTitle>
            <CardDescription>{t('analytics.ai.reviewQueueDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewJobs.length === 0 ? (
              <p className="text-muted-foreground">{t('analytics.ai.noReviewNeeded')}</p>
            ) : (
              <div className="space-y-4">
                {reviewJobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{job.job_type.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('analytics.ai.createdAt', { date: new Date(job.created_at).toLocaleString() })}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="warning">
                        {t('analytics.ai.confidenceLabel', { value: job.confidence_score ? `${(job.confidence_score * 100).toFixed(1)}%` : 'N/A' })}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {t('analytics.ai.thresholdLabel', { value: `${(job.confidence_threshold * 100).toFixed(0)}%` })}
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
