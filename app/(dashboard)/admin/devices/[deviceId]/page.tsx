import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DeviceDetailClient from './device-detail-client'

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>
}) {
  const { deviceId } = await params
  const supabase = await createClient()

  try {
    console.log('[v0] Fetching device with ID:', deviceId)
    
    // Fetch device details
    const { data: device, error: deviceError } = await supabase
      .from('iot_devices')
      .select('*')
      .eq('device_id', deviceId)
      .single()

    console.log('[v0] Device query result:', { device, error: deviceError })

    if (deviceError) {
      console.error('[v0] Device fetch error:', deviceError)
      notFound()
    }

    if (!device) {
      console.log('[v0] No device found for ID:', deviceId)
      notFound()
    }

    // Fetch recent readings (last 100)
    const { data: readings, error: readingsError } = await supabase
      .from('iot_device_readings')
      .select('*')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (readingsError) {
      console.error('[v0] Readings fetch error:', readingsError)
    }

    return (
      <DeviceDetailClient
        device={device}
        initialReadings={readings || []}
      />
    )
  } catch (error) {
    console.error('[v0] Unexpected error:', error)
    notFound()
  }
}
