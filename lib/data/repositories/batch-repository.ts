import { supabase, type Database } from '../supabase-client'

type Batch = Database['public']['Tables']['batches']['Row']
type BatchInsert = Database['public']['Tables']['batches']['Insert']
type BatchUpdate = Database['public']['Tables']['batches']['Update']

export class BatchRepository {
  async findAll(options?: {
    limit?: number
    offset?: number
    productId?: string
    locationId?: string
    qualityStatus?: Batch['quality_status']
  }) {
    let query = supabase
      .from('batches')
      .select('*, products(name, gtin), locations(name, gln)')
      .order('production_date', { ascending: false })

    if (options?.productId) {
      query = query.eq('product_id', options.productId)
    }
    if (options?.locationId) {
      query = query.eq('location_id', options.locationId)
    }
    if (options?.qualityStatus) {
      query = query.eq('quality_status', options.qualityStatus)
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
      .from('batches')
      .select('*, products(name, gtin), locations(name, gln)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async findByBatchNumber(batchNumber: string) {
    const { data, error } = await supabase
      .from('batches')
      .select('*, products(name, gtin), locations(name, gln)')
      .eq('batch_number', batchNumber)
      .single()

    if (error) throw error
    return data
  }

  async create(batch: BatchInsert) {
    const { data, error } = await supabase
      .from('batches')
      .insert(batch)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, batch: BatchUpdate) {
    const { data, error } = await supabase
      .from('batches')
      .update(batch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateQuantity(id: string, quantityDelta: number) {
    const batch = await this.findById(id)
    const newQuantity = batch.quantity_available + quantityDelta

    if (newQuantity < 0) {
      throw new Error('Insufficient quantity available')
    }

    return this.update(id, {
      quantity_available: newQuantity
    })
  }

  async getExpiringBatches(daysThreshold = 30) {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

    const { data, error } = await supabase
      .from('batches')
      .select('*, products(name, gtin)')
      .lte('expiry_date', thresholdDate.toISOString().split('T')[0])
      .eq('quality_status', 'approved')
      .order('expiry_date', { ascending: true })

    if (error) throw error
    return data
  }

  async getBatchStatistics(locationId?: string) {
    let query = supabase
      .from('batches')
      .select('quality_status, quantity_available')

    if (locationId) {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) throw error

    const stats = {
      total: data.length,
      approved: 0,
      pending: 0,
      rejected: 0,
      recalled: 0,
      totalQuantity: 0
    }

    for (const batch of data) {
      stats[batch.quality_status]++
      stats.totalQuantity += batch.quantity_available
    }

    return stats
  }
}
