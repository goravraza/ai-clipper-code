'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Sun, Moon, Sparkles, Upload, Link2, Download, Calendar, Clock,
  Flame, TrendingUp, Zap, Settings2, Type, Palette, Wand2, Coins,
  Youtube, Instagram, Music2, ShieldCheck, ChevronRight, Loader2, Play,
  Languages, Smile, Pencil, Check, LogIn, LogOut, User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerDescription } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import Link from 'next/link'

export const FONTS = [
  { name: 'Montserrat Bold', css: 'Montserrat, system-ui, sans-serif', weight: 900 },
  { name: 'Impact', css: 'Impact, Haettenschweiler, sans-serif', weight: 700 },
  { name: 'Comic Sans', css: '"Comic Sans MS", cursive', weight: 700 },
  { name: 'Anton Display', css: 'Anton, sans-serif', weight: 400 },
  { name: 'Bebas Neue', css: '"Bebas Neue", sans-serif', weight: 400 },
  { name: 'Oswald Bold', css: 'Oswald, sans-serif', weight: 700 },
  { name: 'Pacifico Script', css: 'Pacifico, cursive', weight: 400 },
  { name: 'Permanent Marker', css: '"Permanent Marker", cursive', weight: 400 },
  { name: 'Bangers Comic', css: 'Bangers, cursive', weight: 400 },
  { name: 'Press Start 2P', css: '"Press Start 2P", monospace', weight: 400 },
]

export const STROKE_COLORS = [
  { name: 'White', value: '#ffffff' }, { name: 'Black', value: '#000000' }, { name: 'Neon Yellow', value: '#facc15' },
  { name: 'Hot Pink', value: '#ec4899' }, { name: 'Cyber Cyan', value: '#06b6d4' }, { name: 'Lime', value: '#84cc16' }, { name: 'Orange', value: '#f97316' },
]

export const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'Hindi' }, { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }, { code: 'de', name: 'German' }, { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' }, { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' }, { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar', name: 'Arabic' }, { code: 'ru', name: 'Russian' }, { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' }, { code: 'tr', name: 'Turkish' }, { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' }, { code: 'id', name: 'Indonesian' }, { code: 'tl', name: 'Tagalog' },
  { code: 'bn', name: 'Bengali' }, { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' }, { code: 'gu', name: 'Gujarati' }, { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' }, { code: 'sv', name: 'Swedish' }, { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' }, { code: 'fi', name: 'Finnish' }, { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' }, { code: 'cs', name: 'Czech' }, { code: 'hu', name: 'Hungarian' },
  { code: 'ro', name: 'Romanian' }, { code: 'uk', name: 'Ukrainian' }, { code: 'ms', name: 'Malay' },
  { code: 'fa', name: 'Persian' }, { code: 'sw', name: 'Swahili' },
]

// Base UI strings (English) — these get translated by Gemini when language changes.
const BASE_STRINGS = {
  workspace: 'Workspace',
  pricing: 'Pricing',
  styling: 'Styling',
  admin: 'Admin',
  hero_title_1: 'Turn long videos into',
  hero_title_2: 'viral shorts',
  hero_title_3: 'in minutes.',
  hero_subtitle: 'Drop a YouTube link, Reel, or TikTok URL — our AI finds the most engaging 30-60s moments, captions them in 40+ languages, and schedules them to your socials.',
  open_workspace: 'Open Workspace',
  see_pricing: 'See Pricing',
  workspace_subtitle: 'Ingest your video, watch AI-generated clips, and customize the look.',
  ingestion_portal: 'Ingestion Portal',
  url_placeholder: 'Paste YouTube, TikTok, or Instagram Reels URL…',
  generate_clips: 'Generate Clips',
  or_drop: 'Or drop a local video file here',
  file_hint: 'MP4, MOV, WebM up to 5GB',
  your_clips: 'Your Generated Clips',
  ranked_virality: 'Ranked by virality',
  subtitle_styling: 'Subtitle Styling',
  font_label: 'Font',
  subtitle_language: 'Subtitle Language',
  stroke_color: 'Stroke Color',
  meme_hook_label: 'Auto-insert 3s Meme Hook at Intro',
  meme_hook_desc: 'Boost first-frame retention with a trending meme cold-open.',
  monthly: 'Monthly',
  yearly: 'Yearly',
  pay_only: 'Pay only for what you clip.',
  monthly_credits: 'Monthly credits',
  minutes: 'minutes',
  closest_plan: 'Closest plan:',
  save: 'Save',
  buy: 'Buy',
  most_popular: 'Most Popular',
  slider_match: 'Slider Match',
  sign_in: 'Sign in',
  sign_out: 'Sign out',
  demo_user: 'Demo user',
  hook: 'Hook',
  no_hook: 'No hook',
  edit_hook: 'Edit Hook',
  schedule: 'Schedule',
  download_mp4: 'Download MP4',
}

function formatPrice(amount, symbol) {
  if (symbol === '₹') return `₹${Number(amount).toLocaleString('en-IN')}`
  return `$${Number(amount).toFixed(2)}`
}

function ThemeToggle({ onChange }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button onClick={() => { const next = isDark ? 'light' : 'dark'; setTheme(next); onChange?.(next) }}
      className="relative inline-flex h-9 w-16 items-center rounded-full bg-secondary border border-border transition-colors hover:bg-muted" aria-label="Toggle theme">
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md transition-transform ${isDark ? 'translate-x-8' : 'translate-x-1'}`}>
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
      </span>
    </button>
  )
}

export default function HomePage() {
  const [geo, setGeo] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [packages, setPackages] = useState([])
  const [clips, setClips] = useState([])
  const [memes, setMemes] = useState([])
  const [sliderMinutes, setSliderMinutes] = useState([1000])
  const [billingCycle, setBillingCycle] = useState('month')
  const [urlInput, setUrlInput] = useState('')
  const [isIngesting, setIsIngesting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [subtitleFont, setSubtitleFont] = useState('Montserrat Bold')
  const [strokeColor, setStrokeColor] = useState('#facc15')
  const [subtitleLanguage, setSubtitleLanguage] = useState('en')
  const [uiLanguage, setUiLanguage] = useState('en')
  const [memeHook, setMemeHook] = useState(true)
  const [t, setT] = useState(BASE_STRINGS)
  const [isTranslating, setIsTranslating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/geo').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/pricing-packages').then(r => r.json()),
      fetch('/api/clips').then(r => r.json()),
      fetch('/api/memes').then(r => r.json()),
    ]).then(([g, me, pk, c, m]) => {
      setGeo(g); setProfile(me.user); setIsAuthed(!!me.is_authenticated); setPackages(pk); setClips(c); setMemes(m)
    }).catch(() => toast.error('Failed to load workspace'))
  }, [])

  // Translate UI when uiLanguage changes
  useEffect(() => {
    if (uiLanguage === 'en') { setT(BASE_STRINGS); return }
    const langName = LANGUAGES.find(l => l.code === uiLanguage)?.name || uiLanguage
    setIsTranslating(true)
    fetch('/api/ai/translate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: uiLanguage, language_name: langName, strings: BASE_STRINGS })
    })
      .then(r => r.json())
      .then(data => {
        if (data.translations) {
          setT({ ...BASE_STRINGS, ...data.translations })
          toast.success(`UI translated to ${langName}`)
        } else { toast.error(data.error || 'Translation failed') }
      })
      .catch(() => toast.error('Translation request failed'))
      .finally(() => setIsTranslating(false))
  }, [uiLanguage])

  const selectedPack = useMemo(() => {
    if (!packages.length) return null
    const m = sliderMinutes[0]
    const sorted = [...packages].sort((a,b)=>a.credit_amount_minutes-b.credit_amount_minutes)
    let pick = sorted[0]
    for (const p of sorted) if (p.credit_amount_minutes <= m) pick = p
    return pick
  }, [packages, sliderMinutes])

  const dynamicPrice = useMemo(() => {
    if (!selectedPack || !geo) return null
    const symbol = geo.currency === 'INR' ? '₹' : '$'
    const basePerMin = (geo.currency === 'INR' ? selectedPack.price_inr : selectedPack.price_usd) / selectedPack.credit_amount_minutes
    let raw = basePerMin * sliderMinutes[0]
    if (billingCycle === 'year') raw = raw * 12 * 0.8
    return { symbol, raw, formatted: formatPrice(raw, symbol) }
  }, [selectedPack, geo, sliderMinutes, billingCycle])

  function updateThemeInProfile(next) {
    fetch('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme_preference: next }) })
      .then(r => r.json()).then(setProfile).catch(()=>{})
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setIsAuthed(false)
    window.location.reload()
  }

  function handleBuy(pkg) {
    if (!geo) return
    const isIndia = geo.country_code === 'IN'
    const w = window.open('about:blank', '_blank')
    if (isIndia) {
      toast.success(`Opening Razorpay checkout for ${pkg.name}`, { description: `Amount: ₹${pkg.price_inr.toLocaleString('en-IN')} — Razorpay (MOCK)` })
      w?.document?.write(`<html><body style="font-family:system-ui;background:#0a0a14;color:white;padding:40px;text-align:center"><h1 style="color:#3399cc">Razorpay</h1><h2>${pkg.name}</h2><p style="font-size:32px">₹${pkg.price_inr.toLocaleString('en-IN')}</p><p>Mock payment interface.</p></body></html>`)
    } else {
      toast.success(`Opening Lemon Squeezy checkout for ${pkg.name}`, { description: `Amount: $${pkg.price_usd} — Lemon Squeezy (MOCK)` })
      w?.document?.write(`<html><body style="font-family:system-ui;background:#fff8e7;color:#111;padding:40px;text-align:center"><h1 style="color:#FFC233">🍋 Lemon Squeezy</h1><h2>${pkg.name}</h2><p style="font-size:32px">$${pkg.price_usd}</p><p>Mock payment interface.</p></body></html>`)
    }
  }

  async function handleIngest() {
    if (!urlInput) return toast.error('Paste a video URL first')
    setIsIngesting(true)
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ url: urlInput })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'AI failed')
      toast.success(`AI generated ${data.clips.length} viral clips`, { description: `Top score: ${data.clips[0]?.virality_score}` })
      // refresh clips
      const fresh = await fetch('/api/clips').then(r => r.json())
      setClips(fresh)
      setUrlInput('')
    } catch (e) { toast.error('Ingestion failed', { description: e.message }) }
    finally { setIsIngesting(false) }
  }

  function handleDrop(e) {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    toast.success(`Uploading ${files[0].name}`, { description: 'Local upload accepted (mock)' })
  }

  const fontObj = FONTS.find(f => f.name === subtitleFont) || FONTS[0]
  const initials = (profile?.email || profile?.name || 'U').slice(0,2).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">ClipForge<span className="gradient-text">AI</span></div>
              <div className="text-[10px] text-muted-foreground -mt-1">Long videos → viral shorts</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#workspace" className="hover:text-foreground text-muted-foreground transition-colors">{t.workspace}</a>
            <a href="#pricing" className="hover:text-foreground text-muted-foreground transition-colors">{t.pricing}</a>
            <a href="#styling" className="hover:text-foreground text-muted-foreground transition-colors">{t.styling}</a>
            <Link href="/admin" className="hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> {t.admin}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Select value={uiLanguage} onValueChange={setUiLanguage}>
              <SelectTrigger className="h-9 w-auto gap-1 px-2 border-0 bg-transparent hover:bg-muted focus:ring-0">
                {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                <span className="text-xs">{LANGUAGES.find(l => l.code === uiLanguage)?.name.slice(0,2).toUpperCase()}</span>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium">{profile?.credit_balance_minutes ?? '—'} min</span>
            </div>
            <ThemeToggle onChange={updateThemeInProfile} />
            {isAuthed && profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <Avatar className="h-9 w-9 ring-2 ring-primary/30">
                      <AvatarImage src={profile.picture} alt={profile.email} />
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-xs font-semibold">{profile.name || profile.email}</div>
                    <div className="text-xs text-muted-foreground">{profile.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck className="h-3.5 w-3.5 mr-2" /> {t.admin}</Link></DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}><LogOut className="h-3.5 w-3.5 mr-2" /> {t.sign_out}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login"><Button size="sm" variant="outline" className="gap-1.5"><LogIn className="h-3.5 w-3.5" /> {t.sign_in}</Button></Link>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] gradient-bg opacity-20 blur-3xl rounded-full" />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
              <Flame className="h-3 w-3 mr-1" /> Powered by Gemini AI
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              {t.hero_title_1} <span className="gradient-text">{t.hero_title_2}</span> {t.hero_title_3}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">{t.hero_subtitle}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gradient-bg text-white hover:opacity-90" onClick={() => document.getElementById('workspace')?.scrollIntoView({behavior:'smooth'})}>
                <Wand2 className="mr-2 h-4 w-4" /> {t.open_workspace}
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})}>
                {t.see_pricing} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {geo && (
              <div className="mt-6 text-xs text-muted-foreground">
                Detected location: <span className="font-medium text-foreground">{geo.country_name}</span> — prices in {geo.currency} via <span className="font-medium text-foreground">{geo.payment_processor === 'razorpay' ? 'Razorpay' : 'Lemon Squeezy'}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="workspace" className="container py-16 md:py-24">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{t.workspace}</h2>
          <p className="text-muted-foreground">{t.workspace_subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> {t.ingestion_portal}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t.url_placeholder} value={urlInput} onChange={(e)=>setUrlInput(e.target.value)} className="pl-9 h-11" />
                  </div>
                  <Button onClick={handleIngest} disabled={isIngesting} className="h-11 gradient-bg text-white hover:opacity-90">
                    {isIngesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                    {isIngesting ? 'AI thinking…' : t.generate_clips}
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Youtube className="h-4 w-4 text-red-500" /> YouTube <span>•</span>
                  <Instagram className="h-4 w-4 text-pink-500" /> Reels <span>•</span>
                  <Music2 className="h-4 w-4 text-foreground" /> TikTok
                </div>
                <div
                  onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}}
                  onDragLeave={()=>setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">{t.or_drop}</div>
                  <div className="text-xs text-muted-foreground">{t.file_hint}</div>
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">{t.your_clips}</h3>
                <Badge variant="secondary"><TrendingUp className="h-3 w-3 mr-1" />{t.ranked_virality}</Badge>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {clips.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} memes={memes} t={t} onUpdate={(c)=> setClips(prev => prev.map(x => x.id === c.id ? c : x))} />
                ))}
              </div>
            </div>
          </div>

          <aside id="styling" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> {t.subtitle_styling}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="relative aspect-[9/16] max-w-[200px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-end justify-center p-4">
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-700"><Play className="h-10 w-10" /></div>
                  <div className="relative text-center text-white leading-tight uppercase"
                    style={{ fontFamily: fontObj.css, fontWeight: fontObj.weight, fontSize: fontObj.name === 'Press Start 2P' ? '14px' : '22px', WebkitTextStroke: `2px ${strokeColor}`, textShadow: `0 0 8px ${strokeColor}55` }}>
                    AI built<br/>this clip!
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> {t.font_label} ({FONTS.length})</Label>
                  <Select value={subtitleFont} onValueChange={setSubtitleFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTS.map(f => <SelectItem key={f.name} value={f.name}><span style={{ fontFamily: f.css, fontWeight: f.weight }}>{f.name}</span></SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> {t.subtitle_language}</Label>
                  <Select value={subtitleLanguage} onValueChange={setSubtitleLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> {t.stroke_color}</Label>
                  <div className="flex flex-wrap gap-2">
                    {STROKE_COLORS.map(c => (<button key={c.value} onClick={()=>setStrokeColor(c.value)} className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${strokeColor === c.value ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`} style={{ backgroundColor: c.value }} aria-label={c.name} />))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="font-medium">{t.meme_hook_label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.meme_hook_desc}</p>
                  </div>
                  <Switch checked={memeHook} onCheckedChange={setMemeHook} />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      <section id="pricing" className="border-t border-border bg-muted/30">
        <div className="container py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{t.pricing}</Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">{t.pay_only}</h2>
            <p className="text-muted-foreground">{geo?.country_code === 'IN' ? 'Showing INR prices — secure checkout via Razorpay.' : 'Showing USD prices — secure checkout via Lemon Squeezy.'}</p>
          </div>
          <Card className="max-w-3xl mx-auto mb-12">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{t.monthly_credits}</div>
                  <div className="text-3xl font-bold">{sliderMinutes[0]} <span className="text-base font-normal text-muted-foreground">{t.minutes}</span></div>
                </div>
                <Tabs value={billingCycle} onValueChange={setBillingCycle}>
                  <TabsList>
                    <TabsTrigger value="month">{t.monthly}</TabsTrigger>
                    <TabsTrigger value="year">{t.yearly} <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-primary/15 text-primary border-transparent">-20%</Badge></TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Slider min={300} max={3000} step={100} value={sliderMinutes} onValueChange={setSliderMinutes} />
              <div className="flex justify-between text-xs text-muted-foreground"><span>300 min</span><span>1500 min</span><span>3000 min</span></div>
              {dynamicPrice && selectedPack && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t.closest_plan} <span className="font-medium text-foreground">{selectedPack.name}</span></div>
                    <div className="text-2xl font-bold">{dynamicPrice.formatted}<span className="text-sm text-muted-foreground font-normal">/{billingCycle === 'year' ? 'year' : 'mo'}</span></div>
                    {selectedPack.discount_percentage > 0 && <Badge className="mt-1 bg-emerald-500/15 text-emerald-500 border-transparent">{t.save} {selectedPack.discount_percentage}%</Badge>}
                  </div>
                  <Button size="lg" className="gradient-bg text-white hover:opacity-90" onClick={() => handleBuy(selectedPack)}>{t.buy} {selectedPack.name}</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packages.map((pkg) => {
              const isSelected = selectedPack?.id === pkg.id
              const isIndia = geo?.country_code === 'IN'
              const price = isIndia ? pkg.price_inr : pkg.price_usd
              const symbol = isIndia ? '₹' : '$'
              return (
                <Card key={pkg.id} className={`relative transition-all ${isSelected ? 'border-primary glow scale-[1.02]' : ''} ${pkg.is_featured ? 'border-primary/40' : ''}`}>
                  {pkg.is_featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-bg text-white border-transparent">{t.most_popular}</Badge>}
                  {isSelected && !pkg.is_featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-transparent">{t.slider_match}</Badge>}
                  <CardHeader>
                    <CardTitle>{pkg.name}</CardTitle>
                    <div className="mt-2"><span className="text-4xl font-bold">{formatPrice(price, symbol)}</span><span className="text-muted-foreground text-sm">/mo</span></div>
                    {pkg.discount_percentage > 0 && <Badge className="mt-1 w-fit bg-emerald-500/15 text-emerald-500 border-transparent">{pkg.discount_percentage}% off</Badge>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="text-sm space-y-2">
                      <li className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> {pkg.credit_amount_minutes} min processing</li>
                      <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI virality scoring</li>
                      <li className="flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /> 40+ subtitle languages</li>
                      <li className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Social scheduling</li>
                    </ul>
                    <Button onClick={() => handleBuy(pkg)} className={`w-full ${pkg.is_featured ? 'gradient-bg text-white' : ''}`} variant={pkg.is_featured ? 'default' : 'outline'}>
                      {isIndia ? 'Pay via Razorpay' : 'Pay via Lemon Squeezy'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container py-8 flex items-center justify-between text-sm text-muted-foreground">
          <div>© 2025 ClipForge AI — Built for creators.</div>
          <Link href="/admin" className="hover:text-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Admin Panel</Link>
        </div>
      </footer>
    </div>
  )
}

function ClipCard({ clip, memes, t, onUpdate }) {
  const [title, setTitle] = useState(clip.clip_title)
  const [scheduledTime, setScheduledTime] = useState(clip.scheduled_time || '')
  const [platform, setPlatform] = useState('youtube_shorts')

  async function saveTitle() {
    if (title === clip.clip_title) return
    const r = await fetch(`/api/clips/${clip.id}`, { method: 'PUT', headers: { 'content-type':'application/json' }, body: JSON.stringify({ clip_title: title }) })
    const c = await r.json(); onUpdate(c); toast.success('Title updated')
  }

  async function schedule() {
    if (!scheduledTime) return toast.error('Pick a time first')
    const r = await fetch(`/api/clips/${clip.id}`, { method: 'PUT', headers: { 'content-type':'application/json' }, body: JSON.stringify({ is_scheduled: true, scheduled_time: scheduledTime }) })
    const c = await r.json(); onUpdate(c)
    toast.success(`Scheduled to ${platform.replace('_',' ')}`, { description: new Date(scheduledTime).toLocaleString() })
  }

  function download() { toast.success('Downloading MP4', { description: `${clip.clip_title} (1080x1920)` }) }

  const score = clip.virality_score
  const scoreColor = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-500' : 'bg-orange-500'
  const hookMeme = clip.hook_meme_id ? memes.find(m => m.id === clip.hook_meme_id) : null
  const hookLabel = clip.hook_type === 'text' && clip.hook_text ? `“${clip.hook_text}”`
    : clip.hook_type === 'meme' && hookMeme ? `🎬 ${hookMeme.name}`
    : t.no_hook

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-[9/16] bg-zinc-900 overflow-hidden">
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbnail_url} alt={clip.clip_title} className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <Badge className={`absolute top-2 left-2 ${scoreColor} text-white border-transparent`}><Flame className="h-3 w-3 mr-1" /> {score}</Badge>
        <div className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-xs text-white flex items-center gap-1">
          <Clock className="h-3 w-3" /> {clip.end_time_seconds - clip.start_time_seconds}s
        </div>
        {/* Meme hook preview overlay */}
        {clip.hook_type === 'meme' && hookMeme && (
          <div className="absolute bottom-12 left-2 right-2 rounded-md bg-black/70 backdrop-blur-md p-1.5 flex items-center gap-2 border border-primary/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hookMeme.thumbnail_url} alt={hookMeme.name} className="h-8 w-6 rounded object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-primary font-semibold uppercase tracking-wide">Intro: {hookMeme.duration_seconds}s meme</div>
              <div className="text-[11px] text-white truncate font-medium">{hookMeme.name}</div>
            </div>
          </div>
        )}
        {clip.hook_type === 'text' && clip.hook_text && (
          <div className="absolute bottom-12 left-2 right-2 rounded-md bg-black/70 backdrop-blur-md p-1.5 border border-amber-400/40">
            <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Text Hook</div>
            <div className="text-[11px] text-white line-clamp-2 font-medium">{clip.hook_text}</div>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-6 w-6 text-black ml-1" fill="currentColor" />
          </div>
        </div>
        {clip.is_scheduled && <Badge className="absolute bottom-2 left-2 bg-primary text-primary-foreground"><Calendar className="h-3 w-3 mr-1" /> Scheduled</Badge>}
      </div>
      <CardContent className="p-3 space-y-2">
        <Input value={title} onChange={(e)=>setTitle(e.target.value)} onBlur={saveTitle} className="font-semibold text-sm h-9" />
        <HookEditor clip={clip} memes={memes} onUpdate={onUpdate} hookLabel={hookLabel} t={t} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={download}>
            <Download className="h-3.5 w-3.5 mr-1" /> MP4
          </Button>
          <Drawer>
            <DrawerTrigger asChild>
              <Button size="sm" className="flex-1 gradient-bg text-white hover:opacity-90">
                <Calendar className="h-3.5 w-3.5 mr-1" /> {t.schedule}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <div className="mx-auto w-full max-w-md">
                <DrawerHeader>
                  <DrawerTitle>Schedule “{clip.clip_title}”</DrawerTitle>
                  <DrawerDescription>Queue this clip to post automatically.</DrawerDescription>
                </DrawerHeader>
                <div className="px-4 space-y-4 pb-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="instagram_reels">Instagram Reels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Post at</Label><Input type="datetime-local" value={scheduledTime} onChange={(e)=>setScheduledTime(e.target.value)} /></div>
                </div>
                <DrawerFooter><Button onClick={schedule} className="gradient-bg text-white">Queue this clip</Button></DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </CardContent>
    </Card>
  )
}

function HookEditor({ clip, memes, onUpdate, hookLabel, t }) {
  const [hookType, setHookType] = useState(clip.hook_type || 'none')
  const [hookText, setHookText] = useState(clip.hook_text || '')
  const [hookMemeId, setHookMemeId] = useState(clip.hook_meme_id || null)
  const [open, setOpen] = useState(false)

  async function save() {
    const r = await fetch(`/api/clips/${clip.id}`, {
      method: 'PUT', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ hook_type: hookType, hook_text: hookText, hook_meme_id: hookMemeId })
    })
    const c = await r.json(); onUpdate(c)
    toast.success('Hook updated', { description: hookType === 'text' ? `Text: “${hookText}”` : hookType === 'meme' ? 'Meme hook attached' : 'Hook removed' })
    setOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className="w-full text-left rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted px-2.5 py-1.5 text-xs flex items-center gap-1.5 transition-colors">
          <Smile className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate flex-1">{t.hook}: {hookLabel}</span>
          <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>{t.edit_hook}: “{clip.clip_title}”</DrawerTitle>
            <DrawerDescription>Choose how your video opens — a punchy text overlay or a 3s meme cold-open.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Tabs value={hookType} onValueChange={setHookType}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="none">None</TabsTrigger>
                <TabsTrigger value="text"><Type className="h-3.5 w-3.5 mr-1" /> Text Hook</TabsTrigger>
                <TabsTrigger value="meme"><Smile className="h-3.5 w-3.5 mr-1" /> Meme Video</TabsTrigger>
              </TabsList>
              <TabsContent value="none" className="py-6 text-center text-sm text-muted-foreground">No intro hook — the clip starts at the AI-selected highlight.</TabsContent>
              <TabsContent value="text" className="space-y-3 py-4">
                <Label>Hook text (shown for 2-3s at the start)</Label>
                <Textarea value={hookText} onChange={(e)=>setHookText(e.target.value)} placeholder="e.g. You won't believe what happens next…" rows={3} className="text-base" />
                <div className="rounded-lg bg-zinc-900 p-6 text-center text-white text-2xl font-black uppercase" style={{fontFamily:'Impact, sans-serif', WebkitTextStroke:'2px #facc15'}}>{hookText || 'Your hook preview'}</div>
              </TabsContent>
              <TabsContent value="meme" className="py-4">
                <Label className="mb-2 block">Pick a meme video to prepend ({memes.filter(m=>m.is_active).length} available)</Label>
                <ScrollArea className="h-72 rounded-md border">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
                    {memes.filter(m => m.is_active).map(m => (
                      <button key={m.id} onClick={()=>setHookMemeId(m.id)} className={`relative aspect-[9/16] rounded-md overflow-hidden border-2 transition-all ${hookMemeId === m.id ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.thumbnail_url} alt={m.name} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                        <div className="absolute bottom-1 left-1.5 right-1.5 text-white text-[10px] font-semibold truncate text-left">{m.name}</div>
                        <Badge className="absolute top-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0 border-transparent">{m.duration_seconds}s</Badge>
                        {hookMemeId === m.id && <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5"><Check className="h-3 w-3" /></div>}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          <DrawerFooter><Button onClick={save} className="gradient-bg text-white">Save Hook</Button></DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
