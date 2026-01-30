/**
 * Simple in-memory cache implementation with TTL support
 * For production with distributed systems, use Redis/Upstash
 */

interface CacheEntry<T> {
  data: T
  expiry: number
}

class Cache {
  private cache: Map<string, CacheEntry<any>>
  private defaultTTL: number

  constructor(defaultTTL = 5 * 60 * 1000) {
    // 5 minutes default
    this.cache = new Map()
    this.defaultTTL = defaultTTL

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry < now) {
        this.cache.delete(key)
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (entry.expiry < Date.now()) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { data, expiry })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Cache tags for invalidation
  invalidateByPattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    }
  }
}

// Singleton instance
export const cache = new Cache()

/**
 * Cache decorator for functions
 */
export function cached<T>(
  keyGenerator: (...args: any[]) => string,
  ttl?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args)
      
      // Check cache first
      const cached = cache.get<T>(cacheKey)
      if (cached !== null) {
        console.log(`[v0] Cache hit: ${cacheKey}`)
        return cached
      }

      // Cache miss - execute original function
      console.log(`[v0] Cache miss: ${cacheKey}`)
      const result = await originalMethod.apply(this, args)
      
      // Store in cache
      cache.set(cacheKey, result, ttl)
      
      return result
    }

    return descriptor
  }
}

/**
 * Helper function to wrap async functions with caching
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache
  const cached = cache.get<T>(key)
  if (cached !== null) {
    console.log(`[v0] Cache hit: ${key}`)
    return cached
  }

  // Execute function
  console.log(`[v0] Cache miss: ${key}`)
  const result = await fn()
  
  // Cache result
  cache.set(key, result, ttl)
  
  return result
}
