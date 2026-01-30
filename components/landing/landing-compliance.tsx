'use client'

import { CheckCircle2, Shield } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function LandingCompliance() {
  const { t, locale } = useLocale()
  
  const standards = [
    {
      title: t('landing.compliance.gs1.title'),
      desc: t('landing.compliance.gs1.desc'),
      status: 90,
    },
    {
      title: t('landing.compliance.fsma.title'),
      desc: t('landing.compliance.fsma.desc'),
      status: 100,
    },
    {
      title: t('landing.compliance.eudr.title'),
      desc: t('landing.compliance.eudr.desc'),
      status: 95,
    },
    {
      title: t('landing.compliance.iso.title'),
      desc: t('landing.compliance.iso.desc'),
      status: 85,
    },
  ]

  return (
    <section id="compliance" className="py-20 md:py-28 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            {t('landing.compliance.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t('landing.compliance.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {standards.map((standard, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{standard.title}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  standard.status === 100 
                    ? 'bg-accent/10 text-accent' 
                    : standard.status >= 90
                    ? 'bg-chart-4/10 text-chart-4'
                    : 'bg-accent/10 text-accent'
                }`}>
                  {standard.status}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {standard.desc}
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-accent h-2 rounded-full transition-all" 
                  style={{ width: `${standard.status}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
