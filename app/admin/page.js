'use client'

import { useEffect, useState, useRef } from 'react'
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
import { ShieldCheck, ArrowLeft, Save, Plus, Trash2, Lock, Coins, Smile, Loader2, Film, Image as ImageIcon, Key, CreditCard, Sparkles, Check, AlertCircle, Eye, EyeOff, Ticket, Users, Mail, BarChart3 } from 'lucide-react'
import CouponsTab from './_components/coupons-tab'
import UsersTab from './_components/users-tab'
import NewsletterTab from './_components/newsletter-tab'
import AnalyticsTab from './_components/analytics-tab'

// Catalog of supported integrations (keys + metadata)
const INTEGRATIONS = [
  {
    provider: 'gemini', name: 'Google Gemini', category: 'ai', icon: Sparkles,
    description: 'AI for clip detection, captions, and translation. Default provider.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'gemini-2.0-flash' },
    ],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    provider: 'openai', name: 'OpenAI', category: 'ai', icon: Sparkles,
    description: 'GPT-5 / GPT-4 — alternative AI provider for clip detection.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { key: 'organization', label: 'Organization ID (optional)', type: 'text', placeholder: 'org-...' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    provider: 'anthropic', name: 'Anthropic Claude', category: 'ai', icon: Sparkles,
    description: 'Claude Sonnet / Opus — premium AI for clip detection.',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    ],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    provider: 'razorpay', name: 'Razorpay', category: 'payment', icon: CreditCard,
    description: 'Primary payment gateway for Indian users (INR).',
    fields: [
      { key: 'key_id', label: 'Key ID', type: 'text', placeholder: 'rzp_live_...' },
      { key: 'key_secret', label: 'Key Secret', type: 'password' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password' },
    ],
    docsUrl: 'https://dashboard.razorpay.com/app/keys',
  },
  {
    provider: 'stripe', name: 'Stripe', category: 'payment', icon: CreditCard,
    description: 'Global card processing (USD, EUR, GBP, etc).',
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'text', placeholder: 'pk_live_...' },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
    docsUrl: 'https://dashboard.stripe.com/apikeys',
  },
  {
    provider: 'lemon_squeezy', name: 'Lemon Squeezy', category: 'payment', icon: CreditCard,
    description: 'Merchant-of-record for international SaaS (handles VAT/tax).',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'store_id', label: 'Store ID', type: 'text' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password' },
    ],
    docsUrl: 'https://app.lemonsqueezy.com/settings/api',
  },
  {
    provider: 'paddle', name: 'Paddle', category: 'payment', icon: CreditCard,
    description: 'Merchant-of-record for SaaS with built-in tax compliance.',
    fields: [
      { key: 'vendor_id', label: 'Vendor ID', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'public_key', label: 'Public Key (for verification)', type: 'text' },
    ],
    docsUrl: 'https://vendors.paddle.com/authentication',
  },
  {
    provider: 'paypal', name: 'PayPal', category: 'payment', icon: CreditCard,
    description: 'Universal payment method, especially strong in EU/LATAM.',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
      { key: 'mode', label: 'Mode', type: 'text', placeholder: 'sandbox or live' },
    ],
    docsUrl: 'https://developer.paypal.com/dashboard/applications',
  },
  {
    provider: 'http_proxy', name: 'HTTP Proxy (for YouTube)', category: 'infra', icon: Key,
    description: 'Residential / datacenter HTTP proxy used by yt-dlp + ffmpeg to bypass YouTube IP blocks. Required for YouTube URL ingestion. Format: http(s)://user:pass@host:port',
    fields: [
      { key: 'proxy_url', label: 'Proxy URL', type: 'password', placeholder: 'http://user:pass@host:port' },
      { key: 'notes', label: 'Provider / notes (optional)', type: 'text', placeholder: 'BrightData, Oxylabs, Smartproxy, etc.' },
    ],
    docsUrl: 'https://brightdata.com/proxy-types/residential-proxies',
  },
  {
    provider: 'rapidapi_yt', name: 'RapidAPI YouTube Downloader', category: 'infra', icon: Key,
    description: 'Fallback YouTube downloader API. Used when no HTTP proxy is configured. Note: returned signed URLs may be IP-locked.',
    fields: [
      { key: 'api_key', label: 'RapidAPI Key', type: 'password', placeholder: 'rapidapi key' },
      { key: 'host', label: 'Host', type: 'text', placeholder: 'youtube-media-downloader.p.rapidapi.com' },
    ],
    docsUrl: 'https://rapidapi.com/ytjar/api/youtube-media-downloader',
  },
]

export default function AdminPage() {
  const [profile, setProfile] = useState(null)
  const [pkgs, setPkgs] = useState([])
  const [memes, setMemes] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [useAdmin, setUseAdmin] = useState(false)

  useEffect(() => { load(useAdmin) }, [useAdmin])

  async function load(admin) {
    setLoading(true)
    const [p, list, m, integ] = await Promise.all([
      fetch(`/api/profile?admin=${admin}`).then(r=>r.json()),
      fetch('/api/pricing-packages').then(r=>r.json()),
      fetch('/api/memes').then(r=>r.json()),
      fetch('/api/admin/integrations').then(r=>r.json()).catch(()=>[]),
    ])
    setProfile(p); setPkgs(list); setMemes(m); setIntegrations(Array.isArray(integ) ? integ : []); setLoading(false)
  }

  async function savePkg(pkg) { const r = await fetch(`/api/pricing-packages/${pkg.id}`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(pkg) }); const u = await r.json(); setPkgs(prev => prev.map(x => x.id === u.id ? u : x)); toast.success(`Saved “${u.name}”`) }
  async function removePkg(id) { await fetch(`/api/pricing-packages/${id}`, { method:'DELETE' }); setPkgs(prev => prev.filter(x => x.id !== id)); toast.success('Package removed') }
  async function createPkg() {
    const r = await fetch('/api/pricing-packages', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ name:'New Pack', credit_amount_minutes:500, price_inr:799, price_usd:9.99, discount_percentage:10, is_featured:false, is_active:true }) })
    const created = await r.json(); setPkgs(prev => [...prev, created]); toast.success('New package created')
  }
  async function saveMeme(meme) { const r = await fetch(`/api/memes/${meme.id}`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(meme) }); const u = await r.json(); setMemes(prev => prev.map(x => x.id === u.id ? u : x)); toast.success(`Saved meme “${u.name}”`) }
  async function removeMeme(id) { await fetch(`/api/memes/${id}`, { method:'DELETE' }); setMemes(prev => prev.filter(x => x.id !== id)); toast.success('Meme removed') }
  async function createMeme() {
    const r = await fetch('/api/memes', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ name:'New Meme Hook', category:'reaction', video_url:'', thumbnail_url:'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&q=80', duration_seconds:3, is_active:true }) })
    const created = await r.json(); setMemes(prev => [created, ...prev]); toast.success('New meme added — upload video below')
  }

  async function saveIntegration(provider, credentials, is_active) {
    const r = await fetch('/api/admin/integrations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, credentials, is_active }) })
    const updated = await r.json()
    setIntegrations(prev => {
      const found = prev.find(x => x.provider === provider)
      return found ? prev.map(x => x.provider === provider ? updated : x) : [...prev, updated]
    })
    toast.success(`${INTEGRATIONS.find(i => i.provider === provider)?.name || provider} saved`)
  }
  async function deleteIntegration(provider) {
    await fetch(`/api/admin/integrations/${provider}`, { method: 'DELETE' })
    setIntegrations(prev => prev.filter(x => x.provider !== provider))
    toast.success('Credentials removed')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading admin…</div>

  const hasAccess = profile?.is_admin

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><span className="font-semibold">Admin Console</span></div>
          <div className="flex items-center gap-2 text-xs"><span className="text-muted-foreground">Impersonate admin</span><Switch checked={useAdmin} onCheckedChange={setUseAdmin} /></div>
        </div>
      </header>

      <main className="container py-10">
        {!hasAccess ? (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="py-12 space-y-4">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
              <div><div className="text-lg font-semibold">Admin access required</div><p className="text-sm text-muted-foreground mt-1">Your profile <code className="text-foreground">is_admin</code> flag is false. Toggle “Impersonate admin” above to view the dashboard.</p></div>
              <Badge variant="outline">Logged in as: {profile?.email}</Badge>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="analytics">
            <TabsList className="mb-6 flex-wrap h-auto">
              <TabsTrigger value="analytics"><BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Analytics</TabsTrigger>
              <TabsTrigger value="pricing"><Coins className="h-3.5 w-3.5 mr-1.5" /> Pricing ({pkgs.length})</TabsTrigger>
              <TabsTrigger value="coupons"><Ticket className="h-3.5 w-3.5 mr-1.5" /> Coupons</TabsTrigger>
              <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" /> Users</TabsTrigger>
              <TabsTrigger value="memes"><Smile className="h-3.5 w-3.5 mr-1.5" /> Memes ({memes.length})</TabsTrigger>
              <TabsTrigger value="newsletter"><Mail className="h-3.5 w-3.5 mr-1.5" /> Newsletter</TabsTrigger>
              <TabsTrigger value="integrations"><Key className="h-3.5 w-3.5 mr-1.5" /> Integrations ({integrations.filter(i => i.has_credentials).length}/{INTEGRATIONS.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
            <TabsContent value="coupons"><CouponsTab /></TabsContent>
            <TabsContent value="users"><UsersTab /></TabsContent>
            <TabsContent value="newsletter"><NewsletterTab /></TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h1 className="text-3xl font-bold">Pricing Packages</h1><p className="text-muted-foreground text-sm">Edit prices, credit allocations and active flags.</p></div>
                <Button onClick={createPkg} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New package</Button>
              </div>
              <div className="grid gap-4">{pkgs.map(pkg => <PkgRow key={pkg.id} pkg={pkg} onSave={savePkg} onDelete={removePkg} />)}</div>
            </TabsContent>

            <TabsContent value="memes" className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h1 className="text-3xl font-bold">Meme Hook Library</h1><p className="text-muted-foreground text-sm">Upload 2-3 second meme videos that creators prepend to clips as viral intro hooks.</p></div>
                <Button onClick={createMeme} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New meme</Button>
              </div>
              <div className="grid gap-4">{memes.map(m => <MemeRow key={m.id} meme={m} onSave={saveMeme} onDelete={removeMeme} />)}</div>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">Integrations</h1>
                <p className="text-muted-foreground text-sm">Configure API keys for AI providers and payment gateways. Credentials are encrypted at rest and masked in this UI after saving.</p>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI Providers</h2>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {INTEGRATIONS.filter(i => i.category === 'ai').map(meta => (
                    <IntegrationCard key={meta.provider} meta={meta} existing={integrations.find(x => x.provider === meta.provider)} onSave={saveIntegration} onDelete={deleteIntegration} />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment Gateways</h2>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {INTEGRATIONS.filter(i => i.category === 'payment').map(meta => (
                    <IntegrationCard key={meta.provider} meta={meta} existing={integrations.find(x => x.provider === meta.provider)} onSave={saveIntegration} onDelete={deleteIntegration} />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2"><Key className="h-4 w-4" /> Infrastructure & Downloaders</h2>
                <p className="text-xs text-muted-foreground mb-3">Configure HTTP proxy and/or RapidAPI YouTube downloader to enable YouTube URL ingestion. Without one of these configured, YouTube ingestion will fail with 403 (datacenter IP block).</p>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {INTEGRATIONS.filter(i => i.category === 'infra').map(meta => (
                    <IntegrationCard key={meta.provider} meta={meta} existing={integrations.find(x => x.provider === meta.provider)} onSave={saveIntegration} onDelete={deleteIntegration} />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

function IntegrationCard({ meta, existing, onSave, onDelete }) {
  const Icon = meta.icon || Key
  const [values, setValues] = useState({})
  const [isActive, setIsActive] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existing) {
      setValues(existing.credentials || {})
      setIsActive(existing.is_active !== false)
    }
  }, [existing])

  const configured = existing?.has_credentials
  const dirty = JSON.stringify(values) !== JSON.stringify(existing?.credentials || {}) || isActive !== (existing?.is_active !== false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(meta.provider, values, isActive) } finally { setSaving(false) }
  }

  return (
    <Card className={`relative overflow-hidden ${configured ? 'border-primary/40' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${configured ? 'gradient-bg text-white' : 'bg-muted text-muted-foreground'}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                {meta.name}
                {configured ? (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border-transparent gap-1 text-[10px] px-1.5 h-5"><Check className="h-3 w-3" /> Configured</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-5 gap-1"><AlertCircle className="h-3 w-3" /> Not configured</Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meta.description}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-3">
        {meta.fields.map(field => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            <div className="relative">
              <Input
                type={field.type === 'password' && !revealing ? 'password' : 'text'}
                placeholder={field.placeholder || ''}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="font-mono text-xs pr-9"
              />
              {field.type === 'password' && (
                <button type="button" onClick={() => setRevealing(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {revealing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">Get API key →</a>
          <div className="flex items-center gap-2 text-xs">
            <Label className="text-xs text-muted-foreground">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          {configured && (
            <Button variant="outline" size="sm" onClick={() => onDelete(meta.provider)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" disabled={!dirty || saving} onClick={handleSave} className={`flex-1 ${dirty ? 'gradient-bg text-white' : ''}`}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            {configured ? 'Update' : 'Save credentials'}
          </Button>
        </div>
      </CardContent>
    </Card>
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
  const [uploading, setUploading] = useState(null)
  const videoRef = useRef(null)
  const thumbRef = useRef(null)
  const dirty = JSON.stringify(local) !== JSON.stringify(meme)
  function update(k, v) { setLocal(prev => ({ ...prev, [k]: v })) }

  async function uploadFile(file, kind) {
    if (!file) return
    setUploading(kind === 'meme_video' ? 'video' : 'thumb')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      const r = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Upload failed')
      if (kind === 'meme_video') update('video_url', data.url)
      else update('thumbnail_url', data.url)
      toast.success('File uploaded')
    } catch (e) { toast.error('Upload failed', { description: e.message }) }
    finally { setUploading(null) }
  }

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
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{local.video_url || <em>no video uploaded</em>}</div>
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
        <Field label="Video file" className="md:col-span-2">
          <div className="flex gap-2">
            <Input value={local.video_url} onChange={e => update('video_url', e.target.value)} placeholder="https:// or upload…" className="text-xs" />
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0], 'meme_video')} />
            <Button type="button" variant="outline" size="icon" onClick={() => videoRef.current?.click()} disabled={uploading === 'video'}>
              {uploading === 'video' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
        <Field label="Thumbnail">
          <div className="flex gap-2">
            <Input value={local.thumbnail_url} onChange={e => update('thumbnail_url', e.target.value)} placeholder="URL or upload" className="text-xs" />
            <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0], 'meme_thumbnail')} />
            <Button type="button" variant="outline" size="icon" onClick={() => thumbRef.current?.click()} disabled={uploading === 'thumb'}>
              {uploading === 'thumb' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
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
