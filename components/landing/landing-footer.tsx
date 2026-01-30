'use client'

import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'

export function LandingFooter() {
  const { t, locale } = useLocale()
  
  const footerSections = [
    {
      title: t('landing.footer.product'),
      links: [
        { label: t('landing.footer.features'), href: '#features' },
        { label: t('landing.footer.pricing'), href: '/pricing' },
        { label: t('landing.footer.integrations'), href: '/integrations' },
      ],
    },
    {
      title: t('landing.footer.company'),
      links: [
        { label: t('landing.footer.about'), href: '/about' },
        { label: t('landing.footer.careers'), href: '/careers' },
        { label: t('landing.footer.partners'), href: '/partners' },
      ],
    },
    {
      title: t('landing.footer.resources'),
      links: [
        { label: t('landing.footer.docs'), href: '/docs' },
        { label: t('landing.footer.guides'), href: '/guides' },
        { label: t('landing.footer.support'), href: '/support' },
      ],
    },
    {
      title: t('landing.footer.legal'),
      links: [
        { label: t('landing.footer.privacy'), href: '/privacy' },
        { label: t('landing.footer.terms'), href: '/terms' },
      ],
    },
  ]

  const footerLinks = footerSections.reduce((acc, section) => {
    acc[section.title] = section;
    return acc;
  }, {});

  return (
    <footer id="about" className="bg-muted/30 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {footerSections.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold text-foreground mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <Link 
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">GS1 Traceability</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t('landing.footer.copyright')}
            </p>
          </div>
          <p className="text-sm text-muted-foreground text-center mt-4">
            {t('landing.footer.tagline')}
          </p>
        </div>
      </div>
    </footer>
  )
}
