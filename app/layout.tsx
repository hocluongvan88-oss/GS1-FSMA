import React from "react"
import type { Metadata } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { LocaleProvider } from '@/lib/locale-context'

const beVietnamPro = Be_Vietnam_Pro({ 
  subsets: ["latin", "vietnamese"],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro'
});

const jetBrainsMono = JetBrains_Mono({ 
  subsets: ["latin", "vietnamese"],
  variable: '--font-jetbrains-mono'
});

export const metadata: Metadata = {
  title: 'GS1 Traceability Vietnam - Nền tảng Truy xuất Nguồn gốc Nông sản',
  description: 'Nền tảng truy xuất nguồn gốc chuẩn quốc tế GS1 EPCIS 2.0, tuân thủ FSMA 204 (FDA) và EUDR (EU) cho nông sản Việt Nam. AI-powered food traceability platform for Vietnamese agricultural exports.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${beVietnamPro.variable} ${jetBrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
