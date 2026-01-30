'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function TransformationTestPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleTest = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/events/transformation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputQuantity: [{ value: 100, uom: 'kg', gtin: '8412345678901' }],
          outputQuantity: [{ value: 80, uom: 'kg', gtin: '8412345678902' }],
          location: '8412345678901',
          bizStep: 'commissioning'
        })
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('[v0] Transformation test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleTest} disabled={loading}>
        {loading ? 'Testing...' : 'Test Transformation Event'}
      </Button>

      {result && (
        <div className="space-y-2">
          <Label>Result</Label>
          <Textarea 
            value={JSON.stringify(result, null, 2)} 
            rows={15} 
            readOnly 
            className="font-mono text-xs"
          />
        </div>
      )}
    </div>
  )
}
