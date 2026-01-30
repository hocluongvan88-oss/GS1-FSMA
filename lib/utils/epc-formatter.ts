/**
 * Format EPC URN to human-readable format
 * Example: urn:epc:id:sgtin:8412345678901.1769783103318 -> "SGTIN: 8412345678901 / 1769783103318"
 */
export function formatEPC(epc: string): string {
  if (!epc || typeof epc !== 'string') return epc

  // Extract type and identifiers from URN
  const match = epc.match(/urn:epc:id:(\w+):(.+)/)
  if (!match) return epc

  const [, type, identifier] = match
  const parts = identifier.split('.')

  switch (type.toUpperCase()) {
    case 'SGTIN':
      // SGTIN: Company Prefix . Item Reference . Serial Number
      return parts.length >= 2 
        ? `${type.toUpperCase()}: ${parts[0]} / ${parts.slice(1).join('.')}`
        : identifier
    case 'SSCC':
      // SSCC: Extension Digit + Company Prefix + Serial Reference
      return `${type.toUpperCase()}: ${identifier}`
    case 'SGLN':
      // SGLN: Company Prefix . Location Reference . Extension
      return parts.length >= 2
        ? `${type.toUpperCase()}: ${parts[0]} / ${parts.slice(1).join('.')}`
        : identifier
    case 'GRAI':
    case 'GIAI':
    case 'GSRN':
    case 'GDTI':
      return `${type.toUpperCase()}: ${identifier}`
    default:
      return `${type}: ${identifier}`
  }
}

/**
 * Format quantity list for display
 */
export function formatQuantity(quantityList: any[]): string {
  if (!Array.isArray(quantityList) || quantityList.length === 0) {
    return 'Không có dữ liệu'
  }

  return quantityList.map((q: any) => {
    const quantity = q.quantity || q.value || 0
    const uom = q.uom || q.unit || ''
    const productName = q.epcClass?.split('.').pop()?.replace(/_/g, ' ') || ''
    
    return `${quantity} ${uom}${productName ? ` (${productName})` : ''}`
  }).join(', ')
}
