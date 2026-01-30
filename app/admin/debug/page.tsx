'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Database, 
  Users, 
  TestTube, 
  Download,
  Trash2,
  Filter,
  RefreshCw
} from 'lucide-react'

// Import test components (we'll create these next)
import VoiceTestPanel from './components/voice-test-panel'
import VisionTestPanel from './components/vision-test-panel'
import TransformationTestPanel from './components/transformation-test-panel'
import DatabaseEventsPanel from './components/database-events-panel'
import UserManagementPanel from './components/user-management-panel'
import SystemHealthPanel from './components/system-health-panel'

export default function AdminDebugPage() {
  const [activeTab, setActiveTab] = useState('tests')

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Admin Panel</h1>
          <p className="text-muted-foreground">
            Debug tools, testing, and system monitoring
          </p>
        </div>
        <Badge variant="destructive" className="text-sm">
          Admin Only
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tests" className="gap-2">
            <TestTube className="h-4 w-4" />
            API Tests
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2">
            <Database className="h-4 w-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Voice Input Testing</CardTitle>
                <CardDescription>
                  Test Gemini AI voice transcription and EPCIS event creation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VoiceTestPanel />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vision Input Testing</CardTitle>
                <CardDescription>
                  Test image processing and OCR with Gemini Vision
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VisionTestPanel />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transformation Event Testing</CardTitle>
                <CardDescription>
                  Test mass balance validation and transformation events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TransformationTestPanel />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <DatabaseEventsPanel />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagementPanel />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <SystemHealthPanel />
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Admin Tools</CardTitle>
              <CardDescription>
                Dangerous operations - use with caution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button variant="outline" className="gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Export All Data
                </Button>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear Test Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
