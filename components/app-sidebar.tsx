'use client'

import {
  LayoutDashboard,
  PackagePlus,
  MapPin,
  ShoppingCart,
  FileBarChart,
  Shield,
  Users,
  Truck,
  ClipboardCheck,
  Settings,
  UserCog,
  Cpu,
  AlertTriangle,
  QrCode,
  FileText,
  ListChecks,
  Globe,
  Edit,
  Bug,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeSwitcher } from '@/components/theme-switcher' // Import ThemeSwitcher

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { useLocale } from '@/lib/locale-context'
import { SidebarUserMenu } from '@/components/sidebar-user-menu'

const getMenuItems = (t: (key: string) => string) => [
  {
    titleKey: 'nav.overview',
    items: [
      { titleKey: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { titleKey: 'nav.analytics', icon: FileBarChart, href: '/analytics' },
      { titleKey: 'nav.auditLog', icon: Shield, href: '/audit' },
    ],
  },
  {
    titleKey: 'nav.masterData',
    items: [
      { titleKey: 'nav.products', icon: ShoppingCart, href: '/products' },
      { titleKey: 'nav.locations', icon: MapPin, href: '/locations' },
    ],
  },
  {
    titleKey: 'nav.production',
    items: [
      { titleKey: 'nav.batches', icon: PackagePlus, href: '/batches' },
      { titleKey: 'nav.manualEvent', icon: Edit, href: '/input/manual' },
      { titleKey: 'nav.events', icon: ListChecks, href: '/events' },
      { titleKey: 'nav.shipments', icon: Truck, href: '/shipments' },
    ],
  },
  {
    titleKey: 'nav.export',
    items: [
      { titleKey: 'nav.digitalLink', icon: QrCode, href: '/digital-link' },
      { titleKey: 'nav.exportDocs', icon: FileText, href: '/export-docs' },
    ],
  },
  {
    titleKey: 'nav.administration',
    items: [
      { titleKey: 'nav.aiReviewQueue', icon: ClipboardCheck, href: '/ai-review' },
      { titleKey: 'nav.anomalies', icon: AlertTriangle, href: '/anomalies' },
      { titleKey: 'nav.partnersAndCerts', icon: Users, href: '/admin/partners-certs' },
      { titleKey: 'nav.devices', icon: Cpu, href: '/admin/devices' },
      { titleKey: 'nav.nationalPortal', icon: Globe, href: '/admin/national-portal' },
      { titleKey: 'nav.userManagement', icon: UserCog, href: '/admin/users', adminOnly: true },
      { titleKey: 'nav.systemSettings', icon: Settings, href: '/admin/settings', adminOnly: true },
      { titleKey: 'nav.debugTools', icon: Bug, href: '/admin/debug', adminOnly: true },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { t } = useLocale()
  const menuItems = getMenuItems(t)

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-6 py-4">
          <h2 className="text-lg font-semibold">{t('dashboard.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        
        {menuItems.map((group) => {
          // Show all items - permission checks will be done server-side
          const visibleItems = group.items

          return (
            <SidebarGroup key={group.titleKey}>
              <SidebarGroupLabel>{t(group.titleKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{t(item.titleKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
