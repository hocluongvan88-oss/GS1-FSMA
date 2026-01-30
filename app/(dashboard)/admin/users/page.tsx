'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PermissionGate } from '@/components/auth/permission-gate'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Users, Search, Shield, Edit } from 'lucide-react'
import { roleNames, roleDescriptions, type UserRole } from '@/lib/auth/permissions'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client' // Declare the createClient variable

const client = createClient(); // Declare the client variable

interface User {
  id: string
  email: string | null
  full_name: string
  phone: string
  role: UserRole
  assigned_location: string
  created_at: string
  metadata: Record<string, unknown>
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const isMounted = useRef(true)

  const fetchUsers = useCallback(async () => {
    try {
      // Query directly from users table - email is stored there
      const { data: userProfiles, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isMounted.current) return
      if (error) throw error

      if (userProfiles) {
        setUsers(userProfiles)
      }
    } catch (error: unknown) {
      // Ignore AbortError - happens when component unmounts during fetch
      if (error instanceof Error && error.name === 'AbortError') return
      if (!isMounted.current) return
      console.error('[v0] Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    fetchUsers()
    
    return () => {
      isMounted.current = false
    }
  }, [fetchUsers])

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await client
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      toast.success('User role updated successfully')
      fetchUsers()
      setEditingUser(null)
    } catch (error) {
      console.error('[v0] Error updating role:', error)
      toast.error('Failed to update user role')
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      system_admin: 'bg-purple-500 text-white',
      admin: 'bg-red-500 text-white',
      factory_manager: 'bg-blue-500 text-white',
      quality_inspector: 'bg-green-500 text-white',
      logistics_manager: 'bg-yellow-500 text-white',
      worker: 'bg-gray-500 text-white',
      farmer: 'bg-orange-500 text-white',
      auditor: 'bg-indigo-500 text-white',
      customer: 'bg-pink-500 text-white',
    }
    return colors[role]
  }

  return (
    <PermissionGate>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="size-8" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage users and their roles
            </p>
          </div>
          
          <Badge variant="outline" className="text-base px-4 py-2">
            {users.length} Total Users
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>View and manage all users in the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(roleNames).map(([role, name]) => (
                    <SelectItem key={role} value={role}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading users...
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email || '-'}</TableCell>
                          <TableCell>{user.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              {roleNames[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingUser(user)}
                                >
                                  <Edit className="size-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit User Role</DialogTitle>
                                  <DialogDescription>
                                    Change the role for {user.full_name}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Current Role</Label>
                                    <div className="p-3 bg-muted rounded-md">
                                      <Badge className={getRoleBadgeColor(user.role)}>
                                        {roleNames[user.role]}
                                      </Badge>
                                      <p className="text-sm text-muted-foreground mt-2">
                                        {roleDescriptions[user.role]}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>New Role</Label>
                                    <Select
                                      defaultValue={user.role}
                                      onValueChange={(value) => handleUpdateRole(user.id, value as UserRole)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(roleNames).map(([role, name]) => (
                                          <SelectItem key={role} value={role}>
                                            <div className="flex flex-col">
                                              <span className="font-medium">{name}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {roleDescriptions[role as UserRole]}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              Role Permissions Reference
            </CardTitle>
            <CardDescription>Overview of permissions for each role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(roleNames).map(([role, name]) => (
                <div key={role} className="p-4 border rounded-lg space-y-2">
                  <Badge className={getRoleBadgeColor(role as UserRole)}>
                    {name}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {roleDescriptions[role as UserRole]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
