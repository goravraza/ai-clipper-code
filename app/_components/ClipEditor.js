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
  Gauge, Scissors, X, Loader2, Upload, Sparkles, Check, MessageSquareText, Save as SaveIcon, Plus, Trash2,
} from 'lucide-react'
import { styleAssToCss, chunkForLine, findActiveCue } from './captionUtils'

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
      logo_x_percent: Number.isFinite(clip.logo_x_percent) ? clip.logo_x_percent : 90,
      logo_y_percent: Number.isFinite(clip.logo_y_percent) ? clip.logo_y_percent : 10,
      logo_scale_percent: Number.isFinite(clip.logo_scale_percent) ? clip.logo_scale_percent : 12,
      // NEW: drag-positioned caption coords (center anchor, % of frame)
      caption_x_percent: Number.isFinite(clip.caption_x_percent) ? clip.caption_x_percent : 50,
      caption_y_percent: Number.isFinite(clip.caption_y_percent) ? clip.caption_y_percent : (clip.overlays_config?.caption?.position_percent ?? 78),
      // Caption animation style — how the burned-in subtitles animate on export.
      //   'static'      → plain 4-word chunks, no per-word tags
      //   'karaoke'     → active word colored in accent (default; matches word-level Whisper output)
      //   'word_bounce' → same as karaoke + active word pulses 115% → 100% over ~100ms (voice-synced pop)
      animation_style: clip.animation_style || 'karaoke',
      // Fill mode for 9:16 portrait when source is landscape
      fill_mode: clip.fill_mode || 'crop',
      fill_color: clip.fill_color || '#000000',
      clip_title: clip.clip_title || '',
      duration: dur,
    }
  }, [clip])

  const [state, setState] = useState(initial)
  const [tab, setTab] = useState('presets')
  const [rendering, setRendering] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [probedDuration, setProbedDuration] = useState(null)
  // Active caption track — the editable list of {start, end, text} for the live preview overlay.
  const [activeCaptionTrack, setActiveCaptionTrack] = useState([])
  const [activeCueIdx, setActiveCueIdx] = useState(-1)
  const [editingCueIdx, setEditingCueIdx] = useState(-1)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // Measured preview box rect — used so captions/logos scale & position in real pixels
  const [previewRect, setPreviewRect] = useState({ width: 260, height: 462 })
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const previewBoxRef = useRef(null)
  const draggingRef = useRef(false)
  // CRITICAL: these MUST be useRef. Plain objects get re-created on every React render → drag breaks
  // mid-gesture because each render resets `.current` back to its initial value.
  const captionDraggingRef = useRef(false)
  const resizeRef = useRef(null)
  const inlineEditRef = useRef(null)

  useEffect(() => {
    setState(initial); setTab('presets'); setProbedDuration(null)
    setActiveCaptionTrack([]); setActiveCueIdx(-1); setEditingCueIdx(-1); setCurrentTime(0)
  }, [initial])

  // Fetch the clip's transcript when editor opens.
  // If the clip has no srt yet (ingestion couldn't transcribe), auto-trigger a per-clip
  // on-demand transcription via POST /api/clips/:id/transcribe (Groq Whisper on the local MP4).
  useEffect(() => {
    if (!clip?.id) return
    let cancelled = false
    setTranscriptLoading(true)
    ;(async () => {
      try {
        let r = await fetch(`/api/clips/${clip.id}/transcript`)
        let d = await r.json()
        if (cancelled) return
        // If transcript is empty, trigger on-demand generation, then refetch
        if ((!d.has_srt || !d.segments?.length) && clip.storage_url_mp4?.startsWith('/api/files/')) {
          toast.info('🎙️ Generating transcript…', { description: 'Transcribing this clip with Whisper — this takes a few seconds.' })
          const gen = await fetch(`/api/clips/${clip.id}/transcribe`, { method: 'POST' })
          const genData = await gen.json().catch(() => ({}))
          if (cancelled) return
          if (gen.ok && genData.ok) {
            toast.success(`✅ Transcript ready · ${genData.segments_count || '?'} segments`)
            r = await fetch(`/api/clips/${clip.id}/transcript`)
            d = await r.json()
          } else if (genData.error) {
            toast.error('Transcription failed', { description: genData.hint || genData.error })
          }
        }
        if (!cancelled) setActiveCaptionTrack(Array.isArray(d.segments) ? d.segments : [])
      } catch (e) {
        if (!cancelled) console.warn('Load transcript failed:', e.message)
      } finally {
        if (!cancelled) setTranscriptLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clip?.id, clip?.storage_url_mp4])

  // Probe actual MP4 duration from the video element once metadata loads
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

  // Apply speed to the preview video element
  useEffect(() => {
    const v = videoRef.current
    if (v && state?.speed) {
      try { v.playbackRate = Math.max(0.5, Math.min(2.0, state.speed)) } catch { /* noop */ }
    }
  }, [state?.speed, clip?.storage_url_mp4, clip?.render_version])

  // Sync current time → which cue is active (60 fps capped via requestAnimationFrame loop)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let raf = 0
    const tick = () => {
      const t = v.currentTime || 0
      setCurrentTime(t)
      const { idx } = findActiveCue(activeCaptionTrack, t)
      setActiveCueIdx(prev => prev !== idx ? idx : prev)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeCaptionTrack, clip?.storage_url_mp4, clip?.render_version])

  // Measure the preview box so caption pixel sizes scale correctly w/ aspect ratio + responsive layout.
  useEffect(() => {
    const el = previewBoxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setPreviewRect({ width: r.width, height: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, state?.crop_aspect])

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
      // Save any pending caption edits first
      if (activeCaptionTrack && activeCaptionTrack.length > 0) {
        try {
          await fetch(`/api/clips/${clip.id}/transcript`, {
            method: 'PUT', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ segments: activeCaptionTrack }),
          })
        } catch (e) { console.warn('Save transcript failed (continuing render):', e) }
      }
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
        caption_x_percent: state.caption_x_percent,
        caption_y_percent: state.caption_y_percent,
        fill_mode: state.fill_mode,
        fill_color: state.fill_color,
        logo_url: state.logo_url,
        logo_position: state.logo_position,
        logo_x_percent: state.logo_x_percent,
        logo_y_percent: state.logo_y_percent,
        logo_scale_percent: state.logo_scale_percent,
        title_text: state.title_text,
        title_position: state.title_position,
        clip_title: state.clip_title,
        template_id: state.template_id,
        // NEW: caption animation style — drives the ASS event generator in the backend
        animation_style: state.animation_style,
        // Pass the edited caption track so the backend uses the user's edits (not the cached srt)
        caption_segments: activeCaptionTrack,
      }
      const r = await fetch(`/api/clips/${clip.id}/render`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // Defensive parse — if the upstream proxy times out / errors, the body is an HTML page,
      // not JSON. Surface a useful message instead of "Unexpected token '<'".
      const ctype = r.headers.get('content-type') || ''
      if (!ctype.includes('application/json')) {
        const text = await r.text().catch(() => '')
        if (r.status === 504 || r.status === 502 || r.status === 524) {
          throw new Error('Render timed out at the gateway. Try a shorter trim window, "Crop" fill mode, or retry — the server may still be processing.')
        }
        throw new Error(`Render failed (HTTP ${r.status}). Server returned non-JSON response${text ? ': ' + text.slice(0, 120) : ''}`)
      }
      const data = await r.json()
      if (r.status === 402) {
        // Low credits — show clear billing CTA instead of generic error
        toast.error(data.message || 'Low credits', {
          description: `Need ${data.required?.toFixed?.(2) || ''} credits · Have ${data.available?.toFixed?.(2) || ''}. Head to Pricing to top up.`,
          duration: 8000,
        })
        return
      }
      if (!r.ok) throw new Error(data.error || 'Render failed')
      toast.success('✨ Clip rendered', {
        description: `Duration ${Number(data.final_duration).toFixed(1)}s · -${data.credits_charged?.toFixed?.(2) ?? '?'} credits · ${data.credits_remaining?.toFixed?.(2) ?? '?'} left`,
      })
      onSaved?.(data.clip, { credits_remaining: data.credits_remaining })
      onClose?.()
    } catch (e) { toast.error('Render failed', { description: e.message }) }
    finally { setRendering(false) }
  }

  // ============ Caption editing helpers ============
  function updateCueText(idx, newText) {
    setActiveCaptionTrack(prev => prev.map((s, i) => i === idx ? { ...s, text: newText } : s))
  }
  function deleteCue(idx) {
    setActiveCaptionTrack(prev => prev.filter((_, i) => i !== idx))
    if (activeCueIdx === idx) setActiveCueIdx(-1)
    if (editingCueIdx === idx) setEditingCueIdx(-1)
  }
  function addCueAtCurrentTime() {
    const t = currentTime
    const newCue = { start: t, end: Math.min(t + 2, state?.duration || t + 2), text: 'New caption' }
    setActiveCaptionTrack(prev => {
      const next = [...prev, newCue].sort((a, b) => a.start - b.start)
      return next
    })
  }
  function seekToCue(idx) {
    const s = activeCaptionTrack[idx]
    if (s && videoRef.current) {
      videoRef.current.currentTime = s.start + 0.01
    }
  }
  async function saveTranscript() {
    try {
      const r = await fetch(`/api/clips/${clip.id}/transcript`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segments: activeCaptionTrack }),
      })
      if (!r.ok) throw new Error('Save failed')
      toast.success('Captions saved')
    } catch (e) { toast.error('Save failed', { description: e.message }) }
  }

  const previewBg = clip.thumbnail_url || ''
  const previewAspect = ASPECTS.find(a => a.value === state.crop_aspect) || ASPECTS[0]

  // Cache-bust the video URL on render so the new MP4 loads
  const videoSrc = clip.storage_url_mp4 ? `${clip.storage_url_mp4}?v=${clip.render_version || 0}` : null

  // Logo drag handlers (refs are declared up top above the early return)
  const onLogoPointerDown = (e) => {
    e.preventDefault()
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onLogoPointerMove = (e) => {
    if (!draggingRef.current) return
    const box = previewBoxRef.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.max(0, Math.min(100, ((e.clientX - box.left) / box.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - box.top) / box.height) * 100))
    patch({ logo_x_percent: x, logo_y_percent: y, logo_position: 'custom' })
  }
  const onLogoPointerUp = (e) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Caption drag handlers — move the caption block anywhere on the canvas.
  const onCapPointerDown = (e) => {
    if (editingCueIdx >= 0) return
    e.preventDefault()
    e.stopPropagation()
    captionDraggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onCapPointerMove = (e) => {
    if (!captionDraggingRef.current) return
    const box = previewBoxRef.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.max(5, Math.min(95, ((e.clientX - box.left) / box.width) * 100))
    const y = Math.max(5, Math.min(95, ((e.clientY - box.top) / box.height) * 100))
    patch({ caption_x_percent: x, caption_y_percent: y, caption_position_percent: y })
  }
  const onCapPointerUp = (e) => {
    captionDraggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Caption RESIZE handlers — drag any corner dot to scale font_size proportionally.
  const onResizePointerDown = (e, corner) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startFontSize: state.font_size, corner }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onResizePointerMove = (e) => {
    if (!resizeRef.current) return
    e.stopPropagation()
    const dx = e.clientX - resizeRef.current.startX
    const dy = e.clientY - resizeRef.current.startY
    // Use diagonal distance — outward = bigger
    const corner = resizeRef.current.corner
    const sign = (corner === 'br' || corner === 'tr') ? 1 : -1
    const delta = sign * (Math.abs(dx) > Math.abs(dy) ? dx : (corner.startsWith('t') ? -dy : dy))
    const next = Math.max(10, Math.min(60, Math.round(resizeRef.current.startFontSize + delta / 6)))
    patch({ font_size: next })
  }
  const onResizePointerUp = (e) => {
    resizeRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

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
            <div
              ref={previewBoxRef}
              className={`relative w-full max-h-[60vh] overflow-hidden rounded-lg border border-zinc-800 select-none`}
              style={{
                aspectRatio: state.crop_aspect.replace(':','/'),
                background: state.fill_mode === 'color' ? state.fill_color : '#000000',
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* BLUR FILL UNDERLAY — duplicate of the video, scaled to cover, heavily blurred.
                  Shown only when fill_mode is 'blur' AND we have a real video source. */}
              {videoSrc && state.fill_mode === 'blur' && (
                <video
                  src={videoSrc}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ filter: 'blur(20px) brightness(0.85)', transform: 'scale(1.15)' }}
                  muted
                  playsInline
                  preload="metadata"
                  ref={(el) => {
                    if (!el || !videoRef.current) return
                    // Mirror playback of the main video so blur backdrop stays in sync
                    const main = videoRef.current
                    const sync = () => { try { el.currentTime = main.currentTime; if (!main.paused) el.play().catch(()=>{}); else el.pause() } catch {} }
                    main.addEventListener('seeked', sync)
                    main.addEventListener('play', sync)
                    main.addEventListener('pause', sync)
                    sync()
                  }}
                />
              )}
              {videoSrc ? (
                <video
                  ref={videoRef}
                  key={videoSrc}
                  src={videoSrc}
                  className={`absolute inset-0 w-full h-full ${state.fill_mode === 'crop' ? 'object-cover' : 'object-contain'}`}
                  controls
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  preload="metadata"
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewBg} alt="" className={`absolute inset-0 w-full h-full ${state.fill_mode === 'crop' ? 'object-cover' : 'object-contain'}`} />
              )}
              {/* Speed indicator */}
              {Math.abs(state.speed - 1) > 0.01 && (
                <Badge className="absolute top-2 left-2 bg-amber-500 text-black font-bold z-10">{state.speed.toFixed(2)}×</Badge>
              )}
              {/* Title overlay live preview */}
              {state.title_text && (
                <div className={`absolute left-1/2 -translate-x-1/2 ${state.title_position === 'bottom' ? 'bottom-4' : 'top-4'} px-3 py-1.5 bg-black/70 text-white text-xs font-bold tracking-wide rounded z-10`}>
                  {state.title_text}
                </div>
              )}
              {/* INTERACTIVE ACTIVE CAPTION OVERLAY — bounding box with corner handles */}
              {(() => {
                const activeCue = activeCueIdx >= 0 ? activeCaptionTrack[activeCueIdx] : null
                const displayCue = activeCue || (activeCaptionTrack[0] ? { ...activeCaptionTrack[0], _ghost: true } : { text: 'Sample caption preview', _ghost: true, _idx: -1 })
                const displayText = chunkForLine(displayCue.text || '', 4)
                const cssStyle = styleAssToCss({
                  styleAss: state.style_ass,
                  fontSize: state.font_size,
                  outlineSize: state.outline_size,
                  previewBoxHeight: previewRect.height,
                })
                const isEditing = editingCueIdx === activeCueIdx && activeCueIdx >= 0
                const selected = !!activeCue && !displayCue._ghost
                return (
                  <div
                    className={`absolute pointer-events-auto text-center z-20 ${isEditing ? '' : selected ? 'cursor-move' : ''}`}
                    style={{
                      left: `${state.caption_x_percent}%`,
                      top: `${state.caption_y_percent}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '80%',
                      touchAction: 'none',
                    }}
                    onPointerDown={onCapPointerDown}
                    onPointerMove={onCapPointerMove}
                    onPointerUp={onCapPointerUp}
                    onPointerCancel={onCapPointerUp}
                    title={activeCue ? 'Drag to reposition · double-click to edit text' : 'Generate captions to see them here'}
                  >
                    {/* SELECTION BOUNDING BOX (visible only when a real cue is active) */}
                    {selected && !isEditing && (
                      <>
                        <div className="absolute -inset-3 border border-white/80 pointer-events-none rounded-sm" />
                        {/* Corner handles */}
                        {['tl','tr','bl','br'].map((pos) => (
                          <div
                            key={pos}
                            className={`absolute h-3 w-3 rounded-full bg-white border-2 border-black shadow ${pos === 'tl' ? '-left-4 -top-4' : pos === 'tr' ? '-right-4 -top-4' : pos === 'bl' ? '-left-4 -bottom-4' : '-right-4 -bottom-4'}`}
                            style={{ cursor: pos === 'tl' || pos === 'br' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none' }}
                            onPointerDown={(e) => onResizePointerDown(e, pos)}
                            onPointerMove={onResizePointerMove}
                            onPointerUp={onResizePointerUp}
                          />
                        ))}
                        {/* Delete × button at top-left */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCue(activeCueIdx) }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute -top-7 -left-6 h-5 w-5 rounded-full bg-white text-black text-[11px] font-bold flex items-center justify-center shadow hover:bg-red-500 hover:text-white"
                          title="Delete this cue"
                        >×</button>
                      </>
                    )}

                    {isEditing ? (
                      <textarea
                        ref={inlineEditRef}
                        defaultValue={activeCue?.text || ''}
                        autoFocus
                        rows={2}
                        className="w-full bg-black/80 text-white text-center rounded outline-none border-2 border-primary px-2 py-1 resize-none"
                        style={{ fontSize: cssStyle.fontSize, fontFamily: cssStyle.fontFamily, fontWeight: cssStyle.fontWeight }}
                        onBlur={(e) => { updateCueText(activeCueIdx, e.target.value); setEditingCueIdx(-1) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur() } }}
                      />
                    ) : (
                      <span
                        className={`whitespace-pre-line transition-opacity inline-block ${displayCue._ghost ? 'opacity-40' : 'opacity-100'}`}
                        style={cssStyle}
                        onDoubleClick={(e) => { e.stopPropagation(); if (activeCue) setEditingCueIdx(activeCueIdx) }}
                      >
                        {displayText}
                      </span>
                    )}
                  </div>
                )
              })()}
              {/* Logo overlay — draggable. The frame logo position is the CENTER of the logo. */}
              {state.logo_url && (
                <div
                  className="absolute cursor-move ring-2 ring-primary/70 hover:ring-primary transition-shadow"
                  style={{
                    left: `${state.logo_x_percent}%`,
                    top: `${state.logo_y_percent}%`,
                    width: `${state.logo_scale_percent}%`,
                    transform: 'translate(-50%, -50%)',
                    touchAction: 'none',
                  }}
                  onPointerDown={onLogoPointerDown}
                  onPointerMove={onLogoPointerMove}
                  onPointerUp={onLogoPointerUp}
                  onPointerCancel={onLogoPointerUp}
                  title="Drag to position"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.logo_url} alt="logo" className="w-full h-auto object-contain pointer-events-none drop-shadow-md" draggable={false} />
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 text-center">
              Preview · {state.logo_url ? 'drag logo to reposition · ' : ''}playback speed {state.speed.toFixed(2)}×
            </div>
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
              <TabsContent value="presets" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-4">
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

                {/* Caption Animation Style — drives the ASS event generator on export */}
                <div className="space-y-2">
                  <Label className="text-sm">Caption Animation</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'static',      label: 'Static',    hint: 'Plain lines, no animation' },
                      { id: 'karaoke',     label: 'Karaoke',   hint: 'Active word highlight' },
                      { id: 'word_bounce', label: 'Word Bounce', hint: 'Pulse + highlight' },
                    ].map(opt => {
                      const active = (state.animation_style || 'karaoke') === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => patch({ animation_style: opt.id })}
                          title={opt.hint}
                          className={`rounded-md border p-2.5 text-xs text-center transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="mt-0.5 text-[10px] opacity-70">{opt.hint}</div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Animated styles require word-level transcript timings (auto-generated by Whisper on ingestion).
                  </div>
                </div>
              </TabsContent>

              {/* CC — fine-tune captions + edit transcript */}
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
                    <Label>Caption position (from top)</Label>
                    <span className="text-muted-foreground">{state.caption_position_percent}%</span>
                  </div>
                  <Slider min={5} max={95} step={1} value={[state.caption_position_percent]} onValueChange={([v]) => patch({ caption_position_percent: v })} />
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[{l:'Top', v:20},{l:'Middle', v:50},{l:'Bottom', v:80}].map(p => (
                      <Button key={p.l} size="sm" variant={Math.abs(state.caption_position_percent - p.v) < 5 ? 'default' : 'outline'} onClick={() => patch({ caption_position_percent: p.v })}>{p.l}</Button>
                    ))}
                  </div>
                </div>

                {/* TRANSCRIPT EDITOR — list of cues, click to seek, double-click / inline edit */}
                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" /> Transcript ({activeCaptionTrack.length} cues)</Label>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={addCueAtCurrentTime} title="Add a cue at the current playback time">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={saveTranscript} title="Save edits without re-rendering">
                        <SaveIcon className="h-3.5 w-3.5 mr-1" /> Save
                      </Button>
                    </div>
                  </div>
                  {transcriptLoading ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> loading…</div>
                  ) : activeCaptionTrack.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">No captions yet — ingestion didn't produce a transcript for this clip.</div>
                  ) : (
                    <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                      {activeCaptionTrack.map((cue, i) => {
                        const active = i === activeCueIdx
                        return (
                          <div key={i} className={`group flex items-center gap-2 px-2 py-1.5 rounded text-xs border transition-colors cursor-pointer ${active ? 'border-primary bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted/40'}`}>
                            <button onClick={() => seekToCue(i)} className="font-mono text-[10px] text-muted-foreground tabular-nums w-12 text-left hover:text-foreground">
                              {Math.floor(cue.start / 60)}:{String(Math.floor(cue.start % 60)).padStart(2, '0')}
                            </button>
                            <input
                              value={cue.text}
                              onChange={(e) => updateCueText(i, e.target.value)}
                              onFocus={() => seekToCue(i)}
                              className="flex-1 bg-transparent outline-none border-0 focus:bg-card focus:ring-1 focus:ring-primary rounded px-1 py-0.5"
                            />
                            <button onClick={() => deleteCue(i)} className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">{'💡 Captions auto-wrap to max 4 words/line · click any row to seek · edit text inline · double-click the caption on the preview to edit there'}</div>
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

              {/* Crop + Fill Mode */}
              <TabsContent value="crop" className="p-4 overflow-y-auto max-h-[55vh] mt-0 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Aspect ratio</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {ASPECTS.map(a => (
                      <button key={a.value} onClick={() => patch({ crop_aspect: a.value })}
                        className={`relative rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-colors ${state.crop_aspect === a.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className={`${a.tw} w-14 bg-muted-foreground/30 rounded`} />
                        <div className="text-xs font-medium">{a.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Label className="text-sm font-medium mb-2 block">Background fill (for non-matching source ratios)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'crop',  label: 'Crop',  hint: 'Cut sides' },
                      { id: 'blur',  label: 'Blur',  hint: 'Reels-style' },
                      { id: 'color', label: 'Color', hint: 'Solid bars' },
                    ].map(m => (
                      <button key={m.id} onClick={() => patch({ fill_mode: m.id })}
                        className={`relative rounded-lg border-2 p-3 flex flex-col items-center gap-1 transition-colors ${state.fill_mode === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="text-xs font-bold">{m.label}</div>
                        <div className="text-[10px] text-muted-foreground">{m.hint}</div>
                      </button>
                    ))}
                  </div>
                  {state.fill_mode === 'color' && (
                    <div className="mt-3 flex items-center gap-3">
                      <Label className="text-xs">Bar color</Label>
                      <input type="color" value={state.fill_color} onChange={(e) => patch({ fill_color: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
                      <Input value={state.fill_color} onChange={(e) => patch({ fill_color: e.target.value })} className="font-mono text-xs h-9 w-28" />
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-3">
                    {state.fill_mode === 'crop' && '🔪 Center-crops the source. Best when the action is in the middle.'}
                    {state.fill_mode === 'blur' && '🌫 Original video centered with a blurred copy filling the bars — Instagram Reels look.'}
                    {state.fill_mode === 'color' && '⬛ Solid color bars top/bottom. Pick your brand color above.'}
                  </div>
                </div>
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
                    <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                      ✋ <span className="font-medium">Drag the logo on the preview</span> to position it. Current: <span className="font-mono">{Math.round(state.logo_x_percent)}%, {Math.round(state.logo_y_percent)}%</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Logo size</Label>
                        <span className="text-muted-foreground">{Math.round(state.logo_scale_percent)}% of width</span>
                      </div>
                      <Slider min={5} max={40} step={1} value={[state.logo_scale_percent]} onValueChange={([v]) => patch({ logo_scale_percent: v })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Quick presets</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {LOGO_POSITIONS.map(p => (
                          <Button key={p.id} size="sm" variant="outline" onClick={() => {
                            const x = p.id.endsWith('right') ? 90 : 10
                            const y = p.id.startsWith('bottom') ? 90 : 10
                            patch({ logo_x_percent: x, logo_y_percent: y, logo_position: p.id })
                          }}>{p.label}</Button>
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
