'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function VisionTestPanel() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleTest = async () => {
    if (!imageFile) {
      alert('Please select an image')
      return
    }

    setLoading(true)
    try {
      // TODO: Implement vision API test
      console.log('[v0] Testing vision API with image:', imageFile.name)
    } catch (error) {
      console.error('[v0] Vision test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload Image</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </div>

      <Button onClick={handleTest} disabled={loading}>
        {loading ? 'Processing...' : 'Test Vision API'}
      </Button>

      {result && (
        <Textarea value={JSON.stringify(result, null, 2)} rows={10} readOnly />
      )}
    </div>
  )
}
