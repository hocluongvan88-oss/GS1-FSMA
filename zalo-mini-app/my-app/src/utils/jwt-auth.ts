/**
 * JWT Authentication for Zalo Mini App
 * Integrates with Supabase Auth using proper JWT tokens
 */

import { getAccessToken, getUserInfo } from 'zmp-sdk';
import { createClient } from '@supabase/supabase-js';

export interface ZaloUserInfo {
  id: string;
  name: string;
  avatar?: string;
  idByOA?: string;
}

export interface AuthSession {
  access_token: string;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email?: string;
    zaloId: string;
    fullName: string;
    role: string;
  };
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  zalo_id: string;
  phone?: string;
  full_name: string;
  role: 'farmer' | 'worker' | 'factory_manager' | 'admin';
  assigned_location?: string;
  avatar_url?: string;
}

/**
 * CẤU HÌNH HỆ THỐNG VEXIM GLOBAL
 * Đã cập nhật dựa trên thông tin thực tế từ Supabase của bạn
 */
const SUPABASE_PROJECT_ID = 'wsjckcqeuiyheomfcaok'; 
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const API_URL = import.meta.env.VITE_API_URL || `${SUPABASE_URL}/functions/v1`;

// Export Supabase client for use in components
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Get Zalo user access token
 */
export async function getZaloAccessToken(): Promise<string> {
  try {
    const { token } = await getAccessToken({});
    return token;
  } catch (error) {
    console.error('[Zalo Auth] Failed to get access token:', error);
    throw new Error('Failed to authenticate with Zalo');
  }
}

/**
 * Get Zalo user information
 */
export async function getZaloUserInfo(): Promise<ZaloUserInfo> {
  try {
    const { userInfo } = await getUserInfo({});
    return {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      idByOA: userInfo.idByOA
    };
  } catch (error) {
    console.error('[Zalo Auth] Failed to get user info:', error);
    throw new Error('Failed to get user information');
  }
}

/**
 * Exchange Zalo token for Supabase session
 */
export async function exchangeZaloTokenForSupabase(
  zaloToken: string,
  userInfo: ZaloUserInfo
): Promise<AuthSession> {
  try {
    // Gọi đến Edge Function 'zalo-exchange' trên Supabase của Vexim
    const response = await fetch(`${API_URL}/zalo-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zaloToken,
        userInfo
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Hệ thống Vexim chưa phản hồi xác thực');
    }

    const data = await response.json();
    
    // Đồng bộ hóa các định dạng token
    const session: AuthSession = {
        ...data,
        access_token: data.access_token || data.accessToken,
        accessToken: data.accessToken || data.access_token
    };
    
    localStorage.setItem('auth_session', JSON.stringify(session));
    return session;
  } catch (error: any) {
    console.error('[JWT Auth] Token exchange failed:', error);
    throw new Error('Đăng nhập thất bại: ' + error.message);
  }
}

/**
 * Initialize authentication
 */
export async function initializeAuth(): Promise<AuthSession> {
  try {
    const zaloToken = await getZaloAccessToken();
    const userInfo = await getZaloUserInfo();
    const session = await exchangeZaloTokenForSupabase(zaloToken, userInfo);
    return session;
  } catch (error) {
    console.error('[JWT Auth] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get current session from localStorage
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem('auth_session');
    if (!stored) return null;
    
    const session: AuthSession = JSON.parse(stored);
    if (session.expiresAt && session.expiresAt < Date.now()) {
      localStorage.removeItem('auth_session');
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Sign out
 */
export function signOut(): void {
  localStorage.removeItem('auth_session');
}

/**
 * Get authorization header for API calls
 */
export function getAuthHeader(): Record<string, string> {
  const session = getCurrentSession();
  if (!session) return {};
  
  return {
    'Authorization': `Bearer ${session.access_token || session.accessToken}`
  };
}

export async function getUserProfile(token: string | undefined): Promise<any> {
    if (!token) return null;
    const session = getCurrentSession();
    return session?.user || null;
}

export async function syncOfflineQueue(): Promise<any> {
    // Logic đồng bộ hàng chờ ngoại tuyến
    return { success: 0, failed: 0, errors: [] };
}

/**
 * Authenticate with Zalo - alias for initializeAuth for backward compatibility
 */
export const authenticateWithZalo = initializeAuth;
