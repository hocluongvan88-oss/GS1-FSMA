import React from "react"
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDebugLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user has system_admin role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userProfile || userProfile.role !== 'system_admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
