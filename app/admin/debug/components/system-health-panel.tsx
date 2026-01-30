'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Database, Cpu, HardDrive, Clock } from 'lucide-react'

export default function SystemHealthPanel() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    todayEvents: 0,
    totalUsers: 0,
    voiceAIEvents: 0,
    visionAIEvents: 0,
    averageResponseTime: 0
  })

  useEffect(() => {
    // Mock data - in production, fetch from API
    setStats({
      totalEvents: 1248,
      todayEvents: 37,
      totalUsers: 42,
      voiceAIEvents: 523,
      visionAIEvents: 312,
      averageResponseTime: 1.2
    })
  }, [])

  const healthCards = [
    {
      title: 'Total Events',
      value: stats.totalEvents.toLocaleString(),
      icon: Database,
      description: `${stats.todayEvents} today`,
      status: 'healthy'
    },
    {
      title: 'Active Users',
      value: stats.totalUsers.toString(),
      icon: Activity,
      description: 'Registered users',
      status: 'healthy'
    },
    {
      title: 'Voice AI Events',
      value: stats.voiceAIEvents.toLocaleString(),
      icon: Cpu,
      description: 'Using Gemini 2.5 Flash',
      status: 'healthy'
    },
    {
      title: 'Vision AI Events',
      value: stats.visionAIEvents.toLocaleString(),
      icon: HardDrive,
      description: 'Image processing',
      status: 'healthy'
    },
    {
      title: 'Avg Response Time',
      value: `${stats.averageResponseTime}s`,
      icon: Clock,
      description: 'API performance',
      status: stats.averageResponseTime < 2 ? 'healthy' : 'warning'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {healthCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                <Badge 
                  variant={card.status === 'healthy' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {card.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Real-time system monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Database Connection</span>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Supabase Auth</span>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Gemini AI API</span>
              <Badge variant="default">Online</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">EPCIS Compliance</span>
              <Badge variant="default">v2.0</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
