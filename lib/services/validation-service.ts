/**
 * Background Validation Service
 * Automatically validates events and batches in background
 */

import { createClient } from '@/lib/supabase/client'
import { epcisValidator, type ValidationResult } from '@/lib/validators/epcis-validator'

export interface ValidationJob {
  id: string
  entity_type: 'event' | 'batch' | 'product'
  entity_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: ValidationResult
  error?: string
  created_at: string
  completed_at?: string
}

export class ValidationService {
  private supabase = createClient()

  /**
   * Queue an event for validation
   */
  async queueEventValidation(eventId: string): Promise<void> {
    console.log(`[v0] Queueing validation for event: ${eventId}`)
    
    // Add to AI processing queue with validation job type
    const { error } = await this.supabase
      .from('ai_processing_queue')
      .insert({
        job_type: 'validation',
        event_id: eventId,
        status: 'pending',
        priority: 2, // Lower priority than AI processing
        input_data: { entity_type: 'event', entity_id: eventId }
      })

    if (error) {
      console.error('[v0] Failed to queue validation:', error)
      throw error
    }
  }

  /**
   * Queue batch validation
   */
  async queueBatchValidation(batchId: string): Promise<void> {
    console.log(`[v0] Queueing validation for batch: ${batchId}`)
    
    const { error } = await this.supabase
      .from('ai_processing_queue')
      .insert({
        job_type: 'validation',
        status: 'pending',
        priority: 2,
        input_data: { entity_type: 'batch', entity_id: batchId }
      })

    if (error) {
      console.error('[v0] Failed to queue batch validation:', error)
      throw error
    }
  }

  /**
   * Process validation job
   */
  async processValidationJob(jobId: string): Promise<ValidationResult> {
    console.log(`[v0] Processing validation job: ${jobId}`)
    
    // Get job details
    const { data: job, error: jobError } = await this.supabase
      .from('ai_processing_queue')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Validation job not found')
    }

    // Update status to processing
    await this.supabase
      .from('ai_processing_queue')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', jobId)

    try {
      const inputData = job.input_data as { entity_type: string; entity_id: string }
      let result: ValidationResult

      if (inputData.entity_type === 'event') {
        result = await this.validateEvent(inputData.entity_id)
      } else if (inputData.entity_type === 'batch') {
        result = await this.validateBatch(inputData.entity_id)
      } else {
        throw new Error(`Unknown entity type: ${inputData.entity_type}`)
      }

      // Update job with result
      await this.supabase
        .from('ai_processing_queue')
        .update({
          status: 'completed',
          result: result as any,
          processing_completed_at: new Date().toISOString(),
          requires_review: !result.valid || result.warnings.length > 0
        })
        .eq('id', jobId)

      console.log(`[v0] Validation completed for job ${jobId}: ${result.valid ? 'VALID' : 'INVALID'}`)

      return result
    } catch (error: any) {
      console.error(`[v0] Validation failed for job ${jobId}:`, error)
      
      // Update job with error
      await this.supabase
        .from('ai_processing_queue')
        .update({
          status: 'failed',
          error_message: error.message,
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      throw error
    }
  }

  /**
   * Validate a single event
   */
  private async validateEvent(eventId: string): Promise<ValidationResult> {
    console.log(`[v0] Validating event: ${eventId}`)
    
    const { data: event, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (error || !event) {
      throw new Error('Event not found')
    }

    const result = await epcisValidator.validateEvent(event)

    // Store validation result in event metadata
    await this.supabase
      .from('events')
      .update({
        metadata: {
          ...(event.metadata as any || {}),
          validation: result
        }
      })
      .eq('id', eventId)

    return result
  }

  /**
   * Validate a batch
   */
  private async validateBatch(batchId: string): Promise<ValidationResult> {
    console.log(`[v0] Validating batch: ${batchId}`)
    
    const { data: batch, error } = await this.supabase
      .from('batches')
      .select('*')
      .eq('id', batchId)
      .single()

    if (error || !batch) {
      throw new Error('Batch not found')
    }

    const result = await epcisValidator.validateBatch(batch)

    // Store validation result in batch metadata
    await this.supabase
      .from('batches')
      .update({
        metadata: {
          ...(batch.metadata as any || {}),
          validation: result
        }
      })
      .eq('id', batchId)

    return result
  }

  /**
   * Process pending validation jobs (can be called by cron/worker)
   */
  async processPendingValidations(limit = 10): Promise<number> {
    console.log(`[v0] Processing pending validations (limit: ${limit})`)
    
    const { data: jobs, error } = await this.supabase
      .from('ai_processing_queue')
      .select('id')
      .eq('job_type', 'validation')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[v0] Failed to fetch pending validations:', error)
      return 0
    }

    if (!jobs || jobs.length === 0) {
      console.log('[v0] No pending validations found')
      return 0
    }

    let processed = 0
    for (const job of jobs) {
      try {
        await this.processValidationJob(job.id)
        processed++
      } catch (error) {
        console.error(`[v0] Failed to process validation job ${job.id}:`, error)
      }
    }

    console.log(`[v0] Processed ${processed}/${jobs.length} validation jobs`)
    return processed
  }

  /**
   * Get validation status for an entity
   */
  async getValidationStatus(entityType: 'event' | 'batch', entityId: string): Promise<ValidationResult | null> {
    const table = entityType === 'event' ? 'events' : 'batches'
    
    const { data, error } = await this.supabase
      .from(table)
      .select('metadata')
      .eq('id', entityId)
      .single()

    if (error || !data || !data.metadata) {
      return null
    }

    return (data.metadata as any).validation || null
  }

  /**
   * Get all entities requiring review
   */
  async getEntitiesRequiringReview(limit = 50) {
    const { data, error } = await this.supabase
      .from('ai_processing_queue')
      .select('*')
      .eq('job_type', 'validation')
      .eq('requires_review', true)
      .is('reviewed_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[v0] Failed to fetch entities requiring review:', error)
      return []
    }

    return data || []
  }
}

// Export singleton
export const validationService = new ValidationService()
