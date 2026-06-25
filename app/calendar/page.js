'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar as CalendarIcon, ArrowLeft, Clock, Youtube, Instagram, Music2, X, Flame } from 'lucide-react'
import { toast } from 'sonner'

export default function CalendarPage() {
  const [clips, setClips] = useState(null)

  useEffect(() => {
    fetch('/api/clips').then(r => r.json()).then(setClips).catch(() => setClips([]))
  }, [])

  async function unschedule(id) {
    const r = await fetch(`/api/clips/${id}`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ is_scheduled: false, scheduled_time: null }) })
    const c = await r.json()
    setClips(prev => prev.map(x => x.id === c.id ? c : x))
    toast.success('Schedule cancelled')
  }

  const scheduled = (clips || []).filter(c => c.is_scheduled && c.scheduled_time)
  // group by day
  const byDay = {}
  for (const c of scheduled) {
    const k = new Date(c.scheduled_time).toISOString().slice(0,10)
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(c)
  }
  const days = Object.keys(byDay).sort()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link>
          <div className="flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-primary" /><span className="font-semibold">Content Calendar & Queue</span></div>
          <div className="w-24" />
        </div>
      </header>

      <main className="container py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Posts</h1>
          <p className="text-muted-foreground text-sm">Inspect, reschedule, or cancel upcoming social media deliveries.</p>
        </div>

        {clips === null ? (
          <div className="grid gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : days.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <div className="text-lg font-semibold">No scheduled posts yet</div>
            <p className="text-sm text-muted-foreground mt-1">Schedule clips from the workspace and they’ll appear here.</p>
            <Button asChild className="mt-4 gradient-bg text-white"><Link href="/">Open workspace</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-6">
            {days.map(day => (
              <div key={day}>
                <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                  {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
                <div className="space-y-2">
                  {byDay[day].sort((a,b)=>new Date(a.scheduled_time)-new Date(b.scheduled_time)).map(c => (
                    <Card key={c.id}>
                      <CardContent className="py-3 flex items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.thumbnail_url} alt="" className="h-16 w-12 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{c.clip_title}</div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(c.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <Badge variant="outline" className="gap-1"><Flame className="h-3 w-3 text-amber-500" /> {c.virality_score}</Badge>
                            <Badge variant="outline" className="gap-1"><Youtube className="h-3 w-3 text-red-500" /> Shorts</Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={()=>unschedule(c.id)} className="text-destructive">
                          <X className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
