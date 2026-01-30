'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Download, Filter } from 'lucide-react'

export default function DatabaseEventsPanel() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    eventType: 'all',
    source: 'all',
    limit: '20'
  })

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: filters.limit })
      const response = await fetch(`/api/events/test?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setEvents(data.data)
      }
    } catch (error) {
      console.error('[v0] Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const exportToCSV = () => {
    const csv = [
      ['ID', 'Type', 'Action', 'Source', 'Time', 'Products', 'Quantity'].join(','),
      ...events.map(e => [
        e.id,
        e.event_type,
        e.action,
        e.source_type,
        e.event_time,
        e.epc_list?.length || 0,
        JSON.stringify(e.quantity_list || [])
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events-${new Date().toISOString()}.csv`
    a.click()
  }

  const exportToJSON = () => {
    const json = JSON.stringify(events, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events-${new Date().toISOString()}.json`
    a.click()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Database Events</CardTitle>
              <CardDescription>
                View and export all EPCIS events from database
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToCSV}
                className="gap-2 bg-transparent"
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToJSON}
                className="gap-2 bg-transparent"
              >
                <Download className="h-4 w-4" />
                JSON
              </Button>
              <Button 
                size="sm"
                onClick={fetchEvents}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select 
                value={filters.eventType} 
                onValueChange={(v) => setFilters({...filters, eventType: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ObjectEvent">ObjectEvent</SelectItem>
                  <SelectItem value="TransformationEvent">TransformationEvent</SelectItem>
                  <SelectItem value="AggregationEvent">AggregationEvent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select 
                value={filters.source} 
                onValueChange={(v) => setFilters({...filters, source: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="voice_ai">Voice AI</SelectItem>
                  <SelectItem value="vision_ai">Vision AI</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Limit</Label>
              <Input 
                type="number" 
                value={filters.limit}
                onChange={(e) => setFilters({...filters, limit: e.target.value})}
              />
            </div>
          </div>

          {/* Events List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events found
              </div>
            ) : (
              events.map((event) => (
                <Card key={event.id} className="p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Badge variant="outline">{event.event_type}</Badge>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {event.id.slice(0, 8)}...
                    </div>
                    <div>
                      <span className="text-gray-600">Action:</span> {event.action || 'N/A'}
                    </div>
                    <div>
                      <span className="text-gray-600">Source:</span> {event.source_type}
                    </div>
                    <div>
                      <span className="text-gray-600">Time:</span> {new Date(event.event_time).toLocaleString()}
                    </div>
                    <div>
                      <span className="text-gray-600">Products:</span> {event.epc_list?.length || 0} items
                    </div>
                    {(event.quantity_list && Array.isArray(event.quantity_list) && event.quantity_list.length > 0) && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Quantity:</span>{' '}
                        <span className="font-medium text-green-600">
                          {event.quantity_list.map((q: any, i: number) => (
                            <span key={i}>
                              {i > 0 && ', '}
                              {q.quantity} {q.uom}
                              {q.epcClass && ` (${q.epcClass.split('.').pop()?.replace(/_/g, ' ')})`}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
