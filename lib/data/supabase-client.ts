// Re-export from the main client to ensure single instance
// This file exists for backward compatibility with existing imports
export { createClient } from '@/lib/supabase/client'

// Default instance for convenience - uses the same singleton
import { createClient } from '@/lib/supabase/client'
export const supabase = createClient()

export type Database = {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string
          gln: string
          name: string
          type: 'farm' | 'factory' | 'warehouse' | 'retailer'
          address: Record<string, any> | null
          coordinates: Record<string, any> | null
          parent_gln: string | null
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['locations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['locations']['Insert']>
      }
      products: {
        Row: {
          id: string
          gtin: string
          name: string
          description: string | null
          category: string | null
          unit: string
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      events: {
        Row: {
          id: string
          event_type: 'ObjectEvent' | 'AggregationEvent' | 'TransactionEvent' | 'TransformationEvent'
          event_time: string
          event_timezone: string
          epc_list: Record<string, any> | null
          biz_step: string | null
          disposition: string | null
          read_point: string | null
          biz_location: string | null
          user_id: string | null
          user_name: string | null
          source_type: 'voice_ai' | 'vision_ai' | 'manual' | 'system'
          input_epc_list: Record<string, any> | null
          output_epc_list: Record<string, any> | null
          input_quantity: Record<string, any> | null
          output_quantity: Record<string, any> | null
          ai_metadata: Record<string, any> | null
          epcis_document: Record<string, any>
          batch_id: string | null
          partner_id: string | null
          certification_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      batches: {
        Row: {
          id: string
          batch_number: string
          product_id: string
          location_id: string
          production_date: string
          expiry_date: string | null
          best_before_date: string | null
          quantity_produced: number
          quantity_available: number
          unit_of_measure: string
          quality_status: 'pending' | 'approved' | 'rejected' | 'recalled'
          quality_tested_at: string | null
          quality_tested_by: string | null
          quality_notes: Record<string, any> | null
          certifications: Record<string, any> | null
          regulatory_info: Record<string, any> | null
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['batches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['batches']['Insert']>
      }
      partners: {
        Row: {
          id: string
          partner_type: 'supplier' | 'manufacturer' | 'distributor' | 'retailer'
          company_name: string
          gln: string | null
          contact_person: string | null
          email: string | null
          phone: string | null
          address: Record<string, any> | null
          tax_id: string | null
          business_license: string | null
          certifications: string[]
          rating: number
          total_transactions: number
          quality_score: number
          status: 'active' | 'inactive' | 'blacklisted'
          verified: boolean
          verified_at: string | null
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['partners']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['partners']['Insert']>
      }
    }
  }
}
