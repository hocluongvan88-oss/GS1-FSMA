'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play, Shield, CheckCircle2 } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function LandingHero() {
  const { t } = useLocale()
  
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 mb-6">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">{t('landing.hero.badge')}</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance mb-6">
              {t('landing.hero.title')}{' '}
              <span className="text-accent">{t('landing.hero.titleHighlight')}</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 text-pretty max-w-xl mx-auto lg:mx-0">
              {t('landing.hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-8">
              <Link href="/auth/signup">
                <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-base font-semibold gap-2">
                  {t('landing.hero.cta')}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-base font-semibold gap-2 bg-transparent">
                <Play className="w-5 h-5" />
                {t('landing.hero.ctaSecondary')}
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-4 justify-center lg:justify-start text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span>{t('landing.cta.subtitle').split('.')[0]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span>{t('landing.stats.support')}</span>
              </div>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative">
            <div className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
              {/* Mock Dashboard Header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-chart-4/60" />
                  <div className="w-3 h-3 rounded-full bg-accent/60" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">GS1 Traceability Dashboard</span>
              </div>
              
              {/* Mock Dashboard Content */}
              <div className="p-6 space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-foreground">2,847</div>
                    <div className="text-xs text-muted-foreground">Lô sản xuất</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-accent">99.7%</div>
                    <div className="text-xs text-muted-foreground">Tuân thủ</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-foreground">156</div>
                    <div className="text-xs text-muted-foreground">Đối tác</div>
                  </div>
                </div>

                {/* Event Timeline Mock */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="text-sm font-medium text-foreground mb-3">Sự kiện gần đây</div>
                  <div className="space-y-2">
                    {[
                      { type: 'ObjectEvent', location: 'Trang trại Đà Lạt', time: '2 phút trước' },
                      { type: 'TransformEvent', location: 'Nhà máy Long An', time: '15 phút trước' },
                      { type: 'ShippingEvent', location: 'Cảng Cát Lái', time: '1 giờ trước' },
                    ].map((event, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-accent" />
                          <span className="font-medium text-foreground">{event.type}</span>
                        </div>
                        <span className="text-muted-foreground">{event.location}</span>
                        <span className="text-muted-foreground">{event.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* QR Code Mock */}
                <div className="flex items-center gap-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
                  <div className="w-16 h-16 bg-foreground rounded-lg flex items-center justify-center">
                    <div className="w-12 h-12 grid grid-cols-4 gap-0.5">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className={`${Math.random() > 0.5 ? 'bg-background' : 'bg-transparent'}`} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">GS1 Digital Link</div>
                    <div className="text-xs text-muted-foreground">Quét để xem hành trình sản phẩm</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-card rounded-xl border border-border shadow-lg p-3 hidden lg:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">FSMA 204</div>
                  <div className="text-xs text-accent">Đã xác minh</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
