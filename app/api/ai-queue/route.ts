import { NextRequest, NextResponse } from 'next/server'
import { AIQueueService } from '@/lib/services/ai-queue-service'

const queueService = new AIQueueService()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'stats') {
      const stats = await queueService.getQueueStatistics()
      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    if (action === 'review') {
      const limit = searchParams.get('limit')
      const jobs = await queueService.getJobsForReview(
        limit ? Number.parseInt(limit) : 50
      )
      return NextResponse.json({
        success: true,
        data: jobs,
        count: jobs.length
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use ?action=stats or ?action=review'
      },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[v0] Error in AI queue API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'enqueue') {
      const job = await queueService.enqueueJob({
        jobType: data.jobType,
        inputData: data.inputData,
        userId: data.userId,
        locationGln: data.locationGln,
        priority: data.priority,
        confidenceThreshold: data.confidenceThreshold
      })

      return NextResponse.json({
        success: true,
        data: job
      }, { status: 201 })
    }

    if (action === 'approve') {
      await queueService.approveJob(
        data.jobId,
        data.reviewerId,
        data.notes,
        data.modifiedResult
      )

      return NextResponse.json({
        success: true,
        message: 'Job approved'
      })
    }

    if (action === 'reject') {
      await queueService.rejectJob(
        data.jobId,
        data.reviewerId,
        data.reason
      )

      return NextResponse.json({
        success: true,
        message: 'Job rejected'
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use enqueue, approve, or reject'
      },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[v0] Error in AI queue API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
