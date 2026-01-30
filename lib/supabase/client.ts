import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Create singleton instance at module level
const supabaseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Export singleton instance directly - use this for all client-side code
export const supabase = supabaseClient

// Legacy function for backward compatibility - returns the same singleton
export function createClient() {
  return supabaseClient
}
