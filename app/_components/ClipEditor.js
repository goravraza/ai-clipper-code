'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Palette, Captions, Type, Camera, Film, Crop, Droplet, Hash, Image as ImageIcon,
  Gauge, Scissors, X, Loader2, Upload, Sparkles, Check,
} from 'lucide-react'

// Caption-style presets (the "Big idea" grid in the reference)
const PRESETS = [
  { id: 'classic_white',   label: 'Classic White',  ass: { fontName:'Montserrat', fontSize:20, primary:'&H00FFFFFF&', outline:2, outlineColour:'&H00000000&', bold:1 } },
  { id: 'neon_pop',        label: 'Neon Pop',       ass: { fontName:'Bebas Neue', fontSize:22, primary:'&H00FFFF00&', outline:3, outlineColour:'&H00FF00FF&', bold:1 } },
  { id: 'red_alert',       label: 'Red Alert',      ass: { fontName:'Impact',      fontSize:22, primary:'&H00FFFFFF&', outline:3, outlineColour:'&H000000FF&', bold:1 } },
  { id: 'minimal',         label: 'Minimal',        ass: { fontName:'DejaVu Sans', fontSize:18, primary:'&H00FFFFFF&', outline:1, outlineColour:'&H00000000&', bold:0 } },
  { id: 'cyber_cyan',      label: 'Cyber Cyan',     ass: { fontName:'Oswald',      fontSize:20, primary:'&H00FFFFFF&', outline:2, outlineColour:'&H00FFFF00&', bold:1 } },
  { id: 'highlight_yellow',label: 'Highlight',      ass: { fontName:'Montserrat', fontSize:20, primary:'&H00000000&', outline:0, outlineColour:'&H00000000&', back:'&H0015E1FF&', borderStyle:3, bold:1 } },
  { id: 'pink_pop',        label: 'Pink Pop',       ass: { fontName:'Pacifico',    fontSize:22, primary:'&H00B469FF&', outline:2, outlineColour:'&H00FFFFFF&', bold:1 } },
  { id: 'script_gold',     label: 'Script Gold',    ass: { fontName:'Pacifico',    fontSize:22, primary:'&H0015CCFA&', outline:2, outlineColour:'&H00000000&', bold:1 } },
  { id: 'comic_pink',      label: 'Comic Pink',     ass: { fontName:'Bangers',     fontSize:22, primary:'&H00B469FF&', outline:2, outlineColour:'&H00FFFFFF&', bold:1 } },
  { id: 'block_red',       label: 'Block Red',      ass: { fontName:'Impact',      fontSize:22, primary:'&H00FFFFFF&', outline:0, outlineColour:'&H00000000&', back:'&H000000FF&', borderStyle:3, bold:1 } },
  { id: 'highlight_yellow_blk', label: 'Block Yellow', ass: { fontName:'Bebas Neue',fontSize:22, primary:'&H00000000&', outline:0, outlineColour:'&H00000000&', back:'&H0000FFFF&', borderStyle:3, bold:1 } },
  { id: 'minimalist',      label: 'Minimalist',     ass: { fontName:'DejaVu Sans', fontSize:16, primary:'&H00FFFFFF&', outline:1, outlineColour:'&H00000000&', bold:0 } },
  { id: 'green_pop',       label: 'Green Pop',      ass: { fontName:'Bebas Neue',  fontSize:22, primary:'&H0000FF00&', outline:2, outlineColour:'&H00000000&', bold:1 } },
  { id: 'block_pink',      label: 'Block Pink',     ass: { fontName:'Montserrat',  fontSize:20, primary:'&H00FFFFFF&', outline:0, outlineColour:'&H00000000&', back:'&H00C26895&', borderStyle:3, bold:1 } },
  { id: 'block_blue',      label: 'Block Blue',     ass: { fontName:'Montserrat',  fontSize:20, primary:'&H00FFFFFF&', outline:0, outlineColour:'&H00000000&', back:'&H00FF6F1A&', borderStyle:3, bold:1 } },
  { id: 'plain_white',     label: 'Plain White',    ass: { fontName:'DejaVu Sans', fontSize:18, primary:'&H00FFFFFF&', outline:0, outlineColour:'&H00000000&', bold:1 } },
  { id: 'block_cyan',      label: 'Block Cyan',     ass: { fontName:'Bebas Neue',  fontSize:22, primary:'&H00000000&', outline:0, outlineColour:'&H00000000&', back:'&H00FFFF00&', borderStyle:3, bold:1 } },
  { id: 'magenta_pop',     label: 'Magenta Pop',    ass: { fontName:'Bebas Neue',  fontSize:22, primary:'&H00FF15FF&', outline:2, outlineColour:'&H00FFFFFF&', bold:1 } },
]

// Template tone presets — change the AI clip framing (cosmetic in UI; backend stores template_id for re-analysis)
const TEMPLATES = [
  { id: 'key_insights', label: 'Key Insights' },
  { id: 'hot_take',     label: 'Hot Take' },
  { id: 'quotable',     label: 'Quotable' },
  { id: 'deep_dive',    label: 'Deep Dive' },
  { id: 'casual_recap', label: 'Casual Recap' },
]

const ASPECTS = [
  { value: '9:16', label: '9:16', tw: 'aspect-[9/16]' },
  { value: '1:1',  label: '1:1',  tw: 'aspect-square' },
  { value: '16:9', label: '16:9', tw: 'aspect-video' },
]

const TABS = [
  { id: 'presets',  icon: Palette,   label: 'Presets' },
  { id: 'cc',       icon: Captions,  label: 'CC' },
  { id: 'text',     icon: Type,      label: 'Text' },
  { id: 'crop',     icon: Crop,      label: 'Crop' },
  { id: 'trim',     icon: Scissors,  label: 'Trim' },
  { id: 'speed',    icon: Gauge,     label: 'Speed' },
  { id: 'logo',     icon: ImageIcon, label: 'Logo' },
]

const LOGO_POSITIONS = [
  { id: 'top-left', label: '↖ TL' },
  { id: 'top-right', label: '↗ TR' },
  { id: 'bottom-left', label: '↙ BL' },
  { id: 'bottom-right', label: '↘ BR' },
]

export default function ClipEditor({ open, clip, onClose, onSaved }) {
  const initial = useMemo(() => {
    if (!clip) return null
    const dur = (clip.end_time_seconds || 0) - (clip.start_time_seconds || 0)
    return {
      template_id: clip.template_id || 'key_insights',
      style_preset: clip.style_preset || 'classic_white',
      style_ass: clip.style_ass || PRESETS[0].ass,
      title_text: clip.title_text || '',
      title_position: clip.title_position || 'top',
      crop_aspect: clip.crop_aspect || '9:16',
      trim_start: clip.trim_start ?? 0,
      trim_end: clip.trim_end ?? dur,
      speed: clip.speed || 1.0,
      font_size: clip.font_size || clip.style_ass?.fontSize || 20,
      outline_size: clip.outline_size ?? 2,
      caption_position_percent: clip.overlays_config?.caption?.position_percent ?? 78,
      logo_url: clip.logo_url || null,
      logo_position: clip.logo_position || 'top-right',
      clip_title: clip.clip_title || '',
      duration: dur,
    }
  }, [clip])

  const [state, setState] = useState(initial)
  const [tab, setTab] = useState('presets')
  const [rendering, setRendering] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [probedDuration, setProbedDuration] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { setState(initial); setTab('presets'); setProbedDuration(null) }, [initial])

  // Probe actual MP4 duration from the video element once metadata loads
  // (DB's end-start may not match if previous trims have shrunk the file)
  useEffect(() => {
    if (!clip?.storage_url_mp4) return
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.src = `${clip.storage_url_mp4}?probe=${clip.render_version || 0}`
    const handler = () => {
      const d = Number(v.duration)
      if (Number.isFinite(d) && d > 0) {
        setProbedDuration(d)
        setState(s => s ? {
          ...s,
          duration: d,
          trim_start: Math.min(s.trim_start, d - 0.5),
          trim_end: Math.min(s.trim_end, d),
        } : s)
      }
    }
    v.addEventListener('loadedmetadata', handler, { once: true })
    return () => v.removeEventListener('loadedmetadata', handler)
  }, [clip?.id, clip?.storage_url_mp4, clip?.render_version])

  if (!clip || !state) return null

  function patch(p) { setState(s => ({ ...s, ...p })) }

  function selectPreset(p) {
    patch({
      style_preset: p.id,
      style_ass: p.ass,
      font_size: p.ass.fontSize,
      outline_size: p.ass.outline ?? 2,
    })
  }

  async function uploadLogo(file) {
    if (!file) return
    if (!/(image\/|\.(png|jpg|jpeg|webp))/i.test(file.type + file.name)) return toast.error('Please choose a PNG/JPG/WebP image')
    if (file.size > 10 * 1024 * 1024) return toast.error('Logo too large (max 10 MB)')
    setUploadingLogo(true)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', 'logo')
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Upload failed')
      patch({ logo_url: data.url })
      toast.success('Logo uploaded')
    } catch (e) { toast.error('Logo upload failed', { description: e.message }) }
    finally { setUploadingLogo(false) }
  }

  async function renderClip() {
    setRendering(true)
    try {
      const payload = {
        trim_start: state.trim_start,
        trim_end: state.trim_end,
        crop_aspect: state.crop_aspect,
        speed: state.speed,
        style_preset: state.style_preset,
        style_ass: state.style_ass,
        font_size: state.font_size,
        outline_size: state.outline_size,
        caption_position_percent: state.caption_position_percent,
        logo_url: state.logo_url,
        logo_position: state.logo_position,
        title_text: state.title_text,
        title_position: state.title_position,
        clip_title: state.clip_title,
        template_id: state.template_id,
      }
      const r = await fetch(`/api/clips/${clip.id}/render`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Render failed')
      toast.success('✨ Clip rendered', { description: `Final duration ${Number(data.final_duration).toFixed(1)}s` })
      onSaved?.(data.clip)
      onClose?.()
    } catch (e) { toast.error('Render failed', { description: e.message }) }
    finally { setRendering(false) }
  }

  const previewBg = clip.thumbnail_url || ''
  const previewAspect = ASPECTS.find(a => a.value === state.crop_aspect) || ASPECTS[0]

  // Cache-bust the video URL on render so the new MP4 loads
  const videoSrc = clip.storage_url_mp4 ? `${clip.storage_url_mp4}?v=${clip.render_version || 0}` : null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-hidden p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex-1 min-w-0">
            <Input
              value={state.clip_title}
              onChange={(e) => patch({ clip_title: e.target.value })}
              placeholder="Clip title…"
              className="border-0 px-0 text-base font-semibold focus-visible:ring-0 shadow-none bg-transparent"
            />
            <div className="text-xs text-muted-foreground">
              {Number(state.duration).toFixed(0)}s source • {(state.trim_end - state.trim_start).toFixed(1)}s after trim • {state.crop_aspect}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Templates row */}
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2 overflow-x-auto">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => patch({ template_id: t.id })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${state.template_id === t.id ? 'bg-foreground text-background' : 'bg-background text-foreground border border-border hover:border-primary/50'}`}
            >{t.label}</button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium">FORMAT</span>
            {ASPECTS.map(a => (
              <button key={a.value} onClick={() => patch({ crop_aspect: a.value })}
                className={`px-2.5 py-1 rounded-md font-medium border ${state.crop_aspect === a.value ? 'border-foreground text-foreground bg-background' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{a.label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[260px_1fr] gap-0 min-h-0">
          {/* Left: live video preview */}
          <div className="border-r border-border p-4 flex flex-col items-center bg-zinc-950">
            <div className={`relative w-full ${previewAspect.tw} max-h-[60vh] overflow-hidden rounded-lg border border-zinc-800 bg-black`} style={{ aspectRatio: state.crop_aspect.replace(':','/') }}>
              {videoSrc ? (
                <video
                  key={videoSrc}
                  src={videoSrc}
                  className="absolute inset-0 w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              {/* Title overlay live preview */}
              {state.title_text && (
                <div className={`absolute left-1/2 -translate-x-1/2 ${state.title_position === 'bottom' ? 'bottom-4' : 'top-4'} px-3 py-1.5 bg-black/70 text-white text-xs font-bold tracking-wide rounded`}>
                  {state.title_text}
                </div>
              )}
              {/* Logo preview */}
              {state.logo_url && (
                <div className={`absolute ${state.logo_position?.startsWith('top') ? 'top-3' : 'bottom-3'} ${state.logo_position?.endsWith('right') ? 'right-3' : 'left-3'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.logo_url} alt="logo" className="h-10 w-auto object-contain drop-shadow-md" />
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 text-center">Preview · changes apply on Render</div>
          </div>

          {/* Right: tabs */}
          <div className="flex flex-col min-h-0">
            <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="rounded-none border-b border-border bg-card h-auto p-1 justify-start gap-1 overflow-x-auto">
                {TABS.map(t => {
                  const Icon = t.icon
                  return (
                    <TabsTrigger key={t.id} value={t.id} className="data-[state=active]:bg-muted gap-1.5 text-xs">
                      <Icon className="h-3.5 w-3.5" /> {t.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {/* Presets */}
              <TabsContent value="presets" className="p-4 overflow-y-auto max-h-[55vh] mt-0">
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(p => {
                    const active = state.style_preset === p.id
                    return (
                      <button key={p.id} onClick={() => selectPreset(p)}
                        className={`relative rounded-lg border-2 p-3 flex items-center justify-center transition-all ${active ? 'border-primary' : 'border-border hover:border-primary/40'}`}
                        style={{ background: '#0a0a0a' }}
                      >
                        <PresetSample preset={p} />
                        {active && <span className="absolute top-1 right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center"><Check className="h-2.5 w-2.5 text-white" /></span>}
                      </button>
                    )
                  })}
                </div>
              </TabsContent>

              {/* CC — fine-tune captions */}
              <TabsContent value="cc" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Font size</Label>
                    <span className="text-muted-foreground">{state.font_size}px</span>
                  </div>
                  <Slider min={10} max={48} step={1} value={[state.font_size]} onValueChange={([v]) => patch({ font_size: v })} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Stroke / outline</Label>
                    <span className="text-muted-foreground">{state.outline_size}px</span>
                  </div>
                  <Slider min={0} max={6} step={0.5} value={[state.outline_size]} onValueChange={([v]) => patch({ outline_size: v })} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Caption position (from bottom)</Label>
                    <span className="text-muted-foreground">{state.caption_position_percent}%</span>
                  </div>
                  <Slider min={5} max={95} step={1} value={[state.caption_position_percent]} onValueChange={([v]) => patch({ caption_position_percent: v })} />
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[{l:'Top', v:20},{l:'Middle', v:50},{l:'Bottom', v:80}].map(p => (
                      <Button key={p.l} size="sm" variant={Math.abs(state.caption_position_percent - p.v) < 5 ? 'default' : 'outline'} onClick={() => patch({ caption_position_percent: p.v })}>{p.l}</Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Text — top/bottom title overlay */}
              <TabsContent value="text" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Title text overlay</Label>
                  <Input value={state.title_text} onChange={(e) => patch({ title_text: e.target.value.slice(0, 120) })} placeholder="e.g. THE TRUTH ABOUT…" />
                  <div className="text-[11px] text-muted-foreground">Drawn directly on the video at render-time. Max 120 chars.</div>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant={state.title_position === 'top' ? 'default' : 'outline'} onClick={() => patch({ title_position: 'top' })}>Top</Button>
                    <Button size="sm" variant={state.title_position === 'bottom' ? 'default' : 'outline'} onClick={() => patch({ title_position: 'bottom' })}>Bottom</Button>
                  </div>
                </div>
                {state.title_text && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-center">
                    <Badge variant="outline" className="text-[10px] mb-2">LIVE PREVIEW</Badge>
                    <div className="font-black tracking-wider text-base">{state.title_text}</div>
                  </div>
                )}
              </TabsContent>

              {/* Crop */}
              <TabsContent value="crop" className="p-4 overflow-y-auto max-h-[55vh] mt-0">
                <div className="grid grid-cols-3 gap-3">
                  {ASPECTS.map(a => (
                    <button key={a.value} onClick={() => patch({ crop_aspect: a.value })}
                      className={`relative rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-colors ${state.crop_aspect === a.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                      <div className={`${a.tw} w-14 bg-muted-foreground/30 rounded`} />
                      <div className="text-xs font-medium">{a.label}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground mt-3">Crops from the center. For 1:1 / 16:9, the original 9:16 frame is letter/pillar-boxed by ffmpeg.</div>
              </TabsContent>

              {/* Trim */}
              <TabsContent value="trim" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>In / out point</Label>
                    <span className="text-muted-foreground tabular-nums">{state.trim_start.toFixed(1)}s → {state.trim_end.toFixed(1)}s · <span className="text-primary font-medium">{(state.trim_end - state.trim_start).toFixed(1)}s final</span></span>
                  </div>
                  <Slider min={0} max={state.duration} step={0.1} minStepsBetweenThumbs={1}
                    value={[state.trim_start, state.trim_end]}
                    onValueChange={([a, b]) => patch({ trim_start: a, trim_end: b })} />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>0:00</span><span>{Math.floor(state.duration / 60)}:{String(Math.floor(state.duration % 60)).padStart(2,'0')}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => patch({ trim_start: 0, trim_end: state.duration })}>Reset</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const mid = state.duration / 2
                    const half = Math.min(15, state.duration / 4)
                    patch({ trim_start: Math.max(0, mid - half), trim_end: Math.min(state.duration, mid + half) })
                  }}>Center 30s</Button>
                </div>
              </TabsContent>

              {/* Speed */}
              <TabsContent value="speed" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Playback speed</Label>
                    <span className="text-muted-foreground tabular-nums">{state.speed.toFixed(2)}×</span>
                  </div>
                  <Slider min={0.5} max={2.0} step={0.05} value={[state.speed]} onValueChange={([v]) => patch({ speed: v })} />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[0.5, 0.75, 1.0, 1.25, 1.5].map(v => (
                    <Button key={v} size="sm" variant={Math.abs(state.speed - v) < 0.02 ? 'default' : 'outline'} onClick={() => patch({ speed: v })}>{v}×</Button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">Audio is pitch-corrected (atempo filter). Range 0.5×–2×.</div>
              </TabsContent>

              {/* Logo */}
              <TabsContent value="logo" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-4">
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:border-primary/40"
                  onClick={() => fileRef.current?.click()}>
                  {state.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={state.logo_url} alt="logo" className="mx-auto h-20 w-auto object-contain" />
                  ) : (
                    <>
                      <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium">Upload Logo</div>
                      <div className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WebP · Max 10MB</div>
                    </>
                  )}
                  <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => uploadLogo(e.target.files?.[0])} />
                </div>
                {uploadingLogo && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> uploading…</div>}
                {state.logo_url && (
                  <>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {LOGO_POSITIONS.map(p => (
                          <Button key={p.id} size="sm" variant={state.logo_position === p.id ? 'default' : 'outline'} onClick={() => patch({ logo_position: p.id })}>{p.label}</Button>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => patch({ logo_url: null })}>Remove logo</Button>
                  </>
                )}
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-card">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={renderClip} disabled={rendering} className="gradient-bg text-white min-w-[140px]">
                {rendering ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Rendering…</> : <><Sparkles className="h-4 w-4 mr-1.5" /> Render Clip</>}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PresetSample({ preset }) {
  const ass = preset.ass
  // Translate &HAABBGGRR& format to CSS — strip &H and &, swap to #RRGGBB.
  function toCss(c) {
    if (!c) return null
    const m = String(c).replace(/&H|&/g, '')
    if (m.length < 6) return null
    // ASS = BGR (no alpha first 2 if 8 chars). Take last 6 chars and reverse to RGB.
    const hex6 = m.slice(-6)
    const r = hex6.slice(4, 6); const g = hex6.slice(2, 4); const b = hex6.slice(0, 2)
    return `#${r}${g}${b}`
  }
  const color = toCss(ass.primary) || '#ffffff'
  const stroke = toCss(ass.outlineColour) || '#000000'
  const back = ass.back ? toCss(ass.back) : null
  const fontFamily = ass.fontName
  return (
    <div className="flex gap-1.5 items-center text-sm font-bold tracking-tight" style={{ fontFamily, color, textShadow: back ? 'none' : `-1px -1px 0 ${stroke}, 1px -1px 0 ${stroke}, -1px 1px 0 ${stroke}, 1px 1px 0 ${stroke}` }}>
      <span style={{ background: back || 'transparent', padding: back ? '1px 5px' : 0, borderRadius: back ? 3 : 0 }}>Big</span>
      <span style={{ background: back || 'transparent', padding: back ? '1px 5px' : 0, borderRadius: back ? 3 : 0 }}>idea</span>
    </div>
  )
}
