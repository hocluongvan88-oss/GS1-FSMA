'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Filter, Download, Calendar, MapPin, User } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { formatEPC, formatQuantity } from '@/lib/utils/epc-formatter'

interface Event {
  id: string
  event_type: string
  event_time: string
  biz_step: string
  source_type: string
  user_name: string
  read_point: string
  epc_list: any
  quantity_list: any
  biz_location: string
  disposition: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState('all')
  const [timeRangeFilter, setTimeRangeFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const { t } = useLocale()

  useEffect(() => {
    loadEvents()
    
    // Subscribe to real-time events
    const supabase = createClient()
    const subscription = supabase
      .channel('events-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        console.log('[v0] New event received:', payload)
        setEvents(prev => [payload.new as Event, ...prev])
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    filterEvents()
  }, [events, searchQuery, eventTypeFilter, sourceTypeFilter, timeRangeFilter])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('events')
        .select('*, epcis_document')
        .order('event_time', { ascending: false })
        .limit(500)

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('[v0] Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterEvents = () => {
    let filtered = [...events]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(event => 
        event.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.biz_step?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.read_point?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Event type filter
    if (eventTypeFilter !== 'all') {
      if (eventTypeFilter === 'CTE') {
        // Filter CTE events by business step
        const cteSteps = ['harvesting', 'cooling', 'initial_packing', 'shipping', 'receiving', 'transforming']
        filtered = filtered.filter(event => cteSteps.includes(event.biz_step?.toLowerCase() || ''))
      } else {
        filtered = filtered.filter(event => event.event_type === eventTypeFilter)
      }
    }

    // Source type filter
    if (sourceTypeFilter !== 'all') {
      filtered = filtered.filter(event => event.source_type === sourceTypeFilter)
    }

    // Time range filter
    if (timeRangeFilter !== 'all') {
      const now = new Date()
      const hoursAgo = timeRangeFilter === '24h' ? 24 : timeRangeFilter === '7d' ? 168 : 720
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
      filtered = filtered.filter(event => new Date(event.event_time) >= startTime)
    }

    setFilteredEvents(filtered)
  }

  const exportToCSV = () => {
    const headers = ['Time', 'Event Type', 'Business Step', 'Source', 'User', 'Location']
    const rows = filteredEvents.map(event => [
      new Date(event.event_time).toISOString(),
      event.event_type,
      event.biz_step || '',
      event.source_type,
      event.user_name || '',
      event.read_point || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events_${new Date().toISOString()}.csv`
    a.click()
  }

  const handleViewDetails = (event: Event) => {
    setSelectedEvent(event)
    setIsDetailDialogOpen(true)
  }

  const getSourceBadgeColor = (sourceType: string) => {
    switch (sourceType) {
      case 'voice_ai':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'vision_ai':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'manual':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('events.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('events.subtitle')}
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={filteredEvents.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          {t('events.exportCsv')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('events.stats.totalEvents')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{events.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('events.stats.voiceAi')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {events.filter(e => e.source_type === 'voice_ai').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('events.stats.visionAi')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {events.filter(e => e.source_type === 'vision_ai').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('events.stats.manual')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {events.filter(e => e.source_type === 'manual').length}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('events.stats.cte')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {events.filter(e => {
                  const cteSteps = ['harvesting', 'cooling', 'initial_packing', 'shipping', 'receiving', 'transforming']
                  return cteSteps.includes(e.biz_step?.toLowerCase() || '')
                }).length}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('events.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('events.filters.allTypes')}</SelectItem>
              <SelectItem value="CTE">{t('events.filters.cte')}</SelectItem>
              <SelectItem value="ObjectEvent">{t('events.filters.objectEvent')}</SelectItem>
              <SelectItem value="TransformationEvent">{t('events.filters.transformationEvent')}</SelectItem>
              <SelectItem value="AggregationEvent">{t('events.filters.aggregationEvent')}</SelectItem>
              <SelectItem value="TransactionEvent">{t('events.filters.transactionEvent')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('events.filters.sourceType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('events.filters.allSources')}</SelectItem>
              <SelectItem value="voice_ai">{t('events.filters.voiceAi')}</SelectItem>
              <SelectItem value="vision_ai">{t('events.filters.visionAi')}</SelectItem>
              <SelectItem value="manual">{t('events.filters.manual')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRangeFilter} onValueChange={setTimeRangeFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t('events.filters.timeRange')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('events.filters.allTime')}</SelectItem>
              <SelectItem value="24h">{t('events.filters.last24h')}</SelectItem>
              <SelectItem value="7d">{t('events.filters.last7d')}</SelectItem>
              <SelectItem value="30d">{t('events.filters.last30d')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Events Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.time')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.eventType')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.businessStep')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.source')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.user')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.location')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('events.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      {t('common.loading')}
                    </div>
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t('events.noEvents')}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {new Date(event.event_time).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {event.event_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground capitalize">
                      {event.biz_step || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className={getSourceBadgeColor(event.source_type)}>
                        {event.source_type === 'voice_ai' ? t('events.sourceLabels.voiceAi') :
                         event.source_type === 'vision_ai' ? t('events.sourceLabels.visionAi') :
                         t('events.sourceLabels.manual')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {event.user_name || t('events.system')}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.read_point || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(event)}>
                        {t('events.viewDetails')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>{t('events.showing', { filtered: filteredEvents.length, total: events.length })}</p>
        <p>{t('events.realTimeEnabled')}</p>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('events.eventDetails')}</DialogTitle>
            <DialogDescription>{t('events.eventDetailsDesc')}</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.table.eventType')}</p>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {selectedEvent.event_type}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.table.source')}</p>
                  <Badge variant="outline" className={getSourceBadgeColor(selectedEvent.source_type)}>
                    {selectedEvent.source_type === 'voice_ai' ? t('events.sourceLabels.voiceAi') :
                     selectedEvent.source_type === 'vision_ai' ? t('events.sourceLabels.visionAi') :
                     t('events.sourceLabels.manual')}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.table.time')}</p>
                  <p className="text-sm font-mono text-foreground">
                    {new Date(selectedEvent.event_time).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.table.businessStep')}</p>
                  <p className="text-sm text-foreground capitalize">{selectedEvent.biz_step || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.table.user')}</p>
                  <p className="text-sm text-foreground">{selectedEvent.user_name || t('events.system')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('events.disposition')}</p>
                  <p className="text-sm text-foreground">{selectedEvent.disposition || '-'}</p>
                </div>
              </div>

              {/* Location Info */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('events.locationInfo')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('events.readPoint')}</p>
                    <p className="text-sm text-foreground">{selectedEvent.read_point || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('events.bizLocation')}</p>
                    <p className="text-sm text-foreground">{selectedEvent.biz_location || '-'}</p>
                  </div>
                </div>
              </div>

              {/* EPC List */}
              {selectedEvent.epc_list && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3">{t('events.epcList')}</h4>
                  <div className="space-y-2">
                    {Array.isArray(selectedEvent.epc_list) ? (
                      selectedEvent.epc_list.map((epc: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{formatEPC(epc)}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate mt-1">{epc}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-muted/50 p-3 rounded font-mono text-xs overflow-x-auto">
                        <pre>{JSON.stringify(selectedEvent.epc_list, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity List */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-3">{t('events.quantityList')}</h4>
                {(() => {
                  // Try to get quantity from multiple sources
                  let quantityData = selectedEvent.quantity_list
                  
                  // Fallback to epcis_document if quantity_list is empty
                  if ((!quantityData || (Array.isArray(quantityData) && quantityData.length === 0)) && (selectedEvent as any).epcis_document) {
                    const doc = (selectedEvent as any).epcis_document
                    quantityData = doc?.epcisBody?.eventList?.[0]?.quantityList
                  }
                  
                  if (Array.isArray(quantityData) && quantityData.length > 0) {
                    return (
                      <div className="space-y-2">
                        {quantityData.map((q: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded">
                            <div className="w-8 h-8 bg-green-500/10 rounded flex items-center justify-center">
                              <span className="text-green-600 font-semibold">{idx + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-semibold text-green-600">
                                {q.quantity || q.value || 0} {q.uom || q.unit || ''}
                              </p>
                              {q.epcClass && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {q.epcClass.split('.').pop()?.replace(/_/g, ' ')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  } else {
                    return (
                      <div className="p-3 bg-muted/50 rounded text-sm text-muted-foreground text-center">
                        {t('events.noQuantityData')}
                      </div>
                    )
                  }
                })()}
              </div>

              {/* Event ID */}
              <div className="p-3 bg-muted/30 rounded text-xs">
                <span className="text-muted-foreground">{t('events.eventId')}:</span>{' '}
                <span className="font-mono text-foreground">{selectedEvent.id}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
