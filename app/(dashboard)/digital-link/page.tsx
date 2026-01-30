'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QrCode, Download, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Image from 'next/image'

interface Product {
  id: string
  gtin: string
  name: string
}

interface Batch {
  id: string
  batch_number: string
  traceability_lot_code: string
  product_id: string
}

interface DigitalLink {
  id: string
  short_url: string
  gtin: string
  lot: string | null
  serial: string | null
  access_count: number
  created_at: string
  gs1_digital_link?: string
  qr_code_url?: string
  link_type?: string
}

export default function DigitalLinkPage() {
  const { t } = useLocale()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [digitalLinks, setDigitalLinks] = useState<DigitalLink[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [serial, setSerial] = useState('')
  const [linkType, setLinkType] = useState<string>('traceability')
  
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedQR, setSelectedQR] = useState<DigitalLink | null>(null)

  useEffect(() => {
    loadProducts()
    loadDigitalLinks()
  }, [])

  useEffect(() => {
    if (selectedProductId) {
      loadBatches(selectedProductId)
    } else {
      setBatches([])
      setSelectedBatchId('')
    }
  }, [selectedProductId])

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, gtin, name')
      .order('name')
    if (data) setProducts(data)
  }

  const loadBatches = async (productId: string) => {
    const { data } = await supabase
      .from('batches')
      .select('id, batch_number, traceability_lot_code, product_id')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    if (data) setBatches(data)
  }

  const loadDigitalLinks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('digital_links')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setDigitalLinks(data)
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!selectedProductId) {
      toast({
        title: t('common.error'),
        description: t('digitalLink.selectProduct'),
        variant: 'destructive',
      })
      return
    }

    const product = products.find(p => p.id === selectedProductId)
    const batch = batches.find(b => b.id === selectedBatchId)

    if (!product) return

    setGenerating(true)

    try {
      const response = await fetch('/api/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gtin: product.gtin,
          lot: batch?.traceability_lot_code || null,
          serial: serial || null,
          metadata: {
            product_name: product.name,
            link_type: linkType,
          }
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate QR code')
      }

      toast({
        title: t('common.success'),
        description: t('digitalLink.generateSuccess'),
      })

      loadDigitalLinks()
      
      // Reset form
      setSelectedProductId('')
      setSelectedBatchId('')
      setSerial('')
      
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: t('common.success'),
      description: t('digitalLink.copiedToClipboard'),
    })
  }

  const downloadQR = async (link: DigitalLink) => {
    try {
      const qrUrl = link.qr_code_url || generateQRCodeUrl(link)
      
      // Fetch the image as blob to bypass CORS
      const response = await fetch(qrUrl.replace('format=svg', 'format=png'))
      const blob = await response.blob()
      
      // Create blob URL and download
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `QR-${link.gtin}-${link.lot || 'no-lot'}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl)
      
      toast({
        title: t('common.success'),
        description: t('digitalLink.downloadSuccess'),
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Failed to download QR code',
        variant: 'destructive',
      })
    }
  }

  const generateQRCodeUrl = (link: DigitalLink) => {
    const shortUrl = `${window.location.origin}/dl/${link.short_url}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shortUrl)}&format=svg`
  }

  const showQRCode = (link: DigitalLink) => {
    setSelectedQR(link)
    setQrDialogOpen(true)
  }

  const getProductName = (gtin: string) => {
    const product = products.find(p => p.gtin === gtin)
    return product?.name || gtin
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('digitalLink.title')}
        </h1>
        <p className="text-muted-foreground">{t('digitalLink.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('digitalLink.generateTitle')}</CardTitle>
          <CardDescription>{t('digitalLink.generateDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product">{t('digitalLink.product')} *</Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder={t('digitalLink.selectProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch">{t('digitalLink.batch')}</Label>
              <Select
                value={selectedBatchId}
                onValueChange={setSelectedBatchId}
                disabled={!selectedProductId}
              >
                <SelectTrigger id="batch">
                  <SelectValue placeholder={t('digitalLink.selectBatch')} />
                </SelectTrigger>
                <SelectContent>
                  {batches.map(batch => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.traceability_lot_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serial">{t('digitalLink.serial')}</Label>
              <Input
                id="serial"
                placeholder="SN12345"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkType">{t('digitalLink.linkType')}</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger id="linkType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="traceability">{t('digitalLink.linkTypes.traceability')}</SelectItem>
                  <SelectItem value="pip">{t('digitalLink.linkTypes.pip')}</SelectItem>
                  <SelectItem value="certificationInfo">{t('digitalLink.linkTypes.certificationInfo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={!selectedProductId || generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('digitalLink.generating')}
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                {t('digitalLink.generateQR')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('digitalLink.historyTitle')}</CardTitle>
          <CardDescription>{t('digitalLink.historyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('digitalLink.product')}</TableHead>
                  <TableHead>{t('digitalLink.lot')}</TableHead>
                  <TableHead>{t('digitalLink.shortUrl')}</TableHead>
                  <TableHead>{t('digitalLink.scans')}</TableHead>
                  <TableHead>{t('digitalLink.created')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {digitalLinks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('digitalLink.noLinks')}
                    </TableCell>
                  </TableRow>
                ) : (
                  digitalLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>{getProductName(link.gtin)}</TableCell>
                      <TableCell className="font-mono text-sm">{link.lot || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">
                        {`${window.location.origin}/dl/${link.short_url}`}
                      </TableCell>
                      <TableCell>{link.access_count}</TableCell>
                      <TableCell>
                        {new Date(link.created_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => showQRCode(link)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => downloadQR(link)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => copyToClipboard(`${window.location.origin}/dl/${link.short_url}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('digitalLink.qrCodePreview')}</DialogTitle>
            <DialogDescription>
              {selectedQR && `${getProductName(selectedQR.gtin)} - ${selectedQR.lot || t('digitalLink.noLot')}`}
            </DialogDescription>
          </DialogHeader>
          {selectedQR && (
            <div className="space-y-4">
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <img
                  src={selectedQR.qr_code_url || generateQRCodeUrl(selectedQR)}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('digitalLink.shortUrl')}</Label>
                <div className="flex gap-2">
                  <Input 
                    value={`${window.location.origin}/dl/${selectedQR.short_url}`} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(`${window.location.origin}/dl/${selectedQR.short_url}`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => downloadQR(selectedQR)}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('digitalLink.download')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.open(`/dl/${selectedQR.short_url}`, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('digitalLink.openLink')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
