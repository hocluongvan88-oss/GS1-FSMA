import { supabase, type Database } from '../supabase-client'

type Event = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']
type EventUpdate = Database['public']['Tables']['events']['Update']

export class EventRepository {
  async findAll(options?: {
    limit?: number
    offset?: number
    eventType?: Event['event_type']
    sourceType?: Event['source_type']
    startDate?: string
    endDate?: string
  }) {
    let query = supabase
      .from('events')
      .select('*, locations!events_read_point_fkey(name), products:epc_list')
      .order('event_time', { ascending: false })

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType)
    }
    if (options?.sourceType) {
      query = query.eq('source_type', options.sourceType)
    }
    if (options?.startDate) {
      query = query.gte('event_time', options.startDate)
    }
    if (options?.endDate) {
      query = query.lte('event_time', options.endDate)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  async findById(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*, locations!events_read_point_fkey(name, gln)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async create(event: EventInsert) {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, event: EventUpdate) {
    const { data, error } = await supabase
      .from('events')
      .update(event)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getEventStats(startDate?: string, endDate?: string) {
    let query = supabase
      .from('events')
      .select('event_type, source_type')

    if (startDate) {
      query = query.gte('event_time', startDate)
    }
    if (endDate) {
      query = query.lte('event_time', endDate)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

  async getEventTimeline(startDate: string, endDate: string, intervalHours = 1) {
    const { data, error } = await supabase
      .rpc('get_event_timeline', {
        start_date: startDate,
        end_date: endDate,
        interval_hours: intervalHours
      })

    if (error) {
      // Fallback to client-side grouping if RPC doesn't exist
      const events = await this.findAll({ startDate, endDate })
      return this.groupEventsByTime(events, intervalHours)
    }
    return data
  }

  private groupEventsByTime(events: Event[], intervalHours: number) {
    const grouped: Record<string, number> = {}
    
    for (const event of events) {
      const date = new Date(event.event_time)
      const hour = Math.floor(date.getHours() / intervalHours) * intervalHours
      date.setHours(hour, 0, 0, 0)
      const key = date.toISOString()
      grouped[key] = (grouped[key] || 0) + 1
    }

    return Object.entries(grouped).map(([time, count]) => ({
      time,
      count
    }))
  }

  async getEventsByBatch(batchId: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('batch_id', batchId)
      .order('event_time', { ascending: true })

    if (error) throw error
    return data
  }

  async getEventsByLocation(gln: string, limit = 100) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(`read_point.eq.${gln},biz_location.eq.${gln}`)
      .order('event_time', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }
}
