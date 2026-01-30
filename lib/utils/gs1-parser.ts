/**
 * GS1 Barcode Parser
 * Parses GS1 Application Identifiers (AI) from barcodes
 * Based on GS1 General Specifications
 */

export interface GS1ParseResult {
  valid: boolean
  data: Record<string, string>
  raw: string
  errors: string[]
}

export interface ApplicationIdentifier {
  ai: string
  description: string
  dataTitle: string
  format: string
  length: number | 'variable'
  checkDigit?: boolean
}

// GS1 Application Identifiers (Most common ones)
export const AI_DEFINITIONS: Record<string, ApplicationIdentifier> = {
  '01': { ai: '01', description: 'GTIN', dataTitle: 'GTIN', format: 'N14', length: 14, checkDigit: true },
  '10': { ai: '10', description: 'Batch/Lot Number', dataTitle: 'BATCH/LOT', format: 'X..20', length: 'variable' },
  '11': { ai: '11', description: 'Production Date (YYMMDD)', dataTitle: 'PROD DATE', format: 'N6', length: 6 },
  '13': { ai: '13', description: 'Packaging Date (YYMMDD)', dataTitle: 'PACK DATE', format: 'N6', length: 6 },
  '15': { ai: '15', description: 'Best Before Date (YYMMDD)', dataTitle: 'BEST BEFORE', format: 'N6', length: 6 },
  '17': { ai: '17', description: 'Expiry Date (YYMMDD)', dataTitle: 'USE BY', format: 'N6', length: 6 },
  '21': { ai: '21', description: 'Serial Number', dataTitle: 'SERIAL', format: 'X..20', length: 'variable' },
  '310': { ai: '310', description: 'Net Weight (kg)', dataTitle: 'NET WEIGHT (kg)', format: 'N6', length: 6 },
  '3100': { ai: '3100', description: 'Net Weight (kg) with 0 decimals', dataTitle: 'NET WEIGHT (kg)', format: 'N6', length: 6 },
  '3101': { ai: '3101', description: 'Net Weight (kg) with 1 decimal', dataTitle: 'NET WEIGHT (kg)', format: 'N6', length: 6 },
  '3102': { ai: '3102', description: 'Net Weight (kg) with 2 decimals', dataTitle: 'NET WEIGHT (kg)', format: 'N6', length: 6 },
  '3103': { ai: '3103', description: 'Net Weight (kg) with 3 decimals', dataTitle: 'NET WEIGHT (kg)', format: 'N6', length: 6 },
  '37': { ai: '37', description: 'Count of Trade Items', dataTitle: 'COUNT', format: 'N..8', length: 'variable' },
  '400': { ai: '400', description: 'Customer Purchase Order Number', dataTitle: 'ORDER NUMBER', format: 'X..30', length: 'variable' },
  '410': { ai: '410', description: 'Ship To / Deliver To GLN', dataTitle: 'SHIP TO LOC', format: 'N13', length: 13, checkDigit: true },
  '414': { ai: '414', description: 'Identification of Physical Location - GLN', dataTitle: 'LOC No', format: 'N13', length: 13, checkDigit: true },
  '421': { ai: '421', description: 'Ship To / Deliver To Postal Code', dataTitle: 'SHIP TO POST', format: 'X..12', length: 'variable' },
  '422': { ai: '422', description: 'Country of Origin', dataTitle: 'ORIGIN', format: 'N3', length: 3 },
  '7003': { ai: '7003', description: 'Expiry Date and Time', dataTitle: 'EXPIRY TIME', format: 'N10', length: 10 },
  '8003': { ai: '8003', description: 'GRAI', dataTitle: 'GRAI', format: 'N14+X..16', length: 'variable' },
  '8004': { ai: '8004', description: 'GIAI', dataTitle: 'GIAI', format: 'X..30', length: 'variable' },
  '8006': { ai: '8006', description: 'ITIP', dataTitle: 'ITIP', format: 'N18', length: 18 },
  '8017': { ai: '8017', description: 'GSRN', dataTitle: 'GSRN', format: 'N18', length: 18 },
  '8018': { ai: '8018', description: 'GSRN PROVIDER', dataTitle: 'GSRN PROVIDER', format: 'N18', length: 18 },
  '8020': { ai: '8020', description: 'Payment Slip Reference Number', dataTitle: 'REF No', format: 'X..25', length: 'variable' },
}

/**
 * Parse GS1 barcode string (from QR, DataMatrix, etc.)
 */
export function parseGS1Barcode(barcode: string): GS1ParseResult {
  const result: GS1ParseResult = {
    valid: false,
    data: {},
    raw: barcode,
    errors: []
  }

  if (!barcode || barcode.length === 0) {
    result.errors.push('Empty barcode')
    return result
  }

  // Remove FNC1 character if present (can be ']', or other control characters)
  let cleanBarcode = barcode.replace(/^\]C1/, '').replace(/^\]d2/, '').replace(/^\]e0/, '')
  
  let position = 0
  
  while (position < cleanBarcode.length) {
    // Try to find matching AI
    let foundAI: ApplicationIdentifier | null = null
    let aiString = ''
    
    // Try AIs from longest to shortest (4 chars, 3 chars, 2 chars)
    for (let aiLength = 4; aiLength >= 2; aiLength--) {
      const candidateAI = cleanBarcode.substring(position, position + aiLength)
      if (AI_DEFINITIONS[candidateAI]) {
        foundAI = AI_DEFINITIONS[candidateAI]
        aiString = candidateAI
        break
      }
    }
    
    if (!foundAI) {
      result.errors.push(`Unknown AI at position ${position}: ${cleanBarcode.substring(position, position + 4)}`)
      break
    }
    
    position += aiString.length
    
    // Extract data
    let dataValue = ''
    
    if (foundAI.length === 'variable') {
      // Variable length: look for separator (GS character, ASCII 29) or end of string
      const gsPosition = cleanBarcode.indexOf(String.fromCharCode(29), position)
      if (gsPosition !== -1) {
        dataValue = cleanBarcode.substring(position, gsPosition)
        position = gsPosition + 1 // Skip GS character
      } else {
        dataValue = cleanBarcode.substring(position) // Rest of string
        position = cleanBarcode.length
      }
    } else {
      // Fixed length
      dataValue = cleanBarcode.substring(position, position + foundAI.length)
      position += foundAI.length
    }
    
    // Store parsed data
    result.data[aiString] = dataValue
    
    // Validate data format
    if (foundAI.format.startsWith('N')) {
      // Should be numeric
      if (!/^\d+$/.test(dataValue)) {
        result.errors.push(`AI ${aiString} should be numeric, got: ${dataValue}`)
      }
    }
    
    // Validate check digit if required
    if (foundAI.checkDigit) {
      const { validateGTIN, validateGLN } = require('./gs1-validation')
      let validation
      
      if (aiString === '01') {
        validation = validateGTIN(dataValue)
      } else if (aiString === '410' || aiString === '414') {
        validation = validateGLN(dataValue)
      }
      
      if (validation && !validation.valid) {
        result.errors.push(`AI ${aiString}: ${validation.error}`)
      }
    }
  }
  
  result.valid = result.errors.length === 0 && Object.keys(result.data).length > 0
  
  return result
}

/**
 * Format GS1 date (YYMMDD) to ISO date string
 */
export function formatGS1Date(gs1Date: string): string | null {
  if (gs1Date.length !== 6 || !/^\d{6}$/.test(gs1Date)) {
    return null
  }
  
  const yy = parseInt(gs1Date.substring(0, 2), 10)
  const mm = parseInt(gs1Date.substring(2, 4), 10)
  const dd = parseInt(gs1Date.substring(4, 6), 10)
  
  // Assume 20XX for years 00-50, 19XX for years 51-99
  const year = yy <= 50 ? 2000 + yy : 1900 + yy
  
  try {
    const date = new Date(year, mm - 1, dd)
    return date.toISOString()
  } catch {
    return null
  }
}

/**
 * Format weight with decimals (AI 310x)
 */
export function formatGS1Weight(ai: string, value: string): number | null {
  if (!ai.startsWith('310') || value.length !== 6) {
    return null
  }
  
  const decimals = parseInt(ai[3], 10)
  const rawValue = parseInt(value, 10)
  
  return rawValue / Math.pow(10, decimals)
}

/**
 * Build EPC URI from parsed GS1 data
 */
export function buildEPCURI(gs1Data: Record<string, string>): string | null {
  const gtin = gs1Data['01']
  const serial = gs1Data['21']
  
  if (!gtin) {
    return null
  }
  
  // SGTIN format: urn:epc:id:sgtin:CompanyPrefix.ItemRef.SerialNumber
  // Extract company prefix (first 7-10 digits) and item reference
  // For simplicity, assume 7-digit company prefix
  const companyPrefix = gtin.substring(1, 8) // Skip indicator digit
  const itemRef = gtin.substring(8, 13) // Without check digit
  
  if (serial) {
    return `urn:epc:id:sgtin:${companyPrefix}.${itemRef}.${serial}`
  } else {
    // LGTIN (lot-based)
    const lot = gs1Data['10']
    if (lot) {
      return `urn:epc:class:lgtin:${companyPrefix}.${itemRef}.${lot}`
    }
    // Class-level GTIN
    return `urn:epc:idpat:sgtin:${companyPrefix}.${itemRef}.*`
  }
}

/**
 * Convert GS1 barcode data to EPCIS-compatible object
 */
export function gs1ToEPCIS(gs1Data: Record<string, string>) {
  const epcisData: any = {}
  
  // GTIN -> EPC
  if (gs1Data['01']) {
    epcisData.gtin = gs1Data['01']
    epcisData.epc = buildEPCURI(gs1Data)
  }
  
  // Batch/Lot
  if (gs1Data['10']) {
    epcisData.lot = gs1Data['10']
  }
  
  // Serial Number
  if (gs1Data['21']) {
    epcisData.serial = gs1Data['21']
  }
  
  // Production Date
  if (gs1Data['11']) {
    epcisData.productionDate = formatGS1Date(gs1Data['11'])
  }
  
  // Expiry Date
  if (gs1Data['17']) {
    epcisData.expiryDate = formatGS1Date(gs1Data['17'])
  }
  
  // Best Before Date
  if (gs1Data['15']) {
    epcisData.bestBeforeDate = formatGS1Date(gs1Data['15'])
  }
  
  // Weight
  for (const ai of Object.keys(gs1Data)) {
    if (ai.startsWith('310')) {
      epcisData.netWeightKg = formatGS1Weight(ai, gs1Data[ai])
    }
  }
  
  // Location (GLN)
  if (gs1Data['414']) {
    epcisData.locationGLN = gs1Data['414']
  }
  
  // Ship To Location
  if (gs1Data['410']) {
    epcisData.shipToGLN = gs1Data['410']
  }
  
  return epcisData
}

/**
 * Validate and parse GS1 barcode with full error handling
 */
export function parseAndValidateGS1(barcode: string): {
  valid: boolean
  parsed: Record<string, string>
  epcis: any
  errors: string[]
  warnings: string[]
} {
  const result = parseGS1Barcode(barcode)
  const warnings: string[] = []
  
  // Check for required fields
  if (result.valid && !result.data['01']) {
    warnings.push('GTIN (AI 01) is recommended for traceability')
  }
  
  if (result.valid && !result.data['10'] && !result.data['21']) {
    warnings.push('Batch/Lot (AI 10) or Serial (AI 21) is recommended for item-level traceability')
  }
  
  const epcis = result.valid ? gs1ToEPCIS(result.data) : null
  
  return {
    valid: result.valid,
    parsed: result.data,
    epcis,
    errors: result.errors,
    warnings
  }
}
