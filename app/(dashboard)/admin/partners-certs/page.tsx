'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocale } from '@/lib/locale-context'
import { Users, Award } from 'lucide-react'

export default function PartnersAndCertsPage() {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState('partners')

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('partnersAndCerts.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('partnersAndCerts.subtitle')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="partners" className="gap-2">
            <Users className="h-4 w-4" />
            {t('partners.title')}
          </TabsTrigger>
          <TabsTrigger value="certifications" className="gap-2">
            <Award className="h-4 w-4" />
            {t('certifications.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('partners.title')}</CardTitle>
              <CardDescription>{t('partners.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('partnersAndCerts.partnersDesc')}
              </p>
              <div className="mt-4">
                <a 
                  href="/partners" 
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t('partnersAndCerts.goToPartners')} →
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('certifications.title')}</CardTitle>
              <CardDescription>{t('certifications.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('partnersAndCerts.certsDesc')}
              </p>
              <div className="mt-4">
                <a 
                  href="/certifications" 
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t('partnersAndCerts.goToCerts')} →
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
