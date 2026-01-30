'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import enMessages from '@/messages/en.json'
import viMessages from '@/messages/vi.json'

type Locale = 'vi' | 'en'

type LocaleContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

// Translation dictionaries - now loaded from JSON files
const translations = {
  vi: viMessages,
  en: enMessages,
}

// Backup translations for old keys (for backwards compatibility)
const legacyTranslations = {
  vi: {
    'dashboard.title': 'Dashboard',
    'dashboard.activeBatches': 'Lô sản xuất đang hoạt động',
    'dashboard.inProductionSystem': 'In production system',
    'dashboard.totalProducts': 'Total Products',
    'dashboard.productCatalog': 'Product catalog',
    'dashboard.activeLocations': 'Active Locations',
    'dashboard.inSupplyChain': 'In supply chain',
    'dashboard.aiJobsPending': 'AI Jobs Pending',
    'dashboard.awaitingProcessing': 'Awaiting processing',
    'dashboard.eventTimeline': 'Event Timeline',
    'dashboard.eventsRecordedOverTime': 'Events recorded over time',
    'dashboard.eventTypes': 'Event Types',
    'dashboard.epcisEventDistribution': 'EPCIS event distribution',
    'dashboard.recentEvents': 'Recent Events',
    'dashboard.latestTraceabilityEvents': 'Latest traceability events from the field',
    'dashboard.viewAll': 'View All',
    'dashboard.time': 'TIME',
    'dashboard.eventType': 'EVENT TYPE',
    'dashboard.businessStep': 'BUSINESS STEP',
    'dashboard.source': 'SOURCE',
    'dashboard.user': 'USER',
    'dashboard.location': 'LOCATION',
    'dashboard.noEventsRecorded': 'No events recorded yet',
    'dashboard.last24Hours': 'Last 24 hours',
    'dashboard.last7Days': 'Last 7 days',
    'dashboard.last30Days': 'Last 30 days',
    'dashboard.settings': 'Settings',

    // Analytics
    'analytics.title': 'Analytics',
    'analytics.description': 'Comprehensive supply chain and compliance analytics',
    'analytics.supplyChainFlow': 'Supply Chain Flow',
    'analytics.qualityMetrics': 'Quality Metrics',
    'analytics.aiPerformance': 'AI Performance',
    'analytics.complianceReport': 'Compliance Report',

    // Audit
    'audit.title': 'Audit Log',
    'audit.description': 'Complete audit trail of all system activities',
    'audit.filterByAction': 'Filter by action',
    'audit.allActions': 'All actions',
    'audit.search': 'Search audit logs...',
    'audit.timestamp': 'TIMESTAMP',
    'audit.action': 'ACTION',
    'audit.entityType': 'ENTITY TYPE',
    'audit.entityId': 'ENTITY ID',
    'audit.actor': 'ACTOR',
    'audit.changes': 'CHANGES',
    'audit.ipAddress': 'IP ADDRESS',
    'audit.noAuditLogs': 'No audit logs found',
    'audit.loadMore': 'Load More',
  },
  en: {
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.activeBatches': 'Active Batches',
    'dashboard.inProductionSystem': 'In production system',
    'dashboard.totalProducts': 'Total Products',
    'dashboard.productCatalog': 'Product catalog',
    'dashboard.activeLocations': 'Active Locations',
    'dashboard.inSupplyChain': 'In supply chain',
    'dashboard.aiJobsPending': 'AI Jobs Pending',
    'dashboard.awaitingProcessing': 'Awaiting processing',
    'dashboard.eventTimeline': 'Event Timeline',
    'dashboard.eventsRecordedOverTime': 'Events recorded over time',
    'dashboard.eventTypes': 'Event Types',
    'dashboard.epcisEventDistribution': 'EPCIS event distribution',
    'dashboard.recentEvents': 'Recent Events',
    'dashboard.latestTraceabilityEvents': 'Latest traceability events from the field',
    'dashboard.viewAll': 'View All',
    'dashboard.time': 'TIME',
    'dashboard.eventType': 'EVENT TYPE',
    'dashboard.businessStep': 'BUSINESS STEP',
    'dashboard.source': 'SOURCE',
    'dashboard.user': 'USER',
    'dashboard.location': 'LOCATION',
    'dashboard.noEventsRecorded': 'No events recorded yet',
    'dashboard.last24Hours': 'Last 24 hours',
    'dashboard.last7Days': 'Last 7 days',
    'dashboard.last30Days': 'Last 30 days',
    'dashboard.settings': 'Settings',

    // Analytics
    'analytics.title': 'Analytics',
    'analytics.description': 'Comprehensive supply chain and compliance analytics',
    'analytics.supplyChainFlow': 'Supply Chain Flow',
    'analytics.qualityMetrics': 'Quality Metrics',
    'analytics.aiPerformance': 'AI Performance',
    'analytics.complianceReport': 'Compliance Report',

    // Audit
    'audit.title': 'Audit Log',
    'audit.description': 'Complete audit trail of all system activities',
    'audit.filterByAction': 'Filter by action',
    'audit.allActions': 'All actions',
    'audit.search': 'Search audit logs...',
    'audit.timestamp': 'TIMESTAMP',
    'audit.action': 'ACTION',
    'audit.entityType': 'ENTITY TYPE',
    'audit.entityId': 'ENTITY ID',
    'audit.actor': 'ACTOR',
    'audit.changes': 'CHANGES',
    'audit.ipAddress': 'IP ADDRESS',
    'audit.noAuditLogs': 'No audit logs found',
    'audit.loadMore': 'Load More',
  },
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi')

  // Load locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && (savedLocale === 'vi' || savedLocale === 'en')) {
      setLocaleState(savedLocale)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Split the key to navigate nested objects (e.g., "dashboard.stats.activeBatches")
    const keys = key.split('.')
    let value: any = translations[locale]
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Try legacy translations as fallback
        const legacyValue = legacyTranslations[locale][key as keyof typeof legacyTranslations.vi]
        return legacyValue || key
      }
    }
    
    let result = typeof value === 'string' ? value : key
    
    // Replace parameters in the format {paramName}
    if (params && typeof result === 'string') {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
      })
    }
    
    return result
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
