'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Users, Video, Film, Coins, DollarSign, Activity, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export default function AnalyticsTab() {
  const [data, setData] = useState(null)
  const [activity, setActivity] = useState(null)

  useEffect(() => {
    fetch('/api/admin/analytics?admin=true').then(r=>r.json()).then(d => setData(d.totals ? d : {totals:{}, clips_by_day:[]})).catch(()=>setData({totals:{}, clips_by_day:[]}))
    fetch('/api/admin/activity?admin=true').then(r=>r.json()).then(d => setActivity(Array.isArray(d) ? d : [])).catch(()=>setActivity([]))
  }, [])

  const totals = data?.totals || {}
  const series = data?.clips_by_day || []

  const stats = [
    { label: 'Total Revenue', value: `$${(totals.total_revenue_usd || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Total Users', value: totals.users || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Videos Processed', value: totals.videos || 0, icon: Video, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Clips Generated', value: totals.clips || 0, icon: Film, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Active Subscriptions', value: totals.active_subscriptions || 0, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Credits Outstanding', value: (totals.total_credits_remaining || 0).toLocaleString(), icon: Coins, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ]

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Global Metrics</h1><p className="text-muted-foreground text-sm">Platform-wide revenue, usage, and activity analytics.</p></div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.bg} mb-2`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold tabular-nums">{data === null ? <Skeleton className="h-7 w-12" /> : s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clips per day chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Clips generated — last 14 days</CardTitle></CardHeader>
        <CardContent className="h-72">
          {data === null ? <Skeleton className="h-full w-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="clipGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(271 91% 65%)" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="hsl(271 91% 65%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{fontSize: 11}} tickFormatter={(d) => d.slice(5)} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{fontSize: 11}} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6 }} />
                <Area type="monotone" dataKey="clips" stroke="hsl(271 91% 65%)" fill="url(#clipGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent activity</CardTitle></CardHeader>
        <CardContent>
          {activity === null ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div> : activity.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No activity yet.</div>
          ) : (
            <div className="divide-y">
              {activity.slice(0, 30).map(a => (
                <div key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">{a.action_performed}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{a.user_id ? a.user_id.slice(0,8) : 'anon'} • {a.ip_address}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
