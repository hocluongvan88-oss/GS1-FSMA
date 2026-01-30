import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  interval: number // Time window in milliseconds
  uniqueTokenPerInterval: number // Max requests per interval
}

// In-memory store for rate limiting (use Redis in production for distributed systems)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }
}, 10 * 60 * 1000)

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = {
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 100, // 100 requests per minute
  }
): Promise<{
  success: boolean
  remaining: number
  reset: number
  limit: number
}> {
  // Get identifier (IP address or user ID)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  const identifier = `rate-limit:${ip}`

  const now = Date.now()
  const resetTime = now + config.interval

  const current = rateLimitMap.get(identifier)

  if (!current || current.resetTime < now) {
    // First request or window expired
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime,
    })

    return {
      success: true,
      remaining: config.uniqueTokenPerInterval - 1,
      reset: resetTime,
      limit: config.uniqueTokenPerInterval,
    }
  }

  if (current.count >= config.uniqueTokenPerInterval) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      reset: current.resetTime,
      limit: config.uniqueTokenPerInterval,
    }
  }

  // Increment counter
  current.count++
  rateLimitMap.set(identifier, current)

  return {
    success: true,
    remaining: config.uniqueTokenPerInterval - current.count,
    reset: current.resetTime,
    limit: config.uniqueTokenPerInterval,
  }
}

export function createRateLimitResponse(
  remaining: number,
  reset: number,
  limit: number
) {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    }
  )
}
