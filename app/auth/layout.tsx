import React from "react"
import { Analytics } from '@vercel/analytics/next'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
