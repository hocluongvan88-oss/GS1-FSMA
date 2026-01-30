#!/usr/bin/env node

/**
 * Simple load testing script for API endpoints
 * 
 * Usage:
 *   node scripts/load-test.js <endpoint> <concurrent> <requests>
 * 
 * Example:
 *   node scripts/load-test.js http://localhost:3000/api/events 10 100
 */

const endpoint = process.argv[2] || 'http://localhost:3000/api/events'
const concurrent = Number.parseInt(process.argv[3]) || 10
const totalRequests = Number.parseInt(process.argv[4]) || 100

console.log(`
🔥 Load Testing Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoint:    ${endpoint}
Concurrent:  ${concurrent} requests
Total:       ${totalRequests} requests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

const stats = {
  success: 0,
  errors: 0,
  rateLimited: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  times: []
}

async function makeRequest() {
  const start = Date.now()
  
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const duration = Date.now() - start
    stats.times.push(duration)
    stats.totalTime += duration
    stats.minTime = Math.min(stats.minTime, duration)
    stats.maxTime = Math.max(stats.maxTime, duration)
    
    if (response.status === 429) {
      stats.rateLimited++
      return { status: 'rate_limited', duration }
    }
    
    if (response.ok) {
      stats.success++
      return { status: 'success', duration }
    }
    
    stats.errors++
    return { status: 'error', duration, statusCode: response.status }
  } catch (error) {
    const duration = Date.now() - start
    stats.errors++
    stats.times.push(duration)
    stats.totalTime += duration
    return { status: 'error', duration, error: error.message }
  }
}

async function runLoadTest() {
  const startTime = Date.now()
  const batches = Math.ceil(totalRequests / concurrent)
  
  console.log('🚀 Starting load test...\n')
  
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrent, totalRequests - i * concurrent)
    const requests = Array.from({ length: batchSize }, () => makeRequest())
    
    await Promise.all(requests)
    
    // Progress
    const completed = Math.min((i + 1) * concurrent, totalRequests)
    const progress = ((completed / totalRequests) * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${progress}% (${completed}/${totalRequests})`)
  }
  
  const totalDuration = Date.now() - startTime
  
  // Calculate percentiles
  stats.times.sort((a, b) => a - b)
  const p50 = stats.times[Math.floor(stats.times.length * 0.5)]
  const p90 = stats.times[Math.floor(stats.times.length * 0.9)]
  const p95 = stats.times[Math.floor(stats.times.length * 0.95)]
  const p99 = stats.times[Math.floor(stats.times.length * 0.99)]
  
  const avgTime = stats.totalTime / totalRequests
  const reqPerSec = (totalRequests / (totalDuration / 1000)).toFixed(2)
  
  console.log(`\n
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests:     ${totalRequests}
Successful:         ${stats.success} (${((stats.success / totalRequests) * 100).toFixed(1)}%)
Errors:             ${stats.errors} (${((stats.errors / totalRequests) * 100).toFixed(1)}%)
Rate Limited:       ${stats.rateLimited} (${((stats.rateLimited / totalRequests) * 100).toFixed(1)}%)

⏱️  Response Times (ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average:            ${avgTime.toFixed(2)}ms
Min:                ${stats.minTime}ms
Max:                ${stats.maxTime}ms
P50 (Median):       ${p50}ms
P90:                ${p90}ms
P95:                ${p95}ms
P99:                ${p99}ms

⚡ Performance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Duration:     ${(totalDuration / 1000).toFixed(2)}s
Requests/sec:       ${reqPerSec}

${stats.rateLimited > 0 ? '⚠️  Rate limiting is working! Some requests were throttled.\n' : '✅ All requests completed without rate limiting.\n'}
`)

  // Check if performance is good
  if (avgTime < 200 && stats.success / totalRequests > 0.95) {
    console.log('✅ PASS: System performance is good!\n')
  } else if (avgTime < 500 && stats.success / totalRequests > 0.9) {
    console.log('⚠️  WARNING: System performance is acceptable but could be improved.\n')
  } else {
    console.log('❌ FAIL: System performance needs improvement!\n')
  }
}

runLoadTest().catch(console.error)
