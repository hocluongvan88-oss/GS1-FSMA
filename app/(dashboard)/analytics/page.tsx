'use client'

import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupplyChainFlow } from '@/components/analytics/supply-chain-flow'
import { QualityMetrics } from '@/components/analytics/quality-metrics'
import { AIPerformance } from '@/components/analytics/ai-performance'
import { ComplianceReport } from '@/components/analytics/compliance-report'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocale } from '@/lib/locale-context'

export default function AnalyticsPage() {
  const { t } = useLocale()
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">
            {t('analytics.subtitle')}
          </p>
        </div>

        <Tabs defaultValue="supply-chain" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="supply-chain">{t('analytics.tabs.supplyChain')}</TabsTrigger>
            <TabsTrigger value="quality">{t('analytics.tabs.quality')}</TabsTrigger>
            <TabsTrigger value="ai">{t('analytics.tabs.ai')}</TabsTrigger>
            <TabsTrigger value="compliance">{t('analytics.tabs.compliance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="supply-chain" className="space-y-6">
            <Suspense fallback={<AnalyticsSkeleton />}>
              <SupplyChainFlow />
            </Suspense>
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <Suspense fallback={<AnalyticsSkeleton />}>
              <QualityMetrics />
            </Suspense>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Suspense fallback={<AnalyticsSkeleton />}>
              <AIPerformance />
            </Suspense>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Suspense fallback={<AnalyticsSkeleton />}>
              <ComplianceReport />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
