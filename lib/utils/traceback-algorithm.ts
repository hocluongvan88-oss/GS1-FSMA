/**
 * Recursive Trace-back Algorithm
 * Traverses supply chain tree from consumer back to origin (harvest)
 */

import { supabase } from '../data/supabase-client'

export interface TraceNode {
  eventId: string
  eventType: 'ObjectEvent' | 'TransformationEvent' | 'AggregationEvent'
  eventTime: string
  bizStep: string
  disposition: string
  location: string
  locationName?: string
  epcList: string[]
  inputEPCList?: string[]
  outputEPCList?: string[]
  parentEPCs?: string[] // For aggregation
  childEPCs?: string[] // For aggregation
  user?: string
  sourceType?: string
  depth: number // Tree depth (0 = current, 1 = parent, etc.)
  children: TraceNode[]
}

export interface TracebackResult {
  success: boolean
  rootNode: TraceNode | null
  totalEvents: number
  maxDepth: number
  originEvents: TraceNode[] // Harvest events (depth = maxDepth)
  error?: string
}

/**
 * Main traceback function - starts from batch ID or EPC
 */
export async function tracebackSupplyChain(
  identifier: string,
  options?: {
    maxDepth?: number // Maximum depth to traverse (default: 50)
    includeLocation?: boolean // Include location details (default: true)
  }
): Promise<TracebackResult> {
  const maxDepth = options?.maxDepth || 50
  const includeLocation = options?.includeLocation !== false
  
  try {
    // Find initial event(s) for this identifier
    const initialEvents = await findEventsForIdentifier(identifier)
    
    if (initialEvents.length === 0) {
      return {
        success: false,
        rootNode: null,
        totalEvents: 0,
        maxDepth: 0,
        originEvents: [],
        error: `No events found for identifier: ${identifier}`
      }
    }
    
    // Build tree starting from most recent event
    const rootEvent = initialEvents[0] // Most recent
    const rootNode = await buildTraceTree(
      rootEvent,
      0,
      maxDepth,
      new Set(), // Track visited event IDs to prevent cycles
      includeLocation
    )
    
    // Collect statistics
    const stats = collectTreeStats(rootNode)
    
    return {
      success: true,
      rootNode,
      totalEvents: stats.totalNodes,
      maxDepth: stats.maxDepth,
      originEvents: stats.originNodes
    }
  } catch (error) {
    return {
      success: false,
      rootNode: null,
      totalEvents: 0,
      maxDepth: 0,
      originEvents: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Find all events related to an identifier (batch ID, EPC, GTIN, etc.)
 */
async function findEventsForIdentifier(identifier: string) {
  // Try multiple queries to find events
  const queries = [
    // 1. By batch_id
    supabase
      .from('events')
      .select('*, locations!events_read_point_fkey(name)')
      .eq('batch_id', identifier)
      .order('event_time', { ascending: false }),
    
    // 2. By EPC in epc_list
    supabase
      .from('events')
      .select('*, locations!events_read_point_fkey(name)')
      .contains('epc_list', [identifier])
      .order('event_time', { ascending: false }),
    
    // 3. By EPC in output_epc_list
    supabase
      .from('events')
      .select('*, locations!events_read_point_fkey(name)')
      .contains('output_epc_list', [identifier])
      .order('event_time', { ascending: false })
  ]
  
  const results = await Promise.all(queries)
  
  // Combine and deduplicate
  const allEvents = new Map()
  for (const { data } of results) {
    if (data) {
      for (const event of data) {
        allEvents.set(event.id, event)
      }
    }
  }
  
  return Array.from(allEvents.values())
}

/**
 * Recursively build trace tree by following parent events
 */
async function buildTraceTree(
  event: any,
  currentDepth: number,
  maxDepth: number,
  visited: Set<string>,
  includeLocation: boolean
): Promise<TraceNode> {
  // Prevent infinite loops
  if (visited.has(event.id) || currentDepth >= maxDepth) {
    return createTraceNode(event, currentDepth, [], includeLocation)
  }
  
  visited.add(event.id)
  
  // Find parent events based on event type
  const parentEvents = await findParentEvents(event)
  
  // Recursively build child nodes
  const children: TraceNode[] = []
  for (const parentEvent of parentEvents) {
    const childNode = await buildTraceTree(
      parentEvent,
      currentDepth + 1,
      maxDepth,
      visited,
      includeLocation
    )
    children.push(childNode)
  }
  
  return createTraceNode(event, currentDepth, children, includeLocation)
}

/**
 * Find parent events (events that happened before this one in the chain)
 */
async function findParentEvents(event: any): Promise<any[]> {
  const parentEvents: any[] = []
  
  switch (event.event_type) {
    case 'ObjectEvent':
      // For ObjectEvent, look for events that created/processed these EPCs
      if (event.epc_list && event.epc_list.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*, locations!events_read_point_fkey(name)')
          .contains('output_epc_list', event.epc_list)
          .lt('event_time', event.event_time)
          .order('event_time', { ascending: false })
          .limit(10)
        
        if (data) parentEvents.push(...data)
      }
      break
    
    case 'TransformationEvent':
      // Look for events that created the input EPCs
      if (event.input_epc_list && event.input_epc_list.length > 0) {
        for (const inputEPC of event.input_epc_list) {
          const { data } = await supabase
            .from('events')
            .select('*, locations!events_read_point_fkey(name)')
            .or(`epc_list.cs.{${inputEPC}},output_epc_list.cs.{${inputEPC}}`)
            .lt('event_time', event.event_time)
            .order('event_time', { ascending: false })
            .limit(5)
          
          if (data) parentEvents.push(...data)
        }
      }
      break
    
    case 'AggregationEvent':
      // Look for events that created the child EPCs
      // Note: childEPCs are stored in epcis_document, not as a column
      const childEPCs = event.epcis_document?.childEPCs as string[] | undefined
      if (childEPCs && childEPCs.length > 0) {
        for (const childEPC of childEPCs) {
          const { data } = await supabase
            .from('events')
            .select('*, locations!events_read_point_fkey(name)')
            .or(`epc_list.cs.{${childEPC}},output_epc_list.cs.{${childEPC}}`)
            .lt('event_time', event.event_time)
            .order('event_time', { ascending: false })
            .limit(5)
          
          if (data) parentEvents.push(...data)
        }
      }
      // Also check epc_list for aggregation events (contains child items)
      if (event.epc_list && event.epc_list.length > 0) {
        for (const epc of event.epc_list) {
          const { data } = await supabase
            .from('events')
            .select('*, locations!events_read_point_fkey(name)')
            .or(`epc_list.cs.{${epc}},output_epc_list.cs.{${epc}}`)
            .lt('event_time', event.event_time)
            .order('event_time', { ascending: false })
            .limit(5)
          
          if (data) parentEvents.push(...data)
        }
      }
      break
  }
  
  // Deduplicate by event ID
  const uniqueEvents = new Map()
  for (const evt of parentEvents) {
    uniqueEvents.set(evt.id, evt)
  }
  
  return Array.from(uniqueEvents.values())
}

/**
 * Create a TraceNode from database event
 */
function createTraceNode(
  event: any,
  depth: number,
  children: TraceNode[],
  includeLocation: boolean
): TraceNode {
  return {
    eventId: event.id,
    eventType: event.event_type,
    eventTime: event.event_time,
    bizStep: event.biz_step,
    disposition: event.disposition,
    location: event.read_point,
    locationName: includeLocation && event.locations ? event.locations.name : undefined,
    epcList: event.epc_list || [],
    inputEPCList: event.input_epc_list,
    outputEPCList: event.output_epc_list,
    user: event.user_name,
    sourceType: event.source_type,
    depth,
    children
  }
}

/**
 * Collect statistics from trace tree
 */
function collectTreeStats(node: TraceNode): {
  totalNodes: number
  maxDepth: number
  originNodes: TraceNode[]
} {
  let totalNodes = 1
  let maxDepth = node.depth
  const originNodes: TraceNode[] = []
  
  if (node.children.length === 0) {
    // Leaf node - check if it's a harvest event
    if (node.bizStep === 'commissioning' || node.bizStep === 'harvesting') {
      originNodes.push(node)
    }
  } else {
    // Recurse into children
    for (const child of node.children) {
      const childStats = collectTreeStats(child)
      totalNodes += childStats.totalNodes
      maxDepth = Math.max(maxDepth, childStats.maxDepth)
      originNodes.push(...childStats.originNodes)
    }
  }
  
  return { totalNodes, maxDepth, originNodes }
}

/**
 * SQL query using Recursive CTE (for PostgreSQL)
 * This can be used as a stored procedure for better performance
 * Note: Uses JSONB operators for array containment
 */
export const RECURSIVE_TRACEBACK_SQL = `
WITH RECURSIVE supply_chain AS (
  -- Base case: Start from the target event
  SELECT 
    e.*,
    0 as depth,
    ARRAY[e.id] as path
  FROM events e
  WHERE 
    (e.epc_list IS NOT NULL AND e.epc_list ? $1)
    OR (e.input_epc_list IS NOT NULL AND e.input_epc_list ? $1)
    OR (e.output_epc_list IS NOT NULL AND e.output_epc_list ? $1)
  
  UNION ALL
  
  -- Recursive case: Find parent events
  SELECT 
    parent.*,
    sc.depth + 1,
    sc.path || parent.id
  FROM supply_chain sc
  CROSS JOIN LATERAL (
    SELECT DISTINCT e.*
    FROM events e
    WHERE e.id != sc.id
      AND NOT (e.id = ANY(sc.path))
      AND e.event_time < sc.event_time
      AND (
        -- TransformationEvent: input came from previous output/epc_list
        (
          sc.input_epc_list IS NOT NULL 
          AND (
            (e.output_epc_list IS NOT NULL AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(sc.input_epc_list)))
            OR (e.epc_list IS NOT NULL AND e.epc_list ?| ARRAY(SELECT jsonb_array_elements_text(sc.input_epc_list)))
          )
        )
        OR
        -- Other events: epc_list came from previous output
        (
          sc.input_epc_list IS NULL 
          AND sc.epc_list IS NOT NULL 
          AND e.output_epc_list IS NOT NULL 
          AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(sc.epc_list))
        )
        OR
        -- AggregationEvent: childEPCs from epcis_document
        (
          sc.event_type = 'AggregationEvent'
          AND sc.epcis_document->'childEPCs' IS NOT NULL
          AND e.output_epc_list IS NOT NULL
          AND e.output_epc_list ?| ARRAY(SELECT jsonb_array_elements_text(sc.epcis_document->'childEPCs'))
        )
      )
    LIMIT 10
  ) parent
  WHERE sc.depth < $2 -- Max depth limit
)
SELECT * FROM supply_chain
ORDER BY depth, event_time DESC;
`
