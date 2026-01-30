'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Activity, Trash2, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/locale-context'

type Device = {
  id: string
  device_id: string
  device_name: string
  device_type: 'temperature_sensor' | 'humidity_sensor' | 'gps_tracker' | 'weighing_scale' | 'rfid_reader'
  location_id?: string
  status: 'active' | 'inactive' | 'maintenance'
  last_reading_at?: string
  metadata?: any
  created_at: string
  locations?: {
    name: string
    gln: string
  }
}

type Location = {
  id: string
  name: string
  gln: string
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [formData, setFormData] = useState({
    device_id: '',
    device_name: '',
    device_type: 'temperature_sensor' as Device['device_type'],
    location_id: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadDevices()
    loadLocations()
  }, [])

  const loadDevices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('iot_devices')
      .select('*, locations(name, gln)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDevices(data)
    }
    setLoading(false)
  }

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, gln')
      .order('name')
    
    if (data) {
      setLocations(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase
      .from('iot_devices')
      .insert([{
        device_id: formData.device_id,
        device_name: formData.device_name,
        device_type: formData.device_type,
        location_id: formData.location_id || null,
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
        description: t('devices.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({
        device_id: '',
        device_name: '',
        device_type: 'temperature_sensor',
        location_id: '',
      })
      loadDevices()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('iot_devices')
      .delete()
      .eq('id', id)

    if (!error) {
      toast({
        title: t('common.success'),
        description: t('devices.deleteSuccess'),
      })
      loadDevices()
    }
  }

  const handleStatusChange = async (id: string, status: Device['status']) => {
    const { error } = await supabase
      .from('iot_devices')
      .update({ status })
      .eq('id', id)

    if (!error) {
      toast({
        title: t('common.success'),
        description: t('devices.statusUpdated'),
      })
      loadDevices()
    }
  }

  const handleViewDetails = (device: Device) => {
    setSelectedDevice(device)
    setIsDetailDialogOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'inactive':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      case 'maintenance':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
    }
  }

  const stats = {
    total: devices.length,
    active: devices.filter(d => d.status === 'active').length,
    inactive: devices.filter(d => d.status === 'inactive').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length,
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('devices.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('devices.subtitle')}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('devices.addDevice')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('devices.stats.totalDevices')}</p>
              <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('devices.stats.active')}</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('devices.stats.inactive')}</p>
              <p className="text-3xl font-bold text-gray-600">{stats.inactive}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('devices.stats.maintenance')}</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.maintenance}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('devices.deviceList')}</CardTitle>
          <CardDescription>{t('devices.deviceListDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('devices.noDevices')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('devices.table.deviceId')}</TableHead>
                  <TableHead>{t('devices.table.name')}</TableHead>
                  <TableHead>{t('devices.table.type')}</TableHead>
                  <TableHead>{t('devices.table.location')}</TableHead>
                  <TableHead>{t('devices.table.status')}</TableHead>
                  <TableHead>{t('devices.table.lastReading')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-mono text-sm">{device.device_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{device.device_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{device.device_type.replace(/_/g, ' ')}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {device.locations ? device.locations.name : '-'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={device.status}
                        onValueChange={(v: Device['status']) => handleStatusChange(device.id, v)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">
                            {t('devices.status.active')}
                          </SelectItem>
                          <SelectItem value="inactive">
                            {t('devices.status.inactive')}
                          </SelectItem>
                          <SelectItem value="maintenance">
                            {t('devices.status.maintenance')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {device.last_reading_at 
                        ? new Date(device.last_reading_at).toLocaleString()
                        : t('devices.noReadings')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => window.location.href = `/admin/devices/${device.device_id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(device.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Device Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devices.createDevice')}</DialogTitle>
            <DialogDescription>{t('devices.createDeviceDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device_id">{t('devices.form.deviceId')} *</Label>
              <Input
                id="device_id"
                placeholder="TEMP-001"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_name">{t('devices.form.deviceName')} *</Label>
              <Input
                id="device_name"
                placeholder={t('devices.form.deviceNamePlaceholder')}
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_type">{t('devices.form.deviceType')} *</Label>
              <Select
                value={formData.device_type}
                onValueChange={(v: Device['device_type']) => setFormData({ ...formData, device_type: v })}
              >
                <SelectTrigger id="device_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperature_sensor">{t('devices.types.temperatureSensor')}</SelectItem>
                  <SelectItem value="humidity_sensor">{t('devices.types.humiditySensor')}</SelectItem>
                  <SelectItem value="gps_tracker">{t('devices.types.gpsTracker')}</SelectItem>
                  <SelectItem value="weighing_scale">{t('devices.types.weighingScale')}</SelectItem>
                  <SelectItem value="rfid_reader">{t('devices.types.rfidReader')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_id">{t('devices.form.location')}</Label>
              <Select
                value={formData.location_id}
                onValueChange={(v) => setFormData({ ...formData, location_id: v })}
              >
                <SelectTrigger id="location_id">
                  <SelectValue placeholder={t('devices.form.selectLocation')} />
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
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('common.create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Device Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('devices.deviceDetails')}</DialogTitle>
            <DialogDescription>{t('devices.deviceDetailsDesc')}</DialogDescription>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.form.deviceId')}</p>
                  <p className="text-sm font-mono font-medium">{selectedDevice.device_id}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.form.deviceName')}</p>
                  <p className="text-sm font-medium">{selectedDevice.device_name}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.form.deviceType')}</p>
                  <p className="text-sm font-medium capitalize">{selectedDevice.device_type.replace(/_/g, ' ')}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.table.status')}</p>
                  <Badge variant="outline" className={getStatusColor(selectedDevice.status)}>
                    {t(`devices.status.${selectedDevice.status}`)}
                  </Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.form.location')}</p>
                  <p className="text-sm font-medium">{selectedDevice.locations?.name || '-'}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded">
                  <p className="text-xs text-muted-foreground mb-1">{t('devices.table.lastReading')}</p>
                  <p className="text-sm font-medium">
                    {selectedDevice.last_reading_at 
                      ? new Date(selectedDevice.last_reading_at).toLocaleString()
                      : t('devices.noReadings')}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded text-xs">
                <span className="text-muted-foreground">{t('common.createdAt')}:</span>{' '}
                <span className="font-mono">{new Date(selectedDevice.created_at).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
