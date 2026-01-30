/**
 * GS1 Identifier Validation Utilities
 * Implements Modulo-10 Check Digit Algorithm per GS1 General Specifications
 */

/**
 * Calculate GS1 Check Digit using Modulo-10 algorithm
 * @param digits - String of digits without check digit (e.g., "0123456789012" for GTIN-14)
 * @returns Check digit (0-9)
 */
export function calculateCheckDigit(digits: string): number {
  if (!/^\d+$/.test(digits)) {
    throw new Error('Input must contain only digits')
  }

  // Step 1: Đánh số vị trí từ phải sang trái (bắt đầu từ 1)
  const reversed = digits.split('').reverse()
  
  // Step 2: Tổng các chữ số ở vị trí lẻ (position 1, 3, 5...) nhân với 3
  let sumOdd = 0
  // Step 3: Tổng các chữ số ở vị trí chẵn (position 2, 4, 6...)
  let sumEven = 0
  
  for (let i = 0; i < reversed.length; i++) {
    const digit = parseInt(reversed[i], 10)
    if ((i + 1) % 2 === 1) {
      // Vị trí lẻ
      sumOdd += digit
    } else {
      // Vị trí chẵn
      sumEven += digit
    }
  }
  
  // Step 4: Cộng hai kết quả
  const total = (sumOdd * 3) + sumEven
  
  // Step 5: Tìm số nhỏ nhất để tổng chia hết cho 10
  const checkDigit = (10 - (total % 10)) % 10
  
  return checkDigit
}

/**
 * Validate GS1 identifier with check digit
 * @param identifier - Full identifier including check digit (GTIN, GLN, SSCC)
 * @returns true if valid, false otherwise
 */
export function validateGS1Identifier(identifier: string): boolean {
  if (!/^\d+$/.test(identifier)) {
    return false
  }

  if (identifier.length < 8) {
    return false // Minimum GTIN-8
  }

  // Extract check digit (last digit)
  const checkDigit = parseInt(identifier[identifier.length - 1], 10)
  
  // Calculate expected check digit
  const withoutCheck = identifier.slice(0, -1)
  const expectedCheck = calculateCheckDigit(withoutCheck)
  
  return checkDigit === expectedCheck
}

/**
 * Validate GTIN (Global Trade Item Number)
 * Valid lengths: 8, 12, 13, 14 digits
 */
export function validateGTIN(gtin: string): { valid: boolean; error?: string } {
  const validLengths = [8, 12, 13, 14]
  
  if (!validLengths.includes(gtin.length)) {
    return {
      valid: false,
      error: `GTIN must be 8, 12, 13, or 14 digits (provided: ${gtin.length})`
    }
  }
  
  if (!validateGS1Identifier(gtin)) {
    return {
      valid: false,
      error: 'Invalid GTIN check digit'
    }
  }
  
  return { valid: true }
}

/**
 * Validate GLN (Global Location Number)
 * Must be exactly 13 digits
 */
export function validateGLN(gln: string): { valid: boolean; error?: string } {
  if (gln.length !== 13) {
    return {
      valid: false,
      error: `GLN must be exactly 13 digits (provided: ${gln.length})`
    }
  }
  
  if (!validateGS1Identifier(gln)) {
    return {
      valid: false,
      error: 'Invalid GLN check digit'
    }
  }
  
  return { valid: true }
}

/**
 * Validate SSCC (Serial Shipping Container Code)
 * Must be exactly 18 digits
 */
export function validateSSCC(sscc: string): { valid: boolean; error?: string } {
  if (sscc.length !== 18) {
    return {
      valid: false,
      error: `SSCC must be exactly 18 digits (provided: ${sscc.length})`
    }
  }
  
  if (!validateGS1Identifier(sscc)) {
    return {
      valid: false,
      error: 'Invalid SSCC check digit'
    }
  }
  
  return { valid: true }
}

/**
 * Generate valid GTIN with check digit
 * @param baseDigits - String of digits without check digit
 * @param targetLength - Desired GTIN length (8, 12, 13, or 14)
 */
export function generateGTIN(baseDigits: string, targetLength: number = 14): string {
  if (![8, 12, 13, 14].includes(targetLength)) {
    throw new Error('Target length must be 8, 12, 13, or 14')
  }
  
  // Pad with zeros to reach target length - 1 (reserve space for check digit)
  const paddedBase = baseDigits.padStart(targetLength - 1, '0')
  
  if (paddedBase.length !== targetLength - 1) {
    throw new Error(`Base digits too long for target length ${targetLength}`)
  }
  
  const checkDigit = calculateCheckDigit(paddedBase)
  return paddedBase + checkDigit
}

/**
 * Extract GTIN from EPC (Electronic Product Code) URI
 * Example: "urn:epc:id:sgtin:0123456.789012.12345" -> "01234567890128"
 */
export function extractGTINFromEPC(epcUri: string): string | null {
  // SGTIN format: urn:epc:id:sgtin:CompanyPrefix.ItemReference.Serial
  const sgtinMatch = epcUri.match(/urn:epc:id:sgtin:(\d+)\.(\d+)\.(\d+)/)
  
  if (sgtinMatch) {
    const companyPrefix = sgtinMatch[1]
    const itemReference = sgtinMatch[2]
    
    // Reconstruct GTIN-14 (add indicator digit '0' at start)
    const baseGTIN = '0' + companyPrefix + itemReference
    const gtin14 = generateGTIN(baseGTIN, 14)
    
    return gtin14
  }
  
  return null
}

/**
 * Parse and validate any GS1 identifier
 */
export function parseGS1Identifier(
  identifier: string,
  type?: 'GTIN' | 'GLN' | 'SSCC'
): { valid: boolean; type?: string; error?: string } {
  if (!type) {
    // Auto-detect type by length
    if ([8, 12, 13, 14].includes(identifier.length)) {
      const gtinResult = validateGTIN(identifier)
      if (gtinResult.valid) {
        return { valid: true, type: 'GTIN' }
      }
      return gtinResult
    }
    
    if (identifier.length === 13) {
      const glnResult = validateGLN(identifier)
      if (glnResult.valid) {
        return { valid: true, type: 'GLN' }
      }
      return glnResult
    }
    
    if (identifier.length === 18) {
      const ssccResult = validateSSCC(identifier)
      if (ssccResult.valid) {
        return { valid: true, type: 'SSCC' }
      }
      return ssccResult
    }
    
    return {
      valid: false,
      error: 'Unknown GS1 identifier type'
    }
  }
  
  // Validate specific type
  switch (type) {
    case 'GTIN':
      return { ...validateGTIN(identifier), type: 'GTIN' }
    case 'GLN':
      return { ...validateGLN(identifier), type: 'GLN' }
    case 'SSCC':
      return { ...validateSSCC(identifier), type: 'SSCC' }
    default:
      return { valid: false, error: 'Invalid type specified' }
  }
}
