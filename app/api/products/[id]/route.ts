import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase-client'
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { cache } from '@/lib/cache'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting: 10 edits per minute (restrictive for data integrity)
  const rateLimitResult = await rateLimit(request, {
    interval: 60 * 1000,
    uniqueTokenPerInterval: 10,
  })

  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult.remaining,
      rateLimitResult.reset,
      rateLimitResult.limit
    )
  }

  try {
    const { id } = params
    const body = await request.json()

    // Block immutable fields
    if (body.gtin !== undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'GTIN is immutable and cannot be changed',
          code: 'IMMUTABLE_FIELD'
        },
        { status: 400 }
      )
    }

    // Get current data for audit trail
    const { data: currentData, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentData) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Validate required fields
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.category !== undefined) updateData.category = body.category
    if (body.unit !== undefined) updateData.unit = body.unit
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    updateData.updated_at = new Date().toISOString()

    // Update product
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Create audit log
    const changes: any = {}
    Object.keys(updateData).forEach(key => {
      if (key !== 'updated_at' && currentData[key] !== updateData[key]) {
        changes[key] = {
          old: currentData[key],
          new: updateData[key]
        }
      }
    })

    await supabase.from('audit_log').insert({
      entity_type: 'product',
      entity_id: id,
      action_type: 'UPDATE',
      payload: {
        changes,
        reason: body.edit_reason || 'No reason provided',
        gtin: currentData.gtin
      },
      metadata: {
        user_agent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }
    })

    // Invalidate cache
    cache.invalidateByPattern('^products:')

    return NextResponse.json({
      success: true,
      data: updatedProduct,
      audit: {
        changes_count: Object.keys(changes).length,
        fields_changed: Object.keys(changes)
      }
    })
  } catch (error: any) {
    console.error('[v0] Product PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
