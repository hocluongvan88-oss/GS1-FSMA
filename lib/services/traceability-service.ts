import { EventRepository } from '../data/repositories/event-repository'
import { BatchRepository } from '../data/repositories/batch-repository'
import { supabase, type Database } from '../data/supabase-client'

type Event = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']

// Type for trace chain result from database function
interface TraceChainResult {
  event_id: string
  event_type: string
  event_time: string
  biz_step: string | null
  disposition: string | null
  read_point: string | null
  epc_list: string[] | null
  input_epc_list: string[] | null
  output_epc_list: string[] | null
  depth: number
  path: string[]
  location_name: string | null
}

export class TraceabilityService {
  private eventRepo = new EventRepository()
  private batchRepo = new BatchRepository()

  /**
   * Create EPCIS ObjectEvent (tạo/quan sát sản phẩm)
   */
  async createObjectEvent(params: {
    epcList: string[]
    bizStep: string
    disposition: string
    location: string
    userId?: string
    userName?: string
    sourceType: 'voice_ai' | 'vision_ai' | 'manual' | 'system'
    batchId?: string
    aiMetadata?: Record<string, any>
  }): Promise<Event> {
    const eventTime = new Date().toISOString()

    const epcisDocument = {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: eventTime,
      epcisBody: {
        eventList: [
          {
            type: 'ObjectEvent',
            eventTime,
            eventTimeZoneOffset: '+07:00',
            epcList: params.epcList,
            action: params.bizStep.includes('commissioning') ? 'ADD' : 'OBSERVE',
            bizStep: `urn:epcglobal:cbv:bizstep:${params.bizStep}`,
            disposition: `urn:epcglobal:cbv:disp:${params.disposition}`,
            readPoint: { id: `urn:epc:id:sgln:${params.location}` },
            bizLocation: { id: `urn:epc:id:sgln:${params.location}` }
          }
        ]
      }
    }

    const event: EventInsert = {
      event_type: 'ObjectEvent',
      event_time: eventTime,
      event_timezone: 'Asia/Ho_Chi_Minh',
      epc_list: params.epcList,
      biz_step: params.bizStep,
      disposition: params.disposition,
      read_point: params.location,
      biz_location: params.location,
      user_id: params.userId || null,
      user_name: params.userName || null,
      source_type: params.sourceType,
      batch_id: params.batchId || null,
      ai_metadata: params.aiMetadata || null,
      epcis_document: epcisDocument,
      input_epc_list: null,
      output_epc_list: null,
      input_quantity: null,
      output_quantity: null,
      partner_id: null,
      certification_ids: []
    }

    return this.eventRepo.create(event)
  }

  /**
   * Create EPCIS TransformationEvent (chế biến/biến đổi)
   */
  async createTransformationEvent(params: {
    inputEpcList: string[]
    outputEpcList: string[]
    inputQuantity: Array<{ value: number; uom: string; gtin: string }>
    outputQuantity: Array<{ value: number; uom: string; gtin: string }>
    bizStep: string
    location: string
    userId?: string
    userName?: string
    sourceType: 'voice_ai' | 'vision_ai' | 'manual' | 'system'
    aiMetadata?: Record<string, any>
  }): Promise<Event> {
    const eventTime = new Date().toISOString()

    const epcisDocument = {
      '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      creationDate: eventTime,
      epcisBody: {
        eventList: [
          {
            type: 'TransformationEvent',
            eventTime,
            eventTimeZoneOffset: '+07:00',
            inputEPCList: params.inputEpcList,
            outputEPCList: params.outputEpcList,
            inputQuantityList: params.inputQuantity,
            outputQuantityList: params.outputQuantity,
            bizStep: `urn:epcglobal:cbv:bizstep:${params.bizStep}`,
            readPoint: { id: `urn:epc:id:sgln:${params.location}` },
            bizLocation: { id: `urn:epc:id:sgln:${params.location}` }
          }
        ]
      }
    }

    const event: EventInsert = {
      event_type: 'TransformationEvent',
      event_time: eventTime,
      event_timezone: 'Asia/Ho_Chi_Minh',
      epc_list: null,
      input_epc_list: params.inputEpcList,
      output_epc_list: params.outputEpcList,
      input_quantity: params.inputQuantity,
      output_quantity: params.outputQuantity,
      biz_step: params.bizStep,
      disposition: 'in_progress',
      read_point: params.location,
      biz_location: params.location,
      user_id: params.userId || null,
      user_name: params.userName || null,
      source_type: params.sourceType,
      ai_metadata: params.aiMetadata || null,
      epcis_document: epcisDocument,
      batch_id: null,
      partner_id: null,
      certification_ids: []
    }

    return this.eventRepo.create(event)
  }

  /**
   * Get full traceability chain for a batch
   */
  async getTraceabilityChain(batchId: string) {
    const batch = await this.batchRepo.findById(batchId)
    const events = await this.eventRepo.getEventsByBatch(batchId)

    return {
      batch,
      events,
      timeline: this.buildTimeline(events)
    }
  }

  /**
   * Get traceability for a product by GTIN
   */
  async getProductTraceability(gtin: string, limit = 100) {
    const events = await this.eventRepo.findAll({
      limit
    })

    // Filter events related to this GTIN
    const filtered = events.filter((event) => {
      const epcList = event.epc_list as string[] | null
      if (epcList && epcList.some((epc) => epc.includes(gtin))) {
        return true
      }
      return false
    })

    return filtered
  }

  private buildTimeline(events: Event[]) {
    return events.map((event) => ({
      id: event.id,
      type: event.event_type,
      time: event.event_time,
      bizStep: event.biz_step,
      location: event.read_point,
      source: event.source_type,
      user: event.user_name
    }))
  }

  /**
   * Validate event data before creation
   */
  validateEventData(eventType: string, data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data.location) {
      errors.push('Location (GLN) is required')
    }

    if (eventType === 'ObjectEvent' && (!data.epcList || data.epcList.length === 0)) {
      errors.push('EPC list is required for ObjectEvent')
    }

    if (eventType === 'TransformationEvent') {
      if (!data.inputEpcList || data.inputEpcList.length === 0) {
        errors.push('Input EPC list is required for TransformationEvent')
      }
      if (!data.outputEpcList || data.outputEpcList.length === 0) {
        errors.push('Output EPC list is required for TransformationEvent')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get full trace chain using database function (optimized with materialized view)
   * This method uses the new get_trace_chain function created in script 013
   */
  async getTraceChain(identifier: string, maxDepth = 10): Promise<{
    success: boolean
    chain: TraceChainResult[]
    totalEvents: number
    maxDepthReached: number
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('get_trace_chain', {
        p_identifier: identifier,
        p_max_depth: maxDepth
      })

      if (error) {
        console.error('[v0] get_trace_chain error:', error)
        return {
          success: false,
          chain: [],
          totalEvents: 0,
          maxDepthReached: 0,
          error: error.message
        }
      }

      const chain = (data || []) as TraceChainResult[]
      const maxDepthReached = chain.length > 0 
        ? Math.max(...chain.map(c => c.depth))
        : 0

      return {
        success: true,
        chain,
        totalEvents: chain.length,
        maxDepthReached
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('[v0] getTraceChain exception:', errorMessage)
      return {
        success: false,
        chain: [],
        totalEvents: 0,
        maxDepthReached: 0,
        error: errorMessage
      }
    }
  }

  /**
   * Find all events containing a specific EPC (searches all relevant columns)
   */
  async findEventsByEPC(epc: string): Promise<Event[]> {
    // Search in epc_list, input_epc_list, and output_epc_list
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`epc_list.cs.["${epc}"],input_epc_list.cs.["${epc}"],output_epc_list.cs.["${epc}"]`)
      .order('event_time', { ascending: false })

    if (error) {
      console.error('[v0] findEventsByEPC error:', error)
      return []
    }

    return data || []
  }

  /**
   * Get upstream events (events that led to this event)
   */
  async getUpstreamEvents(eventId: string, maxDepth = 5): Promise<Event[]> {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!event) return []

    const upstream: Event[] = []
    const visited = new Set<string>([eventId])

    // Get EPCs to trace back
    const epcsToTrace: string[] = []
    if (event.input_epc_list) epcsToTrace.push(...(event.input_epc_list as string[]))
    if (event.epc_list) epcsToTrace.push(...(event.epc_list as string[]))

    for (const epc of epcsToTrace) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .or(`epc_list.cs.["${epc}"],output_epc_list.cs.["${epc}"]`)
        .lt('event_time', event.event_time)
        .order('event_time', { ascending: false })
        .limit(maxDepth)

      if (data) {
        for (const e of data) {
          if (!visited.has(e.id)) {
            visited.add(e.id)
            upstream.push(e)
          }
        }
      }
    }

    return upstream
  }

  /**
   * Get downstream events (events that followed this event)
   */
  async getDownstreamEvents(eventId: string, maxDepth = 5): Promise<Event[]> {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!event) return []

    const downstream: Event[] = []
    const visited = new Set<string>([eventId])

    // Get EPCs to trace forward
    const epcsToTrace: string[] = []
    if (event.output_epc_list) epcsToTrace.push(...(event.output_epc_list as string[]))
    if (event.epc_list) epcsToTrace.push(...(event.epc_list as string[]))

    for (const epc of epcsToTrace) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .or(`epc_list.cs.["${epc}"],input_epc_list.cs.["${epc}"]`)
        .gt('event_time', event.event_time)
        .order('event_time', { ascending: true })
        .limit(maxDepth)

      if (data) {
        for (const e of data) {
          if (!visited.has(e.id)) {
            visited.add(e.id)
            downstream.push(e)
          }
        }
      }
    }

    return downstream
  }

  /**
   * Refresh the materialized view (should be called periodically or after bulk inserts)
   */
  async refreshTraceCache(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('refresh_event_trace_paths')
      if (error) {
        console.error('[v0] refresh_event_trace_paths error:', error)
        return false
      }
      return true
    } catch {
      return false
    }
  }
}
