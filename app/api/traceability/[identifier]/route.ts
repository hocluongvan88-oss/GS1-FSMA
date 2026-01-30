import { NextRequest, NextResponse } from 'next/server'
import { TraceabilityService } from '@/lib/services/traceability-service'
import { BatchRepository } from '@/lib/data/repositories/batch-repository'
import { tracebackSupplyChain } from '@/lib/utils/traceback-algorithm'
import { supabase } from '@/lib/data/supabase-client'

const traceabilityService = new TraceabilityService()
const batchRepo = new BatchRepository()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'epc' // 'batch', 'gtin', 'epc', or 'trace'
    const maxDepth = parseInt(searchParams.get('maxDepth') || '10', 10)

    let result

    if (type === 'batch') {
      // Try to find batch by ID or batch number
      let batch
      try {
        batch = await batchRepo.findById(identifier)
      } catch {
        batch = await batchRepo.findByBatchNumber(identifier)
      }

      result = await traceabilityService.getTraceabilityChain(batch.id)
    } else if (type === 'gtin') {
      const events = await traceabilityService.getProductTraceability(identifier)
      result = {
        gtin: identifier,
        events
      }
    } else if (type === 'epc' || type === 'trace') {
      // Use the traceback algorithm for EPC-based tracing
      const traceResult = await tracebackSupplyChain(identifier, { 
        maxDepth,
        includeLocation: true 
      })
      
      if (!traceResult.success) {
        // Fallback: Try using the database function if available
        const { data: dbTrace, error } = await supabase.rpc('get_trace_chain', {
          p_identifier: identifier,
          p_max_depth: maxDepth
        })
        
        if (error || !dbTrace || dbTrace.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: traceResult.error || 'No trace found for identifier',
              identifier,
              suggestion: 'Try using type=gtin or type=batch if this is not an EPC'
            },
            { status: 404 }
          )
        }
        
        result = {
          identifier,
          traceChain: dbTrace,
          totalEvents: dbTrace.length,
          source: 'database_function'
        }
      } else {
        result = {
          identifier,
          rootNode: traceResult.rootNode,
          totalEvents: traceResult.totalEvents,
          maxDepth: traceResult.maxDepth,
          originEvents: traceResult.originEvents,
          source: 'traceback_algorithm'
        }
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported traceability type: ${type}`,
          supportedTypes: ['batch', 'gtin', 'epc', 'trace']
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[v0] Error fetching traceability:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}
