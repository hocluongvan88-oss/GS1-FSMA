'use client'

import { Card } from "@/components/ui/card"

import { Mic, Camera, Activity, Lock, QrCode, FileText } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function LandingFeatures() {
  const { t, locale } = useLocale()
  
  const features = [
    {
      icon: Mic,
      title: t('landing.features.voice.title'),
      desc: t('landing.features.voice.desc'),
    },
    {
      icon: Camera,
      title: t('landing.features.vision.title'),
      desc: t('landing.features.vision.desc'),
    },
    {
      icon: Activity,
      title: t('landing.features.realtime.title'),
      desc: t('landing.features.realtime.desc'),
    },
    {
      icon: Lock,
      title: t('landing.features.blockchain.title'),
      desc: t('landing.features.blockchain.desc'),
    },
    {
      icon: QrCode,
      title: t('landing.features.qrcode.title'),
      desc: t('landing.features.qrcode.desc'),
    },
    {
      icon: FileText,
      title: t('landing.features.export.title'),
      desc: t('landing.features.export.desc'),
    },
  ]

  return (
    <section id="features" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            {t('landing.features.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 bg-card hover:shadow-lg transition-all duration-300 border-border group hover:border-accent/30"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
