'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Trash2, MapPin, Edit } from 'lucide-react'
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
import { geocodeAddress, isValidVietnamCoordinates } from '@/lib/geocoding'

type Location = {
  id: string
  gln: string
  name: string
  type: string
  address: any // Database uses jsonb
  coordinates?: any // Database uses jsonb for coordinates, not separate lat/lng
  created_at: string
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [formData, setFormData] = useState({
    gln: '',
    name: '',
    type: 'farm',
    address: '',
    latitude: '',
    longitude: '',
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: 'farm',
    address: '',
    latitude: '',
    longitude: '',
    edit_reason: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setLocations(data)
    }
  }

  // Auto-geocode address with debounce
  const handleAddressChange = async (address: string) => {
    setFormData({ ...formData, address })

    // Only auto-geocode if address is substantial (> 10 chars)
    if (address.length < 10) return

    setIsGeocoding(true)
    
    // Debounce for better UX
    setTimeout(async () => {
      const result = await geocodeAddress(address)
      
      if (result) {
        // Validate coordinates are in Vietnam
        if (isValidVietnamCoordinates(result.latitude, result.longitude)) {
          setFormData(prev => ({
            ...prev,
            latitude: result.latitude.toFixed(6),
            longitude: result.longitude.toFixed(6),
          }))
          
          toast({
            title: t('locations.geocodingSuccess'),
            description: `${t('locations.coordinatesFound')}: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
          })
        } else {
          toast({
            title: t('locations.geocodingWarning'),
            description: t('locations.coordinatesOutsideVietnam'),
            variant: 'destructive',
          })
        }
      }
      
      setIsGeocoding(false)
    }, 1000) // 1 second debounce
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prepare data according to database schema
    const locationData: any = {
      gln: formData.gln,
      name: formData.name,
      type: formData.type,
      address: formData.address ? { full_address: formData.address } : null,
    }
    
    // Add coordinates if both lat/lng provided
    if (formData.latitude && formData.longitude) {
      locationData.coordinates = {
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      }
    }
    
    const { error } = await supabase
      .from('locations')
      .insert([locationData])
    
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('locations.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({ gln: '', name: '', type: 'farm', address: '', latitude: '', longitude: '' })
      loadLocations()
    }
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setEditFormData({
      name: location.name,
      type: location.type,
      address: location.address?.full_address || '',
      latitude: location.coordinates?.latitude?.toString() || '',
      longitude: location.coordinates?.longitude?.toString() || '',
      edit_reason: '',
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingLocation) return
    
    if (!editFormData.edit_reason.trim()) {
      toast({
        title: t('common.error'),
        description: t('locations.editReasonRequired'),
        variant: 'destructive',
      })
      return
    }

    try {
      // Prepare update data
      const updateData: any = {
        name: editFormData.name,
        type: editFormData.type,
        edit_reason: editFormData.edit_reason,
      }

      // Update address if changed
      if (editFormData.address) {
        updateData.address = { full_address: editFormData.address }
      }

      // Update coordinates if changed
      if (editFormData.latitude && editFormData.longitude) {
        updateData.coordinates = {
          latitude: parseFloat(editFormData.latitude),
          longitude: parseFloat(editFormData.longitude),
        }
      }

      const response = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Update failed')
      }

      toast({
        title: t('common.success'),
        description: t('locations.updateSuccess'),
      })
      
      setIsEditDialogOpen(false)
      setEditingLocation(null)
      loadLocations()
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('locations.deleteSuccess'),
      })
      loadLocations()
    }
  }

  const getLocationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      farm: 'bg-green-500/10 text-green-500',
      factory: 'bg-blue-500/10 text-blue-500',
      warehouse: 'bg-yellow-500/10 text-yellow-500',
      retail: 'bg-purple-500/10 text-purple-500',
    }
    return colors[type] || 'bg-gray-500/10 text-gray-500'
  }

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('locations.title')}</CardTitle>
            <CardDescription>{t('locations.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('locations.addLocation')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('locations.createLocation')}</DialogTitle>
                <DialogDescription>{t('locations.createLocationDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gln">{t('locations.gln')} *</Label>
                  <Input
                    id="gln"
                    placeholder={t('locations.glnPlaceholder')}
                    value={formData.gln}
                    onChange={(e) => setFormData({ ...formData, gln: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t('locations.locationName')} *</Label>
                  <Input
                    id="name"
                    placeholder={t('locations.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t('locations.locationType')} *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="farm">{t('locations.types.farm')}</SelectItem>
                      <SelectItem value="factory">{t('locations.types.factory')}</SelectItem>
                      <SelectItem value="warehouse">{t('locations.types.warehouse')}</SelectItem>
                      <SelectItem value="retail">{t('locations.types.retail')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('locations.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('locations.addressPlaceholder')}
                    value={formData.address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    disabled={isGeocoding}
                  />
                  {isGeocoding && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      {t('locations.geocoding')}...
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('locations.geocodingHint')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">{t('locations.latitude')}</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="11.9404"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">{t('locations.longitude')}</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="108.4583"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('locations.coordinatesAutoFilled')}
                </p>
                <Button type="submit" className="w-full">{t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('locations.editLocation')}</DialogTitle>
                <DialogDescription>{t('locations.editLocationDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gln">{t('locations.gln')} ({t('common.immutable')})</Label>
                  <Input
                    id="edit-gln"
                    value={editingLocation?.gln || ''}
                    disabled
                    className="bg-muted font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('locations.glnImmutableHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t('locations.locationName')} *</Label>
                  <Input
                    id="edit-name"
                    placeholder={t('locations.namePlaceholder')}
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">{t('locations.locationType')} *</Label>
                  <Select
                    value={editFormData.type}
                    onValueChange={(v) => setEditFormData({ ...editFormData, type: v })}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="farm">{t('locations.types.farm')}</SelectItem>
                      <SelectItem value="factory">{t('locations.types.factory')}</SelectItem>
                      <SelectItem value="warehouse">{t('locations.types.warehouse')}</SelectItem>
                      <SelectItem value="retail">{t('locations.types.retail')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">{t('locations.address')}</Label>
                  <Input
                    id="edit-address"
                    placeholder={t('locations.addressPlaceholder')}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-latitude">{t('locations.latitude')}</Label>
                    <Input
                      id="edit-latitude"
                      type="number"
                      step="any"
                      placeholder="11.9404"
                      value={editFormData.latitude}
                      onChange={(e) => setEditFormData({ ...editFormData, latitude: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-longitude">{t('locations.longitude')}</Label>
                    <Input
                      id="edit-longitude"
                      type="number"
                      step="any"
                      placeholder="108.4583"
                      value={editFormData.longitude}
                      onChange={(e) => setEditFormData({ ...editFormData, longitude: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="edit-reason" className="text-orange-600">
                    {t('locations.editReason')} *
                  </Label>
                  <Input
                    id="edit-reason"
                    placeholder={t('locations.editReasonPlaceholder')}
                    value={editFormData.edit_reason}
                    onChange={(e) => setEditFormData({ ...editFormData, edit_reason: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('locations.editReasonHint')}
                  </p>
                </div>
                <Button type="submit" className="w-full">{t('common.update')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('locations.gln')}</TableHead>
                <TableHead>{t('locations.locationName')}</TableHead>
                <TableHead>{t('locations.locationType')}</TableHead>
                <TableHead>{t('locations.address')}</TableHead>
                <TableHead>{t('locations.coordinates')}</TableHead>
                <TableHead className="text-right">{t('locations.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-mono text-sm">{location.gln}</TableCell>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getLocationTypeColor(location.type)}>
                      {location.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {location.address?.full_address || 
                     (typeof location.address === 'object' && location.address 
                       ? `${location.address.street || ''}, ${location.address.city || ''}, ${location.address.province || ''}, ${location.address.country || ''}`.replace(/^,\s*|,\s*,\s*/g, ', ').trim()
                       : location.address || '-')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {location.coordinates?.latitude && location.coordinates?.longitude ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {location.coordinates.latitude.toFixed(4)}, {location.coordinates.longitude.toFixed(4)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(location)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(location.id)}
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
