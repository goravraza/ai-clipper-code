'use client'

// SiteChrome fetches /api/site-settings on mount and injects:
//  - Announcement bar at the top of every page (dismissable via localStorage)
//  - Dynamic CSS variables for --primary and --accent (from site_settings.primary_color / .accent_color)
//  - Admin-injected header code (into a client-safe wrapper)
//  - Admin-injected footer code (into a client-safe wrapper)
// Placed inside the RootLayout so it wraps every page.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

function hexToHsl(hex) {
  // tailwind/shadcn tokens are `H S% L%` triples. Best-effort conversion for user-supplied hex.
  if (!hex || typeof hex !== 'string') return null
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export default function SiteChrome() {
  const [settings, setSettings] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/site-settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d) }).catch(() => {/* offline */})
    try { if (localStorage.getItem('anncmt_dismissed') === '1') setDismissed(true) } catch { /* ssr */ }
  }, [])

  // Inject dynamic CSS variables so admin-chosen colors override our theme.
  useEffect(() => {
    if (!settings) return
    const p = hexToHsl(settings.primary_color)
    const a = hexToHsl(settings.accent_color)
    const root = document.documentElement
    if (p) { root.style.setProperty('--primary', p); root.style.setProperty('--ring', p) }
    if (a) { root.style.setProperty('--accent', a) }
    if (settings.favicon_url) {
      let link = document.querySelector('link[rel="icon"]')
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = settings.favicon_url
    }
    if (settings.meta_title) document.title = settings.meta_title
  }, [settings])

  // Inject arbitrary header code (GTM, analytics, etc.)
  useEffect(() => {
    if (!settings?.header_code) return
    const wrap = document.createElement('div')
    wrap.id = 'site-header-code'
    wrap.innerHTML = settings.header_code
    // Also execute any <script> tags (innerHTML doesn't run them)
    wrap.querySelectorAll('script').forEach(orig => {
      const s = document.createElement('script')
      for (const attr of orig.attributes) s.setAttribute(attr.name, attr.value)
      s.text = orig.textContent || ''
      document.head.appendChild(s)
    })
    return () => { try { wrap.remove() } catch { /* already gone */ } }
  }, [settings?.header_code])

  // Inject arbitrary footer code (Tidio chat widget, etc.)
  useEffect(() => {
    if (!settings?.footer_code) return
    const wrap = document.createElement('div')
    wrap.id = 'site-footer-code'
    wrap.innerHTML = settings.footer_code
    document.body.appendChild(wrap)
    wrap.querySelectorAll('script').forEach(orig => {
      const s = document.createElement('script')
      for (const attr of orig.attributes) s.setAttribute(attr.name, attr.value)
      s.text = orig.textContent || ''
      document.body.appendChild(s)
    })
    return () => { try { wrap.remove() } catch { /* already gone */ } }
  }, [settings?.footer_code])

  if (!settings || !settings.announcement_enabled || !settings.announcement_text || dismissed) return null

  const bg = settings.announcement_bg || '#a855f7'
  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('anncmt_dismissed', '1') } catch {}
  }

  const linkEl = settings.announcement_link ? (
    <Link href={settings.announcement_link} className="underline underline-offset-4 hover:opacity-80 font-semibold whitespace-nowrap">
      {settings.announcement_link_label || 'Learn more'}
    </Link>
  ) : null

  return (
    <div className="relative w-full text-white text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-3 z-40" style={{ background: bg }}>
      <span className="text-center">{settings.announcement_text}</span>
      {linkEl}
      {settings.announcement_dismissable && (
        <button onClick={dismiss} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
