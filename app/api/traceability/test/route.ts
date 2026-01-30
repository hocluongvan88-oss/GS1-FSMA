import { NextResponse } from 'next/server'
import { supabase } from '@/lib/data/supabase-client'
import { TraceabilityService } from '@/lib/services/traceability-service'

/**
 * Test endpoint to verify traceability system is working correctly
 * GET /api/traceability/test
 */
export async function GET() {
  const results: {
    step: string
    status: 'pass' | 'fail' | 'warning'
    message: string
    data?: unknown
  }[] = []

  try {
    // Test 1: Check if events table exists and has data
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, event_type, event_time, epc_list, input_epc_list, output_epc_list')
      .limit(10)
      .order('event_time', { ascending: true })

    if (eventsError) {
      results.push({
        step: '1. Check events table',
        status: 'fail',
        message: `Error querying events: ${eventsError.message}`
      })
    } else {
      results.push({
        step: '1. Check events table',
        status: events && events.length > 0 ? 'pass' : 'warning',
        message: `Found ${events?.length || 0} events`,
        data: events?.slice(0, 3)
      })
    }

    // Test 2: Check if materialized view exists
    const { data: mvData, error: mvError } = await supabase
      .from('event_trace_paths')
      .select('*')
      .limit(5)

    if (mvError) {
      results.push({
        step: '2. Check materialized view',
        status: 'fail',
        message: `Error querying event_trace_paths: ${mvError.message}`
      })
    } else {
      results.push({
        step: '2. Check materialized view',
        status: mvData && mvData.length > 0 ? 'pass' : 'warning',
        message: `Materialized view has ${mvData?.length || 0} entries`,
        data: mvData?.slice(0, 2)
      })
    }

    // Test 3: Test get_trace_chain function
    const testEPC = 'urn:epc:id:sgtin:0854100.000000.12345'
    const { data: traceData, error: traceError } = await supabase.rpc('get_trace_chain', {
      p_identifier: testEPC,
      p_max_depth: 10
    })

    if (traceError) {
      results.push({
        step: '3. Test get_trace_chain function',
        status: 'fail',
        message: `Error calling get_trace_chain: ${traceError.message}`
      })
    } else {
      const traceArray = traceData as unknown[]
      results.push({
        step: '3. Test get_trace_chain function',
        status: traceArray && traceArray.length > 0 ? 'pass' : 'warning',
        message: `Trace chain returned ${traceArray?.length || 0} events for EPC: ${testEPC}`,
        data: traceArray?.slice(0, 3)
      })
    }

    // Test 4: Test TraceabilityService
    const traceService = new TraceabilityService()
    const serviceResult = await traceService.getTraceChain(testEPC, 10)

    results.push({
      step: '4. Test TraceabilityService.getTraceChain',
      status: serviceResult.success ? 'pass' : 'warning',
      message: serviceResult.success 
        ? `Service returned ${serviceResult.totalEvents} events, max depth: ${serviceResult.maxDepthReached}`
        : `Service error: ${serviceResult.error}`,
      data: {
        totalEvents: serviceResult.totalEvents,
        maxDepthReached: serviceResult.maxDepthReached,
        sampleChain: serviceResult.chain.slice(0, 2)
      }
    })

    // Test 5: Test findEventsByEPC
    const foundEvents = await traceService.findEventsByEPC(testEPC)
    results.push({
      step: '5. Test findEventsByEPC',
      status: foundEvents.length > 0 ? 'pass' : 'warning',
      message: `Found ${foundEvents.length} events containing EPC: ${testEPC}`,
      data: foundEvents.slice(0, 2).map(e => ({
        id: e.id,
        type: e.event_type,
        time: e.event_time
      }))
    })

    // Test 6: Verify chain linkage
    const { data: chainEvents } = await supabase
      .from('events')
      .select('*')
      .order('event_time', { ascending: true })
      .limit(10)

    if (chainEvents && chainEvents.length > 1) {
      const linkageAnalysis: string[] = []
      
      for (let i = 1; i < chainEvents.length; i++) {
        const current = chainEvents[i]
        const previous = chainEvents[i - 1]
        
        let linked = false
        const currentInputs = (current.input_epc_list as string[]) || []
        const currentEpcs = (current.epc_list as string[]) || []
        const prevOutputs = (previous.output_epc_list as string[]) || []
        const prevEpcs = (previous.epc_list as string[]) || []

        // Check if current event's inputs match previous event's outputs
        if (currentInputs.length > 0 && prevOutputs.length > 0) {
          linked = currentInputs.some(epc => prevOutputs.includes(epc))
        }
        
        // Check if current event's epcs match previous event's outputs
        if (!linked && currentEpcs.length > 0 && prevOutputs.length > 0) {
          linked = currentEpcs.some(epc => prevOutputs.includes(epc))
        }

        // Check if current event's epcs match previous event's epcs (same item)
        if (!linked && currentEpcs.length > 0 && prevEpcs.length > 0) {
          linked = currentEpcs.some(epc => prevEpcs.includes(epc))
        }

        linkageAnalysis.push(
          `Event ${i}: ${current.event_type} ${linked ? 'LINKED' : 'NOT LINKED'} to Event ${i - 1}: ${previous.event_type}`
        )
      }

      results.push({
        step: '6. Verify chain linkage',
        status: linkageAnalysis.some(l => l.includes('LINKED')) ? 'pass' : 'warning',
        message: 'Chain linkage analysis completed',
        data: linkageAnalysis
      })
    } else {
      results.push({
        step: '6. Verify chain linkage',
        status: 'warning',
        message: 'Not enough events to verify chain linkage'
      })
    }

    // Summary
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const warningCount = results.filter(r => r.status === 'warning').length

    return NextResponse.json({
      success: failCount === 0,
      summary: {
        total: results.length,
        pass: passCount,
        fail: failCount,
        warning: warningCount
      },
      results,
      recommendations: failCount > 0 || warningCount > 0 ? [
        warningCount > 0 && 'Consider adding more seed data to test chain linkage',
        failCount > 0 && 'Check if all SQL migrations have been run',
        'Run REFRESH MATERIALIZED VIEW event_trace_paths if data was recently added'
      ].filter(Boolean) : []
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      success: false,
      error: errorMessage,
      results
    }, { status: 500 })
  }
}
