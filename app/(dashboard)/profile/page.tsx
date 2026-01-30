'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useLocale } from '@/lib/locale-context'

export default function ProfilePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const { t } = useLocale()
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        email: user.email || '',
      })
    }
  }, [user])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id)

      if (error) throw error

      toast.success(t('profile.messages.updateSuccess'))
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || t('profile.messages.updateError'))
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t('profile.loading')}</p>
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

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('profile.subtitle')}</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.sections.profileInfo')}</CardTitle>
            <CardDescription>{t('profile.sections.profileDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(user.full_name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-medium">{user.full_name || 'User'}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('profile.fields.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">{t('profile.fields.emailHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">{t('profile.fields.fullName')}</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder={t('profile.fields.fullNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('profile.fields.phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('profile.fields.phonePlaceholder')}
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? t('profile.actions.updating') : t('profile.actions.update')}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  {t('profile.actions.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.sections.accountInfo')}</CardTitle>
            <CardDescription>{t('profile.sections.accountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">{t('profile.fields.userId')}</p>
              <p className="text-sm text-muted-foreground font-mono">{user.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{t('profile.fields.role')}</p>
              <p className="text-sm text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{t('profile.fields.accountCreated')}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
