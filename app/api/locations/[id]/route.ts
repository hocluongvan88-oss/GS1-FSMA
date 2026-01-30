import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase-client'
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { cache } from '@/lib/cache'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limiting: 10 edits per minute
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

    // Block immutable field - GLN
    if (body.gln !== undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'GLN is immutable and cannot be changed',
          code: 'IMMUTABLE_FIELD'
        },
        { status: 400 }
      )
    }

    // Get current data for audit trail
    const { data: currentData, error: fetchError } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentData) {
      return NextResponse.json(
        { success: false, error: 'Location not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.type !== undefined) updateData.type = body.type
    if (body.address !== undefined) updateData.address = body.address
    if (body.coordinates !== undefined) updateData.coordinates = body.coordinates
    if (body.parent_gln !== undefined) updateData.parent_gln = body.parent_gln
    if (body.metadata !== undefined) updateData.metadata = body.metadata

    updateData.updated_at = new Date().toISOString()

    // Update location
    const { data: updatedLocation, error: updateError } = await supabase
      .from('locations')
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
      if (key !== 'updated_at') {
        const oldVal = JSON.stringify(currentData[key])
        const newVal = JSON.stringify(updateData[key])
        if (oldVal !== newVal) {
          changes[key] = {
            old: currentData[key],
            new: updateData[key]
          }
        }
      }
    })

    await supabase.from('audit_log').insert({
      entity_type: 'location',
      entity_id: id,
      action_type: 'UPDATE',
      payload: {
        changes,
        reason: body.edit_reason || 'No reason provided',
        gln: currentData.gln
      },
      metadata: {
        user_agent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }
    })

    // Invalidate cache
    cache.invalidateByPattern('^locations:')

    return NextResponse.json({
      success: true,
      data: updatedLocation,
      audit: {
        changes_count: Object.keys(changes).length,
        fields_changed: Object.keys(changes)
      }
    })
  } catch (error: any) {
    console.error('[v0] Location PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
