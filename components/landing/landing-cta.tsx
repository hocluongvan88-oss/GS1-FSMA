'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function LandingCTA() {
  const { t } = useLocale()
  
  return (
    <section className="py-20 md:py-28 bg-accent/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
          {t('landing.cta.title')}
        </h2>
        <p className="text-lg text-muted-foreground mb-8 text-pretty">
          {t('landing.cta.subtitle')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/auth/signup">
            <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-base font-semibold gap-2">
              {t('landing.cta.button')}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-base font-semibold gap-2 bg-transparent">
            <Calendar className="w-5 h-5" />
            {t('landing.cta.demo')}
          </Button>
        </div>
      </div>
    </section>
  )
}
