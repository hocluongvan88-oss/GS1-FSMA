/**
 * Zalo Authentication Integration with Supabase
 * Handles Zalo Mini App login and sync with Supabase Auth
 */

import { authorize, getUserInfo } from 'zmp-sdk/apis';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ZaloUserInfo {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
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
 * Authenticate with Zalo and sync with Supabase
 */
export async function authenticateWithZalo(): Promise<{
  zaloUser: ZaloUserInfo;
  supabaseUser: UserProfile | null;
  isNewUser: boolean;
}> {
  try {
    // Step 1: Get Zalo authorization
    const { userInfo: authInfo } = await authorize({
      scopes: ['scope.userInfo', 'scope.userPhonenumber']
    });

    // Step 2: Get detailed user info
    const { userInfo } = await getUserInfo({});

    const zaloUser: ZaloUserInfo = {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      phone: authInfo.phone
    };

    // Step 3: Check if user exists in Supabase
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('zalo_id', zaloUser.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    let supabaseUser: UserProfile | null = existingUser;
    let isNewUser = false;

    // Step 4: Create user if doesn't exist
    if (!existingUser) {
      // Sign in anonymously first to get a Supabase user ID
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) throw authError;

      // Create user profile
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          zalo_id: zaloUser.id,
          phone: zaloUser.phone,
          full_name: zaloUser.name,
          avatar_url: zaloUser.avatar,
          role: 'worker', // Default role, can be changed by admin
          metadata: { onboarded: false }
        })
        .select()
        .single();

      if (createError) throw createError;

      supabaseUser = newUser;
      isNewUser = true;
    } else {
      // Sign in existing user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: `${zaloUser.id}@zalo.local`,
        password: zaloUser.id // In production, use proper password handling
      });

      if (signInError) {
        // If sign-in fails, user might need to be migrated
        console.error('Sign-in error:', signInError);
      }
    }

    return { zaloUser, supabaseUser, isNewUser };
  } catch (error) {
    console.error('Zalo authentication error:', error);
    throw error;
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return profile;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Update user profile error:', error);
    return null;
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
