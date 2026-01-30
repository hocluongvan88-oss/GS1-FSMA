'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t, locale } = useLocale()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-semibold text-lg text-foreground">GS1 Traceability</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.nav.features')}
            </a>
            <a href="#compliance" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.nav.compliance')}
            </a>
            <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.nav.solutions')}
            </a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('landing.nav.about')}
            </a>
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <Link href="/auth/login">
              <Button variant="ghost" size="sm" className="font-medium">
                {t('landing.nav.login')}
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="font-medium">
                {t('landing.nav.getStarted')}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.nav.features')}
              </a>
              <a href="#compliance" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.nav.compliance')}
              </a>
              <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.nav.solutions')}
              </a>
              <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {t('landing.nav.about')}
              </a>
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <ThemeSwitcher />
                <LanguageSwitcher />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full bg-transparent">
                    {t('landing.nav.login')}
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button className="w-full">
                    {t('landing.nav.getStarted')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
