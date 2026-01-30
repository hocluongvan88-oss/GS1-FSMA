'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/locale-context'

type AIJob = {
  id: string
  job_type: string
  status: string
  confidence_score: number | null
  ai_result: any
  human_review_notes: string | null
  created_at: string
  metadata: any
}

export default function AIReviewPage() {
  const [jobs, setJobs] = useState<AIJob[]>([])
  const [selectedJob, setSelectedJob] = useState<AIJob | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const { t } = useLocale()

  useEffect(() => {
    loadJobs()
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('ai_queue_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_processing_queue' },
        () => {
          loadJobs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('ai_processing_queue')
      .select('*')
      .in('status', ['pending_review', 'processing', 'completed'])
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (!error && data) {
      setJobs(data)
    }
  }

  const handleReview = (job: AIJob) => {
    setSelectedJob(job)
    setReviewNotes(job.human_review_notes || '')
    setIsDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedJob) return

    const { error } = await fetch('/api/ai-queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: selectedJob.id,
        action: 'approve',
        notes: reviewNotes,
      }),
    }).then(r => r.json()).then(data => ({ error: data.error }))

    if (error) {
      toast({
        title: t('common.error'),
        description: t('aiReview.messages.approveError'),
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('aiReview.messages.approved'),
      })
      setIsDialogOpen(false)
      loadJobs()
    }
  }

  const handleReject = async () => {
    if (!selectedJob) return

    const { error } = await fetch('/api/ai-queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: selectedJob.id,
        action: 'reject',
        notes: reviewNotes,
      }),
    }).then(r => r.json()).then(data => ({ error: data.error }))

    if (error) {
      toast({
        title: t('common.error'),
        description: t('aiReview.messages.rejectError'),
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('common.success'),
        description: t('aiReview.messages.rejected'),
      })
      setIsDialogOpen(false)
      loadJobs()
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      processing: 'bg-blue-500/10 text-blue-500',
      pending_review: 'bg-yellow-500/10 text-yellow-500',
      completed: 'bg-green-500/10 text-green-500',
      failed: 'bg-red-500/10 text-red-500',
    }
    return colors[status] || 'bg-gray-500/10 text-gray-500'
  }

  const getJobTypeLabel = (jobType: string) => {
    const labels: Record<string, string> = {
      voice_transcription: 'Voice - Transcription',
      vision_ocr: 'Vision - OCR',
      vision_counting: 'Vision - Counting',
      nlp_extraction: 'NLP - Extraction',
    }
    return labels[jobType] || jobType
  }

  const pendingReviewCount = jobs.filter(j => j.status === 'pending_review').length

  return (
    <div className="container mx-auto p-6">
      <Toaster />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Review Queue - Human-in-the-Loop</CardTitle>
              <CardDescription>
                Xem và duyệt các kết quả AI có confidence thấp cần xác nhận
              </CardDescription>
            </div>
            {pendingReviewCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
                <AlertCircle className="mr-1 h-3 w-3" />
                {pendingReviewCount} cần review
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>AI Result</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {getJobTypeLabel(job.job_type)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.confidence_score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              job.confidence_score >= 0.85 ? 'bg-green-500' :
                              job.confidence_score >= 0.7 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${job.confidence_score * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {(job.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(job.created_at).toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {job.ai_result ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {JSON.stringify(job.ai_result).substring(0, 50)}...
                      </code>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReview(job)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review AI Result</DialogTitle>
            <DialogDescription>
              Xác nhận hoặc từ chối kết quả AI processing
            </DialogDescription>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Job Type</Label>
                  <p className="font-medium">{getJobTypeLabel(selectedJob.job_type)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Confidence Score</Label>
                  <p className="font-medium">
                    {selectedJob.confidence_score !== null 
                      ? `${(selectedJob.confidence_score * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">AI Result</Label>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-60">
                  {JSON.stringify(selectedJob.ai_result, null, 2)}
                </pre>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Input Metadata</Label>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-40">
                  {JSON.stringify(selectedJob.metadata, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Thêm ghi chú về quyết định review..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  className="flex-1"
                  variant="default"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve & Create Event
                </Button>
                <Button
                  onClick={handleReject}
                  className="flex-1"
                  variant="destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
