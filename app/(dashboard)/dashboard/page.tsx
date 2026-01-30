'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useLocale } from '@/lib/locale-context'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Event {
  id: string
  event_type: string
  event_time: string
  biz_step: string | null
  disposition: string | null
  source_type: string | null
  user_name: string | null
  read_point: string | null
  biz_location: string | null
  batch_id: string | null
  partner_id: string | null
  epc_list: unknown
  input_epc_list: unknown
  output_epc_list: unknown
  ai_metadata: unknown
  certification_ids: string[] | null
}

interface Stats {
  totalEvents: number
  voiceEvents: number
  visionEvents: number
  manualEvents: number
  totalBatches: number
  totalProducts: number
  activeLocations: number
  aiProcessingJobs: number
}

export default function FactoryDashboard() {
  const { t } = useLocale()
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<Stats>({ 
    totalEvents: 0, 
    voiceEvents: 0, 
    visionEvents: 0, 
    manualEvents: 0,
    totalBatches: 0,
    totalProducts: 0,
    activeLocations: 0,
    aiProcessingJobs: 0
  })
  const [timeRange, setTimeRange] = useState('24h')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    
    // Subscribe to real-time events
    const subscription = supabase
      .channel('events-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
        console.log('[v0] New event received:', payload)
        setEvents(prev => [payload.new as Event, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [timeRange])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Calculate time range
      const now = new Date()
      const hoursAgo = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720
      const startTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()

      // Fetch recent events with specific columns
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_type,
          event_time,
          biz_step,
          disposition,
          source_type,
          user_name,
          read_point,
          biz_location,
          batch_id,
          partner_id,
          epc_list,
          input_epc_list,
          output_epc_list,
          ai_metadata,
          certification_ids
        `)
        .gte('event_time', startTime)
        .order('event_time', { ascending: false })
        .limit(50)

      if (eventsError) {
        console.error('[v0] Events error:', eventsError)
        throw eventsError
      }

      setEvents(eventsData || [])

      // Fetch additional stats in parallel
      const [batchesRes, productsRes, locationsRes, aiJobsRes] = await Promise.all([
        supabase.from('batches').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('locations').select('id', { count: 'exact', head: true }),
        supabase.from('ai_processing_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ])

      // Calculate event source stats
      const voiceCount = eventsData?.filter(e => e.source_type === 'voice_ai').length || 0
      const visionCount = eventsData?.filter(e => e.source_type === 'vision_ai').length || 0
      const manualCount = eventsData?.filter(e => e.source_type === 'manual').length || 0

      setStats({
        totalEvents: eventsData?.length || 0,
        voiceEvents: voiceCount,
        visionEvents: visionCount,
        manualEvents: manualCount,
        totalBatches: batchesRes.count || 0,
        totalProducts: productsRes.count || 0,
        activeLocations: locationsRes.count || 0,
        aiProcessingJobs: aiJobsRes.count || 0
      })


    } catch (error) {
      console.error('[v0] Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Prepare chart data
  const eventsByHour = events.reduce((acc, event) => {
    const hour = new Date(event.event_time).getHours()
    const existing = acc.find(item => item.hour === hour)
    if (existing) {
      existing.count += 1
      if (event.source_type === 'voice_ai') existing.voice += 1
      if (event.source_type === 'vision_ai') existing.vision += 1
    } else {
      acc.push({
        hour,
        count: 1,
        voice: event.source_type === 'voice_ai' ? 1 : 0,
        vision: event.source_type === 'vision_ai' ? 1 : 0
      })
    }
    return acc
  }, [] as Array<{ hour: number; count: number; voice: number; vision: number }>)
  .sort((a, b) => a.hour - b.hour)

  const eventTypeData = [
    { type: 'ObjectEvent', count: events.filter(e => e.event_type === 'ObjectEvent').length },
    { type: 'TransformationEvent', count: events.filter(e => e.event_type === 'TransformationEvent').length },
    { type: 'AggregationEvent', count: events.filter(e => e.event_type === 'AggregationEvent').length },
    { type: 'TransactionEvent', count: events.filter(e => e.event_type === 'TransactionEvent').length },
  ].filter(item => item.count > 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-foreground">GS1 Traceability</h1>
              </div>
              <nav className="hidden md:flex items-center gap-6 ml-8">
                <a href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Overview</a>
                <a href="/events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Events</a>
                <a href="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Products</a>
                <a href="/locations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Locations</a>
                <a href="/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Analytics</a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-secondary text-secondary-foreground text-sm px-3 py-1.5 rounded-md border-0"
              >
                <option value="24h">{t('dashboard.timeRange.last24hours')}</option>
                <option value="7d">{t('dashboard.timeRange.last7days')}</option>
                <option value="30d">{t('dashboard.timeRange.last30days')}</option>
              </select>
              <Button variant="outline" size="sm">{t('common.settings')}</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">{t('dashboard.stats.activeBatches')}</p>
                <p className="text-3xl font-semibold text-blue-900 dark:text-blue-100 mt-1">{stats.totalBatches}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">{t('dashboard.stats.inProductionSystem')}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-300">{t('dashboard.stats.totalProducts')}</p>
                <p className="text-3xl font-semibold text-green-900 dark:text-green-100 mt-1">{stats.totalProducts}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-3">{t('dashboard.stats.productCatalog')}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 dark:text-purple-300">{t('dashboard.stats.activeLocations')}</p>
                <p className="text-3xl font-semibold text-purple-900 dark:text-purple-100 mt-1">{stats.activeLocations}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-3">{t('dashboard.stats.inSupplyChain')}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300">{t('dashboard.stats.aiJobsPending')}</p>
                <p className="text-3xl font-semibold text-orange-900 dark:text-orange-100 mt-1">{stats.aiProcessingJobs}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">{t('dashboard.stats.awaitingProcessing')}</p>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Event Timeline */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t('dashboard.charts.eventTimeline')}</h3>
              <p className="text-sm text-muted-foreground">{t('dashboard.charts.eventTimelineDesc')}</p>
            </div>
            <ChartContainer config={{
              count: { label: 'Total', color: 'hsl(var(--chart-1))' },
              voice: { label: 'Voice AI', color: 'hsl(var(--chart-2))' },
              vision: { label: 'Vision AI', color: 'hsl(var(--chart-3))' }
            }} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventsByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="hour" 
                    stroke="hsl(var(--border))" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    tickFormatter={(v) => `${v}:00`} 
                  />
                  <YAxis 
                    stroke="hsl(var(--border))" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>

          {/* Event Types */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">{t('dashboard.charts.eventTypes')}</h3>
              <p className="text-sm text-muted-foreground">{t('dashboard.charts.eventTypesDesc')}</p>
            </div>
            <ChartContainer config={{
              count: { label: 'Events', color: 'hsl(var(--chart-1))' }
            }} className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="type" 
                    stroke="hsl(var(--border))" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    angle={-15} 
                    textAnchor="end" 
                    height={60} 
                  />
                  <YAxis 
                    stroke="hsl(var(--border))" 
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>
        </div>

        {/* Recent Events Table */}
        <Card className="bg-card border-border">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('dashboard.recentEvents.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('dashboard.recentEvents.subtitle')}</p>
              </div>
              <Button variant="outline" size="sm">{t('common.viewAll')}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.time')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.eventType')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.businessStep')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.source')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.recentEvents.columns.location')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        {t('common.loading')}
                      </div>
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      {t('dashboard.recentEvents.noEvents')}
                    </td>
                  </tr>
                ) : (
                  events.slice(0, 10).map((event) => (
                    <tr key={event.id} className="hover:bg-secondary/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {new Date(event.event_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground capitalize">
                        {event.biz_step || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          event.source_type === 'voice_ai' ? 'bg-chart-2/10 text-chart-2' :
                          event.source_type === 'vision_ai' ? 'bg-chart-3/10 text-chart-3' :
                          'bg-chart-4/10 text-chart-4'
                        }`}>
                          {event.source_type === 'voice_ai' ? 'Voice AI' :
                           event.source_type === 'vision_ai' ? 'Vision AI' :
                           'Manual'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {event.user_name || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {event.read_point || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  )
}
