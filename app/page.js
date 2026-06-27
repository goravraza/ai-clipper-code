'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Sun, Moon, Sparkles, Upload, Link2, Download, Calendar, Clock,
  Flame, TrendingUp, Zap, Settings2, Type, Palette, Wand2, Coins,
  Youtube, Instagram, Music2, ShieldCheck, ChevronRight, Loader2, Play,
  Languages, Smile, Pencil, Check, LogIn, LogOut, User as UserIcon,
  Scissors, Crop, Captions, AArrowDown, AArrowUp, Pause, X, Cloud,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import StyleWizard from './_components/StyleWizard'

const CROP_ASPECTS = [
  { value: '9:16', label: 'Vertical 9:16', tw: 'aspect-[9/16]' },
  { value: '1:1', label: 'Square 1:1', tw: 'aspect-square' },
  { value: '4:5', label: 'Portrait 4:5', tw: 'aspect-[4/5]' },
  { value: '16:9', label: 'Landscape 16:9', tw: 'aspect-video' },
]

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
  const [strokeWidth, setStrokeWidth] = useState([2])
  const [fontSize, setFontSize] = useState([22])
  const [subtitleLanguage, setSubtitleLanguage] = useState('en')
  const [uiLanguage, setUiLanguage] = useState('en')
  const [memeHook, setMemeHook] = useState(true)
  const [couponCode, setCouponCode] = useState('')
  const [couponData, setCouponData] = useState(null)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  // NEW: clip length range + caption burn-in
  const [clipLengthPreset, setClipLengthPreset] = useState('30-60') // '10-30' | '30-60' | '60-90'
  const [burnCaptions, setBurnCaptions] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  // NEW: style wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardPayload, setWizardPayload] = useState(null)
  const [wizardInitialConfig, setWizardInitialConfig] = useState(null)
  const [wizardMode, setWizardMode] = useState('create')
  const [pendingSubmit, setPendingSubmit] = useState(null) // function to call after wizard completes
  const [processing, setProcessing] = useState(null) // { video_id, status, progress }
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
    const couponDiscount = couponData?.valid ? couponData.discount_percent : 0
    const discounted = couponDiscount > 0 ? raw * (1 - couponDiscount / 100) : raw
    return { symbol, raw, discounted, formatted: formatPrice(discounted, symbol), original: formatPrice(raw, symbol), couponDiscount }
  }, [selectedPack, geo, sliderMinutes, billingCycle, couponData])

  async function validateCoupon() {
    if (!couponCode.trim()) return
    setValidatingCoupon(true)
    try {
      const r = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}`)
      const data = await r.json()
      if (data.valid) { setCouponData(data); toast.success(`${data.code} applied: ${data.discount_percent}% off`) }
      else { setCouponData(null); toast.error('Invalid coupon', { description: data.error }) }
    } catch { toast.error('Could not validate coupon') }
    finally { setValidatingCoupon(false) }
  }

  function updateThemeInProfile(next) {
    fetch('/api/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ theme_preference: next }) })
      .then(r => r.json()).then(setProfile).catch(()=>{})
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setIsAuthed(false)
    window.location.reload()
  }

  async function handleBuy(pkg) {
    if (!pkg) return
    setPurchasing(pkg.id)
    try {
      const r = await fetch('/api/packages/purchase', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          package_id: pkg.id,
          coupon_code: couponData?.valid ? couponData.code : undefined,
          billing_cycle: billingCycle,
          country: geo?.country_code,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Purchase failed')
      toast.success(`✅ ${data.message || `+${data.credits_added} min added`}`, {
        description: `New balance: ${data.new_balance_minutes} min — paid ${data.currency} ${data.amount_paid}${data.coupon_applied ? ` (coupon ${data.coupon_applied})` : ''}`,
      })
      // refresh profile to show new credit balance
      const me = await fetch('/api/auth/me').then(r => r.json())
      setProfile(me.user)
    } catch (e) { toast.error('Purchase failed', { description: e.message }) }
    finally { setPurchasing(null) }
  }

  function getClipRange() {
    const [min, max] = clipLengthPreset.split('-').map(Number)
    return { clip_min: min, clip_max: max }
  }

  // ===== STYLE WIZARD ENTRY POINTS =====
  async function handleIngest() {
    if (!urlInput) return toast.error('Paste a video URL first')
    // Try to fetch YouTube thumbnail for the wizard preview
    let thumbnail = null
    let title = null
    try {
      const ytm = urlInput.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
      if (ytm) {
        thumbnail = `https://img.youtube.com/vi/${ytm[1]}/maxresdefault.jpg`
        try {
          const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(urlInput)}&format=json`).then(r=>r.json())
          title = oe?.title
        } catch {}
      }
    } catch {}
    setWizardPayload({ type: 'url', url: urlInput, thumbnail, title: title || urlInput.slice(0,60) })
    setPendingSubmit(() => (config) => submitIngest({ url: urlInput }, config))
    setWizardOpen(true)
  }

  function handleDrop(e) {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    handleFileUpload(files[0])
  }

  async function handleFileUpload(file) {
    if (!file) return
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      return toast.error('Please drop a video file')
    }
    const fileBlobUrl = URL.createObjectURL(file)
    setWizardPayload({ type: 'file', file, fileBlobUrl, title: file.name })
    setPendingSubmit(() => (config) => submitFile(file, config))
    setWizardOpen(true)
  }

  function handleWizardComplete(config) {
    setWizardOpen(false)
    setTimeout(() => {
      if (wizardPayload?.fileBlobUrl && wizardPayload.fileBlobUrl.startsWith('blob:')) URL.revokeObjectURL(wizardPayload.fileBlobUrl)
      setWizardPayload(null); setWizardInitialConfig(null); setWizardMode('create')
    }, 400)
    if (pendingSubmit) pendingSubmit(config)
    setPendingSubmit(null)
  }

  async function submitRestyle(clip, config) {
    toast.info('Restyling clip with new style…')
    try {
      const r = await fetch(`/api/clips/${clip.id}/restyle`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          style_preset: config.style_preset,
          style_ass: config.style_ass,
          overlays_config: config.overlays_config,
          font_size: config.font_size,
          outline_size: config.outline_size,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Restyle failed')
      toast.success('✅ Clip restyled', { description: `New style: ${config.style_preset}` })
      // refresh the clips list so the new MP4 reloads (cache-bust query)
      const fresh = await fetch('/api/clips').then(r => r.json())
      setClips(fresh)
    } catch (e) { toast.error('Restyle failed', { description: e.message }) }
  }

  // ===== ACTUAL BACKEND SUBMISSIONS =====
  async function submitIngest({ url }, wizardConfig) {
    setIsIngesting(true)
    setProcessing({ status: 'queued', progress: 0 })
    try {
      const { clip_min, clip_max } = getClipRange()
      const r = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          url, clip_min, clip_max, add_captions: burnCaptions,
          language: wizardConfig?.language || 'auto',
          style_preset: wizardConfig?.style_preset,
          style_ass: wizardConfig?.style_ass,
          overlays_config: wizardConfig?.overlays_config,
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'AI failed')
      const videoId = data.video_id
      toast.info('Processing started — downloading, transcribing, then cutting with FFmpeg', { description: 'This usually takes 1–3 minutes for short videos.' })

      const startTs = Date.now()
      while (Date.now() - startTs < 8 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 2500))
        const sr = await fetch(`/api/videos/${videoId}`)
        const sd = await sr.json()
        setProcessing({ status: sd.status, progress: sd.progress || 0, title: sd.title })
        if (sd.status === 'completed') {
          toast.success(`✅ ${sd.clip_count || sd.clips?.length || 0} clips ready! (${sd.credits_charged || 0} credits used)`, { description: `From: ${sd.title || url.slice(0,50)}` })
          const [fresh, me] = await Promise.all([
            fetch('/api/clips').then(r => r.json()),
            fetch('/api/auth/me').then(r => r.json()),
          ])
          setClips(fresh); setProfile(me.user)
          setUrlInput('')
          break
        }
        if (sd.status === 'failed') {
          toast.error('Processing failed', { description: sd.error_message || 'unknown error' })
          break
        }
      }
    } catch (e) { toast.error('Ingestion failed', { description: e.message }) }
    finally { setIsIngesting(false); setTimeout(()=>setProcessing(null), 3000) }
  }

  async function submitFile(file, wizardConfig) {
    setIsIngesting(true)
    setProcessing({ status: 'uploading', progress: 0 })
    try {
      const { clip_min, clip_max } = getClipRange()
      const form = new FormData()
      form.append('file', file)
      form.append('kind', 'workspace_video')
      form.append('clip_min', String(clip_min))
      form.append('clip_max', String(clip_max))
      form.append('add_captions', String(burnCaptions))
      if (wizardConfig?.language)        form.append('language', wizardConfig.language)
      if (wizardConfig?.style_preset)    form.append('style_preset', wizardConfig.style_preset)
      if (wizardConfig?.style_ass)       form.append('style_ass', JSON.stringify(wizardConfig.style_ass))
      if (wizardConfig?.overlays_config) form.append('overlays_config', JSON.stringify(wizardConfig.overlays_config))
      toast.info(`Uploading ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)…`)
      const r = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Upload failed')
      const videoId = data.video_id
      const startTs = Date.now()
      while (Date.now() - startTs < 10 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 2500))
        const sr = await fetch(`/api/videos/${videoId}`)
        const sd = await sr.json()
        setProcessing({ status: sd.status, progress: sd.progress || 0, title: sd.title })
        if (sd.status === 'completed') {
          toast.success(`✅ ${sd.clip_count || sd.clips?.length || 0} clips ready! (${sd.credits_charged || 0} credits used)`, { description: `From: ${sd.title}` })
          const [fresh, me] = await Promise.all([
            fetch('/api/clips').then(r => r.json()),
            fetch('/api/auth/me').then(r => r.json()),
          ])
          setClips(fresh); setProfile(me.user)
          break
        }
        if (sd.status === 'failed') {
          toast.error('Processing failed', { description: sd.error_message?.slice(0,200) })
          break
        }
      }
    } catch (e) { toast.error('Upload failed', { description: e.message }) }
    finally { setIsIngesting(false); setTimeout(()=>setProcessing(null), 3000) }
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
            <Link href="/calendar" className="hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Calendar
            </Link>
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

                {/* CLIP LENGTH + CAPTIONS controls */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Scissors className="h-3.5 w-3.5 text-primary" /> Clip Length
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: '10-30', label: '10–30s', sub: 'TikTok hooks' },
                        { value: '30-60', label: '30–60s', sub: 'Shorts / Reels' },
                        { value: '60-90', label: '60–90s', sub: 'Long-form' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setClipLengthPreset(opt.value)}
                          className={`rounded-lg border px-3 py-2 text-left transition-all ${clipLengthPreset === opt.value ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border bg-background hover:border-primary/50'}`}
                        >
                          <div className="text-sm font-semibold">{opt.label}</div>
                          <div className="text-[10px] text-muted-foreground">{opt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <Captions className="h-3.5 w-3.5 text-primary" /> Burn captions into clips
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Auto-generated by Whisper, baked into the video for TikTok / Reels.</p>
                    </div>
                    <Switch checked={burnCaptions} onCheckedChange={setBurnCaptions} />
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Coins className="h-3 w-3" />
                    Cost: <span className="font-semibold text-foreground">1 credit per minute</span> of source video.
                    You have <span className="font-semibold text-primary">{profile?.credit_balance_minutes ?? 0} credits</span>.
                  </div>
                </div>

                {/* PROCESSING PROGRESS */}
                {processing && (
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        {processing.status === 'queued' && 'Queued for processing\u2026'}
                        {processing.status === 'downloading' && 'Downloading video via yt-dlp\u2026'}
                        {processing.status === 'downloaded' && 'Download complete'}
                        {processing.status === 'transcribing' && 'Parsing auto-captions\u2026'}
                        {processing.status === 'analyzing' && 'AI analyzing transcript for viral moments\u2026'}
                        {processing.status === 'cutting' && 'FFmpeg cutting clips\u2026'}
                        {processing.status === 'completed' && '\u2705 Clips ready below!'}
                        {processing.status === 'failed' && '\u274c Processing failed'}
                      </div>
                      <Badge variant="secondary">{processing.progress}%</Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-bg transition-all duration-500" style={{ width: `${processing.progress}%` }} />
                    </div>
                    {processing.title && <div className="text-xs text-muted-foreground truncate">{processing.title}</div>}
                  </div>
                )}

                <div
                  onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}}
                  onDragLeave={()=>setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={()=>document.getElementById('workspace-file-input')?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'}`}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">Drop a video here, or click to choose</div>
                  <div className="text-xs text-muted-foreground">MP4, MOV, WebM — the AI will transcribe & cut viral clips with FFmpeg</div>
                  <input id="workspace-file-input" type="file" accept="video/*" className="hidden" onChange={(e)=>handleFileUpload(e.target.files?.[0])} />
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
                  <ClipCard key={clip.id} clip={clip} memes={memes} t={t} onUpdate={(c)=> setClips(prev => prev.map(x => x.id === c.id ? c : x))} onRestyle={(c) => {
                    setWizardPayload({ type: 'file', title: c.clip_title, fileBlobUrl: c.storage_url_mp4, duration: c.end_time_seconds - c.start_time_seconds })
                    setPendingSubmit(() => (config) => submitRestyle(c, config))
                    setWizardInitialConfig({ style_preset: c.style_preset, overlays_config: c.overlays_config, language: c.language || 'auto', font_size: c.style_ass?.fontSize, outline_size: c.style_ass?.outline })
                    setWizardMode('restyle')
                    setWizardOpen(true)
                  }} />
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
                    style={{ fontFamily: fontObj.css, fontWeight: fontObj.weight, fontSize: `${fontSize[0]}px`, WebkitTextStroke: `${strokeWidth[0]}px ${strokeColor}`, textShadow: `0 0 8px ${strokeColor}55` }}>
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
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><AArrowUp className="h-3.5 w-3.5" /> Font size</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{fontSize[0]}px</span>
                  </div>
                  <Slider min={10} max={48} step={1} value={fontSize} onValueChange={setFontSize} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Stroke width</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{strokeWidth[0]}px</span>
                  </div>
                  <Slider min={0} max={6} step={0.5} value={strokeWidth} onValueChange={setStrokeWidth} />
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

              {/* Coupon input */}
              <div className="flex gap-2 items-end pt-1">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Have a coupon code?</Label>
                  <Input value={couponCode} onChange={(e)=>setCouponCode(e.target.value.toUpperCase())} placeholder="LAUNCH25" className="font-mono uppercase h-9" />
                </div>
                <Button variant="outline" onClick={validateCoupon} disabled={validatingCoupon} className="h-9">
                  {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                </Button>
                {couponData?.valid && (
                  <Button variant="ghost" size="sm" onClick={() => { setCouponData(null); setCouponCode('') }} className="h-9 text-destructive">Remove</Button>
                )}
              </div>

              {dynamicPrice && selectedPack && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                  <div>
                    <div className="text-sm text-muted-foreground">{t.closest_plan} <span className="font-medium text-foreground">{selectedPack.name}</span></div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold">{dynamicPrice.formatted}<span className="text-sm text-muted-foreground font-normal">/{billingCycle === 'year' ? 'year' : 'mo'}</span></div>
                      {dynamicPrice.couponDiscount > 0 && <span className="text-sm text-muted-foreground line-through">{dynamicPrice.original}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPack.discount_percentage > 0 && <Badge className="bg-emerald-500/15 text-emerald-500 border-transparent">{t.save} {selectedPack.discount_percentage}%</Badge>}
                      {dynamicPrice.couponDiscount > 0 && <Badge className="gradient-bg text-white border-transparent">+{dynamicPrice.couponDiscount}% coupon</Badge>}
                    </div>
                  </div>
                  <Button size="lg" disabled={purchasing === selectedPack.id} className="gradient-bg text-white hover:opacity-90" onClick={() => handleBuy(selectedPack)}>
                    {purchasing === selectedPack.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {t.buy} {selectedPack.name}
                  </Button>
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
                    <Button onClick={() => handleBuy(pkg)} disabled={purchasing === pkg.id} className={`w-full ${pkg.is_featured ? 'gradient-bg text-white' : ''}`} variant={pkg.is_featured ? 'default' : 'outline'}>
                      {purchasing === pkg.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      {isIndia ? 'Pay via Razorpay' : 'Pay via Lemon Squeezy'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card/30">
        <div className="container py-10">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg"><Sparkles className="h-4 w-4 text-white" /></div>
                <span className="font-bold">ClipForge<span className="gradient-text">AI</span></span>
              </div>
              <p className="text-xs text-muted-foreground">Turn long videos into viral shorts with AI. Trusted by 50k+ creators.</p>
            </div>
            <div>
              <div className="font-semibold mb-3 text-xs uppercase text-muted-foreground tracking-wide">Product</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#workspace" className="hover:text-foreground">Workspace</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link href="/calendar" className="hover:text-foreground">Calendar</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-3 text-xs uppercase text-muted-foreground tracking-wide">Account</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
                <li><Link href="/signup" className="hover:text-foreground">Sign up</Link></li>
                <li><Link href="/admin" className="hover:text-foreground">Admin</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-3 text-xs uppercase text-muted-foreground tracking-wide">Legal</div>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/refund" className="hover:text-foreground">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
          <Separator className="my-6" />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>© 2025 ClipForge AI — Built for creators.</div>
            <div>Made with Gemini AI 3.5 Flash</div>
          </div>
        </div>
      </footer>

      {/* STYLE WIZARD MODAL */}
      <StyleWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); if (wizardPayload?.fileBlobUrl) URL.revokeObjectURL(wizardPayload.fileBlobUrl); setWizardPayload(null); setPendingSubmit(null) }}
        onComplete={handleWizardComplete}
        payload={wizardPayload}
      />
    </div>
  )
}

function ClipCard({ clip, memes, t, onUpdate, onRestyle }) {
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

  function download() {
    if (clip.storage_url_mp4 && clip.storage_url_mp4.startsWith('/api/files/')) {
      // Use the dedicated /download endpoint which sets Content-Disposition: attachment
      // so the browser actually downloads instead of opening the MP4 inline.
      const a = document.createElement('a')
      a.href = `/api/clips/${clip.id}/download`
      a.download = `${clip.clip_title.replace(/[^a-z0-9]+/gi, '_')}.mp4`
      document.body.appendChild(a); a.click(); a.remove()
      toast.success('Downloading MP4', { description: clip.clip_title })
    } else {
      toast.error('This clip has no rendered MP4 yet', { description: 'Use a YouTube URL in the workspace to generate a real clip.' })
    }
  }

  async function downloadFromR2() {
    try {
      let signedUrl = null
      if (clip.r2_key) {
        const r = await fetch(`/api/clips/${clip.id}/signed-url`).then(r => r.json())
        signedUrl = r?.signed_url
      } else {
        toast.info('Uploading to Cloudflare R2 (CDN)…')
        const r = await fetch(`/api/clips/${clip.id}/upload-to-r2`, { method: 'POST' }).then(r => r.json())
        if (!r.ok) throw new Error(r.error || 'R2 upload failed')
        signedUrl = r.signed_url
        toast.success(`Uploaded ${(r.size / 1024 / 1024).toFixed(1)} MB to R2 — link valid 7 days`)
      }
      if (signedUrl) {
        const a = document.createElement('a')
        a.href = signedUrl; a.target = '_blank'; a.rel = 'noopener'
        a.download = `${clip.clip_title.replace(/[^a-z0-9]+/gi, '_')}.mp4`
        document.body.appendChild(a); a.click(); a.remove()
      }
    } catch (e) { toast.error('R2 download failed', { description: e.message }) }
  }

  function openRestyleWizard() {
    if (typeof onRestyle === 'function') onRestyle(clip)
  }

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
        <div className="flex gap-1">
          <CaptionsButton clip={clip} onUpdate={onUpdate} />
          <TrimCropButton clip={clip} onUpdate={onUpdate} />
          <PreviewButton clip={clip} memes={memes} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={download} disabled={!clip.storage_url_mp4?.startsWith('/api/files/')}>
            <Download className="h-3.5 w-3.5 mr-1" /> {clip.trim_applied_at ? 'Trimmed MP4' : 'MP4'}
          </Button>
          <Button
            size="sm"
            variant={clip.r2_key ? 'default' : 'outline'}
            className={`flex-1 ${clip.r2_key ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
            onClick={downloadFromR2}
            disabled={!clip.storage_url_mp4?.startsWith('/api/files/')}
            title={clip.r2_key ? 'Get a fresh signed CDN URL (1h) — already on R2' : 'Upload to Cloudflare R2 CDN and get a 7-day shareable signed URL'}
          >
            <Cloud className="h-3.5 w-3.5 mr-1" /> {clip.r2_key ? 'CDN Link' : 'Upload to R2'}
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

function CaptionsButton({ clip, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captions, setCaptions] = useState(clip.captions || [])

  async function generate() {
    setLoading(true)
    try {
      const r = await fetch('/api/ai/captions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clip_id: clip.id, language: clip.subtitle_language || 'en' })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'failed')
      onUpdate(data); setCaptions(data.captions || [])
      toast.success(`Generated ${data.captions?.length || 0} captions`)
    } catch (e) { toast.error('Caption generation failed', { description: e.message }) }
    finally { setLoading(false) }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 h-8 px-2 text-xs gap-1">
          <Captions className="h-3.5 w-3.5" /> CC
          {(clip.captions?.length || 0) > 0 && <Badge className="bg-emerald-500/15 text-emerald-600 border-transparent h-4 px-1 text-[10px] ml-0.5">{clip.captions.length}</Badge>}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Auto-captions for “{clip.clip_title}”</DrawerTitle>
            <DrawerDescription>AI-generated timestamped subtitles in {clip.subtitle_language || 'en'}.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            {captions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                <Captions className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-sm font-medium">No captions yet</div>
                <p className="text-xs text-muted-foreground mt-1">Generate AI captions using Gemini in seconds.</p>
              </div>
            ) : (
              <ScrollArea className="h-72 rounded-md border">
                <div className="divide-y">
                  {captions.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2">
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0 mt-0.5">{c.start_time?.toFixed(1)}s</span>
                      <span className="text-sm flex-1">{c.text}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DrawerFooter>
            <Button onClick={generate} disabled={loading} className="gradient-bg text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {captions.length > 0 ? 'Regenerate captions' : 'Generate captions with AI'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function TrimCropButton({ clip, onUpdate }) {
  const [open, setOpen] = useState(false)
  const duration = clip.end_time_seconds - clip.start_time_seconds
  const initialTrim = [
    clip.trim_start ?? 0,
    clip.trim_end ?? duration,
  ]
  const [trim, setTrim] = useState(initialTrim)
  const [aspect, setAspect] = useState(clip.crop_aspect || '9:16')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      // POST /apply-trim actually re-renders the MP4 with new bounds + crop (not just metadata)
      const r = await fetch(`/api/clips/${clip.id}/apply-trim`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trim_start: trim[0], trim_end: trim[1], crop_aspect: aspect })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Trim failed')
      onUpdate(data.clip)
      toast.success('✂️ Trim applied to MP4', { description: `${(trim[1] - trim[0]).toFixed(1)}s @ ${aspect} — re-downloads will get the trimmed file.` })
      setOpen(false)
    } catch (e) { toast.error('Trim failed', { description: e.message }) }
    finally { setSaving(false) }
  }

  const trimmedDuration = (trim[1] - trim[0]).toFixed(1)
  const aspectMeta = CROP_ASPECTS.find(a => a.value === aspect) || CROP_ASPECTS[0]

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 h-8 px-2 text-xs gap-1">
          <Scissors className="h-3.5 w-3.5" /> Trim
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Trim & Crop “{clip.clip_title}”</DrawerTitle>
            <DrawerDescription>Drag the handles to set the in/out points; pick an aspect ratio for the final crop.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-6">
            {/* Trim slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label className="flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5" /> Trim</Label>
                <span className="text-xs text-muted-foreground tabular-nums">{trim[0].toFixed(1)}s → {trim[1].toFixed(1)}s <span className="ml-1 text-primary font-medium">({trimmedDuration}s final)</span></span>
              </div>
              <Slider min={0} max={duration} step={0.1} value={trim} onValueChange={setTrim} minStepsBetweenThumbs={1} />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono"><span>0:00</span><span>{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,'0')}</span></div>
            </div>

            {/* Crop aspect */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Crop className="h-3.5 w-3.5" /> Crop aspect ratio</Label>
              <div className="grid grid-cols-4 gap-2">
                {CROP_ASPECTS.map(a => (
                  <button key={a.value} onClick={() => setAspect(a.value)}
                    className={`relative rounded-lg border-2 p-3 flex flex-col items-center gap-2 transition-colors ${aspect === a.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                    <div className={`${a.tw} w-12 bg-muted-foreground/30 rounded-sm`} />
                    <div className="text-[10px] font-medium">{a.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview frame */}
            <div className="flex items-center justify-center bg-zinc-950 rounded-lg p-4">
              <div className={`${aspectMeta.tw} max-h-48 max-w-full relative overflow-hidden rounded-md border border-border`} style={{aspectRatio: aspect.replace(':','/')}}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-semibold uppercase text-center">{aspectMeta.label}</div>
              </div>
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Save trim & crop
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function PreviewButton({ clip, memes }) {
  const [open, setOpen] = useState(false)
  const aspect = clip.crop_aspect || '9:16'
  const aspectMeta = CROP_ASPECTS.find(a => a.value === aspect) || CROP_ASPECTS[0]
  const isRealClip = clip.storage_url_mp4 && clip.storage_url_mp4.startsWith('/api/files/')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" className="flex-1 h-8 px-2 text-xs gap-1" onClick={()=>setOpen(true)}>
        <Play className="h-3.5 w-3.5" /> Preview
      </Button>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-zinc-950 border-border">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            {clip.clip_title}
            {isRealClip && <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent text-[10px]">REAL MP4</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            {clip.end_time_seconds - clip.start_time_seconds}s · {aspect} · virality {clip.virality_score}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center px-4 pb-4">
          <div className="relative max-h-[60vh] overflow-hidden rounded-lg border border-zinc-800" style={{aspectRatio: aspect.replace(':','/'), width: aspect === '16:9' ? '100%' : aspect === '1:1' ? '60%' : '45%'}}>
            {isRealClip ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={clip.storage_url_mp4} controls autoPlay className="absolute inset-0 h-full w-full object-cover bg-black" />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clip.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/60 text-center p-4">
                  No rendered MP4 for this demo clip.<br/>Paste a YouTube URL to generate real ones.
                </div>
              </>
            )}
            <Badge className="absolute top-3 left-3 bg-emerald-500 text-white border-transparent gap-1 z-10"><Flame className="h-3 w-3" /> {clip.virality_score}</Badge>
          </div>
        </div>
        {clip.ai_rationale && (
          <div className="px-4 pb-4 text-xs text-zinc-400 italic">
            "<span className="text-zinc-300">{clip.ai_rationale}</span>"
          </div>
        )}
      </DialogContent>
    </Dialog>
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
