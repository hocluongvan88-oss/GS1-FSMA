'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/data/supabase-client'
import type { UserRole, Permission } from './permissions'
import { hasPermission, hasAnyPermission, hasAllPermissions } from './permissions'

export interface User {
  id: string
  email: string | undefined
  full_name: string
  role: UserRole
  phone?: string
  avatar_url?: string
  assigned_location?: string
  metadata?: Record<string, any>
}

/**
 * Hook to get current user and role
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()

          if (userData) {
            setUser({
              id: authUser.id,
              email: authUser.email,
              full_name: userData.full_name,
              role: userData.role as UserRole,
              phone: userData.phone,
              avatar_url: userData.avatar_url,
              assigned_location: userData.assigned_location,
              metadata: userData.metadata,
            })
          }
        }
      } catch (error) {
        console.error('[v0] Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

/**
 * Hook to check if user has a specific permission
 */
export function usePermission(permission: Permission): boolean {
  const { user } = useUser()

  if (!user) return false

  return hasPermission(user.role, permission)
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { user } = useUser()

  if (!user) return false

  return hasAnyPermission(user.role, permissions)
}

/**
 * Hook to check if user has all of the specified permissions
 */
export function useAllPermissions(permissions: Permission[]): boolean {
  const { user } = useUser()

  if (!user) return false

  return hasAllPermissions(user.role, permissions)
}

/**
 * Hook to check if user has a specific role
 */
export function useRole(role: UserRole): boolean {
  const { user } = useUser()

  return user?.role === role
}

/**
 * Hook to check if user has any of the specified roles
 */
export function useAnyRole(roles: UserRole[]): boolean {
  const { user } = useUser()

  return user ? roles.includes(user.role) : false
}

/**
 * Main auth hook with helper methods
 */
export function useAuth() {
  const { user, loading } = useUser()

  const isAdmin = user?.role === 'system_admin' || user?.role === 'admin'
  const isSystemAdmin = user?.role === 'system_admin'
  const isFactoryManager = user?.role === 'factory_manager'
  const isQualityInspector = user?.role === 'quality_inspector'
  const isLogisticsManager = user?.role === 'logistics_manager'
  const isWorker = user?.role === 'worker'
  const isFarmer = user?.role === 'farmer'
  const isAuditor = user?.role === 'auditor'

  return {
    user,
    loading,
    isAdmin,
    isSystemAdmin,
    isFactoryManager,
    isQualityInspector,
    isLogisticsManager,
    isWorker,
    isFarmer,
    isAuditor,
  }
}
