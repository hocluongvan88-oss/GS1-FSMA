'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, Sankey, Tooltip, Layer, Rectangle } from 'recharts'
import { ArrowRight, GitBranch, Activity, MapPin, Link2 } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

interface TraceNode {
  id: string
  name: string
  type: string
  time: string
}

interface TraceLink {
  source: string
  target: string
  value: number
  epc?: string
}

interface FlowSummary {
  from: string
  flows: Array<{ to: string; count: number }>
}

interface DepthStats {
  maxDepth: number
  avgDepth: number
  totalChains: number
  fullTraceCount: number
}

interface TracePath {
  id: string
  event_type: string
  depth: number
  path: string[]
}

export function SupplyChainFlow() {
  const [flowData, setFlowData] = useState<any[]>([])
  const [locationData, setLocationData] = useState<any[]>([])
  const [traceNodes, setTraceNodes] = useState<TraceNode[]>([])
  const [traceLinks, setTraceLinks] = useState<TraceLink[]>([])
  const [flowSummary, setFlowSummary] = useState<FlowSummary[]>([])
  const [depthStats, setDepthStats] = useState<DepthStats | null>(null)
  const [tracePaths, setTracePaths] = useState<TracePath[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    fetchSupplyChainData()
    fetchTraceFlowData()
  }, [])

  async function fetchSupplyChainData() {
    try {
      const response = await fetch('/api/analytics/supply-chain')
      const data = await response.json()

      if (data.success) {
        setFlowData(data.data.timeline || [])
        setLocationData(data.data.byLocation || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching supply chain data:', error)
    }
  }

  async function fetchTraceFlowData() {
    try {
      const response = await fetch('/api/analytics/trace-flow')
      const data = await response.json()

      if (data.success) {
        setTraceNodes(data.data.nodes || [])
        setTraceLinks(data.data.links || [])
        setFlowSummary(data.data.flowSummary || [])
        setDepthStats(data.data.depthStats || null)
        setTracePaths(data.data.tracePaths || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching trace flow data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Color mapping for event types
  const eventTypeColors: Record<string, string> = {
    ObjectEvent: 'hsl(var(--chart-1))',
    TransformationEvent: 'hsl(var(--chart-2))',
    AggregationEvent: 'hsl(var(--chart-3))',
    TransactionEvent: 'hsl(var(--chart-4))',
  }

  const eventTypeBadgeColors: Record<string, string> = {
    ObjectEvent: 'bg-blue-100 text-blue-800',
    TransformationEvent: 'bg-green-100 text-green-800',
    AggregationEvent: 'bg-purple-100 text-purple-800',
    TransactionEvent: 'bg-orange-100 text-orange-800',
  }

  if (loading) {
    return <div className="text-muted-foreground">{t('analytics.loading.supplyChain')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Overview Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.supplyChain.traceabilityOverview')}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.supplyChain.maxTraceDepth')}</CardTitle>
              <GitBranch className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{depthStats?.maxDepth || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('analytics.supplyChain.maxDepthDesc')}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.supplyChain.totalChains')}</CardTitle>
              <Link2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{depthStats?.totalChains || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('analytics.supplyChain.totalChainsDesc')}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.supplyChain.fullTraces')}</CardTitle>
              <Activity className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{depthStats?.fullTraceCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('analytics.supplyChain.fullTracesDesc')}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.supplyChain.avgChainLength')}</CardTitle>
              <MapPin className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{depthStats?.avgDepth?.toFixed(1) || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('analytics.supplyChain.avgLengthDesc')}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2: Trace Paths - Most Important */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('analytics.supplyChain.productJourneyTitle')}</h2>
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.supplyChain.tracePathsTitle')}</CardTitle>
            <CardDescription>
              {t('analytics.supplyChain.tracePathsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tracePaths.length > 0 ? (
              <div className="space-y-3">
                {tracePaths.slice(0, 10).map((trace, idx) => {
                  // IMPORTANT: Reverse path to show traceback correctly
                  // Path in DB: [current, parent, grandparent, ...] (depth increasing backward in time)
                  // Display: [origin, ...parents, current] (forward in time - GS1 EPCIS standard)
                  const reversedPath = [...(trace.path || [])].reverse()
                  
                  return (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg overflow-x-auto">
                      <div className="flex flex-col shrink-0">
                        <span className="text-xs font-mono text-muted-foreground">
                          {t('analytics.supplyChain.depth', { depth: trace.depth })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {t('analytics.supplyChain.originToCurrent')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {reversedPath.map((eventId, pathIdx) => {
                          const node = traceNodes.find(n => n.id === eventId)
                          const isOrigin = pathIdx === 0
                          const isCurrent = pathIdx === reversedPath.length - 1
                          
                          return (
                            <div key={pathIdx} className="flex items-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge 
                                  variant={isOrigin ? "default" : "secondary"}
                                  className={`text-xs ${eventTypeBadgeColors[node?.type || ''] || ''} ${
                                    isOrigin ? 'ring-2 ring-green-500' : ''
                                  } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                  {node?.type?.replace('Event', '') || eventId.slice(0, 8)}
                                </Badge>
                                {isOrigin && (
                                  <span className="text-[9px] text-green-600 font-medium">{t('analytics.supplyChain.origin')}</span>
                                )}
                                {isCurrent && (
                                  <span className="text-[9px] text-blue-600 font-medium">{t('analytics.supplyChain.current')}</span>
                                )}
                              </div>
                              {pathIdx < reversedPath.length - 1 && (
                                <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    {t('analytics.supplyChain.epcisCompliant')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t('analytics.supplyChain.noTracePaths')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.supplyChain.timelineTitle')}</CardTitle>
            <CardDescription>{t('analytics.supplyChain.timelineDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                events: {
                  label: 'Events',
                  color: 'hsl(var(--chart-1))'
                }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                  <ChartTooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="events" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Total Events"
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Location Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.supplyChain.locationTitle')}</CardTitle>
            <CardDescription>{t('analytics.supplyChain.locationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                count: {
                  label: 'Events',
                  color: 'hsl(var(--chart-2))'
                }
              }}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="location" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    stroke="hsl(var(--border))"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
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
                    fill="#10b981"
                    name="Events"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Section 5: Quick Stats Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('analytics.supplyChain.summaryTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-900 dark:text-blue-100">{t('analytics.supplyChain.totalLocations')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{locationData.length}</div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{t('analytics.supplyChain.locationsDesc')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-900 dark:text-green-100">{t('analytics.supplyChain.totalEvents')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {locationData.reduce((sum, loc) => sum + loc.count, 0)}
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">{t('analytics.supplyChain.eventsDesc')}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="text-purple-900 dark:text-purple-100">{t('analytics.supplyChain.linkedEvents')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">{traceLinks.length}</div>
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">{t('analytics.supplyChain.linkedDesc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
