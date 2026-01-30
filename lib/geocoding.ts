/**
 * Geocoding utility for automatic address-to-coordinates conversion
 * Complies with GS1 EPCIS 2.0 location requirements
 */

export interface GeocodingResult {
  latitude: number
  longitude: number
  formattedAddress: string
  confidence: 'high' | 'medium' | 'low'
}

export interface AddressComponents {
  street?: string
  city?: string
  province?: string
  country?: string
  postalCode?: string
}

/**
 * Geocode an address using Nominatim (OpenStreetMap) API
 * Free tier, no API key required, suitable for Vietnam addresses
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  try {
    // Nominatim API with proper user agent
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: address,
          format: 'json',
          limit: '1',
          countrycodes: 'vn', // Focus on Vietnam for better accuracy
        }),
      {
        headers: {
          'User-Agent': 'GS1-Traceability-Platform/1.0',
        },
      }
    )

    if (!response.ok) {
      console.error('[v0] Geocoding API error:', response.status)
      return null
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      console.log('[v0] No geocoding results found for:', address)
      return null
    }

    const result = data[0]

    // Determine confidence based on importance score
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (result.importance > 0.6) confidence = 'high'
    else if (result.importance > 0.4) confidence = 'medium'

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formattedAddress: result.display_name,
      confidence,
    }
  } catch (error) {
    console.error('[v0] Geocoding error:', error)
    return null
  }
}

/**
 * Reverse geocode coordinates to address
 * Useful for validation and display
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
        new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          format: 'json',
        }),
      {
        headers: {
          'User-Agent': 'GS1-Traceability-Platform/1.0',
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    return data.display_name || null
  } catch (error) {
    console.error('[v0] Reverse geocoding error:', error)
    return null
  }
}

/**
 * Format address components into a searchable string
 */
export function formatAddress(components: AddressComponents): string {
  const parts = [
    components.street,
    components.city,
    components.province,
    components.country,
  ].filter(Boolean)

  return parts.join(', ')
}

/**
 * Validate coordinates are within Vietnam bounds
 */
export function isValidVietnamCoordinates(
  latitude: number,
  longitude: number
): boolean {
  // Vietnam approximate bounds
  const VIETNAM_BOUNDS = {
    minLat: 8.0,
    maxLat: 24.0,
    minLng: 102.0,
    maxLng: 110.0,
  }

  return (
    latitude >= VIETNAM_BOUNDS.minLat &&
    latitude <= VIETNAM_BOUNDS.maxLat &&
    longitude >= VIETNAM_BOUNDS.minLng &&
    longitude <= VIETNAM_BOUNDS.maxLng
  )
}
