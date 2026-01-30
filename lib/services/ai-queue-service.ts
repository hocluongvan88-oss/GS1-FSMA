import { supabase } from '../data/supabase-client'

export type AIJobType = 'voice_transcription' | 'vision_ocr' | 'vision_counting' | 'nlp_extraction'
export type AIJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'review_required'

export interface AIJob {
  id: string
  job_type: AIJobType
  status: AIJobStatus
  priority: number
  input_data: Record<string, any>
  user_id: string | null
  location_gln: string | null
  result: Record<string, any> | null
  confidence_score: number | null
  confidence_threshold: number
  retry_count: number
  max_retries: number
  requires_review: boolean
  error_message: string | null
  event_id: string | null
  created_at: string
  updated_at: string
}

export class AIQueueService {
  /**
   * Add a new job to the AI processing queue
   */
  async enqueueJob(params: {
    jobType: AIJobType
    inputData: Record<string, any>
    userId?: string
    locationGln?: string
    priority?: number
    confidenceThreshold?: number
  }): Promise<AIJob> {
    const { data, error } = await supabase
      .from('ai_processing_queue')
      .insert({
        job_type: params.jobType,
        input_data: params.inputData,
        user_id: params.userId || null,
        location_gln: params.locationGln || null,
        priority: params.priority || 5,
        confidence_threshold: params.confidenceThreshold || 0.85,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error
    return data as AIJob
  }

  /**
   * Get next job from queue (called by AI workers)
   */
  async getNextJob(): Promise<AIJob | null> {
    const { data, error } = await supabase.rpc('get_next_ai_job')

    if (error) {
      console.error('[v0] Error getting next AI job:', error)
      return null
    }
    return data as AIJob | null
  }

  /**
   * Mark job as completed
   */
  async completeJob(
    jobId: string,
    result: Record<string, any>,
    confidenceScore: number,
    processingTimeMs: number
  ): Promise<void> {
    const { error } = await supabase.rpc('complete_ai_job', {
      job_id: jobId,
      job_result: result,
      job_confidence: confidenceScore,
      job_processing_time: processingTimeMs
    })

    if (error) throw error
  }

  /**
   * Mark job as failed
   */
  async failJob(
    jobId: string,
    errorMessage: string,
    errorDetails?: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase.rpc('fail_ai_job', {
      job_id: jobId,
      error_msg: errorMessage,
      error_detail: errorDetails || {}
    })

    if (error) throw error
  }

  /**
   * Get jobs requiring human review
   */
  async getJobsForReview(limit = 50): Promise<AIJob[]> {
    const { data, error } = await supabase
      .from('ai_processing_queue')
      .select('*')
      .eq('requires_review', true)
      .eq('status', 'review_required')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data as AIJob[]
  }

  /**
   * Approve a job after human review
   */
  async approveJob(
    jobId: string,
    reviewerId: string,
    notes?: string,
    modifiedResult?: Record<string, any>
  ): Promise<void> {
    const { error } = await supabase
      .from('ai_processing_queue')
      .update({
        status: 'completed',
        requires_review: false,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_decision: 'approved',
        review_notes: notes || null,
        result: modifiedResult || undefined
      })
      .eq('id', jobId)

    if (error) throw error
  }

  /**
   * Reject a job after human review
   */
  async rejectJob(
    jobId: string,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    const { error } = await supabase
      .from('ai_processing_queue')
      .update({
        status: 'failed',
        requires_review: false,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_decision: 'rejected',
        review_notes: reason
      })
      .eq('id', jobId)

    if (error) throw error
  }

  /**
   * Get job statistics
   */
  async getQueueStatistics() {
    const { data, error } = await supabase
      .from('ai_processing_queue')
      .select('status, job_type, confidence_score, processing_time_ms')

    if (error) throw error

    const stats = {
      total: data.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      review_required: 0,
      avgConfidence: 0,
      avgProcessingTime: 0
    }

    let totalConfidence = 0
    let totalTime = 0
    let confidenceCount = 0
    let timeCount = 0

    for (const job of data) {
      stats[job.status as keyof typeof stats]++
      if (job.confidence_score !== null) {
        totalConfidence += job.confidence_score
        confidenceCount++
      }
      if (job.processing_time_ms !== null) {
        totalTime += job.processing_time_ms
        timeCount++
      }
    }

    stats.avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    stats.avgProcessingTime = timeCount > 0 ? totalTime / timeCount : 0

    return stats
  }

  /**
   * Get job by ID
   */
  async getJobById(jobId: string): Promise<AIJob | null> {
    const { data, error } = await supabase
      .from('ai_processing_queue')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) return null
    return data as AIJob
  }

  /**
   * Link job to created event
   */
  async linkJobToEvent(jobId: string, eventId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_processing_queue')
      .update({ event_id: eventId })
      .eq('id', jobId)

    if (error) throw error
  }
}
