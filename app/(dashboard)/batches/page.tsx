'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Trash2, PackagePlus } from 'lucide-react'
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

type Batch = {
  id: string
  batch_number: string
  product_id: string
  location_id: string
  production_date: string
  expiry_date: string
  quantity_produced: number
  quantity_available: number
  quality_status: string
  harvest_date: string | null
  harvest_location_gln: string | null
  cooling_completion_datetime: string | null
  traceability_lot_code: string | null
  created_at: string
}

type Product = {
  id: string
  gtin: string
  name: string
}

type Location = {
  id: string
  gln: string
  name: string
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    batch_number: '',
    product_id: '',
    location_id: '',
    production_date: '',
    expiry_date: '',
    quantity_produced: '',
    unit_of_measure: 'kg',
    quality_status: 'pending',
    harvest_date: '',
    harvest_location_gln: '',
    cooling_completion_datetime: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadBatches()
    loadProducts()
    loadLocations()
  }, [])

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, gtin, name')
      .order('name')
    if (data) setProducts(data)
  }

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, gln, name')
      .order('name')
    if (data) setLocations(data)
  }

  const loadBatches = async () => {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setBatches(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.product_id || !formData.location_id || !formData.production_date || !formData.quantity_produced) {
      toast({
        title: t('batches.missingFields'),
        description: 'Vui lòng điền đầy đủ các trường bắt buộc',
        variant: 'destructive',
      })
      return
    }
    
    // Validate KDEs for food products
    if (!formData.harvest_date || !formData.harvest_location_gln) {
      toast({
        title: t('batches.missingFields'),
        description: t('batches.missingFieldsDesc'),
        variant: 'destructive',
      })
      return
    }
    
    // Auto-generate batch_number if not provided
    let batchNumber = formData.batch_number
    if (!batchNumber) {
      // Get selected product's GTIN
      const selectedProduct = products.find(p => p.id === formData.product_id)
      if (selectedProduct) {
        // Format: {GTIN}-BATCH-{YYYYMMDD}
        const dateStr = formData.harvest_date.replace(/-/g, '')
        batchNumber = `${selectedProduct.gtin}-BATCH-${dateStr}`
      }
    }
    
    const insertData: any = {
      batch_number: batchNumber,
      product_id: formData.product_id,
      location_id: formData.location_id,
      production_date: formData.production_date,
      quantity_produced: parseFloat(formData.quantity_produced),
      quantity_available: parseFloat(formData.quantity_produced),
      unit_of_measure: formData.unit_of_measure,
      quality_status: formData.quality_status,
      harvest_date: formData.harvest_date,
      harvest_location_gln: formData.harvest_location_gln,
    }
    
    // Optional fields
    if (formData.expiry_date) insertData.expiry_date = formData.expiry_date
    if (formData.cooling_completion_datetime) {
      insertData.cooling_completion_datetime = new Date(formData.cooling_completion_datetime).toISOString()
    }
    
    const { data, error } = await supabase
      .from('batches')
      .insert([insertData])
      .select()
    
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } else {
      const newBatch = data?.[0]
      toast({
        title: t('batches.createSuccess'),
        description: `${t('batches.tlcGenerated', { tlc: newBatch?.traceability_lot_code || 'Auto-generated' })}`,
      })
      setIsDialogOpen(false)
      setFormData({
        batch_number: '',
        product_id: '',
        location_id: '',
        production_date: '',
        expiry_date: '',
        quantity_produced: '',
        unit_of_measure: 'kg',
        quality_status: 'pending',
        harvest_date: '',
        harvest_location_gln: '',
        cooling_completion_datetime: '',
      })
      loadBatches()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('batches.deleteSuccess'),
      })
      loadBatches()
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      approved: 'bg-green-500/10 text-green-500',
      rejected: 'bg-red-500/10 text-red-500',
    }
    return colors[status] || 'bg-gray-500/10 text-gray-500'
  }

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('batches.title')}</CardTitle>
            <CardDescription>{t('batches.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('batches.createBatch')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('batches.createBatchTitle')}</DialogTitle>
                <DialogDescription>{t('batches.createBatchDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batch_number">{t('batches.batchNumber')}</Label>
                  <Input
                    id="batch_number"
                    placeholder={t('batches.batchNumberPlaceholder')}
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('batches.batchNumberHelper')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product_id">{t('batches.product')} *</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(v) => setFormData({ ...formData, product_id: v })}
                    >
                      <SelectTrigger id="product_id">
                        <SelectValue placeholder={t('batches.selectProduct')} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location_id">{t('batches.productionLocation')} *</Label>
                    <Select
                      value={formData.location_id}
                      onValueChange={(v) => setFormData({ ...formData, location_id: v })}
                    >
                      <SelectTrigger id="location_id">
                        <SelectValue placeholder={t('batches.selectLocation')} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* FSMA 204 Key Data Elements */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3 text-blue-600">
                    {t('batches.fsmaTitle')}
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="harvest_date">{t('batches.harvestDate')} *</Label>
                      <Input
                        id="harvest_date"
                        type="date"
                        value={formData.harvest_date}
                        onChange={(e) => setFormData({ ...formData, harvest_date: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('batches.harvestDateHelper')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="harvest_location_gln">{t('batches.harvestLocation')} *</Label>
                      <Select
                        value={formData.harvest_location_gln}
                        onValueChange={(v) => setFormData({ ...formData, harvest_location_gln: v })}
                      >
                        <SelectTrigger id="harvest_location_gln">
                          <SelectValue placeholder={t('batches.selectHarvestLocation')} />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (
                            <SelectItem key={l.gln} value={l.gln}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cooling_completion_datetime">{t('batches.coolingCompletion')}</Label>
                    <Input
                      id="cooling_completion_datetime"
                      type="datetime-local"
                      value={formData.cooling_completion_datetime}
                      onChange={(e) => setFormData({ ...formData, cooling_completion_datetime: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('batches.coolingHelper')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="production_date">Ngày sản xuất *</Label>
                    <Input
                      id="production_date"
                      type="date"
                      value={formData.production_date}
                      onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry_date">Ngày hết hạn</Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity_produced">{t('batches.quantityProduced')} *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quantity_produced"
                        type="number"
                        placeholder="1000"
                        value={formData.quantity_produced}
                        onChange={(e) => setFormData({ ...formData, quantity_produced: e.target.value })}
                        required
                        className="flex-1"
                      />
                      <Select
                        value={formData.unit_of_measure}
                        onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ton">Tấn</SelectItem>
                          <SelectItem value="piece">Cái</SelectItem>
                          <SelectItem value="box">Hộp</SelectItem>
                          <SelectItem value="bag">Bao</SelectItem>
                          <SelectItem value="liter">Lít</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quality_status">{t('batches.qualityStatus')}</Label>
                    <Select
                      value={formData.quality_status}
                      onValueChange={(v) => setFormData({ ...formData, quality_status: v })}
                    >
                      <SelectTrigger id="quality_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending - Chờ kiểm tra</SelectItem>
                        <SelectItem value="approved">Approved - Đạt chuẩn</SelectItem>
                        <SelectItem value="rejected">Rejected - Không đạt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">{t('batches.createButton')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch / TLC</TableHead>
                  <TableHead>Harvest Date</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Cooling Status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No batches found. Create your first batch to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-mono text-xs font-medium">
                            {batch.batch_number || 'N/A'}
                          </div>
                          {batch.traceability_lot_code && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              TLC: {batch.traceability_lot_code}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {batch.harvest_date ? (
                          <div>
                            <div>{new Date(batch.harvest_date).toLocaleDateString('vi-VN')}</div>
                            {batch.harvest_location_gln && (
                              <div className="text-xs text-muted-foreground">
                                GLN: {batch.harvest_location_gln.slice(-4)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs">Missing KDE</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(batch.production_date).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString('vi-VN') : '-'}
                      </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{batch.quantity_available} / {batch.quantity_produced} {batch.unit_of_measure || 'kg'}</div>
                      <div className="text-xs text-muted-foreground">Available / Total</div>
                    </div>
                  </TableCell>
                      <TableCell>
                        {batch.cooling_completion_datetime ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Completed
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(batch.quality_status)}>
                          {batch.quality_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(batch.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
