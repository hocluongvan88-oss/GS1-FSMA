'use client'

import { Card } from "@/components/ui/card"
import Image from 'next/image'
import { Coffee, Wheat, Fish, Apple } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'

export function LandingIndustries() {
  const { t, locale } = useLocale()
  
  const industries = [
    {
      icon: Coffee,
      image: '/images/industry-coffee.jpg',
      title: t('landing.industries.coffee.title'),
      desc: t('landing.industries.coffee.desc'),
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      icon: Wheat,
      image: '/images/industry-wheat.jpg',
      title: t('landing.industries.rice.title'),
      desc: t('landing.industries.rice.desc'),
      color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    },
    {
      icon: Fish,
      image: '/images/industry-seafood.jpg',
      title: t('landing.industries.seafood.title'),
      desc: t('landing.industries.seafood.desc'),
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      icon: Apple,
      image: '/images/industry-fruits.jpg',
      title: t('landing.industries.fruits.title'),
      desc: t('landing.industries.fruits.desc'),
      color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
  ]

  return (
    <section id="solutions" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 text-balance">
            {t('landing.industries.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t('landing.industries.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((industry, index) => (
            <Card
              key={index}
              className="group overflow-hidden bg-card border-border hover:shadow-xl transition-all duration-300 p-0"
            >
              {/* Image */}
              <div className="aspect-[4/3] relative overflow-hidden">
                <Image
                  src={industry.image || "/placeholder.svg"}
                  alt={industry.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              {/* Content */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${industry.color} flex items-center justify-center`}>
                    <industry.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{industry.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {industry.desc}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
