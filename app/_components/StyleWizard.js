'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Languages, Volume2, ChevronDown, Check, Play, Maximize, Sliders, Scissors } from 'lucide-react'

// ============================================================================
// STYLE PRESETS — each maps to a CSS preview style and a backend ASS spec
// ============================================================================
export const STYLE_PRESETS = [
  {
    id: 'neon_pop',
    name: 'Neon Pop',
    sample: 'BIG IDEA',
    css: {
      fontFamily: 'Montserrat, system-ui, sans-serif', fontWeight: 900, fontSize: 22,
      color: '#ffffff', background: '#ec4899',
      padding: '4px 10px', borderRadius: 6,
      textShadow: '0 0 12px #ec4899, 0 0 4px #fff',
      letterSpacing: 0.5,
      animation: 'neonpop 1.4s ease-in-out infinite',
    },
    ass: { fontName: 'Montserrat', fontSize: 22, primary: '&H00FFFFFF&', back: '&H00C26895&', borderStyle: 3, outline: 0, shadow: 0, bold: 1 },
  },
  {
    id: 'the_beast',
    name: 'The Beast',
    sample: 'BIG IDEA',
    css: {
      fontFamily: 'Impact, Haettenschweiler, sans-serif', fontWeight: 900, fontSize: 22,
      color: '#facc15', textTransform: 'uppercase',
      filter: 'drop-shadow(0 3px 0 #000) drop-shadow(0 0 6px rgba(250,204,21,.6))',
      letterSpacing: 1,
      animation: 'beastbounce 0.6s ease-in-out infinite alternate',
    },
    ass: { fontName: 'Impact', fontSize: 24, primary: '&H0015CCFA&', outline: 2, outlineColour: '&H00000000&', borderStyle: 1, shadow: 1, bold: 1 },
  },
  {
    id: 'minimal_kinetic',
    name: 'Minimal Kinetic',
    sample: 'Big idea',
    css: {
      fontFamily: '"Inter", system-ui, sans-serif', fontWeight: 700, fontSize: 20,
      color: '#ffffff', borderBottom: '2px solid rgba(255,255,255,.25)',
      paddingBottom: 2, letterSpacing: -0.2,
      animation: 'minimalfade 1.2s ease-in-out infinite',
    },
    ass: { fontName: 'Inter', fontSize: 20, primary: '&H00FFFFFF&', outline: 0, borderStyle: 1, shadow: 0, bold: 1 },
  },
  {
    id: 'meme_classic',
    name: 'Meme Classic',
    sample: 'BIG IDEA!',
    css: {
      fontFamily: 'Impact, sans-serif', fontWeight: 700, fontSize: 22,
      color: '#ffffff', WebkitTextStroke: '2px #000',
      textTransform: 'uppercase', letterSpacing: 0.5,
      animation: 'memejitter 0.4s ease-in-out infinite',
    },
    ass: { fontName: 'Impact', fontSize: 22, primary: '&H00FFFFFF&', outline: 3, outlineColour: '&H00000000&', borderStyle: 1, shadow: 0, bold: 1 },
  },
  // Extra variants to fill out the 3x4 grid look from the reference
  { id: 'pink_underline', name: 'Pink Pop', sample: 'Big idea', css: { fontFamily: 'Pacifico, cursive', fontSize: 22, color: '#ec4899', fontWeight: 700, animation: 'minimalfade 1.5s ease-in-out infinite' }, ass: { fontName: 'Pacifico', fontSize: 22, primary: '&H00CC4D9F&', borderStyle: 1, outline: 1, shadow: 0, bold: 1 } },
  { id: 'cyber_cyan', name: 'Cyber Cyan', sample: 'BIG IDEA', css: { fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 22, color: '#06b6d4', textShadow: '0 0 10px #06b6d4', textTransform: 'uppercase' }, ass: { fontName: 'Oswald', fontSize: 22, primary: '&H00D4B606&', borderStyle: 1, outline: 1, shadow: 1, bold: 1 } },
  { id: 'red_chip', name: 'Red Chip', sample: 'IDEA', css: { fontFamily: 'Bebas Neue, sans-serif', fontWeight: 700, fontSize: 22, color: '#ffffff', background: '#ef4444', padding: '4px 10px', borderRadius: 4 }, ass: { fontName: 'Bebas Neue', fontSize: 22, primary: '&H00FFFFFF&', back: '&H004444EF&', borderStyle: 3, outline: 0, shadow: 0, bold: 1 } },
  { id: 'gold_script', name: 'Gold Script', sample: 'Big idea', css: { fontFamily: '"Permanent Marker", cursive', fontSize: 22, color: '#facc15', fontStyle: 'italic', textShadow: '1px 1px 0 #92400e' }, ass: { fontName: 'Permanent Marker', fontSize: 22, primary: '&H0015CCFA&', outline: 1, shadow: 1, bold: 1 } },
  { id: 'mono_white', name: 'Mono White', sample: 'Big idea', css: { fontFamily: 'monospace', fontWeight: 700, fontSize: 20, color: '#ffffff' }, ass: { fontName: 'Courier New', fontSize: 20, primary: '&H00FFFFFF&', outline: 1, shadow: 0, bold: 1 } },
  { id: 'lime_blast', name: 'Lime Blast', sample: 'Big idea', css: { fontFamily: 'Anton, sans-serif', fontWeight: 700, fontSize: 22, color: '#84cc16', textShadow: '0 0 6px #84cc16' }, ass: { fontName: 'Anton', fontSize: 22, primary: '&H0016CC84&', outline: 2, shadow: 1, bold: 1 } },
  { id: 'orange_chip', name: 'Orange Chip', sample: 'BIG IDEA', css: { fontFamily: 'Impact, sans-serif', fontSize: 22, color: '#ffffff', background: '#f97316', padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase' }, ass: { fontName: 'Impact', fontSize: 22, primary: '&H00FFFFFF&', back: '&H001673F9&', borderStyle: 3, outline: 0, shadow: 0, bold: 1 } },
]

// ============================================================================
// LANGUAGE OPTIONS for Step 1
// ============================================================================
const SPOKEN_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect', native: true },
  { code: 'en', name: 'English', native: true },
  { code: 'hi', name: 'Hindi', native: true },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
]

// Default overlay positions (% from top of 9:16 canvas)
const DEFAULT_OVERLAYS = {
  caption: { enabled: true, position: 78, label: 'Caption', sub: 'Word-by-word subtitles', text: "IT'S AN INTERESTING" },
  hook:    { enabled: true, position: 8,  label: 'Hook',    sub: 'Opening line that grabs attention', text: "MRBEAST'S FIRST VIDEO" },
  title:   { enabled: true, position: 28, label: 'Title',   sub: 'Headline for the clip', text: 'BEFORE FAME' },
  description: { enabled: false, position: 92, label: 'Description', sub: 'Supporting line', text: 'Tap to learn more' },
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function StyleWizard({ open, onClose, onComplete, payload, initialConfig = null, mode = 'create' }) {
  // payload: { type: 'url' | 'file', url?: string, file?: File, title?: string, thumbnail?: string, fileBlobUrl?: string, duration?: number }
  // mode: 'create' | 'restyle'  — restyle mode jumps to step 2 and disables source preview
  const [step, setStep] = useState(mode === 'restyle' ? 2 : 1)
  const [language, setLanguage] = useState(initialConfig?.language || 'auto')
  const [stylePreset, setStylePreset] = useState(initialConfig?.style_preset || 'the_beast')
  const [overlays, setOverlays] = useState(() => {
    if (initialConfig?.overlays_config) {
      const oc = initialConfig.overlays_config
      return {
        caption:    { ...DEFAULT_OVERLAYS.caption,    enabled: oc.caption?.enabled !== false,    position: oc.caption?.position_percent ?? DEFAULT_OVERLAYS.caption.position },
        hook:       { ...DEFAULT_OVERLAYS.hook,       enabled: oc.hook?.enabled !== false,       position: oc.hook?.position_percent ?? DEFAULT_OVERLAYS.hook.position },
        title:      { ...DEFAULT_OVERLAYS.title,      enabled: oc.title?.enabled !== false,      position: oc.title?.position_percent ?? DEFAULT_OVERLAYS.title.position },
        description:{ ...DEFAULT_OVERLAYS.description,enabled: oc.description?.enabled !== false,position: oc.description?.position_percent ?? DEFAULT_OVERLAYS.description.position },
      }
    }
    return DEFAULT_OVERLAYS
  })
  const [trimRange, setTrimRange] = useState([initialConfig?.trim_start_seconds || 0, initialConfig?.trim_end_seconds || Math.min(60, payload?.duration || 60)])
  const [fontSize, setFontSize] = useState(initialConfig?.font_size || 22)
  const [outlineSize, setOutlineSize] = useState(initialConfig?.outline_size ?? 2)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setStep(mode === 'restyle' ? 2 : 1); setBusy(false) } }, [open, mode])

  const enabledCount = useMemo(() => Object.values(overlays).filter(o => o.enabled).length, [overlays])
  const selectedPreset = STYLE_PRESETS.find(p => p.id === stylePreset) || STYLE_PRESETS[1]

  function next() { setStep(s => Math.min(3, s + 1)) }
  function back() { if (step === 1) onClose?.(); else setStep(s => s - 1) }

  function finish() {
    setBusy(true)
    onComplete?.({
      language,
      style_preset: stylePreset,
      style_ass: { ...selectedPreset.ass, fontSize, outline: outlineSize },
      font_size: fontSize,
      outline_size: outlineSize,
      trim_start_seconds: trimRange[0],
      trim_end_seconds: trimRange[1],
      overlays_config: {
        caption:    { enabled: overlays.caption.enabled,    position_percent: overlays.caption.position },
        hook:       { enabled: overlays.hook.enabled,       position_percent: overlays.hook.position },
        title:      { enabled: overlays.title.enabled,      position_percent: overlays.title.position },
        description:{ enabled: overlays.description.enabled,position_percent: overlays.description.position },
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.() }}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border">
        {/* Wizard-scoped keyframes for live preview */}
        <style>{`
          @keyframes neonpop { 0%,100%{ text-shadow: 0 0 6px #ec4899; transform: scale(1) } 50% { text-shadow: 0 0 16px #ec4899, 0 0 24px #ec4899; transform: scale(1.04) } }
          @keyframes beastbounce { 0%{ transform: translateY(0) } 100% { transform: translateY(-3px) } }
          @keyframes minimalfade { 0%,100% { opacity: 1 } 50% { opacity: .8 } }
          @keyframes memejitter { 0% { transform: rotate(-1.5deg) } 50% { transform: rotate(1.5deg) } 100% { transform: rotate(-1.5deg) } }
          .wizard-step-btn { transition: transform .12s ease; }
          .wizard-step-btn:active { transform: scale(.97); }
        `}</style>

        {step === 1 && <Step1 payload={payload} language={language} setLanguage={setLanguage} trimRange={trimRange} setTrimRange={setTrimRange} onBack={back} onContinue={next} />}
        {step === 2 && <Step2 payload={payload} stylePreset={stylePreset} setStylePreset={setStylePreset} overlays={overlays} setOverlays={setOverlays} fontSize={fontSize} setFontSize={setFontSize} outlineSize={outlineSize} setOutlineSize={setOutlineSize} onBack={back} onContinue={next} mode={mode} />}
        {step === 3 && <Step3 payload={payload} stylePreset={stylePreset} overlays={overlays} setOverlays={setOverlays} fontSize={fontSize} setFontSize={setFontSize} outlineSize={outlineSize} setOutlineSize={setOutlineSize} onBack={back} onFinish={finish} busy={busy} mode={mode} />}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// STEP 1 — Ingestion confirmation & language
// ============================================================================
function Step1({ payload, language, setLanguage, trimRange, setTrimRange, onBack, onContinue }) {
  const selected = SPOKEN_LANGUAGES.find(l => l.code === language) || SPOKEN_LANGUAGES[0]
  const duration = payload?.duration || 600 // assume up to 10 min if unknown
  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`
  return (
    <div className="p-6 space-y-5">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Step 1 / 3</div>
        <h2 className="text-xl font-bold">Confirm video, language & trim range</h2>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-video max-w-2xl mx-auto">
        <SourcePreview payload={payload} />
      </div>

      {/* Trim slider — visual start/end picker */}
      <div className="max-w-2xl mx-auto space-y-2 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between text-sm">
          <Label className="flex items-center gap-1.5 font-semibold"><Scissors className="h-3.5 w-3.5 text-primary"/> Trim range (the AI will pick clips inside this window)</Label>
          <span className="font-mono text-xs text-muted-foreground">{fmt(trimRange[0])} → {fmt(trimRange[1])}  ({trimRange[1]-trimRange[0]}s)</span>
        </div>
        <Slider min={0} max={duration} step={1} value={trimRange} onValueChange={setTrimRange} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0:00</span>
          <span>{fmt(duration)}</span>
        </div>
        <div className="flex gap-2 pt-1">
          {[ [0, 60, '1 min'], [0, 180, '3 min'], [0, 600, '10 min'], [0, duration, 'Full'] ].map(([a,b,label]) => (
            <button key={label} type="button" onClick={() => setTrimRange([a, Math.min(b, duration)])} className="wizard-step-btn text-[11px] px-3 py-1 rounded-full bg-background border border-border hover:border-primary/50">
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Languages className="h-4 w-4" /> {selected.name} <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
              <Volume2 className="h-3 w-3" /> = native audio
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SPOKEN_LANGUAGES.map(l => (
              <DropdownMenuItem key={l.code} onClick={() => setLanguage(l.code)} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {language === l.code && <Check className="h-3.5 w-3.5 text-primary" />}
                  {language !== l.code && <span className="w-3.5" />}
                  {l.name}
                </span>
                {l.native && <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="wizard-step-btn px-8">Back</Button>
        <Button onClick={onContinue} className="wizard-step-btn px-8 bg-foreground text-background hover:bg-foreground/90">Continue</Button>
      </div>
    </div>
  )
}

function SourcePreview({ payload }) {
  if (!payload) return <div className="aspect-video flex items-center justify-center text-muted-foreground text-sm">No source selected</div>
  if (payload.type === 'url' && payload.url) {
    const m = String(payload.url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
    if (m) {
      return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${m[1]}`} title="YouTube preview" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    }
    return (
      <div className="aspect-video flex flex-col items-center justify-center text-white gap-2 p-6 text-center">
        {payload.thumbnail && <img src={payload.thumbnail} alt="thumb" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
        <div className="relative z-10 text-sm font-medium">{payload.title || payload.url}</div>
      </div>
    )
  }
  if (payload.fileBlobUrl) {
    return <video className="w-full h-full bg-black" src={payload.fileBlobUrl} controls controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} />
  }
  return <div className="aspect-video flex items-center justify-center text-muted-foreground text-sm">{payload.title || 'Source'}</div>
}

// ============================================================================
// STEP 2 — Pick a Style
// ============================================================================
function Step2({ payload, stylePreset, setStylePreset, overlays, setOverlays, fontSize, setFontSize, outlineSize, setOutlineSize, onBack, onContinue, mode }) {
  const enabledCount = Object.values(overlays).filter(o => o.enabled).length
  return (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">Pick a style</span>
          <span className="text-muted-foreground text-xs">Sample preview.</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">You can fine-tune each clip later as well.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <PortraitPreview payload={payload} stylePreset={stylePreset} overlays={overlays} fontSize={fontSize} outlineSize={outlineSize} />

        <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
          <Tabs defaultValue="style" className="flex-1 flex flex-col">
            <TabsList className="bg-transparent gap-6 justify-start border-b border-border rounded-none pb-2 h-auto">
              <TabsTrigger value="style" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-2 font-semibold text-base">Pick a Style</TabsTrigger>
              <TabsTrigger value="overlays" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-2 text-muted-foreground gap-2">
                Text Overlays <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center">{enabledCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="style" className="mt-4 flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {STYLE_PRESETS.map(p => {
                  const active = stylePreset === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setStylePreset(p.id)}
                      className={`wizard-step-btn relative aspect-square rounded-xl bg-black border-2 flex items-center justify-center p-2 hover:border-primary/50 ${active ? 'border-foreground' : 'border-transparent'}`}
                      title={p.name}
                    >
                      <span style={p.css}>{p.sample}</span>
                      {active && <Check className="absolute top-1 right-1 h-4 w-4 text-foreground bg-background rounded-full p-0.5" />}
                    </button>
                  )
                })}
              </div>

              {/* Customize: font size + stroke */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-muted-foreground">Font size</Label>
                    <span className="font-mono">{fontSize}px</span>
                  </div>
                  <Slider min={12} max={48} step={1} value={[fontSize]} onValueChange={v => setFontSize(v[0])} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <Label className="text-muted-foreground">Stroke / outline</Label>
                    <span className="font-mono">{outlineSize}px</span>
                  </div>
                  <Slider min={0} max={8} step={1} value={[outlineSize]} onValueChange={v => setOutlineSize(v[0])} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="overlays" className="mt-4">
              <OverlayPanel overlays={overlays} setOverlays={setOverlays} fontSize={fontSize} setFontSize={setFontSize} outlineSize={outlineSize} setOutlineSize={setOutlineSize} />
            </TabsContent>
          </Tabs>

          <Button onClick={onContinue} className="mt-4 wizard-step-btn w-full bg-foreground text-background hover:bg-foreground/90">Continue</Button>
          <button onClick={onBack} className="text-xs text-muted-foreground mt-2 hover:text-foreground">Don&apos;t show this again</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// STEP 3 — Text overlays positioning
// ============================================================================
function Step3({ payload, stylePreset, overlays, setOverlays, fontSize, setFontSize, outlineSize, setOutlineSize, onBack, onFinish, busy, mode }) {
  const enabledCount = Object.values(overlays).filter(o => o.enabled).length
  return (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">Pick a style</span>
          <span className="text-muted-foreground text-xs">Sample preview.</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">You can fine-tune each clip later as well.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <PortraitPreview payload={payload} stylePreset={stylePreset} overlays={overlays} fontSize={fontSize} outlineSize={outlineSize} />

        <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
          <Tabs defaultValue="overlays" className="flex-1 flex flex-col">
            <TabsList className="bg-transparent gap-6 justify-start border-b border-border rounded-none pb-2 h-auto">
              <TabsTrigger value="style" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-2 text-muted-foreground">Pick a Style</TabsTrigger>
              <TabsTrigger value="overlays" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground rounded-none px-0 pb-2 font-semibold text-base gap-2">
                Text Overlays <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center">{enabledCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="style" className="mt-4">
              <div className="text-sm text-muted-foreground p-3">Tap the <strong>Pick a Style</strong> tab to change preset.</div>
            </TabsContent>

            <TabsContent value="overlays" className="mt-4">
              <OverlayPanel overlays={overlays} setOverlays={setOverlays} fontSize={fontSize} setFontSize={setFontSize} outlineSize={outlineSize} setOutlineSize={setOutlineSize} />
            </TabsContent>
          </Tabs>

          <Button disabled={busy} onClick={onFinish} className="mt-4 wizard-step-btn w-full bg-foreground text-background hover:bg-foreground/90">
            {busy ? 'Starting…' : (mode === 'restyle' ? 'Apply New Style' : 'Continue')}
          </Button>
          <button onClick={onBack} className="text-xs text-muted-foreground mt-2 hover:text-foreground">Don&apos;t show this again</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers — Portrait 9:16 preview
// ============================================================================
function PortraitPreview({ payload, stylePreset, overlays, fontSize, outlineSize }) {
  const preset = STYLE_PRESETS.find(p => p.id === stylePreset) || STYLE_PRESETS[1]
  // Compose live CSS — override fontSize + outline (text-shadow approximation of stroke)
  const liveCss = useMemo(() => {
    const base = { ...preset.css }
    if (fontSize) base.fontSize = `${fontSize}px`
    if (outlineSize > 0) {
      const stroke = []
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) stroke.push(`${dx * outlineSize}px ${dy * outlineSize}px 0 #000`)
      base.textShadow = stroke.join(', ')
    }
    return base
  }, [preset, fontSize, outlineSize])

  return (
    <div className="flex items-start justify-center">
      <div className="relative w-[260px] aspect-[9/16] rounded-[28px] overflow-hidden border-[6px] border-zinc-900 shadow-2xl bg-black">
        <SourcePortrait payload={payload} />

        {overlays.hook.enabled && (
          <div className="absolute left-0 right-0 flex justify-center px-2 pointer-events-none" style={{ top: `${overlays.hook.position}%` }}>
            <span style={liveCss} className="text-center">{overlays.hook.text}</span>
          </div>
        )}
        {overlays.title.enabled && (
          <div className="absolute left-0 right-0 flex justify-center px-2 pointer-events-none" style={{ top: `${overlays.title.position}%` }}>
            <span style={{ ...liveCss, fontSize: `${Math.max(12, (fontSize || 22) - 4)}px`, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{overlays.title.text}</span>
          </div>
        )}
        {overlays.caption.enabled && (
          <div className="absolute left-0 right-0 flex justify-center px-2 pointer-events-none" style={{ top: `${overlays.caption.position}%` }}>
            <span style={liveCss} className="text-center">{overlays.caption.text}</span>
          </div>
        )}
        {overlays.description.enabled && (
          <div className="absolute left-0 right-0 flex justify-center px-2 pointer-events-none" style={{ top: `${overlays.description.position}%` }}>
            <span style={{ ...liveCss, fontSize: `${Math.max(10, (fontSize || 22) - 8)}px`, opacity: .85 }}>{overlays.description.text}</span>
          </div>
        )}

        <div className="absolute left-0 right-0 bottom-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/80 to-transparent text-white flex items-center gap-2 text-[10px]">
          <Play className="h-4 w-4 fill-white" />
          <Volume2 className="h-3.5 w-3.5" />
          <span className="tabular-nums">0:03 / 0:22</span>
          <div className="flex-1" />
          <Maximize className="h-3.5 w-3.5" />
        </div>
        <div className="absolute left-2 right-2 bottom-1 h-0.5 rounded-full bg-white/20">
          <div className="h-full bg-white/90 rounded-full" style={{ width: '14%' }} />
        </div>
      </div>
    </div>
  )
}

function SourcePortrait({ payload }) {
  if (payload?.thumbnail) {
    return <img src={payload.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
  }
  if (payload?.fileBlobUrl) {
    return <video className="absolute inset-0 w-full h-full object-cover" src={payload.fileBlobUrl} muted playsInline autoPlay loop />
  }
  if (payload?.url) {
    const m = String(payload.url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
    if (m) return <img src={`https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" />
  }
  return <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900" />
}

// ============================================================================
// Overlay control panel (shared between step 2 tabs and step 3)
// ============================================================================
function OverlayPanel({ overlays, setOverlays, fontSize, setFontSize, outlineSize, setOutlineSize }) {
  function update(key, patch) { setOverlays(s => ({ ...s, [key]: { ...s[key], ...patch } })) }
  const rows = ['caption', 'hook', 'title', 'description']
  const positions = [
    { label: 'Top', value: 8 },
    { label: 'Middle', value: 50 },
    { label: 'Bottom', value: 88 },
  ]
  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {(typeof setFontSize === 'function' || typeof setOutlineSize === 'function') && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Typography</div>
          {typeof setFontSize === 'function' && (
            <div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Font size</span><span className="font-mono">{fontSize}px</span></div>
              <Slider min={12} max={48} step={1} value={[fontSize]} onValueChange={v => setFontSize(v[0])} />
            </div>
          )}
          {typeof setOutlineSize === 'function' && (
            <div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Stroke</span><span className="font-mono">{outlineSize}px</span></div>
              <Slider min={0} max={8} step={1} value={[outlineSize]} onValueChange={v => setOutlineSize(v[0])} />
            </div>
          )}
        </div>
      )}
      {rows.map(key => {
        const o = overlays[key]
        return (
          <div key={key} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className={o.enabled ? '' : 'opacity-50'}>
                <div className="font-semibold capitalize">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.sub}</div>
              </div>
              <Switch checked={o.enabled} onCheckedChange={(v) => update(key, { enabled: v })} />
            </div>
            <div className={`space-y-2 ${o.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
              {/* Quick position presets */}
              <div className="flex gap-1.5">
                {positions.map(p => (
                  <button key={p.label} type="button" onClick={() => update(key, { position: p.value })} className={`wizard-step-btn text-[11px] flex-1 py-1.5 rounded-md border transition ${Math.abs(o.position - p.value) < 4 ? 'border-foreground bg-foreground/10 font-semibold' : 'border-border bg-background hover:border-primary/50'}`}>{p.label}</button>
                ))}
              </div>
              {/* Fine slider */}
              <Slider min={0} max={100} step={1} value={[o.position]} onValueChange={(v) => update(key, { position: v[0] })} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>↑ Higher ({o.position}%)</span>
                <span>Lower ↓</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
