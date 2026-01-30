import { NextRequest, NextResponse } from 'next/server'
import { EventRepository } from '@/lib/data/repositories/event-repository'
import { TraceabilityService } from '@/lib/services/traceability-service'
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { withCache, cache } from '@/lib/cache'

const eventRepo = new EventRepository()
const traceabilityService = new TraceabilityService()

export async function GET(request: NextRequest) {
  // Rate limiting: 100 requests per minute for read operations
  const rateLimitResult = await rateLimit(request, {
    interval: 60 * 1000,
    uniqueTokenPerInterval: 100,
  })

  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult.remaining,
      rateLimitResult.reset,
      rateLimitResult.limit
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const eventType = searchParams.get('eventType')
    const sourceType = searchParams.get('sourceType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    // Generate cache key from query params
    const cacheKey = `events:${eventType || 'all'}:${sourceType || 'all'}:${startDate || ''}:${endDate || ''}:${limit || 100}:${offset || 0}`

    // Use cache with 2 minute TTL
    const events = await withCache(
      cacheKey,
      async () => {
        return await eventRepo.findAll({
          eventType: eventType as any,
          sourceType: sourceType as any,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: limit ? Number.parseInt(limit) : 100,
          offset: offset ? Number.parseInt(offset) : 0
        })
      },
      2 * 60 * 1000 // 2 minutes cache
    )

    return NextResponse.json({
      success: true,
      data: events,
      count: events.length
    })
  } catch (error: any) {
    console.error('[v0] Error fetching events:', error)
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
  // Rate limiting: 30 requests per minute for write operations (more restrictive)
  const rateLimitResult = await rateLimit(request, {
    interval: 60 * 1000,
    uniqueTokenPerInterval: 30,
  })

  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult.remaining,
      rateLimitResult.reset,
      rateLimitResult.limit
    )
  }

  try {
    const body = await request.json()
    const { eventType, ...eventData } = body

    // Validate event data
    const validation = traceabilityService.validateEventData(eventType, eventData)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors
        },
        { status: 400 }
      )
    }

    let event
    if (eventType === 'ObjectEvent') {
      event = await traceabilityService.createObjectEvent(eventData)
    } else if (eventType === 'TransformationEvent') {
      event = await traceabilityService.createTransformationEvent(eventData)
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported event type: ${eventType}`
        },
        { status: 400 }
      )
    }

    // Invalidate all events cache when new event is created
    cache.invalidateByPattern('^events:')

    return NextResponse.json({
      success: true,
      data: event
    }, { status: 201 })
  } catch (error: any) {
    console.error('[v0] Error creating event:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
