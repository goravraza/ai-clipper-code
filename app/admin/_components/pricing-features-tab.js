'use client'

// Admin CRUD for pricing tiers + the feature-access matrix.
// - Left side: editable list of tiers (rename, reorder, price, delete)
// - Right side: matrix (rows = features, cols = tiers) with a switch per cell
//
// Everything is edited optimistically; a "Save all" button posts the pending
// changes to /api/admin/pricing-features + tier PUTs.

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Save, DollarSign, Coins, Sparkles } from 'lucide-react'

export default function PricingFeaturesTab() {
  const [state, setState] = useState({ catalog: [], tiers: [], matrix: {}, loading: true })
  const [pending, setPending] = useState({}) // { "tier_key::feature_key": bool }
  const [dirty, setDirty] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTier, setNewTier] = useState({ name: '', key: '', price_usd: 0, price_inr: 0, tagline: '' })

  async function reload() {
    setState(s => ({ ...s, loading: true }))
    const r = await fetch('/api/admin/pricing-features?admin=true')
    const data = await r.json().catch(() => ({}))
    setState({
      catalog: Array.isArray(data.catalog) ? data.catalog : [],
      tiers: Array.isArray(data.tiers) ? data.tiers : [],
      matrix: data.matrix || {},
      loading: false,
    })
    setPending({})
    setDirty(new Set())
  }
  useEffect(() => { reload() }, [])

  function toggleCell(tierKey, featureKey) {
    const key = `${tierKey}::${featureKey}`
    const currentVal = pending[key] !== undefined
      ? pending[key]
      : !!(state.matrix[tierKey]?.[featureKey])
    setPending(p => ({ ...p, [key]: !currentVal }))
    setDirty(d => { const n = new Set(d); n.add(key); return n })
  }

  async function saveAll() {
    if (dirty.size === 0) return
    setSaving(true)
    try {
      const updates = Array.from(dirty).map(k => {
        const [tier_key, feature_key] = k.split('::')
        return { tier_key, feature_key, is_enabled: !!pending[k] }
      })
      const r = await fetch('/api/admin/pricing-features?admin=true', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!r.ok) throw new Error('Save failed')
      toast.success(`Saved ${updates.length} change${updates.length === 1 ? '' : 's'}`)
      await reload()
    } catch (e) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  async function updateTier(tier, updates) {
    const r = await fetch(`/api/admin/pricing-tiers/${tier.id}?admin=true`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (r.ok) {
      toast.success(`Updated ${tier.key}`)
      await reload()
    } else {
      const err = await r.json().catch(() => ({}))
      toast.error(err.error || 'Update failed')
    }
  }

  async function deleteTier(tier) {
    if (!confirm(`Delete tier "${tier.name}"? Users on this plan will be moved to Free.`)) return
    const r = await fetch(`/api/admin/pricing-tiers/${tier.id}?admin=true`, { method: 'DELETE' })
    if (r.ok) { toast.success('Deleted'); await reload() }
    else { const err = await r.json().catch(() => ({})); toast.error(err.error || 'Delete failed') }
  }

  async function createTier() {
    if (!newTier.name.trim()) return toast.error('Enter a tier name')
    const r = await fetch('/api/admin/pricing-tiers?admin=true', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newTier),
    })
    if (r.ok) {
      toast.success(`Created ${newTier.name}`)
      setCreating(false)
      setNewTier({ name: '', key: '', price_usd: 0, price_inr: 0, tagline: '' })
      await reload()
    } else {
      const err = await r.json().catch(() => ({}))
      toast.error(err.error || 'Create failed')
    }
  }

  const effectiveMatrix = useMemo(() => {
    // Merge state.matrix + pending overrides
    const m = {}
    for (const t of state.tiers) {
      m[t.key] = { ...(state.matrix[t.key] || {}) }
      for (const f of state.catalog) {
        const k = `${t.key}::${f.key}`
        if (pending[k] !== undefined) m[t.key][f.key] = pending[k]
      }
    }
    return m
  }, [state, pending])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Pricing Tiers & Feature Gating</h1>
          <p className="text-muted-foreground text-sm">Rename tiers, set prices, and flip which premium features each plan unlocks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreating(v => !v)}>
            <Plus className="h-4 w-4 mr-1" /> {creating ? 'Cancel' : 'New tier'}
          </Button>
          <Button onClick={saveAll} disabled={dirty.size === 0 || saving} className={dirty.size > 0 ? 'gradient-bg text-white' : ''}>
            <Save className="h-4 w-4 mr-1" /> Save matrix ({dirty.size})
          </Button>
        </div>
      </div>

      {creating && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Create a new pricing tier</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2"><Label className="text-xs">Display name *</Label><Input value={newTier.name} onChange={e => setNewTier(t => ({ ...t, name: e.target.value, key: t.key || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') }))} placeholder="e.g. Studio" /></div>
            <div><Label className="text-xs">Key (slug)</Label><Input value={newTier.key} onChange={e => setNewTier(t => ({ ...t, key: e.target.value }))} placeholder="studio" /></div>
            <div><Label className="text-xs">Price USD</Label><Input type="number" value={newTier.price_usd} onChange={e => setNewTier(t => ({ ...t, price_usd: Number(e.target.value) }))} /></div>
            <div><Label className="text-xs">Price INR</Label><Input type="number" value={newTier.price_inr} onChange={e => setNewTier(t => ({ ...t, price_inr: Number(e.target.value) }))} /></div>
            <div className="md:col-span-6"><Label className="text-xs">Tagline</Label><Input value={newTier.tagline} onChange={e => setNewTier(t => ({ ...t, tagline: e.target.value }))} placeholder="For agencies with brand kits." /></div>
            <div className="md:col-span-6"><Button onClick={createTier} className="gradient-bg text-white"><Plus className="h-4 w-4 mr-1" /> Create tier</Button></div>
          </CardContent>
        </Card>
      )}

      {state.loading ? (
        <div className="grid gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : (
        <>
          {/* Tier editor row */}
          <div className={`grid gap-3 ${state.tiers.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {state.tiers.map(tier => <TierEditor key={tier.id} tier={tier} onUpdate={updateTier} onDelete={deleteTier} />)}
          </div>

          {/* Feature matrix */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Feature access matrix</CardTitle>
              <p className="text-xs text-muted-foreground">Toggle a switch to enable/disable that feature for that tier. Click <b>Save matrix</b> above to persist.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Feature</th>
                    {state.tiers.map(t => (
                      <th key={t.key} className="text-center py-2 px-3 font-medium">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">{t.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.catalog.map(f => (
                    <tr key={f.key} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{f.label}</div>
                        <div className="text-[11px] text-muted-foreground">{f.description}</div>
                      </td>
                      {state.tiers.map(t => {
                        const dirtyKey = `${t.key}::${f.key}`
                        const on = !!(effectiveMatrix[t.key]?.[f.key])
                        const isDirty = dirty.has(dirtyKey)
                        return (
                          <td key={t.key} className="text-center py-3 px-3">
                            <div className="inline-flex items-center gap-1.5">
                              <Switch checked={on} onCheckedChange={() => toggleCell(t.key, f.key)} />
                              {isDirty && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-500">unsaved</Badge>}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function TierEditor({ tier, onUpdate, onDelete }) {
  const [name, setName] = useState(tier.name)
  const [priceUsd, setPriceUsd] = useState(tier.price_usd || 0)
  const [priceInr, setPriceInr] = useState(tier.price_inr || 0)
  const [tagline, setTagline] = useState(tier.tagline || '')
  const [isActive, setIsActive] = useState(tier.is_active !== false)
  const dirty = name !== tier.name || priceUsd !== (tier.price_usd || 0) || priceInr !== (tier.price_inr || 0) || tagline !== (tier.tagline || '') || isActive !== (tier.is_active !== false)
  const isCore = tier.is_default || tier.key === 'free'

  return (
    <Card className={dirty ? 'border-primary/60' : ''}>
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <Input value={name} onChange={e => setName(e.target.value)} className="font-bold text-base h-9 border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/40" />
            <div className="text-[10px] text-muted-foreground px-1 font-mono">{tier.key}{isCore && ' · default'}</div>
          </div>
          {!isCore && (
            <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => onDelete(tier)} title="Delete tier">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />USD /mo</Label>
            <Input type="number" value={priceUsd} onChange={e => setPriceUsd(Number(e.target.value))} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" />INR /mo</Label>
            <Input type="number" value={priceInr} onChange={e => setPriceInr(Number(e.target.value))} className="h-8 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Tagline</Label>
          <Input value={tagline} onChange={e => setTagline(e.target.value)} className="h-8 text-xs" placeholder="Short pitch shown in upgrade modal" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={isActive} onCheckedChange={setIsActive} /> Active
          </label>
          <Button size="sm" disabled={!dirty} onClick={() => onUpdate(tier, { name, price_usd: priceUsd, price_inr: priceInr, tagline, is_active: isActive })} className={dirty ? 'gradient-bg text-white h-8' : 'h-8'}>
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
