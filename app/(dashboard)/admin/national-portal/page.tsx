'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Globe, Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { Badge } from '@/components/ui/badge'

export default function NationalPortalPage() {
  const { t } = useLocale()

  const syncHistory = [
    {
      id: 1,
      date: '2024-01-20 14:30',
      type: 'events',
      count: 150,
      status: 'success',
    },
    {
      id: 2,
      date: '2024-01-20 08:00',
      type: 'batches',
      count: 45,
      status: 'success',
    },
    {
      id: 3,
      date: '2024-01-19 18:00',
      type: 'events',
      count: 89,
      status: 'pending',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('nationalPortal.title')}
        </h1>
        <p className="text-muted-foreground">{t('nationalPortal.subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('nationalPortal.connectionStatus')}
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-lg font-semibold">{t('nationalPortal.connected')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('nationalPortal.lastSync')}: 14:30
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('nationalPortal.syncedData')}
            </CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              {t('nationalPortal.recordsSynced')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('nationalPortal.pendingSync')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">
              {t('nationalPortal.waitingUpload')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('nationalPortal.syncControl')}</CardTitle>
              <CardDescription>{t('nationalPortal.syncControlDesc')}</CardDescription>
            </div>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              {t('nationalPortal.syncNow')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">{t('nationalPortal.autoSync')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('nationalPortal.autoSyncDesc')}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('nationalPortal.syncInterval')}: 6 {t('nationalPortal.hours')}</span>
                <Button variant="outline" size="sm">
                  {t('nationalPortal.configure')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('nationalPortal.syncHistory')}</CardTitle>
          <CardDescription>{t('nationalPortal.syncHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {syncHistory.map((sync) => (
              <div key={sync.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {sync.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : sync.status === 'pending' ? (
                    <Clock className="h-5 w-5 text-orange-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">{sync.type === 'events' ? t('nationalPortal.events') : t('nationalPortal.batches')}</p>
                    <p className="text-sm text-muted-foreground">{sync.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{sync.count} {t('nationalPortal.records')}</span>
                  <Badge variant={sync.status === 'success' ? 'default' : 'secondary'}>
                    {sync.status === 'success' ? t('nationalPortal.success') : t('nationalPortal.pending')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
