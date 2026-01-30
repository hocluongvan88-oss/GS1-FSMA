'use client'

import { LogOut, User, Settings, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase/client'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { useLocale } from '@/lib/locale-context'
import { createClient } from '@/lib/supabase/client' // Declare the createClient variable

interface UserData {
  id: string
  email?: string
  full_name?: string | null
  role: string
}

export function SidebarUserMenu() {
  const router = useRouter()
  const { t } = useLocale()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      const supabaseClient = createClient() // Use the declared createClient variable
      
      try {
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser()
        
        if (authError || !authUser) {
          setLoading(false)
          return
        }
        
        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('id, full_name, role')
          .eq('id', authUser.id)
          .single()
        
        if (userError) {
          setUser({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || null,
            role: authUser.user_metadata?.role || 'customer'
          })
        } else if (userData) {
          setUser({
            id: userData.id,
            email: authUser.email,
            full_name: userData.full_name,
            role: userData.role
          })
        }
      } catch (error) {
        console.error('[v0] Failed to load user:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (loading || !user) {
    return (
      <div className="flex items-center gap-3 px-2 py-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-muted">...</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse mt-1" />
        </div>
      </div>
    )
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email?.slice(0, 2).toUpperCase() || 'U'
  }

  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      system_admin: t('roles.systemAdmin'),
      admin: t('roles.admin'),
      factory_manager: t('roles.factoryManager'),
      quality_inspector: t('roles.qualityInspector'),
      logistics_manager: t('roles.logisticsManager'),
      worker: t('roles.worker'),
      farmer: t('roles.farmer'),
      auditor: t('roles.auditor'),
      customer: t('roles.customer'),
    }
    return roleMap[role] || role
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="h-auto py-2 px-2 hover:bg-sidebar-accent">
          <div className="flex items-center gap-3 w-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium leading-none truncate">
                {user.full_name || user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-1">
                {getRoleDisplay(user.role)}
              </p>
            </div>
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.full_name || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">
              {getRoleDisplay(user.role)}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>{t('profile.title')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t('common.settings')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('auth.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
