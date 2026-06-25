'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ShieldCheck, ArrowLeft, Save, Plus, Trash2, Lock, Coins, Smile } from 'lucide-react'

export default function AdminPage() {
  const [profile, setProfile] = useState(null)
  const [pkgs, setPkgs] = useState([])
  const [memes, setMemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [useAdmin, setUseAdmin] = useState(false)

  useEffect(() => { load(useAdmin) }, [useAdmin])

  async function load(admin) {
    setLoading(true)
    const [p, list, m] = await Promise.all([
      fetch(`/api/profile?admin=${admin}`).then(r=>r.json()),
      fetch('/api/pricing-packages').then(r=>r.json()),
      fetch('/api/memes').then(r=>r.json()),
    ])
    setProfile(p); setPkgs(list); setMemes(m); setLoading(false)
  }

  async function savePkg(pkg) {
    const r = await fetch(`/api/pricing-packages/${pkg.id}`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(pkg) })
    const u = await r.json(); setPkgs(prev => prev.map(x => x.id === u.id ? u : x))
    toast.success(`Saved “${u.name}”`)
  }
  async function removePkg(id) { await fetch(`/api/pricing-packages/${id}`, { method:'DELETE' }); setPkgs(prev => prev.filter(x => x.id !== id)); toast.success('Package removed') }
  async function createPkg() {
    const r = await fetch('/api/pricing-packages', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ name:'New Pack', credit_amount_minutes:500, price_inr:799, price_usd:9.99, discount_percentage:10, is_featured:false, is_active:true }) })
    const created = await r.json(); setPkgs(prev => [...prev, created]); toast.success('New package created')
  }

  async function saveMeme(meme) {
    const r = await fetch(`/api/memes/${meme.id}`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(meme) })
    const u = await r.json(); setMemes(prev => prev.map(x => x.id === u.id ? u : x))
    toast.success(`Saved meme “${u.name}”`)
  }
  async function removeMeme(id) { await fetch(`/api/memes/${id}`, { method:'DELETE' }); setMemes(prev => prev.filter(x => x.id !== id)); toast.success('Meme removed') }
  async function createMeme() {
    const r = await fetch('/api/memes', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({
      name:'New Meme Hook', category:'reaction', video_url:'https://example.com/meme.mp4',
      thumbnail_url:'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&q=80',
      duration_seconds:3, is_active:true,
    }) })
    const created = await r.json(); setMemes(prev => [created, ...prev]); toast.success('New meme added')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading admin…</div>

  const hasAccess = profile?.is_admin

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to workspace
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">Admin Console</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Impersonate admin</span>
            <Switch checked={useAdmin} onCheckedChange={setUseAdmin} />
          </div>
        </div>
      </header>

      <main className="container py-10">
        {!hasAccess ? (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12 space-y-4">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <div className="text-lg font-semibold">Admin access required</div>
                <p className="text-sm text-muted-foreground mt-1">Your profile <code className="text-foreground">is_admin</code> flag is false. Toggle “Impersonate admin” above to view the dashboard.</p>
              </div>
              <Badge variant="outline">Logged in as: {profile?.email}</Badge>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="pricing">
            <TabsList className="mb-6">
              <TabsTrigger value="pricing"><Coins className="h-3.5 w-3.5 mr-1.5" /> Pricing Packages ({pkgs.length})</TabsTrigger>
              <TabsTrigger value="memes"><Smile className="h-3.5 w-3.5 mr-1.5" /> Meme Library ({memes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pricing" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Pricing Packages</h1>
                  <p className="text-muted-foreground text-sm">Edit prices, credit allocations and active flags. Changes go live instantly.</p>
                </div>
                <Button onClick={createPkg} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New package</Button>
              </div>
              <div className="grid gap-4">
                {pkgs.map(pkg => <PkgRow key={pkg.id} pkg={pkg} onSave={savePkg} onDelete={removePkg} />)}
              </div>
            </TabsContent>

            <TabsContent value="memes" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Meme Hook Library</h1>
                  <p className="text-muted-foreground text-sm">Upload 2-3 second meme videos that creators can prepend to their clips as viral intro hooks.</p>
                </div>
                <Button onClick={createMeme} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New meme</Button>
              </div>
              <div className="grid gap-4">
                {memes.map(m => <MemeRow key={m.id} meme={m} onSave={saveMeme} onDelete={removeMeme} />)}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

function PkgRow({ pkg, onSave, onDelete }) {
  const [local, setLocal] = useState(pkg)
  const dirty = JSON.stringify(local) !== JSON.stringify(pkg)
  function update(k, v) { setLocal(prev => ({ ...prev, [k]: v })) }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {local.name}
            {local.is_featured && <Badge className="gradient-bg text-white border-transparent">Featured</Badge>}
            <Badge variant={local.is_active ? 'default' : 'secondary'}>{local.is_active ? 'Active' : 'Disabled'}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onDelete(pkg.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" disabled={!dirty} onClick={() => onSave(local)} className={dirty ? 'gradient-bg text-white' : ''}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Name"><Input value={local.name} onChange={e => update('name', e.target.value)} /></Field>
        <Field label="Credits (min)"><Input type="number" value={local.credit_amount_minutes} onChange={e => update('credit_amount_minutes', Number(e.target.value))} /></Field>
        <Field label="Price INR (₹)"><Input type="number" value={local.price_inr} onChange={e => update('price_inr', Number(e.target.value))} /></Field>
        <Field label="Price USD ($)"><Input type="number" step="0.01" value={local.price_usd} onChange={e => update('price_usd', Number(e.target.value))} /></Field>
        <Field label="Discount %"><Input type="number" value={local.discount_percentage} onChange={e => update('discount_percentage', Number(e.target.value))} /></Field>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs">Featured</Label><Switch checked={local.is_featured} onCheckedChange={v => update('is_featured', v)} /></div>
          <div className="flex items-center justify-between"><Label className="text-xs">Active</Label><Switch checked={local.is_active} onCheckedChange={v => update('is_active', v)} /></div>
        </div>
      </CardContent>
    </Card>
  )
}

function MemeRow({ meme, onSave, onDelete }) {
  const [local, setLocal] = useState(meme)
  const dirty = JSON.stringify(local) !== JSON.stringify(meme)
  function update(k, v) { setLocal(prev => ({ ...prev, [k]: v })) }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {local.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={local.thumbnail_url} alt={local.name} className="h-14 w-10 rounded object-cover bg-muted shrink-0" />
            )}
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <span className="truncate">{local.name}</span>
                <Badge variant="outline">{local.category}</Badge>
                <Badge variant={local.is_active ? 'default' : 'secondary'}>{local.is_active ? 'Active' : 'Hidden'}</Badge>
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{local.video_url}</div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onDelete(meme.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" disabled={!dirty} onClick={() => onSave(local)} className={dirty ? 'gradient-bg text-white' : ''}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 grid md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Field label="Name"><Input value={local.name} onChange={e => update('name', e.target.value)} /></Field>
        <Field label="Category"><Input value={local.category} onChange={e => update('category', e.target.value)} placeholder="reaction, hype, sfx…" /></Field>
        <Field label="Duration (s)"><Input type="number" value={local.duration_seconds} onChange={e => update('duration_seconds', Number(e.target.value))} /></Field>
        <Field label="Video URL" className="md:col-span-2"><Input value={local.video_url} onChange={e => update('video_url', e.target.value)} placeholder="https://…meme.mp4" /></Field>
        <Field label="Thumbnail URL"><Input value={local.thumbnail_url} onChange={e => update('thumbnail_url', e.target.value)} placeholder="https://…thumb.jpg" /></Field>
        <div className="md:col-span-6 flex items-center justify-end gap-3">
          <Label className="text-xs text-muted-foreground">Active (visible to users)</Label>
          <Switch checked={local.is_active} onCheckedChange={v => update('is_active', v)} />
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, children, className='' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
