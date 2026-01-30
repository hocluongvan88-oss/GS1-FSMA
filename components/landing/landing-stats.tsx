'use client'

import { useLocale } from '@/lib/locale-context'

export function LandingStats() {
  const { t } = useLocale()
  
  const stats = [
    {
      title: t('landing.stats.compliance'),
      desc: t('landing.stats.complianceDesc'),
    },
    {
      title: t('landing.stats.faster'),
      desc: t('landing.stats.fasterDesc'),
    },
    {
      title: t('landing.stats.accuracy'),
      desc: t('landing.stats.accuracyDesc'),
    },
    {
      title: t('landing.stats.support'),
      desc: t('landing.stats.supportDesc'),
    },
  ]

  return (
    <section className="py-12 border-y border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {stat.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
