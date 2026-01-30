#!/usr/bin/env node

/**
 * Comprehensive load test suite for all critical endpoints
 */

const endpoints = [
  {
    name: 'Events API - Read',
    url: 'http://localhost:3000/api/events',
    method: 'GET',
    concurrent: 20,
    requests: 200
  },
  {
    name: 'Batches API - Read',
    url: 'http://localhost:3000/api/batches',
    method: 'GET',
    concurrent: 15,
    requests: 150
  },
  {
    name: 'Events API - Write',
    url: 'http://localhost:3000/api/events',
    method: 'POST',
    body: {
      event_type: 'ObjectEvent',
      action: 'ADD',
      epc_list: ['urn:epc:id:sgtin:test:1:1'],
      biz_location: '8412345678900',
      biz_step: 'commissioning'
    },
    concurrent: 10,
    requests: 50
  }
]

async function testEndpoint(config) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎯 Testing: ${config.name}`)
  console.log(`${'='.repeat(60)}`)
  
  const stats = {
    success: 0,
    errors: 0,
    rateLimited: 0,
    times: []
  }
  
  const startTime = Date.now()
  
  async function makeRequest() {
    const reqStart = Date.now()
    
    try {
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json'
        },
        ...(config.body && { body: JSON.stringify(config.body) })
      })
      
      const duration = Date.now() - reqStart
      stats.times.push(duration)
      
      if (response.status === 429) {
        stats.rateLimited++
      } else if (response.ok) {
        stats.success++
      } else {
        stats.errors++
      }
    } catch (error) {
      stats.errors++
      stats.times.push(Date.now() - reqStart)
    }
  }
  
  // Run tests in batches
  const batches = Math.ceil(config.requests / config.concurrent)
  
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(config.concurrent, config.requests - i * config.concurrent)
    const requests = Array.from({ length: batchSize }, () => makeRequest())
    await Promise.all(requests)
    
    const completed = Math.min((i + 1) * config.concurrent, config.requests)
    process.stdout.write(`\rProgress: ${((completed / config.requests) * 100).toFixed(0)}%`)
  }
  
  const totalDuration = Date.now() - startTime
  
  // Calculate stats
  stats.times.sort((a, b) => a - b)
  const avgTime = stats.times.reduce((a, b) => a + b, 0) / stats.times.length
  const p95 = stats.times[Math.floor(stats.times.length * 0.95)]
  const reqPerSec = (config.requests / (totalDuration / 1000)).toFixed(2)
  
  console.log(`\n
Results:
  ✅ Success:        ${stats.success}/${config.requests} (${((stats.success / config.requests) * 100).toFixed(1)}%)
  ❌ Errors:         ${stats.errors}
  ⏸️  Rate Limited:  ${stats.rateLimited}
  
  ⏱️  Avg Response:   ${avgTime.toFixed(0)}ms
  📊 P95 Response:   ${p95}ms
  ⚡ Throughput:     ${reqPerSec} req/s
  ⏰ Total Time:     ${(totalDuration / 1000).toFixed(2)}s
`)
  
  return {
    name: config.name,
    success: stats.success === config.requests,
    avgTime,
    p95,
    throughput: reqPerSec
  }
}

async function runAllTests() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           🔥 LOAD TEST SUITE - COMPREHENSIVE              ║
╚════════════════════════════════════════════════════════════╝
  `)
  
  const results = []
  
  for (const config of endpoints) {
    const result = await testEndpoint(config)
    results.push(result)
    
    // Wait between tests to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 TEST SUMMARY')
  console.log(`${'='.repeat(60)}`)
  
  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.name}`)
    console.log(`   Avg: ${result.avgTime.toFixed(0)}ms | P95: ${result.p95}ms | ${result.throughput} req/s`)
  })
  
  const allPassed = results.every(r => r.success)
  
  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)
  console.log(`${'='.repeat(60)}\n`)
}

runAllTests().catch(console.error)
