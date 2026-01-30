'use client'

import React from 'react'
import { useUser, usePermission, useAnyPermission, useRole, useAnyRole } from '@/lib/auth/hooks'
import type { Permission, UserRole } from '@/lib/auth/permissions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface PermissionGateProps {
  children: React.ReactNode
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean
  role?: UserRole
  roles?: UserRole[]
  fallback?: React.ReactNode
  showAlert?: boolean
}

/**
 * Component to conditionally render based on permissions
 * 
 * Usage:
 * <PermissionGate permission="event:create">
 *   <Button>Create Event</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  fallback = null,
  showAlert = false,
}: PermissionGateProps) {
  const { user, loading } = useUser()
  const hasPermission = usePermission(permission!)
  const hasAnyPerm = useAnyPermission(permissions || [])
  const hasRole = useRole(role!)
  const hasAnyRole = useAnyRole(roles || [])

  const checkMultiplePermissions = () => {
    if (permissions && permissions.length > 0) {
      if (requireAll) {
        // Require all permissions
        return permissions.every(p => hasPermission)
      } else {
        // Require any permission
        return hasAnyPerm
      }
    }
    return false
  }

  const checkMultipleRoles = () => {
    if (roles && roles.length > 0) {
      return hasAnyRole
    }
    return false
  }

  if (loading) {
    return null
  }

  if (!user) {
    return showAlert ? (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please log in to access this feature.</AlertDescription>
      </Alert>
    ) : null
  }

  let hasAccess = false

  // Check permission
  if (permission && hasPermission) {
    hasAccess = true
  }

  // Check multiple permissions
  if (checkMultiplePermissions()) {
    hasAccess = true
  }

  // Check role
  if (role && hasRole) {
    hasAccess = true
  }

  // Check multiple roles
  if (checkMultipleRoles()) {
    hasAccess = true
  }

  if (!hasAccess) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      )
    }
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Component to show user role badge
 */
export function RoleBadge() {
  const { user } = useUser()

  if (!user) return null

  const roleColors: Record<UserRole, string> = {
    system_admin: 'bg-purple-500',
    admin: 'bg-red-500',
    factory_manager: 'bg-blue-500',
    quality_inspector: 'bg-green-500',
    logistics_manager: 'bg-yellow-500',
    worker: 'bg-gray-500',
    farmer: 'bg-orange-500',
    auditor: 'bg-indigo-500',
    customer: 'bg-pink-500',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${roleColors[user.role]}`}>
      {user.role}
    </span>
  )
}

/**
 * Simplified component to require authentication and optionally a specific permission
 * If no action is provided, it only requires the user to be logged in
 */
export function RequirePermission({ 
  action, 
  children 
}: { 
  action?: Permission
  children: React.ReactNode 
}) {
  const { user, loading } = useUser()

  if (loading) {
    return null
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>Please log in to access this feature.</AlertDescription>
      </Alert>
    )
  }

  // If no specific permission required, just check authentication
  if (!action) {
    return <>{children}</>
  }

  return (
    <PermissionGate permission={action} showAlert>
      {children}
    </PermissionGate>
  )
}

/**
 * Simplified component to require a specific role
 */
export function RequireRole({ 
  roles, 
  children 
}: { 
  roles: UserRole[]
  children: React.ReactNode 
}) {
  return (
    <PermissionGate roles={roles} showAlert>
      {children}
    </PermissionGate>
  )
}
