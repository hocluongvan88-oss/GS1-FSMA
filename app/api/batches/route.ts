import { NextRequest, NextResponse } from 'next/server'
import { BatchRepository } from '@/lib/data/repositories/batch-repository'
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit'

const batchRepo = new BatchRepository()

export async function GET(request: NextRequest) {
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
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId')
    const qualityStatus = searchParams.get('qualityStatus')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    const batches = await batchRepo.findAll({
      productId: productId || undefined,
      locationId: locationId || undefined,
      qualityStatus: qualityStatus as any,
      limit: limit ? Number.parseInt(limit) : 100,
      offset: offset ? Number.parseInt(offset) : 0
    })

    return NextResponse.json({
      success: true,
      data: batches,
      count: batches.length
    })
  } catch (error: any) {
    console.error('[v0] Error fetching batches:', error)
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
  const rateLimitResult = await rateLimit(request, {
    interval: 60 * 1000,
    uniqueTokenPerInterval: 20,
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
    
    // Validate required fields
    if (!body.batch_number || !body.product_id || !body.location_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'batch_number, product_id, and location_id are required'
        },
        { status: 400 }
      )
    }

    const batch = await batchRepo.create(body)

    return NextResponse.json({
      success: true,
      data: batch
    }, { status: 201 })
  } catch (error: any) {
    console.error('[v0] Error creating batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
