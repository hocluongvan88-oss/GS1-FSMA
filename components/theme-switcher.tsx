'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/lib/locale-context'

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { t } = useLocale()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon">
        <Sun className="h-5 w-5" />
        <span className="sr-only">{t('theme.loading')}</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-5 w-5" />
          <span className="sr-only">{t('theme.switchToLight')}</span>
        </>
      ) : (
        <>
          <Moon className="h-5 w-5" />
          <span className="sr-only">{t('theme.switchToDark')}</span>
        </>
      )}
    </Button>
  )
}
