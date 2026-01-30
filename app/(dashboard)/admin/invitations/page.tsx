'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Ticket, Plus, Copy, XCircle, Clock, Users } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { RequirePermission } from '@/components/auth/permission-gate'
import { useLocale } from '@/lib/locale-context'

interface Invitation {
  id: string
  invitation_code: string
  organization_gln: string
  organization_name: string
  invited_role: string
  max_uses: number
  uses_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
  notes: string | null
}

interface Location {
  gln: string
  name: string
  type: string
}

export default function InvitationsPage() {
  const { toast } = useToast()
  const { t } = useLocale()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])
  
  // Form state
  const [formData, setFormData] = useState({
    organizationGln: '',
    organizationName: '',
    invitedRole: 'farmer',
    maxUses: 10,
    expiresInDays: 30,
    notes: ''
  })

  useEffect(() => {
    fetchInvitations()
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('gln, name, type')
        .order('name')
      
      if (error) throw error
      if (data) setLocations(data)
    } catch (error) {
      console.error('[v0] Error fetching locations:', error)
      toast({ title: 'Error', description: 'Failed to load locations', variant: 'destructive' })
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invitations')
      const result = await response.json()
      
      if (result.success) {
        setInvitations(result.data)
      }
    } catch (error) {
      console.error('[v0] Error fetching invitations:', error)
      toast({ title: 'Error', description: 'Failed to load invitations', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLocationChange = (gln: string) => {
    const location = locations.find(loc => loc.gln === gln)
    if (location) {
      setFormData({
        ...formData,
        organizationGln: gln,
        organizationName: location.name
      })
    }
  }

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.organizationGln || !formData.organizationName) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please select an organization', 
        variant: 'destructive' 
      })
      return
    }

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdBy: currentUserId || '00000000-0000-0000-0000-000000000001'
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({ title: 'Success', description: 'Invitation created successfully!' })
        setShowCreateDialog(false)
        fetchInvitations()
        
        // Reset form
        setFormData({
          organizationGln: '',
          organizationName: '',
          invitedRole: 'farmer',
          maxUses: 10,
          expiresInDays: 30,
          notes: ''
        })
        
        // Copy code to clipboard
        navigator.clipboard.writeText(result.data.invitation_code)
        toast({ title: 'Copied', description: 'Invitation code copied to clipboard' })
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create invitation', variant: 'destructive' })
      }
    } catch (error) {
      console.error('[v0] Error creating invitation:', error)
      toast({ title: 'Error', description: 'Failed to create invitation', variant: 'destructive' })
    }
  }

  const handleDeactivate = async (invitationId: string) => {
    if (!confirm('Are you sure you want to deactivate this invitation?')) return

    try {
      const response = await fetch(`/api/invitations?id=${invitationId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast({ title: 'Success', description: 'Invitation deactivated' })
        fetchInvitations()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to deactivate', variant: 'destructive' })
      }
    } catch (error) {
      console.error('[v0] Error deactivating invitation:', error)
      toast({ title: 'Error', description: 'Failed to deactivate invitation', variant: 'destructive' })
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({ title: 'Copied', description: 'Code copied to clipboard' })
  }

  const getStatusBadge = (invitation: Invitation) => {
    if (!invitation.is_active) {
      return <Badge variant="destructive">Deactivated</Badge>
    }
    
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>
    }

    if (invitation.max_uses !== -1 && invitation.uses_count >= invitation.max_uses) {
      return <Badge variant="secondary">Fully Used</Badge>
    }

    return <Badge variant="default" className="bg-green-500">Active</Badge>
  }

  return (
    <RequirePermission>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invitation Management</h1>
            <p className="text-muted-foreground">Create and manage invitation codes for farmers</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Invitation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Invitation</DialogTitle>
                <DialogDescription>
                  Generate an invitation code to onboard farmers to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Organization / Location</Label>
                  <Select
                    value={formData.organizationGln}
                    onValueChange={handleLocationChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations && locations.length > 0 ? (
                        locations.map((location) => (
                          <SelectItem key={location.gln} value={location.gln}>
                            {location.name} ({location.gln})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          No locations available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {formData.organizationName || 'None'}
                  </p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={formData.invitedRole}
                    onValueChange={(value) => setFormData({ ...formData, invitedRole: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="farmer">Farmer</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Uses</Label>
                  <Input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) })}
                    min={1}
                  />
                </div>
                <div>
                  <Label>Expires In (days)</Label>
                  <Input
                    type="number"
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                    min={1}
                  />
                </div>
                <div>
                  <Label>Notes (Optional)</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g., For 2026 harvest season"
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Generate Invitation Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Invitation Codes
            </CardTitle>
            <CardDescription>
              Total: {invitations.length} invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invitations yet. Create one to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {invitation.invitation_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(invitation.invitation_code)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invitation.organization_name}</p>
                          <p className="text-xs text-muted-foreground">{invitation.organization_gln}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invitation.invited_role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {invitation.uses_count} / {invitation.max_uses === -1 ? '∞' : invitation.max_uses}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invitation.expires_at ? (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(invitation.expires_at).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invitation)}</TableCell>
                      <TableCell>
                        {invitation.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(invitation.id)}
                          >
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
      </Card>
    </div>
    </RequirePermission>
  )
}
