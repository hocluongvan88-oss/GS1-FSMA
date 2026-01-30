import { AIQueueService } from './ai-queue-service'
import type { AIJob } from './ai-queue-service'

export class AIWorker {
  private queueService = new AIQueueService()
  private isRunning = false

  /**
   * Start the AI worker to process jobs from queue
   */
  async start(pollIntervalMs = 5000) {
    if (this.isRunning) {
      console.log('[v0] AI Worker is already running')
      return
    }

    this.isRunning = true
    console.log('[v0] AI Worker started')

    while (this.isRunning) {
      try {
        const job = await this.queueService.getNextJob()
        
        if (job) {
          console.log(`[v0] Processing AI job: ${job.id} (${job.job_type})`)
          await this.processJob(job)
        } else {
          // No jobs available, wait before polling again
          await this.sleep(pollIntervalMs)
        }
      } catch (error) {
        console.error('[v0] Error in AI Worker loop:', error)
        await this.sleep(pollIntervalMs)
      }
    }

    console.log('[v0] AI Worker stopped')
  }

  /**
   * Stop the AI worker
   */
  stop() {
    this.isRunning = false
  }

  /**
   * Process a single AI job
   */
  private async processJob(job: AIJob) {
    const startTime = Date.now()

    try {
      let result: Record<string, any>
      let confidenceScore: number

      switch (job.job_type) {
        case 'voice_transcription':
          ({ result, confidenceScore } = await this.processVoice(job))
          break
        case 'vision_ocr':
          ({ result, confidenceScore } = await this.processVisionOCR(job))
          break
        case 'vision_counting':
          ({ result, confidenceScore } = await this.processVisionCounting(job))
          break
        case 'nlp_extraction':
          ({ result, confidenceScore } = await this.processNLP(job))
          break
        default:
          throw new Error(`Unknown job type: ${job.job_type}`)
      }

      const processingTime = Date.now() - startTime

      await this.queueService.completeJob(
        job.id,
        result,
        confidenceScore,
        processingTime
      )

      console.log(`[v0] Job ${job.id} completed in ${processingTime}ms with confidence ${confidenceScore}`)
    } catch (error: any) {
      console.error(`[v0] Job ${job.id} failed:`, error)
      
      await this.queueService.failJob(
        job.id,
        error.message,
        { stack: error.stack }
      )
    }
  }

  /**
   * Process voice transcription job
   */
  private async processVoice(job: AIJob): Promise<{ result: any; confidenceScore: number }> {
    const { audio_url } = job.input_data

    // Call Supabase Edge Function for voice processing
    const response = await fetch('/supabase/functions/v1/process-voice-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url })
    })

    if (!response.ok) {
      throw new Error(`Voice processing failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      result: data,
      confidenceScore: data.confidence || 0.9
    }
  }

  /**
   * Process vision OCR job
   */
  private async processVisionOCR(job: AIJob): Promise<{ result: any; confidenceScore: number }> {
    const { image_url } = job.input_data

    // Call Supabase Edge Function for vision processing
    const response = await fetch('/supabase/functions/v1/process-vision-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url, task: 'ocr' })
    })

    if (!response.ok) {
      throw new Error(`Vision OCR failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      result: data,
      confidenceScore: data.confidence || 0.85
    }
  }

  /**
   * Process vision counting job
   */
  private async processVisionCounting(job: AIJob): Promise<{ result: any; confidenceScore: number }> {
    const { image_url } = job.input_data

    // Call Supabase Edge Function for vision processing
    const response = await fetch('/supabase/functions/v1/process-vision-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url, task: 'counting' })
    })

    if (!response.ok) {
      throw new Error(`Vision counting failed: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      result: data,
      confidenceScore: data.confidence || 0.8
    }
  }

  /**
   * Process NLP extraction job
   */
  private async processNLP(job: AIJob): Promise<{ result: any; confidenceScore: number }> {
    const { text } = job.input_data

    // Simple NLP extraction using regex/parsing
    // In production, this would call a proper NLP service

    const result = {
      text,
      extracted: this.extractEventData(text)
    }

    return {
      result,
      confidenceScore: 0.9
    }
  }

  /**
   * Extract event data from text
   */
  private extractEventData(text: string) {
    // Simple extraction logic - in production use proper NLP
    const data: Record<string, any> = {}

    // Extract numbers (quantities)
    const numbers = text.match(/\d+/g)
    if (numbers) {
      data.quantity = Number.parseInt(numbers[0])
    }

    // Extract keywords for biz_step
    if (text.includes('thu hoạch') || text.includes('harvest')) {
      data.bizStep = 'commissioning'
    } else if (text.includes('chế biến') || text.includes('process')) {
      data.bizStep = 'transforming'
    } else if (text.includes('vận chuyển') || text.includes('ship')) {
      data.bizStep = 'shipping'
    }

    return data
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
