/**
 * Zod Schemas for JSONB Field Validation
 * Ensures data consistency across the application
 */

import { z } from 'zod'

// ==============================================================================
// Address Schema (for locations table)
// ==============================================================================

export const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province/State is required'),
  country: z.string().min(2, 'Country code required').max(2, 'Use ISO 3166-1 alpha-2'),
  postal_code: z.string().optional(),
  full_address: z.string().optional(),
}).strict()

export type Address = z.infer<typeof AddressSchema>

// ==============================================================================
// Coordinates Schema (for locations table)
// ==============================================================================

export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  accuracy: z.number().positive().optional(),
}).strict()

export type Coordinates = z.infer<typeof CoordinatesSchema>

// ==============================================================================
// EPCIS Document Schema (for epcis_events table)
// ==============================================================================

export const ILMDSchema = z.object({
  lotNumber: z.string().optional(),
  productionDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  harvestDate: z.string().datetime().optional(),
  certifications: z.array(z.string()).optional(),
  conversionFactor: z.number().positive().optional(),
  customFields: z.record(z.unknown()).optional(),
}).passthrough() // Allow additional fields for flexibility

export const QuantityElementSchema = z.object({
  epcClass: z.string(),
  quantity: z.number().positive(),
  uom: z.string().min(1, 'Unit of measure required'),
})

export const SourceDestSchema = z.object({
  type: z.enum(['owning_party', 'possessing_party', 'location']),
  id: z.string().min(1),
})

export const EPCISDocumentSchema = z.object({
  '@context': z.string().url().optional(),
  type: z.string().optional(),
  schemaVersion: z.string().default('2.0'),
  creationDate: z.string().datetime().optional(),
  
  // Business context
  bizStep: z.string().optional(),
  disposition: z.string().optional(),
  
  // Parties
  sourceList: z.array(SourceDestSchema).optional(),
  destinationList: z.array(SourceDestSchema).optional(),
  
  // Instance/Lot-Level Master Data (ILMD)
  ilmd: ILMDSchema.optional(),
  
  // Quantities for aggregation/transformation
  quantityList: z.array(QuantityElementSchema).optional(),
  
  // Sensor data
  sensorElementList: z.array(z.object({
    sensorMetadata: z.record(z.unknown()),
    sensorReport: z.array(z.record(z.unknown())),
  })).optional(),
  
  // Extensions
  extensions: z.record(z.unknown()).optional(),
}).passthrough()

export type EPCISDocument = z.infer<typeof EPCISDocumentSchema>

// ==============================================================================
// Product Metadata Schema
// ==============================================================================

export const ProductMetadataSchema = z.object({
  brand: z.string().optional(),
  manufacturer: z.string().optional(),
  origin_country: z.string().length(2).optional(),
  certifications: z.array(z.string()).optional(),
  nutritional_info: z.record(z.unknown()).optional(),
  storage_conditions: z.object({
    temperature_min: z.number().optional(),
    temperature_max: z.number().optional(),
    humidity_min: z.number().optional(),
    humidity_max: z.number().optional(),
  }).optional(),
  shelf_life_days: z.number().int().positive().optional(),
}).passthrough()

export type ProductMetadata = z.infer<typeof ProductMetadataSchema>

// ==============================================================================
// Validation Helper Functions
// ==============================================================================

export function validateAddress(data: unknown): { valid: boolean; data?: Address; errors?: string[] } {
  const result = AddressSchema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  return { 
    valid: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  }
}

export function validateCoordinates(data: unknown): { valid: boolean; data?: Coordinates; errors?: string[] } {
  const result = CoordinatesSchema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  return { 
    valid: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  }
}

export function validateEPCISDocument(data: unknown): { valid: boolean; data?: EPCISDocument; errors?: string[] } {
  const result = EPCISDocumentSchema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  return { 
    valid: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  }
}

export function validateProductMetadata(data: unknown): { valid: boolean; data?: ProductMetadata; errors?: string[] } {
  const result = ProductMetadataSchema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  return { 
    valid: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  }
}

// ==============================================================================
// Sanitization Functions
// ==============================================================================

/**
 * Sanitize address data before saving to database
 */
export function sanitizeAddress(input: Partial<Address>): Address | null {
  try {
    // Build full_address if not provided
    const fullAddress = input.full_address || 
      [input.street, input.city, input.province, input.country]
        .filter(Boolean)
        .join(', ')
    
    return AddressSchema.parse({
      ...input,
      full_address: fullAddress
    })
  } catch {
    return null
  }
}

/**
 * Format address for display
 */
export function formatAddress(address: unknown): string {
  const result = AddressSchema.safeParse(address)
  if (!result.success) return '-'
  
  const addr = result.data
  return addr.full_address || 
    [addr.street, addr.city, addr.province, addr.country]
      .filter(Boolean)
      .join(', ')
}
