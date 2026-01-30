import { NextResponse } from 'next/server'
import { validationService } from '@/lib/services/validation-service'

/**
 * API endpoint to trigger background validation processing
 * Can be called by cron job or manually
 */
export async function POST(request: Request) {
  try {
    const { limit = 10 } = await request.json().catch(() => ({}))

    console.log(`[v0] API: Starting validation processing (limit: ${limit})`)
    
    const processed = await validationService.processPendingValidations(limit)

    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} validation job(s)`
    })
  } catch (error: any) {
    console.error('[v0] API: Validation processing failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check validation status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type') as 'event' | 'batch'
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 }
      )
    }

    const status = await validationService.getValidationStatus(entityType, entityId)

    if (!status) {
      return NextResponse.json(
        { error: 'Validation status not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      status
    })
  } catch (error: any) {
    console.error('[v0] API: Failed to get validation status:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
