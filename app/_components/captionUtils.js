'use client'

// Helper: convert ASS color tokens (&HAABBGGRR&) to CSS hex / rgba
export function assToCss(c) {
  if (!c) return null
  const m = String(c).replace(/&H|&/g, '')
  if (m.length < 6) return null
  const hex6 = m.slice(-6)
  const r = hex6.slice(4, 6); const g = hex6.slice(2, 4); const b = hex6.slice(0, 2)
  return `#${r}${g}${b}`
}

// Convert a CSS hex color (#RRGGBB or #RGB) to the ASS Style-row format `&HAABBGGRR&`.
// Alpha byte is fixed at 00 (fully opaque) — the AA field only matters when the user overrides transparency.
// Returns null for invalid input so callers can fall back to defaults.
export function cssHexToAss(hex) {
  if (!hex) return null
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')  // #RGB → RRGGBB
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const r = h.slice(0, 2).toUpperCase()
  const g = h.slice(2, 4).toUpperCase()
  const b = h.slice(4, 6).toUpperCase()
  return `&H00${b}${g}${r}&`
}

// Build a CSS style object that visually approximates ASS subtitle rendering.
// Used by the live caption overlay during preview so what-you-see-IS-what-renders.
//
// IMPORTANT — pixel-size math:
// At render time we write a real .ass file with PlayResY = output frame height (e.g. 1920 for 9:16).
// The user-facing `fontSize` value (10..48) is treated as "ASS points in default 288-tall PlayResY",
// so the rendered pixel height = fontSize * (outputFrameH / 288).
// For the preview to be pixel-proportional we use the SAME ratio scaled to the preview box:
//   previewPx = fontSize * (previewBoxHeight / 288)
// This makes the preview WYSIWYG with the final render output.
export function styleAssToCss({ styleAss, fontSize, outlineSize, previewBoxHeight = 462, frameWidth, fontFamilyOverride, colorOverride, strokeOverride }) {
  // Back-compat: if caller still passes `frameWidth` (old signature) use a fallback height.
  const refH = previewBoxHeight || (frameWidth ? Math.round(frameWidth * 16 / 9) : 462)
  const ass = styleAss || {}
  const fontFamily = fontFamilyOverride || ass.fontName || 'DejaVu Sans'
  const color = colorOverride || assToCss(ass.primary) || '#ffffff'
  const stroke = strokeOverride || assToCss(ass.outlineColour) || '#000000'
  const back = ass.back ? assToCss(ass.back) : null
  const bold = ass.bold ? 800 : 400
  // Match render: previewPx = fontSize * (previewBoxHeight / 288)
  const px = Math.max(8, Math.round((Number(fontSize) || ass.fontSize || 20) * (refH / 288)))
  // Outline scales by the same ratio (capped so it doesn't dominate at small fonts)
  const outlinePx = Math.max(0, Math.min(8, Math.round((Number(outlineSize) || ass.outline || 2) * (refH / 288) / 2)))
  const stroked = outlinePx > 0 ? {
    // Sharp outlines only — eight directions for clean stroke effect.
    textShadow: [
      `-${outlinePx}px -${outlinePx}px 0 ${stroke}`,
      `${outlinePx}px -${outlinePx}px 0 ${stroke}`,
      `-${outlinePx}px ${outlinePx}px 0 ${stroke}`,
      `${outlinePx}px ${outlinePx}px 0 ${stroke}`,
      `0 -${outlinePx}px 0 ${stroke}`,
      `0 ${outlinePx}px 0 ${stroke}`,
      `-${outlinePx}px 0 0 ${stroke}`,
      `${outlinePx}px 0 0 ${stroke}`,
    ].join(', '),
  } : {}
  return {
    fontFamily,
    color,
    fontWeight: bold,
    fontSize: `${px}px`,
    background: back || 'transparent',
    padding: back ? `${Math.round(px * 0.15)}px ${Math.round(px * 0.4)}px` : '0',
    borderRadius: back ? '4px' : 0,
    lineHeight: 1.15,
    display: 'inline-block',
    ...stroked,
  }
}

// Split a long text into ≤ N words per line using \n; mirrors backend chunking.
export function chunkForLine(text, maxWordsPerLine = 4) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWordsPerLine) return words.join(' ')
  const half = Math.ceil(words.length / 2)
  return words.slice(0, half).join(' ') + '\n' + words.slice(half).join(' ')
}

// Find the caption segment whose [start, end] contains the current playback time `t`.
// Returns { idx, segment } or { idx: -1, segment: null }.
export function findActiveCue(segments, t) {
  if (!Array.isArray(segments) || segments.length === 0) return { idx: -1, segment: null }
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (t >= (s.start ?? 0) && t < (s.end ?? 0)) return { idx: i, segment: s }
  }
  return { idx: -1, segment: null }
}
