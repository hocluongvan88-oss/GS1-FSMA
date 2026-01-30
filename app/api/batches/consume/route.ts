import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { batch_id, quantity_to_consume } = await request.json()

    if (!batch_id || !quantity_to_consume || quantity_to_consume <= 0) {
      return NextResponse.json(
        { error: 'Invalid batch_id or quantity_to_consume' },
        { status: 400 }
      )
    }

    // Use PostgreSQL row-level locking with FOR UPDATE to prevent race conditions
    // This locks the row until transaction completes
    const { data: batch, error: fetchError } = await supabase
      .rpc('consume_batch_quantity', {
        p_batch_id: batch_id,
        p_quantity_to_consume: quantity_to_consume,
      })

    if (fetchError) {
      console.error('[v0] Error consuming batch:', fetchError)
      return NextResponse.json(
        { error: fetchError.message || 'Failed to consume batch' },
        { status: 500 }
      )
    }

    if (!batch) {
      return NextResponse.json(
        { error: 'Insufficient quantity available' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      batch,
      message: `Successfully consumed ${quantity_to_consume} units`,
    })
  } catch (error: any) {
    console.error('[v0] Batch consume error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
