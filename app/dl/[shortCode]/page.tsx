/**
 * GS1 Digital Link Consumer Page
 * Public-facing product traceability information
 */

import { createClient } from '@supabase/supabase-js'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PageProps {
  params: {
    shortCode: string
  }
}

export default async function DigitalLinkPage({ params }: PageProps) {
  const { shortCode } = await params

  console.log('[v0] Resolving digital link for shortCode:', shortCode)

  // Fetch digital link data
  const { data: linkData, error: linkError } = await supabase
    .from('digital_links')
    .select('*')
    .eq('short_url', shortCode)
    .single()

  console.log('[v0] Digital link query result:', { linkData, linkError })

  if (!linkData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Product Not Found</h1>
          <p className="text-muted-foreground">
            The product you're looking for could not be found.
            {linkError && <><br /><span className="text-xs">Error: {linkError.message}</span></>}
          </p>
        </Card>
      </div>
    )
  }

  // Fetch product info
  const { data: productData } = await supabase
    .from('products')
    .select('*')
    .eq('gtin', linkData.gtin)
    .single()

  // Fetch traceability events
  const { data: eventsData } = await supabase
    .from('events')
    .select('*, locations(name, type)')
    .contains('epc_list', [linkData.epc])
    .order('event_time', { ascending: false })

  // Update access count
  await supabase
    .from('digital_links')
    .update({ access_count: (linkData.access_count || 0) + 1 })
    .eq('id', linkData.id)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-foreground">Product Traceability</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Product Information */}
        <Card className="p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">{productData?.name}</h2>
              <p className="text-muted-foreground">{productData?.description}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              GTIN: {linkData.gtin}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="text-lg font-medium text-foreground capitalize">{productData?.category}</p>
            </div>
            {linkData.lot && (
              <div>
                <p className="text-sm text-muted-foreground">Lot Number</p>
                <p className="text-lg font-medium text-foreground">{linkData.lot}</p>
              </div>
            )}
            {linkData.serial && (
              <div>
                <p className="text-sm text-muted-foreground">Serial Number</p>
                <p className="text-lg font-medium text-foreground">{linkData.serial}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Traceability Timeline */}
        <Card className="p-8">
          <h3 className="text-2xl font-bold text-foreground mb-6">Traceability History</h3>
          
          {!eventsData || eventsData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No traceability events recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {eventsData.map((event, index) => (
                <div key={event.id} className="relative pl-8 pb-6 border-l-2 border-border last:border-0 last:pb-0">
                  <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                  
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-medium">
                          {event.event_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground capitalize">
                          {event.biz_step}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(event.event_time).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {event.locations && (
                        <div>
                          <span className="text-muted-foreground">Location: </span>
                          <span className="text-foreground font-medium">{event.locations.name}</span>
                        </div>
                      )}
                      {event.user_name && (
                        <div>
                          <span className="text-muted-foreground">Recorded by: </span>
                          <span className="text-foreground font-medium">{event.user_name}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Source: </span>
                        <Badge variant="secondary" className="text-xs">
                          {event.source_type === 'voice_ai' ? 'Voice AI' :
                           event.source_type === 'vision_ai' ? 'Vision AI' :
                           'Manual Entry'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by GS1 EPCIS 2.0 Standard</p>
          <p className="mt-1">This product has been accessed {(linkData.access_count || 0) + 1} times</p>
        </div>
      </main>
    </div>
  )
}
