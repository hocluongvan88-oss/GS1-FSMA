import React from "react"
import { Analytics } from '@vercel/analytics/next'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { LocaleProvider } from '@/lib/locale-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LocaleProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 w-full">
          <div className="sticky top-0 z-10 bg-background border-b p-2 flex items-center justify-between">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>
          {children}
        </main>
        <Analytics />
      </SidebarProvider>
    </LocaleProvider>
  )
}
