'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle, XCircle, AlertTriangle, Package, Truck, FileCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useLocale } from '@/lib/locale-context'

type AnomalyType = 'missing_kdes' | 'unverified_shipment' | 'expiring_cert'

interface Anomaly {
  id: string
  type: AnomalyType
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  entity_id: string
  entity_type: string
  detected_at: string
  status: 'open' | 'investigating' | 'resolved'
  metadata: any
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { toast } = useToast()
  const { t } = useLocale()
  const supabase = createClient()

  const loadAnomalies = async () => {
    setLoading(true)
    try {
      const detectedAnomalies: Anomaly[] = []

      // 1. Check for batches missing KDEs
      const { data: missingKdes } = await supabase
        .from('v_batches_missing_kdes')
        .select('*')

      if (missingKdes) {
        for (const batch of missingKdes) {
          const issues = []
          if (batch.tlc_status === 'Missing') issues.push('TLC')
          if (batch.harvest_date_status === 'Missing') issues.push('Harvest Date')
          if (batch.harvest_location_status === 'Missing') issues.push('Harvest Location')
          if (batch.cooling_completion_status === 'Missing') issues.push('Cooling Completion')

          if (issues.length > 0) {
            detectedAnomalies.push({
              id: `missing-kde-${batch.id}`,
              type: 'missing_kdes',
              severity: 'critical',
              title: t('anomalies.types.missingKdes'),
              description: `${batch.batch_number} - ${batch.product_name}: Missing ${issues.join(', ')}`,
              entity_id: batch.id,
              entity_type: 'batch',
              detected_at: new Date().toISOString(),
              status: 'open',
              metadata: batch
            })
          }
        }
      }

      // 2. Check for unverified shipments
      const { data: unverifiedShipments } = await supabase
        .from('v_unverified_shipments')
        .select('*')

      if (unverifiedShipments) {
        for (const shipment of unverifiedShipments) {
          detectedAnomalies.push({
            id: `unverified-shipment-${shipment.id}`,
            type: 'unverified_shipment',
            severity: shipment.alert_level === 'Critical' ? 'critical' : 'warning',
            title: t('anomalies.types.unverifiedShipment'),
            description: `${shipment.shipment_number}: In transit for ${Math.round(shipment.days_in_transit)} days without verification`,
            entity_id: shipment.id,
            entity_type: 'shipment',
            detected_at: shipment.dispatched_at,
            status: 'open',
            metadata: shipment
          })
        }
      }

      // 3. Check for expiring certifications
      const { data: expiringCerts } = await supabase
        .from('v_expiring_certifications')
        .select('*')
        .lte('days_until_expiry', 90)

      if (expiringCerts) {
        for (const cert of expiringCerts) {
          detectedAnomalies.push({
            id: `expiring-cert-${cert.id}`,
            type: 'expiring_cert',
            severity: cert.alert_level === 'Critical' ? 'critical' : 'warning',
            title: t('anomalies.types.expiringCert'),
            description: `${cert.certification_type} for ${cert.issued_to_name}: Expires in ${cert.days_until_expiry} days`,
            entity_id: cert.id,
            entity_type: 'certification',
            detected_at: new Date().toISOString(),
            status: 'open',
            metadata: cert
          })
        }
      }

      setAnomalies(detectedAnomalies)
    } catch (error) {
      console.error('[v0] Error loading anomalies:', error)
      toast({
        title: t('common.error'),
        description: 'Failed to load anomalies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnomalies()
  }, [])

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly)
    setIsDetailOpen(true)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    }
  }

  const getTypeIcon = (type: AnomalyType) => {
    switch (type) {
      case 'missing_kdes':
        return <Package className="w-5 h-5" />
      case 'unverified_shipment':
        return <Truck className="w-5 h-5" />
      case 'expiring_cert':
        return <FileCheck className="w-5 h-5" />
    }
  }

  const stats = {
    total: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    open: anomalies.filter(a => a.status === 'open').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('anomalies.title')}</h1>
        <p className="text-muted-foreground">{t('anomalies.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('anomalies.stats.totalAnomalies')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('anomalies.stats.critical')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('anomalies.stats.warning')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.warning}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('anomalies.stats.open')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.open}</div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('anomalies.detectedAnomalies')}</CardTitle>
          <CardDescription>{t('anomalies.detectedAnomaliesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">{t('anomalies.noAnomalies')}</p>
              <p className="text-sm text-muted-foreground">{t('anomalies.noAnomaliesDesc')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {anomalies.map((anomaly) => (
                <Card key={anomaly.id} className="border-l-4" style={{
                  borderLeftColor: anomaly.severity === 'critical' ? '#ef4444' : 
                                 anomaly.severity === 'warning' ? '#eab308' : '#3b82f6'
                }}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded ${getSeverityColor(anomaly.severity)}`}>
                          {getTypeIcon(anomaly.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{anomaly.title}</h4>
                            <Badge variant="outline" className={getSeverityColor(anomaly.severity)}>
                              {t(`anomalies.severity.${anomaly.severity}`)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{anomaly.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{t('anomalies.detected')}: {new Date(anomaly.detected_at).toLocaleString('vi-VN')}</span>
                            <Badge variant="secondary">{t(`anomalies.status.${anomaly.status}`)}</Badge>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(anomaly)}
                      >
                        {t('anomalies.viewDetails')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('anomalies.anomalyDetails')}</DialogTitle>
            <DialogDescription>{t('anomalies.anomalyDetailsDesc')}</DialogDescription>
          </DialogHeader>
          {selectedAnomaly && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded ${getSeverityColor(selectedAnomaly.severity)}`}>
                  {getTypeIcon(selectedAnomaly.type)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{selectedAnomaly.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAnomaly.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('anomalies.severity.label')}</p>
                  <Badge className={getSeverityColor(selectedAnomaly.severity)}>
                    {t(`anomalies.severity.${selectedAnomaly.severity}`)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('anomalies.status.label')}</p>
                  <Badge variant="secondary">{t(`anomalies.status.${selectedAnomaly.status}`)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('anomalies.detected')}</p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(selectedAnomaly.detected_at).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('anomalies.entityType')}</p>
                  <p className="text-sm font-medium text-foreground capitalize">{selectedAnomaly.entity_type}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 text-foreground">{t('anomalies.additionalInfo')}</h4>
                <div className="space-y-3">
                  {selectedAnomaly.metadata && typeof selectedAnomaly.metadata === 'object' && (
                    <>
                      {selectedAnomaly.metadata.batch_number && (
                        <div className="flex justify-between p-3 bg-muted/30 rounded">
                          <span className="text-sm text-muted-foreground">Batch Number</span>
                          <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.batch_number}</span>
                        </div>
                      )}
                      {selectedAnomaly.metadata.product_name && (
                        <div className="flex justify-between p-3 bg-muted/30 rounded">
                          <span className="text-sm text-muted-foreground">Product Name</span>
                          <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.product_name}</span>
                        </div>
                      )}
                      {selectedAnomaly.metadata.production_date && (
                        <div className="flex justify-between p-3 bg-muted/30 rounded">
                          <span className="text-sm text-muted-foreground">Production Date</span>
                          <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.production_date}</span>
                        </div>
                      )}
                      {selectedAnomaly.metadata.category && (
                        <div className="flex justify-between p-3 bg-muted/30 rounded">
                          <span className="text-sm text-muted-foreground">Category</span>
                          <span className="text-sm font-medium text-foreground capitalize">{selectedAnomaly.metadata.category}</span>
                        </div>
                      )}
                      
                      {/* Missing KDEs Section */}
                      {(selectedAnomaly.metadata.harvest_date_status === 'Missing' || 
                        selectedAnomaly.metadata.harvest_location_status === 'Missing' ||
                        selectedAnomaly.metadata.cooling_completion_status === 'Missing' ||
                        selectedAnomaly.metadata.tlc_status === 'Missing') && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Missing Key Data Elements:</p>
                          <ul className="space-y-1 text-sm text-muted-foreground">
                            {selectedAnomaly.metadata.tlc_status === 'Missing' && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                Traceability Lot Code (TLC)
                              </li>
                            )}
                            {selectedAnomaly.metadata.harvest_date_status === 'Missing' && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                Harvest Date
                              </li>
                            )}
                            {selectedAnomaly.metadata.harvest_location_status === 'Missing' && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                Harvest Location
                              </li>
                            )}
                            {selectedAnomaly.metadata.cooling_completion_status === 'Missing' && (
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                Cooling Completion
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Shipment Info */}
                      {selectedAnomaly.metadata.shipment_number && (
                        <>
                          <div className="flex justify-between p-3 bg-muted/30 rounded">
                            <span className="text-sm text-muted-foreground">Shipment Number</span>
                            <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.shipment_number}</span>
                          </div>
                          {selectedAnomaly.metadata.dispatch_date && (
                            <div className="flex justify-between p-3 bg-muted/30 rounded">
                              <span className="text-sm text-muted-foreground">Dispatch Date</span>
                              <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.dispatch_date}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Certification Info */}
                      {selectedAnomaly.metadata.certification_name && (
                        <>
                          <div className="flex justify-between p-3 bg-muted/30 rounded">
                            <span className="text-sm text-muted-foreground">Certification</span>
                            <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.certification_name}</span>
                          </div>
                          {selectedAnomaly.metadata.expiry_date && (
                            <div className="flex justify-between p-3 bg-muted/30 rounded">
                              <span className="text-sm text-muted-foreground">Expiry Date</span>
                              <span className="text-sm font-medium text-foreground">{selectedAnomaly.metadata.expiry_date}</span>
                            </div>
                          )}
                          {selectedAnomaly.metadata.days_until_expiry && (
                            <div className="flex justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                              <span className="text-sm text-muted-foreground">Days Until Expiry</span>
                              <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                                {selectedAnomaly.metadata.days_until_expiry} days
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
