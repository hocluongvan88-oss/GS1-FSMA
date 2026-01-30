import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase-client'
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Rate limiting: 50 requests per minute for audit logs (sensitive data)
  const rateLimitResult = await rateLimit(request, {
    interval: 60 * 1000,
    uniqueTokenPerInterval: 50,
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
    const action = searchParams.get('action')

    if (action === 'verify-chain') {
      const { data, error } = await supabase.rpc('verify_audit_chain')

      if (error) throw error

      const invalid = data?.filter((block: any) => !block.is_valid) || []

      return NextResponse.json({
        success: true,
        data: {
          totalBlocks: data?.length || 0,
          validBlocks: data?.length - invalid.length || 0,
          invalidBlocks: invalid.length,
          invalid
        }
      })
    }

    if (action === 'verify-block') {
      const blockNumber = searchParams.get('blockNumber')
      if (!blockNumber) {
        return NextResponse.json(
          {
            success: false,
            error: 'blockNumber is required'
          },
          { status: 400 }
        )
      }

      const { data, error } = await supabase.rpc('verify_audit_block', {
        block_num: Number.parseInt(blockNumber)
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: {
          blockNumber: Number.parseInt(blockNumber),
          isValid: data
        }
      })
    }

    if (action === 'trail') {
      const entityType = searchParams.get('entityType')
      const entityId = searchParams.get('entityId')

      if (!entityType || !entityId) {
        return NextResponse.json(
          {
            success: false,
            error: 'entityType and entityId are required'
          },
          { status: 400 }
        )
      }

      const { data, error } = await supabase.rpc('get_audit_trail', {
        entity_type_param: entityType,
        entity_id_param: entityId
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: {
          entityType,
          entityId,
          trail: data
        }
      })
    }

    if (action === 'stats') {
      const { data, error } = await supabase
        .from('audit_statistics')
        .select('*')
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data
      })
    }

    // Default: Get recent audit logs
    const limit = searchParams.get('limit')
    const entityType = searchParams.get('entityType')

    let query = supabase
      .from('audit_log')
      .select('*')
      .order('block_number', { ascending: false })

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    if (limit) {
      query = query.limit(Number.parseInt(limit))
    } else {
      query = query.limit(100)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0
    })
  } catch (error: any) {
    console.error('[v0] Error in audit API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
