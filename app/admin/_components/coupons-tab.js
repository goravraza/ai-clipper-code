'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Save, Ticket, Copy } from 'lucide-react'

export default function CouponsTab() {
  const [list, setList] = useState(null)
  useEffect(() => { fetch('/api/admin/coupons?admin=true').then(r=>r.json()).then(d=>setList(Array.isArray(d)?d:[])).catch(()=>setList([])) }, [])

  async function create() {
    const code = `PROMO${Math.random().toString(36).slice(2,7).toUpperCase()}`
    const r = await fetch('/api/admin/coupons?admin=true', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ code, discount_percent: 20, max_redemptions: 100 }) })
    const c = await r.json()
    if (!r.ok) return toast.error(c.error || 'Failed')
    setList(prev => [c, ...prev]); toast.success(`Created ${c.code}`)
  }
  async function save(coupon) {
    const r = await fetch(`/api/admin/coupons/${coupon.id}?admin=true`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(coupon) })
    const u = await r.json(); setList(prev => prev.map(x => x.id === u.id ? u : x)); toast.success(`Saved ${u.code}`)
  }
  async function remove(id) {
    await fetch(`/api/admin/coupons/${id}?admin=true`, { method:'DELETE' }); setList(prev => prev.filter(x => x.id !== id)); toast.success('Coupon removed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Coupon Codes</h1><p className="text-muted-foreground text-sm">Spawn promotional codes with discount caps, usage limits, and expiry dates.</p></div>
        <Button onClick={create} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New coupon</Button>
      </div>
      {list === null ? (
        <div className="grid gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      ) : list.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Ticket className="h-10 w-10 mx-auto mb-3" /><div className="text-sm">No coupons yet. Click “New coupon” to spawn one.</div>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">{list.map(c => <Row key={c.id} coupon={c} onSave={save} onDelete={remove} />)}</div>
      )}
    </div>
  )
}

function Row({ coupon, onSave, onDelete }) {
  const [local, setLocal] = useState(coupon)
  const dirty = JSON.stringify(local) !== JSON.stringify(coupon)
  function update(k, v) { setLocal(prev => ({ ...prev, [k]: v })) }
  const exp = local.expires_at ? new Date(local.expires_at).toISOString().slice(0,10) : ''
  const used = local.current_redemptions || 0
  const usagePct = local.max_redemptions ? Math.min(100, (used / local.max_redemptions) * 100) : 0
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg text-white shrink-0"><Ticket className="h-5 w-5" /></div>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <code className="font-mono text-lg">{local.code}</code>
                <button onClick={() => { navigator.clipboard.writeText(local.code); toast.success('Copied!') }} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                <Badge className="gradient-bg text-white border-transparent">{local.discount_percent}% off</Badge>
                <Badge variant={local.is_active ? 'default' : 'secondary'}>{local.is_active ? 'Active' : 'Disabled'}</Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-1">{used} / {local.max_redemptions} used • expires {exp}</div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onDelete(coupon.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" disabled={!dirty} onClick={() => onSave(local)} className={dirty ? 'gradient-bg text-white' : ''}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full gradient-bg transition-all" style={{ width: `${usagePct}%` }} />
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 grid md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Code</Label><Input value={local.code} onChange={e=>update('code', e.target.value.toUpperCase())} className="font-mono" /></div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Discount %</Label><Input type="number" value={local.discount_percent} onChange={e=>update('discount_percent', Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Max uses</Label><Input type="number" value={local.max_redemptions} onChange={e=>update('max_redemptions', Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Expires</Label><Input type="date" value={exp} onChange={e=>update('expires_at', e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
        <div className="flex items-end justify-between"><Label className="text-xs text-muted-foreground mr-2">Active</Label><Switch checked={local.is_active} onCheckedChange={v=>update('is_active', v)} /></div>
      </CardContent>
    </Card>
  )
}
