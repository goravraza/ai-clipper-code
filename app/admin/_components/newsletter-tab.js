'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Send, Loader2 } from 'lucide-react'

export default function NewsletterTab() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState(null)

  useEffect(() => { refresh() }, [])
  async function refresh() { fetch('/api/admin/newsletters?admin=true').then(r=>r.json()).then(d=>setHistory(Array.isArray(d)?d:[])).catch(()=>setHistory([])) }

  async function send() {
    if (!subject.trim() || !body.trim()) return toast.error('Subject and body required')
    setSending(true)
    try {
      const r = await fetch('/api/admin/newsletters?admin=true', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ subject, body_content: body }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed')
      toast.success(`Broadcast sent to ${data.total_sent} users`, { description: 'In-app banner pushed; email delivery simulated.' })
      setSubject(''); setBody(''); refresh()
    } catch (e) { toast.error('Failed to send', { description: e.message }) }
    finally { setSending(false) }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div><h1 className="text-3xl font-bold">Broadcast Newsletter</h1><p className="text-muted-foreground text-sm">Push an in-app banner + simulated email blast to all users.</p></div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="✨ New feature: Auto-captions in 40+ languages" /></div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={body} onChange={e=>setBody(e.target.value)} rows={10} placeholder="Hi creators,\n\nWe just shipped…" />
            </div>
            <Button onClick={send} disabled={sending} className="w-full gradient-bg text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send to all users
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Sent broadcasts</h2>
        {history === null ? (
          <div className="grid gap-3">{[1,2].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
        ) : history.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground"><Mail className="h-8 w-8 mx-auto mb-2" />No broadcasts yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">{history.map(n => (
            <Card key={n.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{n.subject}</div>
                  <Badge variant="secondary">{n.total_sent} sent</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{n.body_content}</div>
              </CardContent>
            </Card>
          ))}</div>
        )}
      </div>
    </div>
  )
}
