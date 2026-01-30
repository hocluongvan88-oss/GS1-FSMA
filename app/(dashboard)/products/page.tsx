'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/locale-context'

type Product = {
  id: string
  gtin: string
  name: string
  category: string
  unit: string
  created_at: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    gtin: '',
    name: '',
    category: '',
    unit: 'kg',
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    edit_reason: '',
  })
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setProducts(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if GTIN already exists
    const { data: existingProduct } = await supabase
      .from('products')
      .select('gtin')
      .eq('gtin', formData.gtin)
      .single()
    
    if (existingProduct) {
      toast({
        title: t('products.duplicateError'),
        description: t('products.gtinExists').replace('{gtin}', formData.gtin),
        variant: 'destructive',
      })
      return
    }
    
    const { error } = await supabase
      .from('products')
      .insert([formData])
    
    if (error) {
      // Handle duplicate key error specifically
      if (error.code === '23505' && error.message.includes('products_gtin_key')) {
        toast({
          title: t('products.duplicateError'),
          description: t('products.gtinExists').replace('{gtin}', formData.gtin),
          variant: 'destructive',
        })
      } else {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: 'destructive',
        })
      }
    } else {
      toast({
        title: t('common.success'),
        description: t('products.createSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({ gtin: '', name: '', category: '', unit: 'kg' })
      loadProducts()
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setEditFormData({
      name: product.name,
      category: product.category,
      unit: product.unit,
      edit_reason: '',
    })
    setIsEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingProduct) return
    
    if (!editFormData.edit_reason.trim()) {
      toast({
        title: t('common.error'),
        description: t('products.editReasonRequired'),
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Update failed')
      }

      toast({
        title: t('common.success'),
        description: t('products.updateSuccess'),
      })
      
      setIsEditDialogOpen(false)
      setEditingProduct(null)
      loadProducts()
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
      .from('products')
      .delete()
      .eq('id', id)
    
    if (!error) {
      toast({
        title: t('common.success'),
        description: t('products.deleteSuccess'),
      })
      loadProducts()
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('products.title')}</CardTitle>
            <CardDescription>{t('products.subtitle')}</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('products.addProduct')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('products.createProduct')}</DialogTitle>
                <DialogDescription>{t('products.createProductDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gtin">{t('products.gtin')} *</Label>
                  <Input
                    id="gtin"
                    placeholder={t('products.gtinPlaceholder')}
                    value={formData.gtin}
                    onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t('products.productName')} *</Label>
                  <Input
                    id="name"
                    placeholder={t('products.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">{t('products.category')}</Label>
                  <Input
                    id="category"
                    placeholder={t('products.categoryPlaceholder')}
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">{t('products.unit')}</Label>
                  <Input
                    id="unit"
                    placeholder={t('products.unitPlaceholder')}
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">{t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('products.editProduct')}</DialogTitle>
                <DialogDescription>{t('products.editProductDesc')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gtin">{t('products.gtin')} ({t('common.immutable')})</Label>
                  <Input
                    id="edit-gtin"
                    value={editingProduct?.gtin || ''}
                    disabled
                    className="bg-muted font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('products.gtinImmutableHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t('products.productName')} *</Label>
                  <Input
                    id="edit-name"
                    placeholder={t('products.namePlaceholder')}
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">{t('products.category')}</Label>
                  <Input
                    id="edit-category"
                    placeholder={t('products.categoryPlaceholder')}
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unit">{t('products.unit')}</Label>
                  <Input
                    id="edit-unit"
                    placeholder={t('products.unitPlaceholder')}
                    value={editFormData.unit}
                    onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                  />
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="edit-reason" className="text-orange-600">
                    {t('products.editReason')} *
                  </Label>
                  <Input
                    id="edit-reason"
                    placeholder={t('products.editReasonPlaceholder')}
                    value={editFormData.edit_reason}
                    onChange={(e) => setEditFormData({ ...editFormData, edit_reason: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('products.editReasonHint')}
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
                <TableHead>{t('products.gtin')}</TableHead>
                <TableHead>{t('products.productName')}</TableHead>
                <TableHead>{t('products.category')}</TableHead>
                <TableHead>{t('products.unit')}</TableHead>
                <TableHead>{t('products.createdAt')}</TableHead>
                <TableHead className="text-right">{t('products.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.gtin}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(product.created_at).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
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
