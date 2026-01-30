'use client'

import { LogOut, User, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'

interface UserData {
  id: string
  email?: string
  full_name?: string | null
  role: string
}

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          console.error('[v0] Auth error:', authError)
          setLoading(false)
          return
        }
        
        // Query only specific columns to avoid RLS recursion
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('id', authUser.id)
          .single()
        
        if (userError) {
          console.error('[v0] User data error:', userError)
          // Fallback to auth user data only
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
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (loading) {
    return (
      <Button variant="ghost" className="relative h-10 w-10 rounded-full" disabled>
        <Avatar>
          <AvatarFallback className="bg-muted">...</AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  if (!user) {
    return null
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
      system_admin: 'System Admin',
      admin: 'Admin',
      factory_manager: 'Factory Manager',
      quality_inspector: 'Quality Inspector',
      logistics_manager: 'Logistics Manager',
      worker: 'Worker',
      farmer: 'Farmer',
      auditor: 'Auditor',
      customer: 'Customer',
    }
    return roleMap[role] || role
  }

  return (
    <div className="flex items-center gap-3 mr-4">
      <div className="text-right">
        <p className="text-sm font-medium">{user.email}</p>
        <p className="text-xs text-muted-foreground">{getRoleDisplay(user.role)}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
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
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  )
}
