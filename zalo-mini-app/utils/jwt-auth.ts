/**
 * JWT Authentication for Zalo Mini App
 * Integrates with Supabase Auth using proper JWT tokens
 */

import { api } from 'zmp-sdk'

export interface ZaloUserInfo {
  id: string
  name: string
  avatar?: string
  idByOA?: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email?: string
    zaloId: string
    fullName: string
    role: string
  }
  expiresAt: number
}

/**
 * Get Zalo user access token
 */
export async function getZaloAccessToken(): Promise<string> {
  try {
    const { token } = await api.getAccessToken({})
    return token
  } catch (error) {
    console.error('[Zalo Auth] Failed to get access token:', error)
    throw new Error('Failed to authenticate with Zalo')
  }
}

/**
 * Get Zalo user information
 */
export async function getZaloUserInfo(): Promise<ZaloUserInfo> {
  try {
    const { userInfo } = await api.getUserInfo({})
    return {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      idByOA: userInfo.idByOA
    }
  } catch (error) {
    console.error('[Zalo Auth] Failed to get user info:', error)
    throw new Error('Failed to get user information')
  }
}

/**
 * Exchange Zalo token for Supabase session
 * Calls backend API to verify Zalo token and create/get user
 */
export async function exchangeZaloTokenForSupabase(
  zaloToken: string,
  userInfo: ZaloUserInfo
): Promise<AuthSession> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/zalo-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zaloToken,
        userInfo
      })
    })

    if (!response.ok) {
      throw new Error('Failed to exchange token')
    }

    const session: AuthSession = await response.json()
    
    // Store session in localStorage
    localStorage.setItem('auth_session', JSON.stringify(session))
    
    return session
  } catch (error) {
    console.error('[JWT Auth] Token exchange failed:', error)
    throw new Error('Authentication failed')
  }
}

/**
 * Initialize authentication
 * Gets Zalo token and exchanges for Supabase session
 */
export async function initializeAuth(): Promise<AuthSession> {
  try {
    // Get Zalo access token
    const zaloToken = await getZaloAccessToken()
    
    // Get user info
    const userInfo = await getZaloUserInfo()
    
    // Exchange for Supabase session
    const session = await exchangeZaloTokenForSupabase(zaloToken, userInfo)
    
    return session
  } catch (error) {
    console.error('[JWT Auth] Initialization failed:', error)
    throw error
  }
}

/**
 * Get current session from localStorage
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem('auth_session')
    if (!stored) return null
    
    const session: AuthSession = JSON.parse(stored)
    
    // Check if token is expired
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem('auth_session')
      return null
    }
    
    return session
  } catch {
    return null
  }
}

/**
 * Refresh session if needed
 */
export async function refreshSessionIfNeeded(): Promise<AuthSession | null> {
  const session = getCurrentSession()
  
  if (!session) {
    return null
  }
  
  // Refresh if expiring within 5 minutes
  const fiveMinutes = 5 * 60 * 1000
  if (session.expiresAt - Date.now() < fiveMinutes) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.refreshToken}`
        }
      })
      
      if (response.ok) {
        const newSession: AuthSession = await response.json()
        localStorage.setItem('auth_session', JSON.stringify(newSession))
        return newSession
      }
    } catch (error) {
      console.error('[JWT Auth] Refresh failed:', error)
    }
  }
  
  return session
}

/**
 * Sign out
 */
export function signOut(): void {
  localStorage.removeItem('auth_session')
}

/**
 * Get authorization header for API calls
 */
export function getAuthHeader(): Record<string, string> {
  const session = getCurrentSession()
  if (!session) {
    return {}
  }
  
  return {
    'Authorization': `Bearer ${session.accessToken}`
  }
}
