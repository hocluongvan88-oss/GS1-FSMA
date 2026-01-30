'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/locale-context'

type Partner = {
  id: string
  company_name: string
  partner_type: string
  contact_person: string
  email: string
  phone: string
  gln?: string
  created_at: string
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    partner_type: 'supplier',
    contact_person: '',
    email: '',
    phone: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadPartners()
  }, [])

  const loadPartners = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setPartners(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('partners')
      .insert([formData])
    
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('partners.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({ company_name: '', partner_type: 'supplier', contact_person: '', email: '', phone: '' })
      loadPartners()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('partners.deleteSuccess'),
      })
      loadPartners()
    }
  }

  const getPartnerTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      supplier: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      distributor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      retailer: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      manufacturer: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      customer: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
      logistics: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      certifier: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    }
    return colors[type] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
  }

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('partners.title')}</CardTitle>
            <CardDescription>{t('partners.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('partners.addPartner')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('partners.createPartner')}</DialogTitle>
                <DialogDescription>{t('partners.createPartnerDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('partners.companyName')} *</Label>
                  <Input
                    id="company_name"
                    placeholder={t('partners.companyPlaceholder')}
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner_type">{t('partners.partnerType')} *</Label>
                  <Select
                    value={formData.partner_type}
                    onValueChange={(v) => setFormData({ ...formData, partner_type: v })}
                  >
                    <SelectTrigger id="partner_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">{t('partners.types.supplier')}</SelectItem>
                      <SelectItem value="distributor">{t('partners.types.distributor')}</SelectItem>
                      <SelectItem value="retailer">{t('partners.types.retailer')}</SelectItem>
                      <SelectItem value="manufacturer">{t('partners.types.manufacturer')}</SelectItem>
                      <SelectItem value="customer">{t('partners.types.customer')}</SelectItem>
                      <SelectItem value="logistics">{t('partners.types.logistics')}</SelectItem>
                      <SelectItem value="certifier">{t('partners.types.certifier')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">{t('partners.contactPerson')}</Label>
                  <Input
                    id="contact_person"
                    placeholder={t('partners.contactPlaceholder')}
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('partners.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('partners.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('partners.phone')}</Label>
                  <Input
                    id="phone"
                    placeholder={t('partners.phonePlaceholder')}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">{t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partners.companyName')}</TableHead>
                <TableHead>{t('partners.partnerType')}</TableHead>
                <TableHead>{t('partners.contactPerson')}</TableHead>
                <TableHead>{t('partners.email')}</TableHead>
                <TableHead>{t('partners.phone')}</TableHead>
                <TableHead className="text-right">{t('partners.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium">{partner.company_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getPartnerTypeColor(partner.partner_type)}>
                      {partner.partner_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{partner.contact_person || '-'}</TableCell>
                  <TableCell className="text-sm">{partner.email || '-'}</TableCell>
                  <TableCell className="text-sm">{partner.phone || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(partner.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
