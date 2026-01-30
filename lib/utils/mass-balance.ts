/**
 * Mass Balance & Conversion Logic
 * Prevents fraud by validating input/output quantities in transformation events
 */

export interface QuantityItem {
  value: number
  uom: string // Unit of Measure (kg, g, L, ml, pieces, etc.)
  gtin?: string
}

export interface ConversionFactor {
  product: string
  inputUOM: string
  outputUOM: string
  factor: number // C% = (Output / Input) × 100
  tolerance: number // Acceptable variation (e.g., 5% for ±5% tolerance)
}

/**
 * Standard conversion factors for common agricultural products
 */
export const STANDARD_CONVERSION_FACTORS: Record<string, ConversionFactor> = {
  'fresh_to_dried_fruit': {
    product: 'Fruit (Fresh to Dried)',
    inputUOM: 'kg',
    outputUOM: 'kg',
    factor: 15, // 1kg fresh -> ~0.15kg dried (85% water loss)
    tolerance: 5
  },
  'raw_to_processed_meat': {
    product: 'Meat (Raw to Processed)',
    inputUOM: 'kg',
    outputUOM: 'kg',
    factor: 75, // 1kg raw -> ~0.75kg processed (25% loss)
    tolerance: 8
  },
  'raw_coffee_to_roasted': {
    product: 'Coffee (Raw to Roasted)',
    inputUOM: 'kg',
    outputUOM: 'kg',
    factor: 85, // 1kg raw -> ~0.85kg roasted (15% moisture loss)
    tolerance: 3
  },
  'fresh_mango_to_juice': {
    product: 'Mango (Fresh to Juice)',
    inputUOM: 'kg',
    outputUOM: 'L',
    factor: 60, // 1kg mango -> ~0.6L juice (40% pulp/waste)
    tolerance: 10
  }
}

/**
 * Normalize quantity to a base unit (kg for weight, L for volume)
 */
function normalizeQuantity(quantity: QuantityItem): { value: number; baseUOM: string } {
  const { value, uom } = quantity
  
  // Weight conversions
  const weightConversions: Record<string, number> = {
    'kg': 1,
    'g': 0.001,
    'mg': 0.000001,
    'ton': 1000,
    'lb': 0.453592,
    'oz': 0.0283495
  }
  
  // Volume conversions
  const volumeConversions: Record<string, number> = {
    'L': 1,
    'ml': 0.001,
    'gal': 3.78541,
    'fl_oz': 0.0295735
  }
  
  if (uom in weightConversions) {
    return {
      value: value * weightConversions[uom],
      baseUOM: 'kg'
    }
  }
  
  if (uom in volumeConversions) {
    return {
      value: value * volumeConversions[uom],
      baseUOM: 'L'
    }
  }
  
  // If not recognized, assume it's already in base unit
  return { value, baseUOM: uom }
}

/**
 * Calculate conversion factor from input to output
 * C% = (Total Output / Total Input) × 100
 */
export function calculateConversionFactor(
  inputQuantities: QuantityItem[],
  outputQuantities: QuantityItem[]
): number {
  // Sum all inputs (normalized to base units)
  const totalInput = inputQuantities.reduce((sum, item) => {
    const normalized = normalizeQuantity(item)
    return sum + normalized.value
  }, 0)
  
  // Sum all outputs (normalized to base units)
  const totalOutput = outputQuantities.reduce((sum, item) => {
    const normalized = normalizeQuantity(item)
    return sum + normalized.value
  }, 0)
  
  if (totalInput === 0) {
    throw new Error('Total input cannot be zero')
  }
  
  // Return as percentage
  return (totalOutput / totalInput) * 100
}

/**
 * Validate mass balance for a transformation event
 * Returns anomaly if output exceeds expected maximum
 */
export function validateMassBalance(params: {
  inputQuantities: QuantityItem[]
  outputQuantities: QuantityItem[]
  expectedConversionFactor: number // Expected C% (e.g., 75 for 75% yield)
  tolerance?: number // Acceptable variance (default 10%)
}): {
  valid: boolean
  actualConversionFactor: number
  expectedRange: { min: number; max: number }
  anomaly?: string
  severity?: 'warning' | 'critical'
} {
  const { inputQuantities, outputQuantities, expectedConversionFactor, tolerance = 10 } = params
  
  const actualFactor = calculateConversionFactor(inputQuantities, outputQuantities)
  
  // Calculate acceptable range
  const minFactor = expectedConversionFactor - tolerance
  const maxFactor = expectedConversionFactor + tolerance
  
  let valid = true
  let anomaly: string | undefined
  let severity: 'warning' | 'critical' | undefined
  
  if (actualFactor < minFactor) {
    valid = false
    anomaly = `Output is ${(expectedConversionFactor - actualFactor).toFixed(1)}% below expected (possible waste or quality issues)`
    severity = actualFactor < (expectedConversionFactor - tolerance * 2) ? 'critical' : 'warning'
  } else if (actualFactor > maxFactor) {
    valid = false
    anomaly = `Output is ${(actualFactor - expectedConversionFactor).toFixed(1)}% above expected (FRAUD ALERT: Possible undeclared input)`
    severity = 'critical' // Over-production is always critical (fraud indicator)
  }
  
  return {
    valid,
    actualConversionFactor: actualFactor,
    expectedRange: { min: minFactor, max: maxFactor },
    anomaly,
    severity
  }
}

/**
 * Get standard conversion factor for a product type
 */
export function getStandardConversionFactor(
  productKey: string
): ConversionFactor | null {
  return STANDARD_CONVERSION_FACTORS[productKey] || null
}

/**
 * Validate transformation event with mass balance check
 */
export function validateTransformationEvent(params: {
  inputQuantities: QuantityItem[]
  outputQuantities: QuantityItem[]
  productType?: string // Key to lookup standard conversion factor
  customConversionFactor?: number
  tolerance?: number
}): {
  valid: boolean
  conversionFactor: number
  anomalies: string[]
  warnings: string[]
} {
  const { inputQuantities, outputQuantities, productType, customConversionFactor, tolerance } = params
  
  const anomalies: string[] = []
  const warnings: string[] = []
  
  // Check if quantities are provided
  if (inputQuantities.length === 0) {
    anomalies.push('No input quantities provided')
  }
  if (outputQuantities.length === 0) {
    anomalies.push('No output quantities provided')
  }
  
  if (anomalies.length > 0) {
    return {
      valid: false,
      conversionFactor: 0,
      anomalies,
      warnings
    }
  }
  
  // Calculate actual conversion factor
  const actualFactor = calculateConversionFactor(inputQuantities, outputQuantities)
  
  // Get expected conversion factor
  let expectedFactor = customConversionFactor
  let expectedTolerance = tolerance || 10
  
  if (!expectedFactor && productType) {
    const standard = getStandardConversionFactor(productType)
    if (standard) {
      expectedFactor = standard.factor
      expectedTolerance = standard.tolerance
    }
  }
  
  // Validate if we have an expected factor
  if (expectedFactor) {
    const validation = validateMassBalance({
      inputQuantities,
      outputQuantities,
      expectedConversionFactor: expectedFactor,
      tolerance: expectedTolerance
    })
    
    if (!validation.valid) {
      if (validation.severity === 'critical') {
        anomalies.push(validation.anomaly!)
      } else {
        warnings.push(validation.anomaly!)
      }
    }
  }
  
  return {
    valid: anomalies.length === 0,
    conversionFactor: actualFactor,
    anomalies,
    warnings
  }
}

/**
 * Calculate expected output based on input and conversion factor
 */
export function calculateExpectedOutput(
  inputQuantities: QuantityItem[],
  conversionFactor: number
): number {
  const totalInput = inputQuantities.reduce((sum, item) => {
    const normalized = normalizeQuantity(item)
    return sum + normalized.value
  }, 0)
  
  return (totalInput * conversionFactor) / 100
}
