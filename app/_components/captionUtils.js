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

// Build a CSS style object that visually approximates ASS subtitle rendering.
// Used by the live caption overlay during preview so what-you-see-IS-what-renders.
export function styleAssToCss({ styleAss, fontSize, outlineSize, frameWidth = 360 }) {
  const ass = styleAss || {}
  const fontFamily = ass.fontName || 'DejaVu Sans'
  const color = assToCss(ass.primary) || '#ffffff'
  const stroke = assToCss(ass.outlineColour) || '#000000'
  const back = ass.back ? assToCss(ass.back) : null
  const bold = ass.bold ? 800 : 400
  // The actual font size during render is in ASS points relative to original_size.
  // Scale roughly: 1 ass point ≈ frameWidth/40 px. Use a sensible multiplier so preview matches output.
  const px = Math.max(10, Math.round((Number(fontSize) || ass.fontSize || 20) * (frameWidth / 540)))
  const outlinePx = Math.max(0, Math.round((Number(outlineSize) || ass.outline || 2)))
  const stroked = outlinePx > 0 ? {
    // Sharp outlines only — no blurred drop-shadow. Eight directions for clean stroke effect.
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
    padding: back ? '4px 10px' : '0',
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
