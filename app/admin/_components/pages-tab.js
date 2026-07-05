'use client'

// Admin CMS: Custom pages (privacy, terms, about, custom marketing pages, etc.)
// Each page has: slug, title, HTML body content, SEO meta, and public/private visibility.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, ExternalLink, Eye, EyeOff, FileText } from 'lucide-react'

export default function PagesTab() {
  const [pages, setPages] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => { reload() }, [])
  async function reload() {
    const r = await fetch('/api/admin/pages?admin=true')
    const d = await r.json().catch(() => [])
    setPages(Array.isArray(d) ? d : [])
    if (selected) {
      const fresh = (Array.isArray(d) ? d : []).find(p => p.id === selected.id)
      if (fresh) setSelected(fresh)
    }
  }

  async function create() {
    const title = prompt('Page title?')
    if (!title) return
    const r = await fetch('/api/admin/pages?admin=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, content_html: '<h1>' + title + '</h1><p>Start editing this page in the admin.</p>' }) })
    const d = await r.json()
    if (!r.ok) return toast.error(d.error || 'Create failed')
    toast.success('Page created')
    await reload()
    setSelected(d)
  }

  async function remove(page) {
    if (!confirm(`Delete \"${page.title}\"?`)) return
    const r = await fetch(`/api/admin/pages/${page.id}?admin=true`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); if (selected?.id === page.id) setSelected(null); await reload() }
    else toast.error('Delete failed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Custom Pages</h1>
          <p className="text-muted-foreground text-sm">Create additional pages (Privacy, About, feature landing pages) with SEO meta. Public URL: <code className="text-xs">/p/[slug]</code></p>
        </div>
        <Button onClick={create} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> New page</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Left: list */}
        <div className="space-y-2 md:col-span-1">
          {pages === null ? [1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)
            : pages.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2" />No pages yet.</CardContent></Card>
            ) : pages.map(p => (
              <button key={p.id} onClick={() => setSelected(p)} className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${selected?.id === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate">{p.title}</div>
                  <div className="flex gap-1 shrink-0">
                    {p.visibility === 'private' ? <Badge variant="outline" className="text-[9px]"><EyeOff className="h-3 w-3 mr-0.5" /> private</Badge> : <Badge variant="outline" className="text-[9px]"><Eye className="h-3 w-3 mr-0.5" /> public</Badge>}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">/p/{p.slug}</div>
              </button>
            ))}
        </div>

        {/* Right: editor */}
        <div className="md:col-span-2">
          {selected ? <PageEditor key={selected.id} page={selected} onSaved={reload} onDelete={() => remove(selected)} /> : (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2" />Select a page from the left, or create a new one.
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  )
}

function PageEditor({ page, onSaved, onDelete }) {
  const [title, setTitle] = useState(page.title)
  const [metaTitle, setMetaTitle] = useState(page.meta_title || '')
  const [metaDesc, setMetaDesc] = useState(page.meta_description || '')
  const [visibility, setVisibility] = useState(page.visibility || 'public')
  const [content, setContent] = useState(page.content_html || '')
  const [isActive, setIsActive] = useState(page.is_active !== false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const r = await fetch(`/api/admin/pages/${page.id}?admin=true`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        title, meta_title: metaTitle, meta_description: metaDesc, visibility, content_html: content, is_active: isActive,
      }) })
      if (!r.ok) throw new Error('Save failed')
      toast.success('Saved')
      await onSaved?.()
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gradient-bg text-white"><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
            <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /> View live</a>
          </div>
          <div className="flex gap-2">
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Slug (immutable)</Label><Input value={page.slug} readOnly className="bg-muted font-mono text-xs" /></div>
        </div>
        <div className="space-y-1"><Label className="text-xs">Meta title (browser tab)</Label><Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Meta description</Label><Textarea rows={2} value={metaDesc} onChange={e => setMetaDesc(e.target.value)} /></div>
        <div className="space-y-1">
          <Label className="text-xs">Content (HTML — supports headings, paragraphs, links, lists)</Label>
          <Textarea rows={12} value={content} onChange={e => setContent(e.target.value)} className="font-mono text-xs" />
        </div>
      </CardContent>
    </Card>
  )
}
