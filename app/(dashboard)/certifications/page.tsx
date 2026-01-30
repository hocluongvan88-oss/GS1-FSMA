'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Trash2, Award, ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

type Certification = {
  id: string
  certification_type: string
  certification_body: string
  certificate_number: string
  issued_to_type: string
  issued_to_id: string
  issue_date: string
  expiry_date: string
  status: string
  certificate_url: string | null
  verification_url: string | null
  created_at: string
}

type ExpiringCertification = {
  id: string
  certification_type: string
  certification_body: string
  certificate_number: string
  issue_date: string
  expiry_date: string
  days_until_expiry: number
  alert_level: string
  issued_to_name: string
}

type Location = {
  id: string
  gln: string
  name: string
}

type Batch = {
  id: string
  batch_number: string
}

type Partner = {
  id: string
  company_name: string
}

export default function CertificationsPage() {
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCertification[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    certification_type: 'organic',
    certification_body: '',
    certificate_number: '',
    issued_to_type: 'location',
    issued_to_id: '',
    issue_date: '',
    expiry_date: '',
    certificate_url: '',
    verification_url: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadCertifications()
    loadExpiringCertifications()
    loadLocations()
    loadBatches()
    loadPartners()
  }, [])

  const loadCertifications = async () => {
    const { data, error } = await supabase
      .from('certifications')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setCertifications(data)
    }
  }

  const loadExpiringCertifications = async () => {
    const { data } = await supabase
      .from('v_expiring_certifications')
      .select('*')
      .order('days_until_expiry', { ascending: true })
    if (data) setExpiringCerts(data as unknown as ExpiringCertification[])
  }

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, gln, name')
      .order('name')
    if (data) setLocations(data)
  }

  const loadBatches = async () => {
    const { data } = await supabase
      .from('batches')
      .select('id, batch_number')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setBatches(data)
  }

  const loadPartners = async () => {
    const { data } = await supabase
      .from('partners')
      .select('id, company_name')
      .order('company_name')
    if (data) setPartners(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const { error } = await supabase
      .from('certifications')
      .insert([{
        ...formData,
        status: 'active',
      }])
    
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('certifications.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({
        certification_type: 'organic',
        certification_body: '',
        certificate_number: '',
        issued_to_type: 'location',
        issued_to_id: '',
        issue_date: '',
        expiry_date: '',
        certificate_url: '',
        verification_url: '',
      })
      loadCertifications()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('certifications')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('certifications.deleteSuccess'),
      })
      loadCertifications()
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      expired: 'bg-yellow-500/10 text-yellow-500',
      suspended: 'bg-orange-500/10 text-orange-500',
      revoked: 'bg-red-500/10 text-red-500',
    }
    return colors[status] || 'bg-gray-500/10 text-gray-500'
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      organic: 'Organic',
      fair_trade: 'Fair Trade',
      halal: 'Halal',
      kosher: 'Kosher',
      vegan: 'Vegan',
      gmp: 'GMP',
      haccp: 'HACCP',
      iso: 'ISO',
    }
    return labels[type] || type
  }

  const getAlertBadgeClass = (alertLevel: string) => {
    switch (alertLevel) {
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200'
      case 'critical':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200'
      default:
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200'
    }
  }

  const getAlertIcon = (alertLevel: string) => {
    switch (alertLevel) {
      case 'expired':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Toaster />
      
      {/* Expiring Certifications Alert */}
      {expiringCerts.filter(c => c.alert_level === 'critical' || c.alert_level === 'expired').length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('certifications.alert.title')}</AlertTitle>
          <AlertDescription>
            {t('certifications.alert.message', {
              expired: expiringCerts.filter(c => c.alert_level === 'expired').length,
              critical: expiringCerts.filter(c => c.alert_level === 'critical').length
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Expiring Certifications Card */}
      {expiringCerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('certifications.expiring.title')}</CardTitle>
            <CardDescription>{t('certifications.expiring.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringCerts.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20"
                >
                  <div className="flex items-center gap-3">
                    {getAlertIcon(cert.alert_level)}
                    <div>
                      <div className="font-medium">{cert.certification_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {cert.issued_to_name} • {cert.certificate_number}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm">
                        Expires: {new Date(cert.expiry_date).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cert.days_until_expiry < 0
                          ? `Expired ${Math.abs(cert.days_until_expiry)} days ago`
                          : `${cert.days_until_expiry} days remaining`}
                      </div>
                    </div>
                    <Badge variant="outline" className={getAlertBadgeClass(cert.alert_level)}>
                      {cert.alert_level}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {t('certifications.title')}
            </CardTitle>
            <CardDescription>{t('certifications.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('certifications.addCertification')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('certifications.createTitle')}</DialogTitle>
                <DialogDescription>{t('certifications.createDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="certification_type">Loại chứng nhận *</Label>
                    <Select
                      value={formData.certification_type}
                      onValueChange={(v) => setFormData({ ...formData, certification_type: v })}
                    >
                      <SelectTrigger id="certification_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organic">Organic</SelectItem>
                        <SelectItem value="fair_trade">Fair Trade</SelectItem>
                        <SelectItem value="halal">Halal</SelectItem>
                        <SelectItem value="kosher">Kosher</SelectItem>
                        <SelectItem value="vegan">Vegan</SelectItem>
                        <SelectItem value="gmp">GMP</SelectItem>
                        <SelectItem value="haccp">HACCP</SelectItem>
                        <SelectItem value="iso">ISO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certification_body">Tổ chức chứng nhận *</Label>
                    <Input
                      id="certification_body"
                      placeholder="USDA Organic, EU Organic, etc."
                      value={formData.certification_body}
                      onChange={(e) => setFormData({ ...formData, certification_body: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certificate_number">Số chứng nhận *</Label>
                  <Input
                    id="certificate_number"
                    placeholder="CERT-ORG-2025-001"
                    value={formData.certificate_number}
                    onChange={(e) => setFormData({ ...formData, certificate_number: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issued_to_type">Cấp cho *</Label>
                    <Select
                      value={formData.issued_to_type}
                      onValueChange={(v) => setFormData({ ...formData, issued_to_type: v })}
                    >
                      <SelectTrigger id="issued_to_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="location">Location (Địa điểm)</SelectItem>
                        <SelectItem value="product">Product (Sản phẩm)</SelectItem>
                        <SelectItem value="batch">Batch (Lô sản xuất)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="issued_to_id">Entity *</Label>
                    <Select
                      value={formData.issued_to_id}
                      onValueChange={(v) => setFormData({ ...formData, issued_to_id: v })}
                    >
                      <SelectTrigger id="issued_to_id">
                        <SelectValue placeholder="Select entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.issued_to_type === 'location' && locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name} ({l.gln})
                          </SelectItem>
                        ))}
                        {formData.issued_to_type === 'batch' && batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.batch_number}
                          </SelectItem>
                        ))}
                        {formData.issued_to_type === 'partner' && partners.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issue_date">Ngày cấp *</Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry_date">Ngày hết hạn *</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certificate_url">Certificate URL</Label>
                  <Input
                    id="certificate_url"
                    type="url"
                    placeholder="https://..."
                    value={formData.certificate_url}
                    onChange={(e) => setFormData({ ...formData, certificate_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification_url">Verification URL</Label>
                  <Input
                    id="verification_url"
                    type="url"
                    placeholder="https://..."
                    value={formData.verification_url}
                    onChange={(e) => setFormData({ ...formData, verification_url: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">Tạo chứng nhận</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Số chứng nhận</TableHead>
                <TableHead>Tổ chức</TableHead>
                <TableHead>Cấp cho</TableHead>
                <TableHead>Ngày cấp</TableHead>
                <TableHead>Hết hạn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certifications.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(cert.certification_type)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{cert.certificate_number}</TableCell>
                  <TableCell className="text-sm">{cert.certification_body}</TableCell>
                  <TableCell className="text-sm capitalize">{cert.issued_to_type}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(cert.issue_date).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(cert.expiry_date).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(cert.status)}>
                      {cert.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {cert.certificate_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(cert.certificate_url!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
