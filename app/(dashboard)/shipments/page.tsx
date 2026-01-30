'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Trash2, Truck, MapPin, Package, Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/locale-context'
import { Separator } from '@/components/ui/separator'

type Location = {
  id: string
  gln: string
  name: string
  type: string
}

type Partner = {
  id: string
  company_name: string
  partner_type: string
}

type Shipment = {
  id: string
  shipment_number: string
  from_location_id: string
  to_location_id: string
  carrier_partner_id: string | null
  status: string
  dispatched_at: string | null
  delivered_at: string | null
  tracking_number: string | null
  items: any
  vehicle_info: any
  temperature_log: any
  documents: any
  receiving_event_id: string | null
  received_by: string | null
  receiving_verified: boolean
  receiving_discrepancy: any
  two_party_verified: boolean
  created_at: string
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [formData, setFormData] = useState({
    shipment_number: '',
    from_location_id: '',
    to_location_id: '',
    carrier_partner_id: '',
    tracking_number: '',
    batch_id: '',
    quantity: '',
    unit: 'kg',
    vehicle_plate: '',
    driver_name: '',
    driver_phone: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadShipments()
    loadLocations()
    loadPartners()
  }, [])

  const loadShipments = async () => {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setShipments(data)
    }
  }

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, gln, name, type')
      .order('name')
    
    if (!error && data) {
      setLocations(data)
    }
  }

  const loadPartners = async () => {
    const { data, error } = await supabase
      .from('partners')
      .select('id, company_name, partner_type')
      .eq('status', 'active')
      .order('company_name')
    
    if (!error && data) {
      setPartners(data)
    }
  }

  const handleViewDetails = (shipment: Shipment) => {
    setSelectedShipment(shipment)
    setIsDetailDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Build items array
    const itemsData = formData.batch_id ? [{
      batch_id: formData.batch_id,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
    }] : []

    // Build vehicle info
    const vehicleData = (formData.vehicle_plate || formData.driver_name) ? {
      plate: formData.vehicle_plate,
      driver: formData.driver_name,
      phone: formData.driver_phone,
    } : null

    const { error } = await supabase
      .from('shipments')
      .insert([{
        shipment_number: formData.shipment_number,
        from_location_id: formData.from_location_id,
        to_location_id: formData.to_location_id,
        carrier_partner_id: formData.carrier_partner_id || null,
        tracking_number: formData.tracking_number || null,
        items: itemsData,
        vehicle_info: vehicleData,
        status: 'pending',
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
        description: t('shipments.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({
        shipment_number: '',
        from_location_id: '',
        to_location_id: '',
        carrier_partner_id: '',
        tracking_number: '',
        batch_id: '',
        quantity: '',
        unit: 'kg',
        vehicle_plate: '',
        driver_name: '',
        driver_phone: '',
      })
      loadShipments()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('shipments')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('shipments.deleteSuccess'),
      })
      loadShipments()
    }
  }

  const updateStatus = async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus }
    
    if (newStatus === 'in_transit' && !shipments.find(s => s.id === id)?.dispatched_at) {
      updates.dispatched_at = new Date().toISOString()
    }
    if (newStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('shipments.statusUpdated'),
      })
      loadShipments()
    }
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId)
    return location ? location.name : locationId
  }

  const getPartnerName = (partnerId: string | null) => {
    if (!partnerId) return '-'
    const partner = partners.find(p => p.id === partnerId)
    return partner ? partner.company_name : partnerId
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      in_transit: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    }
    return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }

  const getStatusLabel = (status: string) => {
    return t(`shipments.status.${status}`, status)
  }

  const getVerificationBadge = (shipment: Shipment) => {
    if (shipment.two_party_verified) {
      return (
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-500 border-green-500/20">
          <CheckCircle2 className="h-3 w-3" />
          {t('shipments.verified')}
        </Badge>
      )
    }
    if (shipment.receiving_verified) {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Clock className="h-3 w-3" />
          {t('shipments.partialVerified')}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-500 border-gray-500/20">
        {t('shipments.notVerified')}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('shipments.stats.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('shipments.stats.inTransit')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {shipments.filter(s => s.status === 'in_transit').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('shipments.stats.verified')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {shipments.filter(s => s.two_party_verified).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('shipments.stats.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {shipments.filter(s => s.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {t('shipments.title')}
            </CardTitle>
            <CardDescription>{t('shipments.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('shipments.create')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('shipments.createTitle')}</DialogTitle>
                <DialogDescription>{t('shipments.createDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shipment_number">{t('shipments.form.shipmentNumber')} *</Label>
                  <Input
                    id="shipment_number"
                    placeholder="SHIP-2026-001"
                    value={formData.shipment_number}
                    onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_location_id">{t('shipments.form.fromLocation')} *</Label>
                    <Select
                      value={formData.from_location_id}
                      onValueChange={(v) => setFormData({ ...formData, from_location_id: v })}
                      required
                    >
                      <SelectTrigger id="from_location_id">
                        <SelectValue placeholder={t('shipments.form.selectLocation')} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to_location_id">{t('shipments.form.toLocation')} *</Label>
                    <Select
                      value={formData.to_location_id}
                      onValueChange={(v) => setFormData({ ...formData, to_location_id: v })}
                      required
                    >
                      <SelectTrigger id="to_location_id">
                        <SelectValue placeholder={t('shipments.form.selectLocation')} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carrier_partner_id">{t('shipments.form.carrier')}</Label>
                    <Select
                      value={formData.carrier_partner_id}
                      onValueChange={(v) => setFormData({ ...formData, carrier_partner_id: v })}
                    >
                      <SelectTrigger id="carrier_partner_id">
                        <SelectValue placeholder={t('shipments.form.selectCarrier')} />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.filter(p => p.partner_type === 'logistics').map(partner => (
                          <SelectItem key={partner.id} value={partner.id}>
                            {partner.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tracking_number">{t('shipments.form.trackingNumber')}</Label>
                    <Input
                      id="tracking_number"
                      placeholder="TRK123456789"
                      value={formData.tracking_number}
                      onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t('shipments.form.items')}</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="batch_id">{t('shipments.form.batchId')}</Label>
                      <Input
                        id="batch_id"
                        placeholder={t('shipments.form.selectBatch')}
                        value={formData.batch_id}
                        onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">{t('shipments.form.quantity')}</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        placeholder="100"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">{t('shipments.form.unit')}</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(v) => setFormData({ ...formData, unit: v })}
                      >
                        <SelectTrigger id="unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="ton">ton</SelectItem>
                          <SelectItem value="pcs">{t('shipments.form.pieces')}</SelectItem>
                          <SelectItem value="boxes">{t('shipments.form.boxes')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-base font-semibold">{t('shipments.form.vehicleInfo')}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_plate">{t('shipments.form.licensePlate')}</Label>
                      <Input
                        id="vehicle_plate"
                        placeholder="29A-12345"
                        value={formData.vehicle_plate}
                        onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver_name">{t('shipments.form.driverName')}</Label>
                      <Input
                        id="driver_name"
                        placeholder={t('shipments.form.driverNamePlaceholder')}
                        value={formData.driver_name}
                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver_phone">{t('shipments.form.driverPhone')}</Label>
                      <Input
                        id="driver_phone"
                        type="tel"
                        placeholder="0901234567"
                        value={formData.driver_phone}
                        onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                      />
                    </div>
                  </div>
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
                <TableHead>{t('shipments.table.shipmentNumber')}</TableHead>
                <TableHead>{t('shipments.table.route')}</TableHead>
                <TableHead>{t('shipments.table.items')}</TableHead>
                <TableHead>{t('shipments.table.status')}</TableHead>
                <TableHead>{t('shipments.table.verification')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t('shipments.noShipments')}
                  </TableCell>
                </TableRow>
              ) : (
                shipments.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {shipment.shipment_number}
                      {shipment.tracking_number && (
                        <div className="text-xs text-muted-foreground">{shipment.tracking_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{getLocationName(shipment.from_location_id)}</div>
                          <div className="text-xs text-muted-foreground">→</div>
                          <div className="font-medium truncate">{getLocationName(shipment.to_location_id)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Package className="h-3 w-3" />
                        {Array.isArray(shipment.items) ? shipment.items.length : 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={shipment.status}
                        onValueChange={(v) => updateStatus(shipment.id, v)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue>
                            <Badge variant="outline" className={getStatusColor(shipment.status)}>
                              {getStatusLabel(shipment.status)}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">{getStatusLabel('pending')}</SelectItem>
                          <SelectItem value="in_transit">{getStatusLabel('in_transit')}</SelectItem>
                          <SelectItem value="delivered">{getStatusLabel('delivered')}</SelectItem>
                          <SelectItem value="cancelled">{getStatusLabel('cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {getVerificationBadge(shipment)}
                      {shipment.receiving_discrepancy && (
                        <Badge variant="outline" className="gap-1 ml-1 bg-orange-500/10 text-orange-500 border-orange-500/20">
                          <AlertTriangle className="h-3 w-3" />
                          {t('shipments.hasDiscrepancy')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(shipment)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(shipment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('shipments.detailsTitle')}</DialogTitle>
            <DialogDescription>{t('shipments.detailsDesc')}</DialogDescription>
          </DialogHeader>
          {selectedShipment && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('shipments.table.shipmentNumber')}</p>
                  <p className="font-mono font-semibold">{selectedShipment.shipment_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('shipments.table.status')}</p>
                  <Badge variant="outline" className={getStatusColor(selectedShipment.status)}>
                    {getStatusLabel(selectedShipment.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('shipments.form.trackingNumber')}</p>
                  <p className="font-mono text-sm">{selectedShipment.tracking_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('shipments.form.carrier')}</p>
                  <p className="text-sm">{getPartnerName(selectedShipment.carrier_partner_id)}</p>
                </div>
              </div>

              {/* Route */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('shipments.routeInfo')}
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t('shipments.from')}:</span>
                    <span className="font-medium">{getLocationName(selectedShipment.from_location_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t('shipments.to')}:</span>
                    <span className="font-medium">{getLocationName(selectedShipment.to_location_id)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t('shipments.dispatched')}:</span>
                    <span>{selectedShipment.dispatched_at 
                      ? new Date(selectedShipment.dispatched_at).toLocaleString() 
                      : t('common.notYet')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">{t('shipments.delivered')}:</span>
                    <span>{selectedShipment.delivered_at 
                      ? new Date(selectedShipment.delivered_at).toLocaleString() 
                      : t('common.notYet')}
                    </span>
                  </div>
                </div>
              </div>

              {/* FSMA 204 Verification */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('shipments.verificationStatus')}
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('shipments.twoPartyVerified')}:</span>
                    {selectedShipment.two_party_verified ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        {t('common.yes')}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                        {t('common.no')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('shipments.receivingVerified')}:</span>
                    {selectedShipment.receiving_verified ? (
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        {t('common.yes')}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                        {t('common.no')}
                      </Badge>
                    )}
                  </div>
                  {selectedShipment.receiving_event_id && (
                    <div>
                      <span className="text-xs text-muted-foreground">{t('shipments.receivingEventId')}:</span>
                      <p className="font-mono text-xs mt-1">{selectedShipment.receiving_event_id}</p>
                    </div>
                  )}
                  {selectedShipment.receiving_discrepancy && (
                    <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
                      <p className="text-sm font-semibold text-orange-600 mb-2">
                        {t('shipments.discrepancyFound')}
                      </p>
                      <pre className="text-xs font-mono overflow-x-auto">
                        {JSON.stringify(selectedShipment.receiving_discrepancy, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              {selectedShipment.items && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('shipments.itemsList')}
                  </h4>
                  <div className="space-y-2">
                    {Array.isArray(selectedShipment.items) && selectedShipment.items.length > 0 ? (
                      selectedShipment.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-lg">
                          <div className="w-8 h-8 bg-blue-500/10 rounded flex items-center justify-center shrink-0">
                            <span className="text-blue-600 font-semibold">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {item.product_name && (
                              <p className="text-base font-semibold text-foreground mb-1">
                                {item.product_name}
                              </p>
                            )}
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-muted-foreground">{t('shipments.form.quantity')}:</span>
                                <span className="text-base font-semibold text-green-600">
                                  {item.quantity || item.value || 0} {item.unit || item.uom || ''}
                                </span>
                              </div>
                              {item.batch_number && (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-muted-foreground">{t('shipments.form.batchNumber')}:</span>
                                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                    {item.batch_number}
                                  </code>
                                </div>
                              )}
                              {item.batch_id && (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm text-muted-foreground">Batch ID:</span>
                                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[200px]">
                                    {item.batch_id}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-muted/50 rounded text-sm text-muted-foreground text-center">
                        {t('shipments.noItems')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle Info */}
              {selectedShipment.vehicle_info && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    {t('shipments.vehicleInfo')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedShipment.vehicle_info.plate && (
                      <div className="p-3 bg-muted/50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">{t('shipments.form.licensePlate')}</p>
                        <p className="font-semibold font-mono">{selectedShipment.vehicle_info.plate}</p>
                      </div>
                    )}
                    {selectedShipment.vehicle_info.driver && (
                      <div className="p-3 bg-muted/50 rounded">
                        <p className="text-xs text-muted-foreground mb-1">{t('shipments.form.driverName')}</p>
                        <p className="font-medium">{selectedShipment.vehicle_info.driver}</p>
                      </div>
                    )}
                    {selectedShipment.vehicle_info.phone && (
                      <div className="p-3 bg-muted/50 rounded col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">{t('shipments.form.driverPhone')}</p>
                        <p className="font-mono">{selectedShipment.vehicle_info.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Temperature Log (Cold Chain) */}
              {selectedShipment.temperature_log && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3">{t('shipments.temperatureLog')}</h4>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify(selectedShipment.temperature_log, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Documents */}
              {selectedShipment.documents && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm mb-3">{t('shipments.documents')}</h4>
                  <div className="bg-muted/50 p-3 rounded font-mono text-xs overflow-x-auto">
                    <pre>{JSON.stringify(selectedShipment.documents, null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="p-3 bg-muted/30 rounded text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">{t('common.id')}:</span>{' '}
                  <span className="font-mono">{selectedShipment.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('common.createdAt')}:</span>{' '}
                  <span>{new Date(selectedShipment.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
