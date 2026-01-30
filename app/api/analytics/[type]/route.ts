import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params

    if (type === 'supply-chain') {
      return await getSupplyChainAnalytics()
    }

    if (type === 'quality') {
      return await getQualityAnalytics()
    }

    if (type === 'compliance') {
      return await getComplianceAnalytics()
    }

    if (type === 'trace-flow') {
      return await getTraceFlowAnalytics()
    }

    return NextResponse.json(
      {
        success: false,
        error: `Unknown analytics type: ${type}`
      },
      { status: 400 }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error in analytics API:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

async function getSupplyChainAnalytics() {
  // Get events timeline
  const { data: events } = await supabase
    .from('events')
    .select('event_time, read_point')
    .order('event_time', { ascending: true })

  // Group by date
  const timelineMap: Record<string, number> = {}
  const locationMap: Record<string, number> = {}

  for (const event of events || []) {
    const date = new Date(event.event_time).toISOString().split('T')[0]
    timelineMap[date] = (timelineMap[date] || 0) + 1

    if (event.read_point) {
      locationMap[event.read_point] = (locationMap[event.read_point] || 0) + 1
    }
  }

  const timeline = Object.entries(timelineMap).map(([date, events]) => ({
    date,
    events
  }))

  const byLocation = Object.entries(locationMap).map(([location, count]) => ({
    location,
    count
  }))

  return NextResponse.json({
    success: true,
    data: {
      timeline,
      byLocation
    }
  })
}

async function getQualityAnalytics() {
  // Get batch statistics
  const { data: batches } = await supabase
    .from('batches')
    .select('quality_status, quantity_available, expiry_date')

  const stats = {
    total: batches?.length || 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    recalled: 0,
    totalQuantity: 0
  }

  for (const batch of batches || []) {
    stats[batch.quality_status as keyof typeof stats]++
    stats.totalQuantity += batch.quantity_available
  }

  // Get expiring batches
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() + 30)

  const { data: expiring } = await supabase
    .from('batches')
    .select('*, products(name, gtin)')
    .lte('expiry_date', thresholdDate.toISOString().split('T')[0])
    .eq('quality_status', 'approved')
    .order('expiry_date', { ascending: true })

  return NextResponse.json({
    success: true,
    data: {
      stats,
      expiring
    }
  })
}

async function getComplianceAnalytics() {
  // Get all certifications
  const { data: certifications } = await supabase
    .from('certifications')
    .select('*')
    .order('expiry_date', { ascending: true })

  // Calculate compliance score
  const active = certifications?.filter((c) => c.status === 'active').length || 0
  const total = certifications?.length || 1
  const score = Math.round((active / total) * 100)

  return NextResponse.json({
    success: true,
    data: {
      certifications,
      score
    }
  })
}

async function getTraceFlowAnalytics() {
  // Get materialized view data for trace paths
  const { data: tracePaths, error: traceError } = await supabase
    .from('event_trace_paths')
    .select('*')
    .order('depth', { ascending: false })
    .limit(100)

  if (traceError) {
    console.error('[v0] Error fetching trace paths:', traceError)
  }

  // Get all events with locations for flow visualization
  const { data: events } = await supabase
    .from('events')
    .select(`
      id,
      event_type,
      event_time,
      biz_step,
      disposition,
      read_point,
      epc_list,
      input_epc_list,
      output_epc_list
    `)
    .order('event_time', { ascending: true })

  // Get locations for mapping
  const { data: locations } = await supabase
    .from('locations')
    .select('gln, name, location_type')

  const locationMap = new Map(locations?.map(l => [l.gln, l]) || [])

  // Build flow nodes and links for Sankey/Flow diagram
  const nodes: Array<{id: string; name: string; type: string; time: string}> = []
  const links: Array<{source: string; target: string; value: number; epc?: string}> = []

  // Create nodes from events
  for (const event of events || []) {
    const location = locationMap.get(event.read_point || '')
    nodes.push({
      id: event.id,
      name: `${event.event_type} @ ${location?.name || event.read_point || 'Unknown'}`,
      type: event.event_type,
      time: event.event_time
    })
  }

  // Create links based on EPC tracing
  for (const event of events || []) {
    // For TransformationEvent: link input EPCs to this event
    if (event.event_type === 'TransformationEvent' && event.input_epc_list) {
      const inputEPCs = event.input_epc_list as string[]
      for (const epc of inputEPCs) {
        // Find previous events with this EPC in output or epc_list
        const sourceEvent = (events || []).find(e => 
          e.id !== event.id &&
          new Date(e.event_time) < new Date(event.event_time) &&
          (
            (e.output_epc_list && (e.output_epc_list as string[]).includes(epc)) ||
            (e.epc_list && (e.epc_list as string[]).includes(epc))
          )
        )
        if (sourceEvent) {
          links.push({
            source: sourceEvent.id,
            target: event.id,
            value: 1,
            epc
          })
        }
      }
    }

    // For other events: link epc_list to previous output_epc_list
    if (event.epc_list && event.event_type !== 'TransformationEvent') {
      const epcList = event.epc_list as string[]
      for (const epc of epcList) {
        const sourceEvent = (events || []).find(e => 
          e.id !== event.id &&
          new Date(e.event_time) < new Date(event.event_time) &&
          e.output_epc_list && (e.output_epc_list as string[]).includes(epc)
        )
        if (sourceEvent) {
          links.push({
            source: sourceEvent.id,
            target: event.id,
            value: 1,
            epc
          })
        }
      }
    }
  }

  // Build event type flow summary
  const eventTypeFlow: Record<string, Record<string, number>> = {}
  for (const link of links) {
    const sourceNode = nodes.find(n => n.id === link.source)
    const targetNode = nodes.find(n => n.id === link.target)
    if (sourceNode && targetNode) {
      const key = sourceNode.type
      if (!eventTypeFlow[key]) eventTypeFlow[key] = {}
      eventTypeFlow[key][targetNode.type] = (eventTypeFlow[key][targetNode.type] || 0) + 1
    }
  }

  // Convert to array format for charts
  const flowSummary = Object.entries(eventTypeFlow).map(([from, toMap]) => ({
    from,
    flows: Object.entries(toMap).map(([to, count]) => ({ to, count }))
  }))

  // Calculate trace depth statistics
  const depthStats = {
    maxDepth: tracePaths && tracePaths.length > 0 
      ? Math.max(...tracePaths.map(t => t.depth || 0)) 
      : 0,
    avgDepth: tracePaths && tracePaths.length > 0
      ? tracePaths.reduce((sum, t) => sum + (t.depth || 0), 0) / tracePaths.length
      : 0,
    totalChains: tracePaths?.length || 0,
    fullTraceCount: tracePaths?.filter(t => (t.depth || 0) >= 3).length || 0
  }

  return NextResponse.json({
    success: true,
    data: {
      nodes,
      links,
      flowSummary,
      depthStats,
      tracePaths: tracePaths?.slice(0, 20) // Return sample of trace paths
    }
  })
}
