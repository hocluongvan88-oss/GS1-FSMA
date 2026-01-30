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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Plus, Eye, FileText } from 'lucide-react'
import { useLocale } from '@/lib/locale-context'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface ExportDocument {
  id: string
  doc_type: 'fsma204' | 'eudr'
  batch_id: string
  batch_number?: string
  product_name?: string
  status: 'draft' | 'pending' | 'completed' | 'rejected'
  document_data: any
  pdf_url?: string
  created_at: string
}

interface Batch {
  id: string
  batch_number: string
  product_id: string
  products: {
    name: string
    gtin: string
  }
}

export default function ExportDocsPage() {
  const { t } = useLocale()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [documents, setDocuments] = useState<ExportDocument[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<ExportDocument | null>(null)
  const [formData, setFormData] = useState({
    doc_type: 'fsma204' as 'fsma204' | 'eudr',
    batch_id: '',
  })

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('export_documents')
      .select(`
        *,
        batches (
          batch_number,
          products (
            name,
            gtin
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const formatted = data.map(doc => ({
        ...doc,
        batch_number: doc.batches?.batch_number,
        product_name: doc.batches?.products?.name
      }))
      setDocuments(formatted)
    }
    setLoading(false)
  }

  const loadBatches = async () => {
    const { data } = await supabase
      .from('batches')
      .select('id, batch_number, product_id, products(name, gtin)')
      .order('created_at', { ascending: false })

    if (data) {
      setBatches(data as any)
    }
  }

  useEffect(() => {
    loadDocuments()
    loadBatches()

    // Real-time subscription
    const channel = supabase
      .channel('export_documents_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'export_documents' },
        () => loadDocuments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleGenerate = async () => {
    if (!formData.batch_id) {
      toast({
        title: t('common.error'),
        description: t('exportDocs.selectBatchRequired'),
        variant: 'destructive',
      })
      return
    }

    const batch = batches.find(b => b.id === formData.batch_id)
    if (!batch) return

    // Generate document data based on type
    const documentData = formData.doc_type === 'fsma204' 
      ? generateFSMA204Data(batch)
      : generateEUDRData(batch)

    const { error } = await supabase
      .from('export_documents')
      .insert({
        doc_type: formData.doc_type,
        batch_id: formData.batch_id,
        status: 'completed',
        document_data: documentData,
      })

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('exportDocs.generateSuccess'),
      })
      setIsDialogOpen(false)
      setFormData({ doc_type: 'fsma204', batch_id: '' })
      loadDocuments()
    }
  }

  const generateFSMA204Data = (batch: Batch) => ({
    regulation: 'FSMA 204 - Food Traceability Rule',
    batch_number: batch.batch_number,
    product_name: batch.products?.name,
    gtin: batch.products?.gtin,
    traceability_lot_code: batch.batch_number,
    harvest_date: new Date().toISOString().split('T')[0],
    cooled_date: new Date().toISOString().split('T')[0],
    initial_pack_date: new Date().toISOString().split('T')[0],
    location_description: 'Facility registered with FDA',
    reference_document_type: 'Traceability certificate',
    reference_document_number: `FSMA-${batch.batch_number}`,
  })

  const generateEUDRData = (batch: Batch) => ({
    regulation: 'EU Deforestation Regulation (EUDR)',
    batch_number: batch.batch_number,
    product_name: batch.products?.name,
    commodity_category: 'Coffee',
    country_of_production: 'Vietnam',
    geolocation_info: {
      latitude: 11.9404,
      longitude: 108.4583,
      polygon_coordinates: []
    },
    deforestation_free_statement: 'This product is deforestation-free',
    due_diligence_completed: true,
    risk_assessment: 'Low risk',
    certification_date: new Date().toISOString().split('T')[0],
  })

  const handleView = (doc: ExportDocument) => {
    setSelectedDoc(doc)
    setIsViewDialogOpen(true)
  }

  const handleDownload = (doc: ExportDocument) => {
    // Generate PDF content
    const content = JSON.stringify(doc.document_data, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.doc_type.toUpperCase()}-${doc.batch_number || doc.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: t('common.success'),
      description: t('exportDocs.downloadSuccess'),
    })
  }

  const stats = {
    fsma204: {
      total: documents.filter(d => d.doc_type === 'fsma204').length,
      completed: documents.filter(d => d.doc_type === 'fsma204' && d.status === 'completed').length,
    },
    eudr: {
      total: documents.filter(d => d.doc_type === 'eudr').length,
      completed: documents.filter(d => d.doc_type === 'eudr' && d.status === 'completed').length,
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('exportDocs.title')}
          </h1>
          <p className="text-muted-foreground">{t('exportDocs.subtitle')}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('exportDocs.create')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('exportDocs.stats.fsma204')}</CardTitle>
            <CardDescription>{t('exportDocs.stats.fsma204Desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('exportDocs.stats.totalDocs')}</span>
                <span className="font-medium">{stats.fsma204.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('exportDocs.stats.compliance')}</span>
                <Badge variant="default">
                  {stats.fsma204.total > 0 
                    ? Math.round((stats.fsma204.completed / stats.fsma204.total) * 100) + '%'
                    : '0%'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('exportDocs.stats.eudr')}</CardTitle>
            <CardDescription>{t('exportDocs.stats.eudrDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('exportDocs.stats.totalDocsEU')}</span>
                <span className="font-medium">{stats.eudr.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('exportDocs.stats.compliance')}</span>
                <Badge variant="default">
                  {stats.eudr.total > 0 
                    ? Math.round((stats.eudr.completed / stats.eudr.total) * 100) + '%'
                    : '0%'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('exportDocs.recentDocs')}</CardTitle>
          <CardDescription>{t('exportDocs.recentDocsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>{t('exportDocs.noDocs')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('exportDocs.docType')}</TableHead>
                  <TableHead>{t('exportDocs.batch')}</TableHead>
                  <TableHead>{t('exportDocs.product')}</TableHead>
                  <TableHead>{t('exportDocs.status')}</TableHead>
                  <TableHead>{t('exportDocs.date')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.doc_type === 'fsma204' ? t('exportDocs.fsma204') : t('exportDocs.eudr')}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{doc.batch_number || '-'}</TableCell>
                    <TableCell>{doc.product_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={doc.status === 'completed' ? 'default' : 'secondary'}>
                        {t(`exportDocs.${doc.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleView(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-4 w-4" />
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

      {/* Generate Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('exportDocs.createTitle')}</DialogTitle>
            <DialogDescription>{t('exportDocs.createDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('exportDocs.form.docType')}</Label>
              <Select 
                value={formData.doc_type}
                onValueChange={(v: 'fsma204' | 'eudr') => setFormData({ ...formData, doc_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('exportDocs.form.selectDocType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fsma204">{t('exportDocs.docTypes.fsma204')}</SelectItem>
                  <SelectItem value="eudr">{t('exportDocs.docTypes.eudr')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('exportDocs.form.batch')}</Label>
              <Select 
                value={formData.batch_id}
                onValueChange={(v) => setFormData({ ...formData, batch_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('exportDocs.form.selectBatch')} />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => {
                    // Shorten batch number: remove GTIN prefix, keep only BATCH-XXX
                    const shortBatch = batch.batch_number.includes('BATCH-') 
                      ? batch.batch_number.split('BATCH-')[1] 
                      : batch.batch_number;
                    return (
                      <SelectItem key={batch.id} value={batch.id}>
                        LOT{shortBatch} - {batch.products?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleGenerate}>
              {t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('exportDocs.documentDetails')}</DialogTitle>
            <DialogDescription>
              {selectedDoc?.doc_type === 'fsma204' ? t('exportDocs.fsma204') : t('exportDocs.eudr')}
            </DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">{t('exportDocs.batchInfo')}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('exportDocs.batch')}:</span>
                    <p className="font-mono">{selectedDoc.batch_number}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('exportDocs.product')}:</span>
                    <p>{selectedDoc.product_name}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">{t('exportDocs.documentData')}</h4>
                <div className="bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-xs">
                    {JSON.stringify(selectedDoc.document_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
