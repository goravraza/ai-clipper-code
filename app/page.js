'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Sun, Moon, Sparkles, Upload, Link2, Download, Calendar, Clock,
  Flame, TrendingUp, Zap, Settings2, Type, Palette, Wand2, Coins,
  Youtube, Instagram, Music2, ShieldCheck, ChevronRight, Loader2, Play,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

const FONTS = ['Montserrat Bold', 'Impact', 'Comic Sans']
const STROKE_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Neon Yellow', value: '#facc15' },
  { name: 'Hot Pink', value: '#ec4899' },
  { name: 'Cyber Cyan', value: '#06b6d4' },
]

function formatPrice(amount, symbol) {
  if (symbol === '₹') return `₹${Number(amount).toLocaleString('en-IN')}`
  return `$${Number(amount).toFixed(2)}`
}

function ThemeToggle({ profileTheme, onChange }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => {
        const next = isDark ? 'light' : 'dark'
        setTheme(next)
        onChange?.(next)
      }}
      className="relative inline-flex h-9 w-16 items-center rounded-full bg-secondary border border-border transition-colors hover:bg-muted"
      aria-label="Toggle theme"
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md transition-transform ${isDark ? 'translate-x-8' : 'translate-x-1'}`}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
      </span>
    </button>
  )
}

export default function HomePage() {
  const [geo, setGeo] = useState(null)
  const [profile, setProfile] = useState(null)
  const [packages, setPackages] = useState([])
  const [clips, setClips] = useState([])
  const [sliderMinutes, setSliderMinutes] = useState([1000])
  const [billingCycle, setBillingCycle] = useState('month')
  const [urlInput, setUrlInput] = useState('')
  const [isIngesting, setIsIngesting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  // styling panel state
  const [subtitleFont, setSubtitleFont] = useState('Montserrat Bold')
  const [strokeColor, setStrokeColor] = useState(STROKE_COLORS[0].value)
  const [memeHook, setMemeHook] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/geo').then(r => r.json()),
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/pricing-packages').then(r => r.json()),
      fetch('/api/clips').then(r => r.json()),
    ]).then(([g, p, pk, c]) => {
      setGeo(g); setProfile(p); setPackages(pk); setClips(c)
    }).catch(err => toast.error('Failed to load workspace'))
  }, [])

  // pick currently selected pack based on slider value
  const selectedPack = useMemo(() => {
    if (!packages.length) return null
    const m = sliderMinutes[0]
    // closest pack at-or-below; else lowest
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
    const yearly = billingCycle === 'year'
    if (yearly) raw = raw * 12 * 0.8 // 20% yearly discount
    return { symbol, raw, formatted: formatPrice(raw, symbol) }
  }, [selectedPack, geo, sliderMinutes, billingCycle])

  function updateThemeInProfile(next) {
    fetch('/api/profile', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme_preference: next })
    }).then(r => r.json()).then(setProfile).catch(()=>{})
  }

  function handleBuy(pkg) {
    if (!geo) return
    const isIndia = geo.country_code === 'IN'
    if (isIndia) {
      toast.success(`Opening Razorpay checkout for ${pkg.name}`, {
        description: `Amount: ₹${pkg.price_inr.toLocaleString('en-IN')} — Razorpay payment window (MOCK)`,
      })
      window.open('about:blank', '_blank')?.document?.write(
        `<html><head><title>Razorpay Mock Checkout</title></head><body style="font-family:system-ui;background:#0a0a14;color:white;padding:40px;text-align:center"><h1 style="color:#3399cc">Razorpay</h1><h2>${pkg.name}</h2><p style="font-size:32px">₹${pkg.price_inr.toLocaleString('en-IN')}</p><p>Mock payment interface for Indian users.</p></body></html>`
      )
    } else {
      toast.success(`Opening Lemon Squeezy checkout for ${pkg.name}`, {
        description: `Amount: $${pkg.price_usd} — Lemon Squeezy (MOCK)`,
      })
      window.open('about:blank', '_blank')?.document?.write(
        `<html><head><title>Lemon Squeezy Mock Checkout</title></head><body style="font-family:system-ui;background:#fff8e7;color:#111;padding:40px;text-align:center"><h1 style="color:#FFC233">🍋 Lemon Squeezy</h1><h2>${pkg.name}</h2><p style="font-size:32px">$${pkg.price_usd}</p><p>Mock payment interface for international users.</p></body></html>`
      )
    }
  }

  async function handleIngest() {
    if (!urlInput) return toast.error('Paste a video URL first')
    setIsIngesting(true)
    try {
      await fetch('/api/videos', {
        method: 'POST', headers: { 'content-type':'application/json' },
        body: JSON.stringify({ url: urlInput })
      })
      toast.success('Video queued for AI clipping', {
        description: 'We’ll generate viral shorts in ~2 minutes (mocked).',
      })
      setUrlInput('')
    } catch (e) { toast.error('Ingestion failed') }
    finally { setIsIngesting(false) }
  }

  function handleDrop(e) {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    toast.success(`Uploading ${files[0].name}`, { description: 'Local upload accepted (mock)' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* TOP NAV */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
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
            <a href="#workspace" className="hover:text-foreground text-muted-foreground transition-colors">Workspace</a>
            <a href="#pricing" className="hover:text-foreground text-muted-foreground transition-colors">Pricing</a>
            <a href="#styling" className="hover:text-foreground text-muted-foreground transition-colors">Styling</a>
            <Link href="/admin" className="hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium">{profile?.credit_balance_minutes ?? '—'} min</span>
            </div>
            <ThemeToggle profileTheme={profile?.theme_preference} onChange={updateThemeInProfile} />
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] gradient-bg opacity-20 blur-3xl rounded-full" />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
              <Flame className="h-3 w-3 mr-1" /> AI Virality Score — Now Live
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Turn long videos into <span className="gradient-text">viral shorts</span> in minutes.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Drop a YouTube link, Reel, or TikTok URL — our AI finds the most engaging 30-60s moments,
              auto-captions them, and schedules them straight to your socials.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gradient-bg text-white hover:opacity-90" onClick={() => document.getElementById('workspace')?.scrollIntoView({behavior:'smooth'})}>
                <Wand2 className="mr-2 h-4 w-4" /> Open Workspace
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})}>
                See Pricing <ChevronRight className="ml-1 h-4 w-4" />
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

      {/* WORKSPACE */}
      <section id="workspace" className="container py-16 md:py-24">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Workspace</h2>
          <p className="text-muted-foreground">Ingest your video, watch AI-generated clips, and customize the look.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* INGESTION PORTAL */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" /> Ingestion Portal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Paste YouTube, TikTok, or Instagram Reels URL…"
                      value={urlInput}
                      onChange={(e)=>setUrlInput(e.target.value)}
                      className="pl-9 h-11"
                    />
                  </div>
                  <Button onClick={handleIngest} disabled={isIngesting} className="h-11 gradient-bg text-white hover:opacity-90">
                    {isIngesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                    Generate Clips
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Youtube className="h-4 w-4 text-red-500" /> YouTube
                  <span>•</span>
                  <Instagram className="h-4 w-4 text-pink-500" /> Reels
                  <span>•</span>
                  <Music2 className="h-4 w-4 text-foreground" /> TikTok
                </div>

                <div
                  onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}}
                  onDragLeave={()=>setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">Or drop a local video file here</div>
                  <div className="text-xs text-muted-foreground">MP4, MOV, WebM up to 5GB</div>
                </div>
              </CardContent>
            </Card>

            {/* CLIPS GRID */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Your Generated Clips</h3>
                <Badge variant="secondary"><TrendingUp className="h-3 w-3 mr-1" />Ranked by virality</Badge>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {clips.map((clip) => (
                  <ClipCard key={clip.id} clip={clip} onUpdate={(c)=> setClips(prev => prev.map(x => x.id === c.id ? c : x))} />
                ))}
              </div>
            </div>
          </div>

          {/* STYLING PANEL */}
          <aside id="styling" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" /> Subtitle Styling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* LIVE PREVIEW */}
                <div className="relative aspect-[9/16] max-w-[180px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-end justify-center p-3">
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                    <Play className="h-10 w-10" />
                  </div>
                  <div
                    className="relative text-center text-white text-lg leading-tight font-black uppercase"
                    style={{
                      fontFamily: subtitleFont === 'Impact' ? 'Impact, Haettenschweiler, sans-serif' : subtitleFont === 'Comic Sans' ? '"Comic Sans MS", cursive' : 'Montserrat, system-ui, sans-serif',
                      WebkitTextStroke: `2px ${strokeColor}`,
                      textShadow: `0 0 8px ${strokeColor}55`,
                    }}
                  >
                    AI built<br/>this clip!
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Font</Label>
                  <Select value={subtitleFont} onValueChange={setSubtitleFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Stroke Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {STROKE_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={()=>setStrokeColor(c.value)}
                        className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${strokeColor === c.value ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
                        style={{ backgroundColor: c.value }}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label className="font-medium">Auto-insert 3s Meme Hook at Intro</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Boost the first-frame retention with a trending meme cold-open.</p>
                  </div>
                  <Switch checked={memeHook} onCheckedChange={setMemeHook} />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border bg-muted/30">
        <div className="container py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Simple, transparent pricing</Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">Pay only for what you clip.</h2>
            <p className="text-muted-foreground">
              {geo?.country_code === 'IN'
                ? 'Showing INR prices — secure checkout via Razorpay.'
                : 'Showing USD prices — secure checkout via Lemon Squeezy.'}
            </p>
          </div>

          {/* SLIDER + TOGGLE */}
          <Card className="max-w-3xl mx-auto mb-12">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Monthly credits</div>
                  <div className="text-3xl font-bold">{sliderMinutes[0]} <span className="text-base font-normal text-muted-foreground">minutes</span></div>
                </div>
                <Tabs value={billingCycle} onValueChange={setBillingCycle}>
                  <TabsList>
                    <TabsTrigger value="month">Monthly</TabsTrigger>
                    <TabsTrigger value="year">Yearly <Badge className="ml-1.5 h-4 px-1 text-[10px] bg-primary/15 text-primary border-transparent">-20%</Badge></TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Slider min={300} max={3000} step={100} value={sliderMinutes} onValueChange={setSliderMinutes} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>300 min</span><span>1500 min</span><span>3000 min</span>
              </div>

              {dynamicPrice && selectedPack && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Closest plan: <span className="font-medium text-foreground">{selectedPack.name}</span></div>
                    <div className="text-2xl font-bold">{dynamicPrice.formatted}<span className="text-sm text-muted-foreground font-normal">/{billingCycle === 'year' ? 'year' : 'mo'}</span></div>
                    {selectedPack.discount_percentage > 0 && (
                      <Badge className="mt-1 bg-emerald-500/15 text-emerald-500 border-transparent">Save {selectedPack.discount_percentage}%</Badge>
                    )}
                  </div>
                  <Button size="lg" className="gradient-bg text-white hover:opacity-90" onClick={() => handleBuy(selectedPack)}>
                    Buy {selectedPack.name}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PACKAGE CARDS */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packages.map((pkg) => {
              const isSelected = selectedPack?.id === pkg.id
              const isIndia = geo?.country_code === 'IN'
              const price = isIndia ? pkg.price_inr : pkg.price_usd
              const symbol = isIndia ? '₹' : '$'
              return (
                <Card key={pkg.id} className={`relative transition-all ${isSelected ? 'border-primary glow scale-[1.02]' : ''} ${pkg.is_featured ? 'border-primary/40' : ''}`}>
                  {pkg.is_featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-bg text-white border-transparent">Most Popular</Badge>
                  )}
                  {isSelected && !pkg.is_featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground border-transparent">Slider Match</Badge>
                  )}
                  <CardHeader>
                    <CardTitle>{pkg.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-4xl font-bold">{formatPrice(price, symbol)}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    {pkg.discount_percentage > 0 && (
                      <Badge className="mt-1 w-fit bg-emerald-500/15 text-emerald-500 border-transparent">{pkg.discount_percentage}% off</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="text-sm space-y-2">
                      <li className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> {pkg.credit_amount_minutes} min processing</li>
                      <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI virality scoring</li>
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

function ClipCard({ clip, onUpdate }) {
  const [title, setTitle] = useState(clip.clip_title)
  const [scheduledTime, setScheduledTime] = useState(clip.scheduled_time || '')
  const [platform, setPlatform] = useState('youtube_shorts')

  async function saveTitle() {
    if (title === clip.clip_title) return
    const r = await fetch(`/api/clips/${clip.id}`, {
      method: 'PUT', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ clip_title: title })
    })
    const c = await r.json()
    onUpdate(c)
    toast.success('Title updated')
  }

  async function schedule() {
    if (!scheduledTime) return toast.error('Pick a time first')
    const r = await fetch(`/api/clips/${clip.id}`, {
      method: 'PUT', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ is_scheduled: true, scheduled_time: scheduledTime })
    })
    const c = await r.json()
    onUpdate(c)
    toast.success(`Scheduled to ${platform.replace('_',' ')}`, { description: new Date(scheduledTime).toLocaleString() })
  }

  function download() {
    toast.success('Downloading MP4', { description: `${clip.clip_title} (1080x1920)` })
  }

  const score = clip.virality_score
  const scoreColor = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-500' : 'bg-orange-500'

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-[9/16] bg-zinc-900 overflow-hidden">
        {clip.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbnail_url} alt={clip.clip_title} className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <Badge className={`absolute top-2 left-2 ${scoreColor} text-white border-transparent`}>
          <Flame className="h-3 w-3 mr-1" /> {score}
        </Badge>
        <div className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur px-2 py-0.5 text-xs text-white flex items-center gap-1">
          <Clock className="h-3 w-3" /> {clip.end_time_seconds - clip.start_time_seconds}s
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-6 w-6 text-black ml-1" fill="currentColor" />
          </div>
        </div>
        {clip.is_scheduled && (
          <Badge className="absolute bottom-2 left-2 bg-primary text-primary-foreground">
            <Calendar className="h-3 w-3 mr-1" /> Scheduled
          </Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <Input
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
          onBlur={saveTitle}
          className="font-semibold text-sm h-9"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={download}>
            <Download className="h-3.5 w-3.5 mr-1" /> MP4
          </Button>
          <Drawer>
            <DrawerTrigger asChild>
              <Button size="sm" className="flex-1 gradient-bg text-white hover:opacity-90">
                <Calendar className="h-3.5 w-3.5 mr-1" /> Schedule
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
                  <div className="space-y-2">
                    <Label>Post at</Label>
                    <Input type="datetime-local" value={scheduledTime} onChange={(e)=>setScheduledTime(e.target.value)} />
                  </div>
                </div>
                <DrawerFooter>
                  <Button onClick={schedule} className="gradient-bg text-white">Queue this clip</Button>
                </DrawerFooter>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </CardContent>
    </Card>
  )
}
