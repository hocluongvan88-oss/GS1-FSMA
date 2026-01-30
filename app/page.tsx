'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/data/supabase-client'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingStats } from '@/components/landing/landing-stats'
import { LandingFeatures } from '@/components/landing/landing-features'
import { LandingCompliance } from '@/components/landing/landing-compliance'
import { LandingIndustries } from '@/components/landing/landing-industries'
import { LandingCTA } from '@/components/landing/landing-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function LandingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          router.push('/dashboard')
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('[v0] Auth check error:', error)
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingCompliance />
        <LandingIndustries />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  )
}
