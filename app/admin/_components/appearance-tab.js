'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Upload, Palette, Megaphone, Code, Share2, Search, ImageIcon, Sliders } from 'lucide-react'

export default function AppearanceTab() {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const logoRef = useRef(null)
  const favRef = useRef(null)
  const ogRef = useRef(null)

  useEffect(() => { load() }, [])
  async function load() {
    const r = await fetch('/api/admin/site-settings?admin=true')
    const d = await r.json().catch(() => null)
    setS(d || {})
  }

  function patch(u) { setS(prev => ({ ...prev, ...u })) }

  async function save() {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/site-settings?admin=true', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) })
      if (!r.ok) throw new Error('Save failed')
      toast.success('Site settings saved — refresh to see the changes site-wide')
      await load()
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  async function upload(kind, file) {
    if (!file) return
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      const r = await fetch('/api/admin/site-settings/upload?admin=true', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Upload failed')
      toast.success(`${kind} uploaded`)
      await load()
    } catch (e) { toast.error(e.message) }
    setUploading(null)
  }

  if (!s) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap sticky top-0 z-30 bg-background py-2 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold">Appearance & Site Settings</h1>
          <p className="text-muted-foreground text-sm">Brand, SEO, announcement bar, integration snippets — all in one place.</p>
        </div>
        <Button onClick={save} disabled={saving} className="gradient-bg text-white"><Save className="h-4 w-4 mr-1" /> Save all</Button>
      </div>

      {/* Brand identity */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sliders className="h-4 w-4" /> Brand identity</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Site name</Label><Input value={s.site_name || ''} onChange={e => patch({ site_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tagline</Label><Input value={s.site_tagline || ''} onChange={e => patch({ site_tagline: e.target.value })} /></div>
          <UploadRow label="Logo (PNG/SVG, ≤50KB)" url={s.logo_url} kind="logo" onChoose={f => upload('logo', f)} busy={uploading === 'logo'} inputRef={logoRef} />
          <UploadRow label="Favicon (ICO/PNG, ≤50KB)" url={s.favicon_url} kind="favicon" onChoose={f => upload('favicon', f)} busy={uploading === 'favicon'} inputRef={favRef} />
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Colors & theme</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <ColorField label="Primary" value={s.primary_color} onChange={v => patch({ primary_color: v })} />
          <ColorField label="Accent" value={s.accent_color} onChange={v => patch({ accent_color: v })} />
          <div className="space-y-1.5">
            <Label>Default theme</Label>
            <Select value={s.default_theme || 'dark'} onValueChange={v => patch({ default_theme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> SEO defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Meta title (browser tab)</Label><Input value={s.meta_title || ''} onChange={e => patch({ meta_title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Meta description</Label><Textarea rows={2} value={s.meta_description || ''} onChange={e => patch({ meta_description: e.target.value })} /></div>
          <UploadRow label="OG / social share image (1200×630, ≤500KB)" url={s.og_image_url} kind="og" onChoose={f => upload('og', f)} busy={uploading === 'og'} inputRef={ogRef} />
        </CardContent>
      </Card>

      {/* Announcement bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> Announcement bar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={!!s.announcement_enabled} onCheckedChange={v => patch({ announcement_enabled: v })} />
            <Label>Show announcement bar on every page</Label>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Message</Label><Input value={s.announcement_text || ''} onChange={e => patch({ announcement_text: e.target.value })} /></div>
            <ColorField label="Background" value={s.announcement_bg} onChange={v => patch({ announcement_bg: v })} />
            <div className="space-y-1.5"><Label>Link URL</Label><Input value={s.announcement_link || ''} onChange={e => patch({ announcement_link: e.target.value })} placeholder="/#pricing" /></div>
            <div className="space-y-1.5"><Label>Link label</Label><Input value={s.announcement_link_label || ''} onChange={e => patch({ announcement_link_label: e.target.value })} placeholder="See plans" /></div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!s.announcement_dismissable} onCheckedChange={v => patch({ announcement_dismissable: v })} />
            <Label>Allow visitors to dismiss (stored per-browser)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sliders className="h-4 w-4" /> Feature flags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={!!s.features_scheduling_enabled} onCheckedChange={v => patch({ features_scheduling_enabled: v })} />
            <div>
              <Label>Enable Scheduling</Label>
              <div className="text-[11px] text-muted-foreground">Shows the Calendar page + Schedule buttons on clip cards. Disable while the feature is under construction.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social links */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Share2 className="h-4 w-4" /> Social links (footer)</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Twitter / X URL</Label><Input value={s.social_twitter || ''} onChange={e => patch({ social_twitter: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Instagram URL</Label><Input value={s.social_instagram || ''} onChange={e => patch({ social_instagram: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>YouTube URL</Label><Input value={s.social_youtube || ''} onChange={e => patch({ social_youtube: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>LinkedIn URL</Label><Input value={s.social_linkedin || ''} onChange={e => patch({ social_linkedin: e.target.value })} /></div>
        </CardContent>
      </Card>

      {/* Code injection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Code className="h-4 w-4" /> Custom code injection</CardTitle>
          <p className="text-[11px] text-muted-foreground">⚠️ Advanced. Paste 3rd-party scripts (Google Tag Manager, Tidio chat, Hotjar, etc.). Runs on every page.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Header code (injected into &lt;head&gt;)</Label>
            <Textarea rows={5} value={s.header_code || ''} onChange={e => patch({ header_code: e.target.value })} className="font-mono text-xs" placeholder="<!-- Google Tag Manager --> ..." />
          </div>
          <div className="space-y-1.5">
            <Label>Footer code (injected before &lt;/body&gt;)</Label>
            <Textarea rows={5} value={s.footer_code || ''} onChange={e => patch({ footer_code: e.target.value })} className="font-mono text-xs" placeholder="<!-- Tidio Chat --> ..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4 z-30">
        <Button onClick={save} disabled={saving} size="lg" className="gradient-bg text-white shadow-xl"><Save className="h-4 w-4 mr-1" /> Save all</Button>
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value.toUpperCase())} className="h-6 w-8 rounded cursor-pointer border-0 bg-transparent p-0" />
        <Input value={value || ''} onChange={e => onChange(e.target.value)} className="h-7 border-0 focus-visible:ring-0 font-mono text-xs px-1" maxLength={7} />
      </div>
    </div>
  )
}

function UploadRow({ label, url, kind, onChoose, busy, inputRef }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={kind} className="h-10 w-10 object-contain rounded bg-muted" />
        ) : (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate font-mono text-muted-foreground">{url || '— not set —'}</div>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" /> {busy ? 'Uploading…' : 'Change'}
        </Button>
        <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={e => onChoose(e.target.files?.[0])} />
      </div>
    </div>
  )
}
