// Real video processing pipeline using RapidAPI YouTube downloader + ffmpeg + OpenAI Whisper + caption burn-in
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const execFileP = promisify(execFile)
const UPLOAD_DIR = '/app/data/uploads'
const ORIGINALS_DIR = path.join(UPLOAD_DIR, 'originals')
const CLIPS_DIR = path.join(UPLOAD_DIR, 'clips')

const YT_DLP = process.env.YT_DLP_PATH || '/root/.venv/bin/yt-dlp'
const FFMPEG = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || '/usr/bin/ffprobe'
const DENO_PATH = process.env.DENO_PATH || '/root/.deno/bin/deno'
const RAPIDAPI_YT_KEY_ENV = process.env.RAPIDAPI_YT_KEY
const RAPIDAPI_YT_HOST_ENV = process.env.RAPIDAPI_YT_HOST || 'youtube-media-downloader.p.rapidapi.com'

// Read provider creds from DB integration_credentials (preferred over env)
async function getIntegration(db, provider) {
  if (!db) return null
  try { return await db.collection('integration_credentials').findOne({ provider, is_active: { $ne: false } }) } catch { return null }
}
async function getProxyUrl(db) {
  const integ = await getIntegration(db, 'http_proxy')
  const raw = integ?.credentials?.proxy_url || process.env.HTTP_PROXY_URL || null
  return normalizeProxyUrl(raw)
}

// Accepts either:
//   http://host:port:user:pass            (Thordata's default format)
//   host:port:user:pass                   (no scheme)
//   http://user:pass@host:port            (already standard — returned as-is)
// Returns: standard "http://user:pass@host:port" or null.
function normalizeProxyUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  let s = raw.trim()
  // Already standard if it contains @ before the host
  if (/^https?:\/\/[^/]*@/.test(s)) return s
  // Strip scheme if present so we can split cleanly
  const schemeMatch = s.match(/^(https?:\/\/)/i)
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : 'http://'
  if (schemeMatch) s = s.slice(schemeMatch[0].length)
  // Already standard "user:pass@host:port" without scheme
  if (s.includes('@')) return scheme + s
  // Now expect "host:port:user:pass" — split on first 2 colons for host:port
  const parts = s.split(':')
  if (parts.length >= 4) {
    const host = parts[0]
    const port = parts[1]
    const user = parts[2]
    const pass = parts.slice(3).join(':') // pass might contain colons
    if (host && port && user && pass) {
      return `${scheme}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`
    }
  }
  // Fallback: return as-is (might be "host:port" — no auth)
  return scheme + s
}
async function getRapidApi(db) {
  const integ = await getIntegration(db, 'rapidapi_yt')
  return {
    key: integ?.credentials?.api_key || RAPIDAPI_YT_KEY_ENV,
    host: integ?.credentials?.host || RAPIDAPI_YT_HOST_ENV,
  }
}

// Returns a path to a temporary cookies.txt file, or null if no cookies stored.
async function getCookiesFile(db) {
  const integ = await getIntegration(db, 'youtube_cookies')
  const text = integ?.credentials?.cookies_text
  if (!text || text.length < 50) return null
  const cookieDir = '/app/data/cookies'
  await fs.mkdir(cookieDir, { recursive: true })
  const filePath = path.join(cookieDir, 'yt.txt')
  await fs.writeFile(filePath, text, 'utf-8')
  return filePath
}

async function ensureDirs() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true })
  await fs.mkdir(CLIPS_DIR, { recursive: true })
}
async function fileExists(p) { try { await fs.access(p); return true } catch { return false } }

function runCmd(cmd, args, { timeout = 240000, cwd, env, capture = true } = {}) {
  return new Promise((resolve, reject) => {
    let proc
    try { proc = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env }) } catch (e) { return reject(new Error(`spawn ${cmd} failed: ${e.message}`)) }
    let stdout = '', stderr = ''
    const t = setTimeout(() => { try { proc.kill('SIGKILL') } catch {}; reject(new Error(`${cmd} timeout after ${timeout / 1000}s`)) }, timeout)
    if (capture) {
      proc.stdout.on('data', d => { stdout += d.toString() })
      proc.stderr.on('data', d => { stderr += d.toString() })
    }
    proc.on('error', err => { clearTimeout(t); reject(new Error(`${cmd} spawn error: ${err.message}`)) })
    proc.on('close', code => { clearTimeout(t); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`)) })
  })
}

// ============================================================================
// NEW YT-DLP + FFMPEG SEGMENT-FETCH ARCHITECTURE
// ============================================================================

// Step 1: get metadata + auto-captions URL without downloading any video bytes
async function fetchYouTubeMetadata(url, proxyUrl, cookiesFile) {
  const args = ['--dump-single-json', '--skip-download', '--no-warnings']
  if (cookiesFile) args.push('--cookies', cookiesFile)
  if (proxyUrl) args.push(`--proxy=${proxyUrl}`)
  args.push(url)
  const env = { PATH: `/root/.deno/bin:${process.env.PATH || ''}` }
  const { stdout } = await runCmd(YT_DLP, args, { timeout: 30000, env })
  return JSON.parse(stdout)
}

// Step 2: get a directly-fetchable stream URL signed for our outbound IP
// Tries multiple resolutions (1080 → 720 → 480 → best) so we always get something.
async function extractStreamUrl(url, proxyUrl, cookiesFile, { audioOnly = false, maxHeight = 720 } = {}) {
  const fmtChain = audioOnly
    ? 'bestaudio[ext=m4a]/bestaudio'
    : [
        `best[height<=${maxHeight}][ext=mp4]`,
        `best[height<=${maxHeight}]`,
        `best[height<=480][ext=mp4]`,
        `best[height<=480]`,
        `best[ext=mp4]`,
        `best`,
      ].join('/')
  const args = ['-g', '-f', fmtChain, '--no-warnings']
  if (cookiesFile) args.push('--cookies', cookiesFile)
  if (proxyUrl) args.push(`--proxy=${proxyUrl}`)
  args.push(url)
  const env = { PATH: `/root/.deno/bin:${process.env.PATH || ''}` }
  const { stdout } = await runCmd(YT_DLP, args, { timeout: 30000, env })
  const lines = stdout.split('\n').filter(Boolean)
  return lines[0]
}

// Step 3: fetch a single trimmed segment — uses yt-dlp's --download-sections (handles proxy redirects properly)
// Includes retry logic since residential proxies can rotate to blocked exit nodes between calls.
async function fetchYouTubeSegment(url, startSec, endSec, outPath, proxyUrl, cookiesFile, maxHeight = 1080) {
  const start = Math.max(0, Math.floor(startSec))
  const end = Math.max(start + 1, Math.ceil(endSec))
  const fmt = `best[height<=${maxHeight}]/best`
  let lastErr = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const args = [
        '-f', fmt,
        '--no-playlist', '--no-warnings', '--no-check-formats',
        '--download-sections', `*${start}-${end}`,
        '--force-keyframes-at-cuts',
        '--ffmpeg-location', '/usr/bin',
        '--retries', '5', '--fragment-retries', '5',
        '--socket-timeout', '30',
        '-o', outPath,
      ]
      if (cookiesFile) args.push('--cookies', cookiesFile)
      if (proxyUrl) args.push(`--proxy=${proxyUrl}`)
      args.push(url)
      console.log(`[ytseg attempt ${attempt}/5] ${YT_DLP} ${args.slice(-3).join(' ')}`)
      const env = { PATH: `/root/.deno/bin:/root/.venv/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` }
      await runCmd(YT_DLP, args, { timeout: 240000, env })
      try { const st = await fs.stat(outPath); if (st.size > 1024) { console.log(`[ytseg attempt ${attempt}] SUCCESS — ${st.size} bytes`); return } } catch {}
      throw new Error('downloaded file too small')
    } catch (e) {
      lastErr = e
      console.warn(`[ytseg attempt ${attempt}/5] failed: ${e.message.slice(0,200)}`)
      try { await fs.unlink(outPath) } catch {}
      if (attempt < 5) await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))
    }
  }
  throw lastErr
}

// Step 3b: legacy ffmpeg-based segment fetch (kept for non-YouTube stream URLs)
async function fetchSegmentViaFfmpeg(streamUrl, startSec, endSec, outPath, proxyUrl, cookiesHeader = null) {
  const args = ['-y']
  if (proxyUrl) args.push('-http_proxy', proxyUrl)
  if (cookiesHeader) args.push('-cookies', cookiesHeader)
  args.push(
    '-ss', String(startSec),
    '-to', String(endSec),
    '-i', streamUrl,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outPath,
  )
  const env = { http_proxy: proxyUrl || '', https_proxy: proxyUrl || '' }
  await runCmd(FFMPEG, args, { timeout: 180000, env })
}

// Helper — fetch audio-only stream into a small mp3 for Whisper
async function fetchAudioForTranscription(streamUrl, outPath, proxyUrl) {
  const args = ['-y']
  if (proxyUrl) args.push('-http_proxy', proxyUrl)
  args.push('-i', streamUrl, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-f', 'mp3', outPath)
  const env = { http_proxy: proxyUrl || '', https_proxy: proxyUrl || '' }
  await runCmd(FFMPEG, args, { timeout: 180000, env })
}

// NEW: fetch the FULL video (not just a segment) — for "Download Full Video" feature
// Includes retry logic since residential proxy nodes can rotate.
export async function fetchFullVideoFromYouTube({ url, outDir, db, maxHeight = 720 }) {
  await fs.mkdir(outDir, { recursive: true })
  const proxyUrl = await getProxyUrl(db)
  const cookiesFile = await getCookiesFile(db)
  const outTemplate = path.join(outDir, 'full.%(ext)s')
  let lastErr = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const args = [
        '-f', `best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]/best[ext=mp4]/best`,
        '--no-playlist', '--no-warnings', '--no-check-formats',
        '--retries', '10', '--fragment-retries', '10', '--socket-timeout', '45',
        '--ffmpeg-location', '/usr/bin',
        '-o', outTemplate,
      ]
      // Use BOTH proxy AND cookies — YouTube bot-detection needs both once IP is flagged.
      if (proxyUrl) args.push(`--proxy=${proxyUrl}`)
      if (cookiesFile) args.push('--cookies', cookiesFile)
      args.push(url)
      const env = { PATH: `/root/.deno/bin:/root/.venv/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` }
      console.log(`[full-dl attempt ${attempt}/4] yt-dlp ${url.slice(0,60)}`)
      await runCmd(YT_DLP, args, { timeout: 600000, env })
      const files = await fs.readdir(outDir)
      const f = files.find(n => /^full\.(mp4|webm|mkv)$/.test(n))
      if (!f) throw new Error('yt-dlp produced no full video')
      const fullPath = path.join(outDir, f)
      const st = await fs.stat(fullPath)
      if (st.size < 100 * 1024) throw new Error(`Downloaded file too small (${st.size} bytes)`)
      console.log(`[full-dl attempt ${attempt}] SUCCESS — ${(st.size/1024/1024).toFixed(1)} MB`)
      return fullPath
    } catch (e) {
      lastErr = e
      console.warn(`[full-dl attempt ${attempt}/4] failed: ${e.message.slice(0,200)}`)
      // wipe any partial file
      try { const files = await fs.readdir(outDir); for (const fn of files) if (/^full\./.test(fn)) await fs.unlink(path.join(outDir, fn)).catch(()=>{}) } catch {}
      if (attempt < 4) await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000))
    }
  }
  throw lastErr || new Error('Full video download failed after 4 attempts')
}

// Parse VTT subtitle file → array of { start, end, text }
function parseVTT(content) {
  const lines = content.split(/\r?\n/)
  const segments = []
  let current = null
  for (const line of lines) {
    const m = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
    if (m) {
      const start = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
      const end = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000
      current = { start, end, text: '' }
      segments.push(current)
    } else if (current && line.trim() && !line.startsWith('WEBVTT') && !line.includes('-->') && !/^\d+$/.test(line.trim())) {
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (clean) current.text = (current.text ? current.text + ' ' : '') + clean
    }
  }
  const out = []
  for (const s of segments) {
    if (!s.text) continue
    const last = out[out.length - 1]
    if (last && last.text === s.text) { last.end = s.end; continue }
    out.push(s)
  }
  return out
}

function transcriptToText(segments) {
  return segments.map(s => `[${Math.floor(s.start)}s] ${s.text}`).join('\n')
}

// Format seconds as SRT timestamp 00:00:00,000
function srtTime(secs) {
  const s = Math.max(0, secs)
  const hh = Math.floor(s / 3600).toString().padStart(2, '0')
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  const ms = Math.floor((s - Math.floor(s)) * 1000).toString().padStart(3, '0')
  return `${hh}:${mm}:${ss},${ms}`
}

// Build SRT content for a clip from segments within [clipStart, clipEnd]; times are offset to clip-local.
// CRITICAL: Strict 3-4 words per cue MAX so captions never bleed out of 9:16 frame.
// We use \N (ASS line-break) inserted into SRT — ffmpeg's subtitles filter parses both \n and \N as line breaks.
function buildClipSrt(segments, clipStart, clipEnd, { maxWordsPerCue = 4, maxWordsPerLine = 4 } = {}) {
  const local = []
  for (const s of segments) {
    if (s.end <= clipStart || s.start >= clipEnd) continue
    const start = Math.max(0, s.start - clipStart)
    const end = Math.min(clipEnd - clipStart, s.end - clipStart)
    if (end - start < 0.2) continue
    const text = String(s.text || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const words = text.split(/\s+/).filter(Boolean)
    // Split into cues of maxWordsPerCue. Each cue itself may have an internal line-break if > maxWordsPerLine.
    if (words.length <= maxWordsPerCue) {
      local.push({ start, end, text: words.join(' ') })
    } else {
      const chunks = []
      for (let i = 0; i < words.length; i += maxWordsPerCue) chunks.push(words.slice(i, i + maxWordsPerCue).join(' '))
      const per = (end - start) / chunks.length
      chunks.forEach((txt, i) => local.push({ start: start + i * per, end: start + (i + 1) * per, text: txt }))
    }
  }
  // Build SRT — sanitize text and enforce hard line-break if cue is still >maxWordsPerLine (safety)
  return local.map((c, i) => {
    const ws = c.text.split(/\s+/)
    let safe = c.text
    if (ws.length > maxWordsPerLine) {
      const half = Math.ceil(ws.length / 2)
      safe = ws.slice(0, half).join(' ') + '\n' + ws.slice(half).join(' ')
    }
    return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${safe}\n`
  }).join('\n')
}

// Build ffmpeg subtitles filter with optional style override + vertical position from overlays config.
// style_ass example: { fontName:'Impact', fontSize:24, primary:'&H0015CCFA&', outline:2, outlineColour:'&H00000000&', borderStyle:1, shadow:1, bold:1, back:'&H00C26895&' }
function ffmpegSubtitleFilter(srtPath, { styleAss = null, captionPositionPercent = 78, frameWidth = 1080, frameHeight = 1920 } = {}) {
  const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
  // MarginV scaled to frame height: 9px/percent for 1080p portrait by default.
  const heightFactor = frameHeight / 200  // 1920/200 = 9.6
  const marginV = Math.max(20, Math.round((100 - Math.max(0, Math.min(100, captionPositionPercent))) * heightFactor))
  // Side margins = 10% on each side → 80% max caption width (enforces no-bleed for long phrases)
  const marginH = Math.round(frameWidth * 0.10)
  const base = { fontName: 'DejaVu Sans', fontSize: 18, primary: '&H00FFFFFF&', outlineColour: '&H00000000&', borderStyle: 1, outline: 2, shadow: 0, bold: 1 }
  const s = { ...base, ...(styleAss || {}) }
  const parts = [
    `FontName=${s.fontName}`,
    `FontSize=${s.fontSize}`,
    `PrimaryColour=${s.primary}`,
    s.back ? `BackColour=${s.back}` : null,
    `OutlineColour=${s.outlineColour || base.outlineColour}`,
    `BorderStyle=${s.borderStyle}`,
    `Outline=${s.outline}`,
    `Shadow=${s.shadow}`,
    `Bold=${s.bold}`,
    `Alignment=2`,           // bottom-center anchor
    `MarginV=${marginV}`,
    `MarginL=${marginH}`,    // enforce left guard
    `MarginR=${marginH}`,    // enforce right guard (subtitles filter respects these → auto-wraps text)
    `WrapStyle=0`,           // smart wrap (lower line wider — looks better on Shorts)
  ].filter(Boolean).join(',')
  // Pass real frame dimensions so ASS positions/wraps based on actual canvas, not the default 384×288 it assumes.
  return `subtitles='${escaped}':force_style='${parts}':original_size=${frameWidth}x${frameHeight}`
}

async function getOpenAIKey(db) {
  if (!db) return null
  try { const integ = await db.collection('integration_credentials').findOne({ provider: 'openai', is_active: { $ne: false } }); return integ?.credentials?.api_key || null } catch { return null }
}

async function extractAudio(videoPath, outputPath, durationLimit = null) {
  const args = ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k']
  if (durationLimit) args.push('-t', String(durationLimit))
  args.push('-f', 'mp3', outputPath)
  await runCmd(FFMPEG, args, { timeout: 120000 })
}

async function getGroqWhisperConfig(db) {
  if (!db) return null
  try {
    const integ = await db.collection('integration_credentials').findOne({ provider: 'groq_whisper', is_active: { $ne: false } })
    if (!integ?.credentials?.api_key) return null
    return {
      apiKey: integ.credentials.api_key,
      model: integ.credentials.model || 'whisper-large-v3',
    }
  } catch { return null }
}

async function transcribeWithWhisper(audioPath, apiKey, language = null, db = null) {
  const audioBuf = await fs.readFile(audioPath)
  // Probe audio duration so we can scale synthetic segments from gpt-4o-transcribe (no timestamps)
  let audioDuration = 0
  try {
    const { stdout } = await execFileP(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', audioPath])
    audioDuration = parseFloat(stdout.trim()) || 0
  } catch {}

  // Provider chain — try GROQ first (fast, cheap, real segments), then OpenAI variants.
  const groq = db ? await getGroqWhisperConfig(db) : null
  const chain = []
  if (groq) chain.push({
    name: 'groq:' + groq.model,
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    apiKey: groq.apiKey,
    model: groq.model,
    supportsSegments: true,
  })
  // OpenAI: try gpt-4o-transcribe first (best accuracy for Indic), then whisper-1 (segments+timestamps).
  const openaiPrimary = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe'
  if (apiKey) {
    if (openaiPrimary !== 'whisper-1') chain.push({
      name: 'openai:' + openaiPrimary,
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey, model: openaiPrimary, supportsSegments: false,
    })
    chain.push({
      name: 'openai:whisper-1',
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey, model: 'whisper-1', supportsSegments: true,
    })
  }
  if (chain.length === 0) throw new Error('No transcription provider configured (need OpenAI or Groq key)')

  let lastErr = null
  for (const p of chain) {
    try {
      const f = new FormData()
      const blob2 = new Blob([audioBuf], { type: 'audio/mpeg' })
      f.append('file', blob2, 'audio.mp3')
      f.append('model', p.model)
      if (p.supportsSegments) {
        f.append('response_format', 'verbose_json')
        f.append('timestamp_granularities[]', 'segment')
      } else {
        f.append('response_format', 'json')
      }
      if (language && language !== 'auto') f.append('language', language)
      const t0 = Date.now()
      const r = await fetch(p.endpoint, { method: 'POST', headers: { authorization: `Bearer ${p.apiKey}` }, body: f })
      if (!r.ok) {
        const txt = await r.text().catch(()=>'')
        lastErr = new Error(`${p.name} ${r.status}: ${txt.slice(0,200)}`)
        console.warn(`[transcribe] ${p.name} failed, trying next:`, lastErr.message)
        continue
      }
      const data = await r.json()
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`[transcribe] Used ${p.name} (${elapsed}s, audio ${audioDuration.toFixed(1)}s)`)
      if (Array.isArray(data.segments) && data.segments.length > 0) {
        return data.segments.map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() })).filter(s => s.text)
      }
      if (typeof data.text === 'string' && data.text.trim().length > 0) {
        const fullText = data.text.trim()
        const words = fullText.split(/\s+/).filter(Boolean)
        if (words.length === 0) { lastErr = new Error(`${p.name}: no words`); continue }
        const wordsPerCue = 6
        const numCues = Math.max(1, Math.ceil(words.length / wordsPerCue))
        const totalDur = audioDuration > 0 ? audioDuration : numCues * 2
        const cueDur = totalDur / numCues
        const segs = []
        for (let i = 0; i < numCues; i++) {
          const txt = words.slice(i * wordsPerCue, (i + 1) * wordsPerCue).join(' ')
          if (txt) segs.push({ start: i * cueDur, end: (i + 1) * cueDur, text: txt })
        }
        if (segs.length > 0) {
          console.log(`[transcribe] Synthesized ${segs.length} segments across ${totalDur.toFixed(1)}s`)
          return segs
        }
      }
      lastErr = new Error(`${p.name}: empty response`)
    } catch (e) {
      lastErr = e
      console.warn(`[transcribe] ${p.name} threw:`, e.message)
    }
  }
  throw lastErr || new Error('All transcription providers failed')
}

function extractYouTubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

// Download a YouTube video via RapidAPI YouTube Media Downloader.
// Returns the local file path to the mp4 saved on disk, or null if not a YouTube URL.
async function downloadYouTubeViaRapidAPI(url, videoDir, rapid) {
  const vid = extractYouTubeId(url)
  if (!vid) return null
  if (!rapid?.key) throw new Error('RapidAPI key not configured')

  const detailsUrl = `https://${rapid.host}/v2/video/details?videoId=${vid}`
  const r = await fetch(detailsUrl, { headers: { 'x-rapidapi-host': rapid.host, 'x-rapidapi-key': rapid.key } })
  if (!r.ok) { const txt = await r.text().catch(()=>''); throw new Error(`RapidAPI details ${r.status}: ${txt.slice(0,200)}`) }
  const data = await r.json()
  const items = data?.videos?.items || []
  // Prefer 360p/480p MP4 with audio; fall back to first MP4 with audio
  const withAudio = items.filter(f => f.hasAudio && f.extension === 'mp4' && f.url)
  const preferred = withAudio.find(f => /360p|480p/.test(String(f.quality))) || withAudio[0]
  if (!preferred?.url) throw new Error('No downloadable mp4 with audio found from RapidAPI response')

  const outPath = path.join(videoDir, 'video.mp4')
  const dl = await fetch(preferred.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'origin': 'https://www.youtube.com',
      'referer': 'https://www.youtube.com/',
      'sec-fetch-dest': 'video',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'cross-site',
      'range': 'bytes=0-',
    },
  })
  if (!dl.ok && dl.status !== 206) throw new Error(`Download GET ${dl.status}`)
  const buf = Buffer.from(await dl.arrayBuffer())
  if (buf.length < 1024) throw new Error('Downloaded file too small — link may be IP-restricted')
  await fs.writeFile(outPath, buf)
  return { videoPath: outPath, title: data?.title || null, thumbnail: data?.thumbnails?.[0]?.url || null }
}

// MAIN background processor
export async function processVideoInBackground({
  videoId,
  url,
  localFile,
  userId,
  db,
  callLLM,
  clipLengthRange,
  addCaptions,
  language,         // 'auto' | 'en' | 'hi' | ...
  stylePreset,      // 'neon_pop' | 'the_beast' | ...
  styleAss,         // { fontName, fontSize, primary, ... }
  overlaysConfig,   // { caption:{enabled,position_percent}, hook:..., title:..., description:... }
}) {
  await ensureDirs()
  const videoDir = path.join(ORIGINALS_DIR, videoId)
  await fs.mkdir(videoDir, { recursive: true })
  const minLen = Math.max(5, Number(clipLengthRange?.min) || 30)
  const maxLen = Math.max(minLen + 5, Number(clipLengthRange?.max) || 60)
  const burnCaptions = addCaptions !== false  // default true

  async function setStage(stage, meta = {}) {
    try { await db.collection('videos_processed').updateOne({ id: videoId }, { $set: { status: stage, ...meta, updated_at: new Date() } }) } catch (e) { console.error('setStage failed', e.message) }
  }

  try {
    let videoPath = null
    let streamUrl = null          // when set, we'll use per-clip segment fetch instead of full-video path
    let proxyUrl = null
    let segments = []
    let transcriptionSource = 'none'

    if (localFile) {
      await setStage('uploaded', { progress: 25 })
      if (!(await fileExists(localFile))) throw new Error('Uploaded file not found on disk')
      videoPath = localFile
    } else {
      // ============= STAGE 1: YOUTUBE METADATA + STREAM URL =============
      await setStage('downloading', { progress: 5 })
      proxyUrl = await getProxyUrl(db)
      // Cookies + residential proxy together can confuse YouTube (IP mismatch on the cookie).
      // Use cookies ONLY when no proxy is set (datacenter direct-fetch needs them).
      const cookiesFile = proxyUrl ? null : await getCookiesFile(db)
      const ytId = extractYouTubeId(url)

      if (ytId) {
        // Try the new yt-dlp + segment-fetch architecture
        try {
          // 1a) Get metadata + duration + auto-captions URL (no bytes)
          const meta = await fetchYouTubeMetadata(url, proxyUrl, cookiesFile)
          const duration = Math.floor(Number(meta.duration) || 300)
          const title = meta.title || null
          const thumbnail = meta.thumbnail || null
          await db.collection('videos_processed').updateOne({ id: videoId }, { $set: { title: title || undefined, thumbnail_url: thumbnail || undefined, duration_seconds: duration } })

          // 1b) Try to get auto-captions via metadata's automatic_captions map
          try {
            const ac = meta.automatic_captions || {}
            const langKey = (language && language !== 'auto' && ac[language]) ? language : (ac.en ? 'en' : (Object.keys(ac)[0] || null))
            if (langKey) {
              const vttUrlObj = (ac[langKey] || []).find(x => x.ext === 'vtt') || (ac[langKey] || [])[0]
              if (vttUrlObj?.url) {
                const vttResp = await fetch(vttUrlObj.url).catch(() => null)
                if (vttResp?.ok) {
                  const vtt = await vttResp.text()
                  segments = parseVTT(vtt)
                  if (segments.length > 0) transcriptionSource = 'youtube-auto'
                }
              }
            }
          } catch (e) { console.error('auto-captions fetch failed', e.message) }

          // 1c) Get a directly-fetchable stream URL
          streamUrl = await extractStreamUrl(url, proxyUrl, cookiesFile, { maxHeight: 720 })
          if (!streamUrl) throw new Error('yt-dlp returned no stream URL')

          // 1d) Soft probe — only fail if BOTH HEAD and yt-dlp can't fetch any bytes via the proxy
          //     (yt-dlp's --download-sections handles redirects + proxy better than ffmpeg, so we trust it).
          //     A failed probe is a warning, not a fatal — we'll find out at the cut step.
          try {
            const probe = await fetch(streamUrl, { method: 'HEAD' })
            if (probe.status === 403 || probe.status === 401) console.warn(`Stream URL probe returned ${probe.status} — will attempt anyway via yt-dlp+proxy.`)
          } catch (probeErr) { console.warn('Stream URL probe failed (non-fatal):', probeErr.message) }

          await db.collection('videos_processed').updateOne({ id: videoId }, { $set: { duration_seconds: duration } })

          // For metadata pipeline we don't have a local video file; downstream code branches on streamUrl
        } catch (ytErr) {
          console.error('yt-dlp path failed:', ytErr.message)
          // Fallback: try RapidAPI (likely to fail too on IP-locked URLs)
          const rapid = await getRapidApi(db)
          if (rapid.key) {
            try {
              const result = await downloadYouTubeViaRapidAPI(url, videoDir, rapid)
              videoPath = result.videoPath
              if (result.title) await db.collection('videos_processed').updateOne({ id: videoId }, { $set: { title: result.title } })
            } catch (rErr) {
              throw new Error(`YouTube ingestion failed. yt-dlp: ${ytErr.message.slice(0,120)}. RapidAPI: ${rErr.message.slice(0,120)}. ${proxyUrl ? 'Check your proxy.' : 'Configure HTTP Proxy in Admin → Integrations.'}`)
            }
          } else {
            throw new Error(ytErr.message)
          }
        }
      } else if (await fileExists(YT_DLP)) {
        // Non-YouTube URL: fall back to old yt-dlp full download path
        const outTemplate = path.join(videoDir, 'video.%(ext)s')
        try {
          const dlArgs = ['-f', 'best[height<=480][ext=mp4]/best[height<=480]/best', '--no-playlist', '--write-auto-subs', '--sub-langs', 'en,en-orig', '--sub-format', 'vtt', '--download-sections', '*0-600', '--force-keyframes-at-cuts', '-o', outTemplate]
          if (proxyUrl) dlArgs.unshift(`--proxy=${proxyUrl}`)
          dlArgs.push(url)
          await runCmd(YT_DLP, dlArgs, { timeout: 240000, env: { PATH: `/root/.deno/bin:${process.env.PATH || ''}` } })
        } catch (dlErr) { throw new Error(`Video download failed: ${dlErr.message.slice(0,200)}. Try uploading the file directly.`) }
        const files = await fs.readdir(videoDir)
        const videoFile = files.find(f => /\.(mp4|webm|mkv)$/.test(f))
        if (!videoFile) throw new Error('Download produced no video file')
        videoPath = path.join(videoDir, videoFile)
        const vttFile = files.find(f => /\.(en|en-orig)\.vtt$/.test(f)) || files.find(f => /\.vtt$/.test(f))
        if (vttFile) { const vttContent = await fs.readFile(path.join(videoDir, vttFile), 'utf-8'); segments = parseVTT(vttContent); if (segments.length > 0) transcriptionSource = 'youtube-auto' }
      } else {
        throw new Error('No downloader available.')
      }
    }

    // ============= STAGE 2: PROBE / DURATION =============
    let duration = 300
    if (videoPath) {
      const stat = await fs.stat(videoPath)
      await setStage('downloaded', { progress: 35, downloaded_bytes: stat.size })
      if (await fileExists(FFPROBE)) {
        try { const { stdout } = await execFileP(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', videoPath]); duration = Math.floor(parseFloat(stdout.trim()) || 300) } catch (e) { console.error('ffprobe failed', e.message) }
      }
    } else if (streamUrl) {
      // Duration already pulled from yt-dlp metadata; query db
      const v = await db.collection('videos_processed').findOne({ id: videoId })
      duration = Math.max(5, Math.floor(v?.duration_seconds || 300))
      await setStage('downloaded', { progress: 35, downloaded_bytes: 0 })
    }

    // ============= STAGE 2.5: CREDIT DEDUCTION (now that we know duration) =============
    const creditsRequired = Math.max(1, Math.ceil(duration / 60))
    if (userId) {
      try {
        const result = await db.collection('profiles').findOneAndUpdate(
          { id: userId, credit_balance_minutes: { $gte: creditsRequired } },
          { $inc: { credit_balance_minutes: -creditsRequired } },
          { returnDocument: 'after' }
        )
        if (!result?.value && !result?.lastErrorObject?.updatedExisting && !result) {
          // Old/new mongo driver shape: check both
        }
        // findOneAndUpdate returns { value: ... } or the doc directly depending on driver version
        const updated = result?.value || result
        if (!updated) throw new Error(`Insufficient credits — need ${creditsRequired} minutes`)
        await db.collection('credit_transactions').insertOne({ id: uuidv4(), user_id: userId, video_id: videoId, amount: -creditsRequired, reason: 'video_processing', duration_seconds: duration, created_at: new Date() })
      } catch (creditErr) {
        throw new Error(`Insufficient credits — this video needs ${creditsRequired} credit-minutes. ${creditErr.message}`)
      }
    }
    await setStage('downloaded', { progress: 40, credits_charged: creditsRequired })

    // ============= STAGE 3: WHISPER TRANSCRIPTION =============
    await setStage('transcribing', { progress: 50, duration_seconds: duration })
    if (segments.length < 5) {
      const apiKey = await getOpenAIKey(db)
      const groq = await getGroqWhisperConfig(db)
      // Allow transcription if EITHER OpenAI or Groq is configured
      if ((apiKey || groq) && (await fileExists(FFMPEG))) {
        try {
          const audioPath = path.join(videoDir, 'audio.mp3')
          if (videoPath) {
            await extractAudio(videoPath, audioPath)
            const audioStat = await fs.stat(audioPath)
            if (audioStat.size > 24 * 1024 * 1024) await extractAudio(videoPath, audioPath, 1500)
          } else if (streamUrl) {
            // Use yt-dlp to download audio-only directly. ALWAYS pass cookies + proxy — YouTube bot detection
            // requires both for residential-proxy IPs that have been flagged.
            try {
              const tmpAudio = path.join(videoDir, 'audio.%(ext)s')
              const cookiesFile3 = await getCookiesFile(db)
              const args = [
                '-f', 'bestaudio[ext=m4a]/bestaudio',
                '--no-playlist', '--no-warnings', '--no-check-formats',
                '--ffmpeg-location', '/usr/bin',
                '--retries', '5', '--fragment-retries', '5', '--socket-timeout', '30',
                '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
                '-o', tmpAudio,
              ]
              if (proxyUrl) args.push(`--proxy=${proxyUrl}`)
              if (cookiesFile3) args.push('--cookies', cookiesFile3)
              args.push(url)
              const env = { PATH: `/root/.deno/bin:/root/.venv/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` }
              await runCmd(YT_DLP, args, { timeout: 300000, env })
              const files2 = await fs.readdir(videoDir)
              const mp3 = files2.find(n => /^audio\.mp3$/.test(n))
              if (mp3) await fs.rename(path.join(videoDir, mp3), audioPath)
            } catch (audErr) {
              console.error('yt-dlp audio extract failed, trying ffmpeg+stream fallback:', audErr.message)
              try {
                const cookiesFile2 = await getCookiesFile(db)
                const audioStream = await extractStreamUrl(url, proxyUrl, cookiesFile2, { audioOnly: true })
                await fetchAudioForTranscription(audioStream, audioPath, proxyUrl)
              } catch (audErr2) {
                console.error('ffmpeg+stream audio fallback also failed:', audErr2.message)
              }
            }
          }
          if (await fileExists(audioPath)) {
            const whisperSegs = await transcribeWithWhisper(audioPath, apiKey, language, db)
            if (whisperSegs.length > 0) { segments = whisperSegs; transcriptionSource = 'whisper' }
            try { await fs.unlink(audioPath) } catch {}
          }
        } catch (wErr) { console.error('Whisper failed, continuing without transcript:', wErr.message) }
      }
    }

    const hasTranscript = segments.length > 5
    const transcript = hasTranscript ? transcriptToText(segments).slice(0, 12000) : ''

    // ============= STAGE 4: AI ANALYSIS =============
    await setStage('analyzing', { progress: 60, transcript_segments: segments.length, transcription_source: transcriptionSource })

    const prompt = hasTranscript
      ? `You are an expert short-form video editor. Below is a timestamped transcript of a long video. Pick 3 highly-engaging segments most likely to go viral on TikTok / Shorts / Reels. Each clip MUST be between ${minLen} and ${maxLen} seconds long.\n\nTRANSCRIPT:\n${transcript}\n\nReturn ONLY valid JSON, no markdown:\n{ "clips": [ { "clip_title": "punchy curiosity-gap title under 60 chars", "start_time_seconds": int, "end_time_seconds": int (must be ${minLen}-${maxLen}s after start), "virality_score": 70-99, "hook_text": "4-8 word scroll-stopping opener", "transcript_segment": "the exact text spoken during this clip", "why": "one sentence on why this will go viral" } ] }\nSort by virality_score desc.`
      : `Generate 3 plausible viral clip suggestions for a ${duration}s video (no transcript). Each clip must be ${minLen}-${maxLen} seconds. Spread start times across the video. Return ONLY valid JSON: { "clips": [ { "clip_title": "...", "start_time_seconds": int, "end_time_seconds": int, "virality_score": 70-99, "hook_text": "...", "transcript_segment": "", "why": "..." } ] }`

    let raw
    try { raw = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.8, db }) }
    catch (e) { throw new Error('AI analysis failed: ' + e.message) }

    const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(cleaned) } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]) } catch {} } }
    if (!parsed?.clips || !Array.isArray(parsed.clips)) throw new Error('AI returned invalid format')

    // ============= STAGE 5: CUT + BURN CAPTIONS =============
    await setStage('cutting', { progress: 80 })
    const createdClips = []
    let fullVideoFallbackPath = null  // populated if we fall back to a full download

    async function tryCutClip(c, i, opts = {}) {
      const useLocalFullPath = opts.localFullPath || null
      const start = Math.max(0, Math.min(Number(c.start_time_seconds) || 0, Math.max(0, duration - minLen)))
      let end = Math.max(start + minLen, Math.min(Number(c.end_time_seconds) || (start + minLen), duration))
      end = Math.min(end, start + maxLen)
      const clipDuration = end - start
      if (clipDuration < 5) return null

      const clipId = uuidv4()
      const clipFilename = `${clipId}.mp4`
      const clipPath = path.join(CLIPS_DIR, clipFilename)
      const clipTranscript = segments.filter(s => s.start >= start - 1 && s.end <= end + 1).map(s => s.text).join(' ').slice(0, 1000)

      const rawClipPath = path.join(videoDir, `raw_${clipId}.mp4`)
      // Source preference: explicit fallback full video > local upload videoPath > stream URL > YouTube segment fetch
      const sourceLocal = useLocalFullPath || videoPath
      if (sourceLocal) {
        // High-quality cut: medium preset + CRF 18 for visual-lossless, 1080p shorts target.
        await runCmd(FFMPEG, ['-y', '-ss', String(start), '-i', sourceLocal, '-t', String(clipDuration),
          '-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',
          '-c:a','aac','-b:a','192k','-ar','44100','-movflags','+faststart', rawClipPath], { timeout: 180000 })
      } else if (extractYouTubeId(url)) {
        const cookiesArg = await getCookiesFile(db)
        // Bumped to 1080p HD for shorts quality (was 720)
        await fetchYouTubeSegment(url, start, end, rawClipPath, proxyUrl, cookiesArg, 1080)
      } else if (streamUrl) {
        await fetchSegmentViaFfmpeg(streamUrl, start, end, rawClipPath, proxyUrl)
      } else {
        throw new Error('No video source available')
      }

      // STEP B: NO LONGER BURNS CAPTIONS DURING INGESTION!
      // Previously this baked captions into the source MP4 → double-caption bug when user re-rendered in editor.
      // Now we ONLY save srt_content; captions are burned only at final export via /api/clips/:id/render.
      // The raw clip is renamed to the final clip path as-is.
      let captionsBurned = false
      let srtContentSaved = null
      if (segments.length > 0) {
        const srtContent = buildClipSrt(segments, start, end)
        if (srtContent.trim().length > 0) srtContentSaved = srtContent
      }
      try { await fs.rename(rawClipPath, clipPath) } catch {}
      const finalPath = clipPath

      // STEP C: Thumbnail
      const thumbFilename = `${clipId}.jpg`
      const thumbPath = path.join(CLIPS_DIR, thumbFilename)
      try {
        await runCmd(FFMPEG, ['-y', '-ss', String(Math.floor(clipDuration / 2)), '-i', finalPath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=540:-2', thumbPath], { timeout: 30000 })
      } catch (thumbErr) { console.error('Thumb failed', thumbErr.message) }

      const doc = {
        id: clipId, video_id: videoId, user_id: userId,
        clip_title: String(c.clip_title || `Clip ${i+1}`).slice(0, 90),
        start_time_seconds: Math.floor(start), end_time_seconds: Math.floor(end),
        virality_score: Math.min(99, Math.max(50, Number(c.virality_score) || 80)),
        transcript_segment: clipTranscript || String(c.transcript_segment || '').slice(0,1000),
        storage_url_mp4: `/api/files/clips/${clipFilename}`,
        thumbnail_url: `/api/files/clips/${thumbFilename}`,
        source_video_url: url || `local:${path.basename(localFile || '')}`,
        is_scheduled: false, scheduled_time: null,
        hook_type: c.hook_text ? 'text' : 'none',
        hook_text: String(c.hook_text || '').slice(0,120),
        hook_meme_id: null,
        subtitle_language: 'en',
        ai_rationale: String(c.why || '').slice(0,200),
        transcription_source: transcriptionSource,
        captions_burned: captionsBurned,
        srt_content: srtContentSaved,
        clip_length_range: { min: minLen, max: maxLen },
        style_preset: stylePreset || null,
        language: language || 'auto',
        overlays_config: overlaysConfig || null,
        is_real: true,
        created_at: new Date(),
      }
      await db.collection('generated_clips').insertOne(doc)
      return doc
    }

    // First pass: try the cheap segment-fetch path
    const cutErrors = []
    for (let i = 0; i < parsed.clips.length; i++) {
      try {
        const doc = await tryCutClip(parsed.clips[i], i)
        if (doc) createdClips.push(doc)
      } catch (cutErr) {
        console.error('Clip cut failed (pass 1):', cutErr.message)
        cutErrors.push(cutErr.message)
      }
    }

    // FULL-VIDEO FALLBACK: if zero clips cut and we have a YouTube URL, download the full video once and retry locally
    if (createdClips.length === 0 && !videoPath && extractYouTubeId(url)) {
      try {
        await setStage('cutting', { progress: 70, note: 'Segment fetch failed — downloading full video as fallback…' })
        console.log('[fallback] Downloading full video via yt-dlp+proxy as a single operation…')
        fullVideoFallbackPath = await fetchFullVideoFromYouTube({ url, outDir: videoDir, db, maxHeight: 720 })
        console.log('[fallback] Got full video at', fullVideoFallbackPath)
        // Probe real duration now that we have the file
        try {
          const { stdout } = await execFileP(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', fullVideoFallbackPath])
          const probedDur = Math.floor(parseFloat(stdout.trim()) || duration)
          if (probedDur > 5) duration = probedDur
        } catch {}
        await setStage('cutting', { progress: 85 })
        for (let i = 0; i < parsed.clips.length; i++) {
          try {
            const doc = await tryCutClip(parsed.clips[i], i, { localFullPath: fullVideoFallbackPath })
            if (doc) createdClips.push(doc)
          } catch (e2) {
            console.error('Clip cut failed (fallback pass):', e2.message)
            cutErrors.push('fallback: ' + e2.message)
          }
        }
      } catch (fbErr) {
        console.error('Full-video fallback download failed:', fbErr.message)
        cutErrors.push('full-download: ' + fbErr.message)
      }
    }

    if (createdClips.length === 0) {
      const detail = cutErrors.length ? ` Last error: ${cutErrors[cutErrors.length - 1].slice(0, 200)}` : ''
      throw new Error(`Could not download any clips from the source video.${detail} ${proxyUrl ? 'The residential proxy may be rate-limiting — try again in a minute, or upload the file directly.' : 'Configure HTTP Proxy in Admin → Integrations to bypass YouTube IP blocks.'}`)
    }

    await setStage('completed', { progress: 100, clip_count: createdClips.length, transcript_segments: segments.length, duration_seconds: duration, transcription_source: transcriptionSource, captions_burned: createdClips.some(c => c.captions_burned), credits_charged: creditsRequired })
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}
    return { ok: true, clips: createdClips.length, transcription_source: transcriptionSource, credits_charged: creditsRequired }
  } catch (err) {
    console.error('Video processing failed', err)
    await setStage('failed', { error_message: String(err?.message || err).slice(0,500), progress: 0 })
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}
    return { ok: false, error: String(err?.message || err) }
  }
}
