'use client'

import React from "react"

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { useLocale } from '@/lib/locale-context'

export default function ManualEventPage() {
  const { t } = useLocale()
  const [formData, setFormData] = useState({
    eventType: '',
    action: '',
    epc: '',
    quantity: '',
    unit: 'kg',
    location: '',
    bizStep: '',
    disposition: '',
    notes: '',
    // Aggregation specific
    parentID: '',
    childEPCs: '',
    // Transformation specific
    inputEPCs: '',
    outputEPCs: '',
    transformationID: '',
    // Transaction specific
    bizTransaction: '',
    bizTransactionType: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation based on event type
    if (!formData.eventType || !formData.location) {
      toast({
        title: t('manualEvent.validation.missingFields'),
        description: t('manualEvent.validation.requiredFields'),
        variant: 'destructive',
      })
      return
    }

    // Event-specific validation
    if (formData.eventType === 'AggregationEvent' && (!formData.parentID || !formData.childEPCs)) {
      toast({
        title: t('manualEvent.validation.missingFields'),
        description: 'Parent ID và Child EPCs là bắt buộc cho Aggregation Event',
        variant: 'destructive',
      })
      return
    }

    if (formData.eventType === 'TransformationEvent' && (!formData.inputEPCs || !formData.outputEPCs || !formData.transformationID)) {
      toast({
        title: t('manualEvent.validation.missingFields'),
        description: 'Input, Output EPCs và Transformation ID là bắt buộc cho Transformation Event',
        variant: 'destructive',
      })
      return
    }

    if (formData.eventType === 'TransactionEvent' && (!formData.bizTransaction || !formData.bizTransactionType)) {
      toast({
        title: t('manualEvent.validation.missingFields'),
        description: 'Transaction type và number là bắt buộc cho Transaction Event',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Build payload based on event type
      const basePayload = {
        event_type: formData.eventType,
        biz_location: formData.location,
        biz_step: formData.bizStep,
        disposition: formData.disposition,
        source_type: 'manual',
        metadata: { notes: formData.notes },
      }

      let payload: any = { ...basePayload }

      // Add event-specific fields
      if (formData.eventType === 'ObjectEvent') {
        payload = {
          ...payload,
          action: formData.action,
          epc_list: formData.epc ? formData.epc.split('\n').filter(e => e.trim()) : [],
          input_quantity: formData.quantity ? [{ quantity: parseFloat(formData.quantity), uom: formData.unit }] : undefined,
        }
      } else if (formData.eventType === 'AggregationEvent') {
        payload = {
          ...payload,
          action: formData.action,
          epc_list: [formData.parentID], // Parent as main EPC
          input_epc_list: formData.childEPCs.split('\n').filter(e => e.trim()), // Child EPCs
          metadata: {
            ...payload.metadata,
            parentID: formData.parentID,
            aggregationType: formData.action,
          },
        }
      } else if (formData.eventType === 'TransformationEvent') {
        payload = {
          ...payload,
          input_epc_list: formData.inputEPCs.split('\n').filter(e => e.trim()),
          output_epc_list: formData.outputEPCs.split('\n').filter(e => e.trim()),
          metadata: {
            ...payload.metadata,
            transformationID: formData.transformationID,
          },
        }
      } else if (formData.eventType === 'TransactionEvent') {
        payload = {
          ...payload,
          epc_list: formData.epc ? formData.epc.split('\n').filter(e => e.trim()) : [],
          metadata: {
            ...payload.metadata,
            bizTransaction: {
              type: formData.bizTransactionType,
              value: formData.bizTransaction,
            },
          },
        }
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to create event')

      toast({
        title: t('common.success'),
        description: t('manualEvent.success.created'),
      })

      // Reset all form fields
      setFormData({
        eventType: '',
        action: '',
        epc: '',
        quantity: '',
        unit: 'kg',
        location: '',
        bizStep: '',
        disposition: '',
        notes: '',
        parentID: '',
        childEPCs: '',
        inputEPCs: '',
        outputEPCs: '',
        transformationID: '',
        bizTransaction: '',
        bizTransactionType: '',
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('manualEvent.error.createFailed'),
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Toaster />
      <Card>
        <CardHeader>
          <CardTitle>{t('manualEvent.title')}</CardTitle>
          <CardDescription>
            {t('manualEvent.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Event Type - Always shown */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="eventType">{t('manualEvent.fields.eventType')} *</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(v) => setFormData({ ...formData, eventType: v })}
                >
                  <SelectTrigger id="eventType">
                    <SelectValue placeholder={t('manualEvent.fields.selectEventType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ObjectEvent">{t('manualEvent.eventTypes.object')}</SelectItem>
                    <SelectItem value="AggregationEvent">{t('manualEvent.eventTypes.aggregation')}</SelectItem>
                    <SelectItem value="TransactionEvent">{t('manualEvent.eventTypes.transaction')}</SelectItem>
                    <SelectItem value="TransformationEvent">{t('manualEvent.eventTypes.transformation')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ObjectEvent Fields */}
              {formData.eventType === 'ObjectEvent' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="action">{t('manualEvent.fields.action')}</Label>
                    <Select
                      value={formData.action}
                      onValueChange={(v) => setFormData({ ...formData, action: v })}
                    >
                      <SelectTrigger id="action">
                        <SelectValue placeholder={t('manualEvent.fields.selectAction')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADD">{t('manualEvent.actions.add')}</SelectItem>
                        <SelectItem value="OBSERVE">{t('manualEvent.actions.observe')}</SelectItem>
                        <SelectItem value="DELETE">{t('manualEvent.actions.delete')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="epc">{t('manualEvent.fields.epc')}</Label>
                    <Input
                      id="epc"
                      placeholder={t('manualEvent.fields.epcPlaceholder')}
                      value={formData.epc}
                      onChange={(e) => setFormData({ ...formData, epc: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">{t('manualEvent.fields.quantity')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quantity"
                        type="number"
                        placeholder={t('manualEvent.fields.quantityPlaceholder')}
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="flex-1"
                      />
                      <Select
                        value={formData.unit}
                        onValueChange={(v) => setFormData({ ...formData, unit: v })}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ton">Tấn</SelectItem>
                          <SelectItem value="piece">Cái</SelectItem>
                          <SelectItem value="box">Hộp</SelectItem>
                          <SelectItem value="bag">Bao</SelectItem>
                          <SelectItem value="liter">Lít</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bizStep">{t('manualEvent.fields.businessStep')}</Label>
                    <Select
                      value={formData.bizStep}
                      onValueChange={(v) => setFormData({ ...formData, bizStep: v })}
                    >
                      <SelectTrigger id="bizStep">
                        <SelectValue placeholder={t('manualEvent.fields.selectBusinessStep')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commissioning">{t('manualEvent.bizSteps.commissioning')}</SelectItem>
                        <SelectItem value="receiving">{t('manualEvent.bizSteps.receiving')}</SelectItem>
                        <SelectItem value="shipping">{t('manualEvent.bizSteps.shipping')}</SelectItem>
                        <SelectItem value="transforming">{t('manualEvent.bizSteps.transforming')}</SelectItem>
                        <SelectItem value="packing">{t('manualEvent.bizSteps.packing')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="disposition">{t('manualEvent.fields.disposition')}</Label>
                    <Select
                      value={formData.disposition}
                      onValueChange={(v) => setFormData({ ...formData, disposition: v })}
                    >
                      <SelectTrigger id="disposition">
                        <SelectValue placeholder={t('manualEvent.fields.selectDisposition')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">{t('manualEvent.dispositions.inProgress')}</SelectItem>
                        <SelectItem value="in_transit">{t('manualEvent.dispositions.inTransit')}</SelectItem>
                        <SelectItem value="active">{t('manualEvent.dispositions.active')}</SelectItem>
                        <SelectItem value="completed">{t('manualEvent.dispositions.completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* AggregationEvent Fields */}
              {formData.eventType === 'AggregationEvent' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="action">{t('manualEvent.fields.action')} *</Label>
                    <Select
                      value={formData.action}
                      onValueChange={(v) => setFormData({ ...formData, action: v })}
                    >
                      <SelectTrigger id="action">
                        <SelectValue placeholder={t('manualEvent.fields.selectAction')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADD">{t('manualEvent.aggregation.actionAdd')}</SelectItem>
                        <SelectItem value="OBSERVE">{t('manualEvent.aggregation.actionObserve')}</SelectItem>
                        <SelectItem value="DELETE">{t('manualEvent.aggregation.actionDelete')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentID">{t('manualEvent.aggregation.parentID')} *</Label>
                    <Input
                      id="parentID"
                      placeholder={t('manualEvent.aggregation.parentIDPlaceholder')}
                      value={formData.parentID}
                      onChange={(e) => setFormData({ ...formData, parentID: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="childEPCs">{t('manualEvent.aggregation.childEPCs')} *</Label>
                    <Textarea
                      id="childEPCs"
                      placeholder={t('manualEvent.aggregation.childEPCsPlaceholder')}
                      value={formData.childEPCs}
                      onChange={(e) => setFormData({ ...formData, childEPCs: e.target.value })}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">{t('manualEvent.aggregation.childEPCsHelper')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bizStep">{t('manualEvent.fields.businessStep')}</Label>
                    <Select
                      value={formData.bizStep}
                      onValueChange={(v) => setFormData({ ...formData, bizStep: v })}
                    >
                      <SelectTrigger id="bizStep">
                        <SelectValue placeholder={t('manualEvent.fields.selectBusinessStep')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="packing">{t('manualEvent.bizSteps.packing')}</SelectItem>
                        <SelectItem value="unpacking">{t('manualEvent.bizSteps.unpacking')}</SelectItem>
                        <SelectItem value="shipping">{t('manualEvent.bizSteps.shipping')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* TransformationEvent Fields */}
              {formData.eventType === 'TransformationEvent' && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="inputEPCs">{t('manualEvent.transformation.inputEPCs')} *</Label>
                    <Textarea
                      id="inputEPCs"
                      placeholder={t('manualEvent.transformation.inputEPCsPlaceholder')}
                      value={formData.inputEPCs}
                      onChange={(e) => setFormData({ ...formData, inputEPCs: e.target.value })}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">{t('manualEvent.transformation.inputHelper')}</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="outputEPCs">{t('manualEvent.transformation.outputEPCs')} *</Label>
                    <Textarea
                      id="outputEPCs"
                      placeholder={t('manualEvent.transformation.outputEPCsPlaceholder')}
                      value={formData.outputEPCs}
                      onChange={(e) => setFormData({ ...formData, outputEPCs: e.target.value })}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">{t('manualEvent.transformation.outputHelper')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transformationID">{t('manualEvent.transformation.transformationID')} *</Label>
                    <Input
                      id="transformationID"
                      placeholder={t('manualEvent.transformation.transformationIDPlaceholder')}
                      value={formData.transformationID}
                      onChange={(e) => setFormData({ ...formData, transformationID: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bizStep">{t('manualEvent.fields.businessStep')}</Label>
                    <Select
                      value={formData.bizStep}
                      onValueChange={(v) => setFormData({ ...formData, bizStep: v })}
                    >
                      <SelectTrigger id="bizStep">
                        <SelectValue placeholder={t('manualEvent.fields.selectBusinessStep')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transforming">{t('manualEvent.bizSteps.transforming')}</SelectItem>
                        <SelectItem value="commissioning">{t('manualEvent.bizSteps.commissioning')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* TransactionEvent Fields */}
              {formData.eventType === 'TransactionEvent' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bizTransactionType">{t('manualEvent.transaction.type')} *</Label>
                    <Select
                      value={formData.bizTransactionType}
                      onValueChange={(v) => setFormData({ ...formData, bizTransactionType: v })}
                    >
                      <SelectTrigger id="bizTransactionType">
                        <SelectValue placeholder={t('manualEvent.transaction.selectType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="po">{t('manualEvent.transaction.po')}</SelectItem>
                        <SelectItem value="invoice">{t('manualEvent.transaction.invoice')}</SelectItem>
                        <SelectItem value="bol">{t('manualEvent.transaction.bol')}</SelectItem>
                        <SelectItem value="desadv">{t('manualEvent.transaction.desadv')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bizTransaction">{t('manualEvent.transaction.number')} *</Label>
                    <Input
                      id="bizTransaction"
                      placeholder={t('manualEvent.transaction.numberPlaceholder')}
                      value={formData.bizTransaction}
                      onChange={(e) => setFormData({ ...formData, bizTransaction: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="epc">{t('manualEvent.fields.epc')}</Label>
                    <Textarea
                      id="epc"
                      placeholder={t('manualEvent.transaction.epcListPlaceholder')}
                      value={formData.epc}
                      onChange={(e) => setFormData({ ...formData, epc: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bizStep">{t('manualEvent.fields.businessStep')}</Label>
                    <Select
                      value={formData.bizStep}
                      onValueChange={(v) => setFormData({ ...formData, bizStep: v })}
                    >
                      <SelectTrigger id="bizStep">
                        <SelectValue placeholder={t('manualEvent.fields.selectBusinessStep')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shipping">{t('manualEvent.bizSteps.shipping')}</SelectItem>
                        <SelectItem value="receiving">{t('manualEvent.bizSteps.receiving')}</SelectItem>
                        <SelectItem value="inspecting">{t('manualEvent.bizSteps.inspecting')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Location - Always shown */}
              {formData.eventType && (
                <div className="space-y-2">
                  <Label htmlFor="location">{t('manualEvent.fields.location')} *</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(v) => setFormData({ ...formData, location: v })}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder={t('manualEvent.fields.selectLocation')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8412345678900">{t('manualEvent.locations.farm')}</SelectItem>
                      <SelectItem value="8412345678901">{t('manualEvent.locations.factory')}</SelectItem>
                      <SelectItem value="8412345678902">{t('manualEvent.locations.warehouse')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('manualEvent.fields.notes')}</Label>
              <Textarea
                id="notes"
                placeholder={t('manualEvent.fields.notesPlaceholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? t('manualEvent.saving') : t('manualEvent.createButton')}
            </Button>
          </form>

          <div className="mt-6 space-y-4">
            <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
              <p className="font-medium mb-2">{t('manualEvent.epcisStandard')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>{t('manualEvent.what')}</strong> EPC/GTIN - {t('manualEvent.whatDesc')}</li>
                <li><strong>{t('manualEvent.where')}</strong> GLN - {t('manualEvent.whereDesc')}</li>
                <li><strong>{t('manualEvent.when')}</strong> Timestamp - {t('manualEvent.whenDesc')}</li>
                <li><strong>{t('manualEvent.why')}</strong> Business Step - {t('manualEvent.whyDesc')}</li>
                <li><strong>{t('manualEvent.how')}</strong> Disposition - {t('manualEvent.howDesc')}</li>
              </ul>
            </div>
            
            <div className="text-sm bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">{t('manualEvent.zaloTitle')}</p>
              <p className="text-blue-800 dark:text-blue-200">
                {t('manualEvent.zaloDescription')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
