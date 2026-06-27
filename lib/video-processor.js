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
const RAPIDAPI_YT_KEY = process.env.RAPIDAPI_YT_KEY
const RAPIDAPI_YT_HOST = process.env.RAPIDAPI_YT_HOST || 'youtube-media-downloader.p.rapidapi.com'

async function ensureDirs() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true })
  await fs.mkdir(CLIPS_DIR, { recursive: true })
}
async function fileExists(p) { try { await fs.access(p); return true } catch { return false } }

function runCmd(cmd, args, { timeout = 240000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let proc
    try { proc = spawn(cmd, args, { cwd }) } catch (e) { return reject(new Error(`spawn ${cmd} failed: ${e.message}`)) }
    let stdout = '', stderr = ''
    const t = setTimeout(() => { try { proc.kill('SIGKILL') } catch {}; reject(new Error(`${cmd} timeout after ${timeout / 1000}s`)) }, timeout)
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', err => { clearTimeout(t); reject(new Error(`${cmd} spawn error: ${err.message}`)) })
    proc.on('close', code => { clearTimeout(t); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`)) })
  })
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
// Splits long segments into shorter on-screen lines for readability.
function buildClipSrt(segments, clipStart, clipEnd) {
  const local = []
  for (const s of segments) {
    if (s.end <= clipStart || s.start >= clipEnd) continue
    const start = Math.max(0, s.start - clipStart)
    const end = Math.min(clipEnd - clipStart, s.end - clipStart)
    if (end - start < 0.2) continue
    // chunk long text into max 6 words per cue
    const words = s.text.split(/\s+/).filter(Boolean)
    if (words.length <= 7) {
      local.push({ start, end, text: s.text })
    } else {
      const chunks = []
      for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '))
      const per = (end - start) / chunks.length
      chunks.forEach((txt, i) => local.push({ start: start + i * per, end: start + (i + 1) * per, text: txt }))
    }
  }
  return local.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text.replace(/\n/g,' ')}\n`).join('\n')
}

// Build ffmpeg subtitles filter with optional style override + vertical position from overlays config.
// style_ass example: { fontName:'Impact', fontSize:24, primary:'&H0015CCFA&', outline:2, outlineColour:'&H00000000&', borderStyle:1, shadow:1, bold:1, back:'&H00C26895&' }
function ffmpegSubtitleFilter(srtPath, { styleAss = null, captionPositionPercent = 78 } = {}) {
  const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
  // MarginV is from BOTTOM of frame. For a 9:16 1080x1920 frame, position_percent=78 means caption sits ~22% above bottom.
  // marginV = (100 - position_percent) * frameHeightFactor; we approximate with 9px per percent point assuming 1080p portrait.
  const marginV = Math.max(20, Math.round((100 - Math.max(0, Math.min(100, captionPositionPercent))) * 9))
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
    `Alignment=2`,
    `MarginV=${marginV}`,
  ].filter(Boolean).join(',')
  return `subtitles='${escaped}':force_style='${parts}'`
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

async function transcribeWithWhisper(audioPath, apiKey, language = null) {
  const audioBuf = await fs.readFile(audioPath)
  const blob = new Blob([audioBuf], { type: 'audio/mpeg' })
  const form = new FormData()
  form.append('file', blob, 'audio.mp3')
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  if (language && language !== 'auto') form.append('language', language)
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form })
  if (!r.ok) { const txt = await r.text().catch(()=>''); throw new Error(`Whisper ${r.status}: ${txt.slice(0,200)}`) }
  const data = await r.json()
  return (data.segments || []).map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() })).filter(s => s.text)
}

function extractYouTubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

// Download a YouTube video via RapidAPI YouTube Media Downloader.
// Returns the local file path to the mp4 saved on disk, or null if not a YouTube URL.
async function downloadYouTubeViaRapidAPI(url, videoDir) {
  const vid = extractYouTubeId(url)
  if (!vid) return null
  if (!RAPIDAPI_YT_KEY) throw new Error('RAPIDAPI_YT_KEY not configured in environment')

  const detailsUrl = `https://${RAPIDAPI_YT_HOST}/v2/video/details?videoId=${vid}`
  const r = await fetch(detailsUrl, { headers: { 'x-rapidapi-host': RAPIDAPI_YT_HOST, 'x-rapidapi-key': RAPIDAPI_YT_KEY } })
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
    let videoPath
    let segments = []
    let transcriptionSource = 'none'

    if (localFile) {
      await setStage('uploaded', { progress: 25 })
      if (!(await fileExists(localFile))) throw new Error('Uploaded file not found on disk')
      videoPath = localFile
    } else {
      // ============= STAGE 1: DOWNLOAD =============
      await setStage('downloading', { progress: 5 })
      const ytId = extractYouTubeId(url)
      if (ytId && RAPIDAPI_YT_KEY) {
        // Use RapidAPI for YouTube (works around IP blocks)
        try {
          const result = await downloadYouTubeViaRapidAPI(url, videoDir)
          videoPath = result.videoPath
          if (result.title || result.thumbnail) {
            await db.collection('videos_processed').updateOne({ id: videoId }, { $set: { title: result.title || undefined, thumbnail_url: result.thumbnail || undefined } })
          }
        } catch (rErr) {
          throw new Error(`RapidAPI YouTube download failed: ${rErr.message.slice(0,200)}. Try uploading the file directly via the drop zone.`)
        }
      } else if (await fileExists(YT_DLP)) {
        const outTemplate = path.join(videoDir, 'video.%(ext)s')
        try {
          await runCmd(YT_DLP, ['-f', 'best[height<=480][ext=mp4]/best[height<=480]/best', '--no-playlist', '--write-auto-subs', '--sub-langs', 'en,en-orig', '--sub-format', 'vtt', '--download-sections', '*0-600', '--force-keyframes-at-cuts', '-o', outTemplate, url], { timeout: 240000 })
        } catch (dlErr) { throw new Error(`Video download failed: ${dlErr.message.slice(0,200)}. Try uploading the file directly.`) }
        const files = await fs.readdir(videoDir)
        const videoFile = files.find(f => /\.(mp4|webm|mkv)$/.test(f))
        if (!videoFile) throw new Error('Download produced no video file')
        videoPath = path.join(videoDir, videoFile)
        const vttFile = files.find(f => /\.(en|en-orig)\.vtt$/.test(f)) || files.find(f => /\.vtt$/.test(f))
        if (vttFile) { const vttContent = await fs.readFile(path.join(videoDir, vttFile), 'utf-8'); segments = parseVTT(vttContent); if (segments.length > 0) transcriptionSource = 'youtube-auto' }
      } else {
        throw new Error('No downloader available. Set RAPIDAPI_YT_KEY or install yt-dlp.')
      }
    }

    const stat = await fs.stat(videoPath)
    await setStage('downloaded', { progress: 35, downloaded_bytes: stat.size })

    // ============= STAGE 2: PROBE =============
    let duration = 300
    if (await fileExists(FFPROBE)) {
      try { const { stdout } = await execFileP(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', videoPath]); duration = Math.floor(parseFloat(stdout.trim()) || 300) } catch (e) { console.error('ffprobe failed', e.message) }
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
      if (apiKey && (await fileExists(FFMPEG))) {
        try {
          const audioPath = path.join(videoDir, 'audio.mp3')
          await extractAudio(videoPath, audioPath)
          const audioStat = await fs.stat(audioPath)
          if (audioStat.size > 24 * 1024 * 1024) await extractAudio(videoPath, audioPath, 1500)
          const whisperSegs = await transcribeWithWhisper(audioPath, apiKey, language)
          if (whisperSegs.length > 0) { segments = whisperSegs; transcriptionSource = 'whisper' }
          try { await fs.unlink(audioPath) } catch {}
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
    for (let i = 0; i < parsed.clips.length; i++) {
      const c = parsed.clips[i]
      const start = Math.max(0, Math.min(Number(c.start_time_seconds) || 0, Math.max(0, duration - minLen)))
      let end = Math.max(start + minLen, Math.min(Number(c.end_time_seconds) || (start + minLen), duration))
      end = Math.min(end, start + maxLen)
      const clipDuration = end - start
      if (clipDuration < 5) { console.error('Clip too short, skipping'); continue }

      const clipId = uuidv4()
      const clipFilename = `${clipId}.mp4`
      const clipPath = path.join(CLIPS_DIR, clipFilename)
      const clipTranscript = segments.filter(s => s.start >= start - 1 && s.end <= end + 1).map(s => s.text).join(' ').slice(0, 1000)

      // STEP A: Cut raw clip (fast)
      const rawClipPath = path.join(videoDir, `raw_${clipId}.mp4`)
      try {
        await runCmd(FFMPEG, ['-y', '-ss', String(start), '-i', videoPath, '-t', String(clipDuration), '-c:v','libx264','-preset','veryfast','-crf','24','-c:a','aac','-b:a','128k','-movflags','+faststart', rawClipPath], { timeout: 120000 })
      } catch (cutErr) { console.error('Clip cut failed', cutErr.message); continue }

      // STEP B: Optionally burn captions via subtitles filter
      let finalPath = rawClipPath
      let captionsBurned = false
      if (burnCaptions && segments.length > 0) {
        const srtContent = buildClipSrt(segments, start, end)
        if (srtContent.trim().length > 0) {
          const srtPath = path.join(videoDir, `${clipId}.srt`)
          await fs.writeFile(srtPath, srtContent, 'utf-8')
          try {
          await runCmd(FFMPEG, ['-y', '-i', rawClipPath, '-vf', ffmpegSubtitleFilter(srtPath, { styleAss, captionPositionPercent: overlaysConfig?.caption?.position_percent ?? 78 }), '-c:v','libx264','-preset','veryfast','-crf','22','-c:a','copy','-movflags','+faststart', clipPath], { timeout: 180000 })
            finalPath = clipPath
            captionsBurned = true
            try { await fs.unlink(rawClipPath) } catch {}
            try { await fs.unlink(srtPath) } catch {}
          } catch (burnErr) {
            console.error('Caption burn failed, using raw clip:', burnErr.message)
            try { await fs.rename(rawClipPath, clipPath) } catch {}
            finalPath = clipPath
          }
        } else {
          try { await fs.rename(rawClipPath, clipPath) } catch {}
          finalPath = clipPath
        }
      } else {
        try { await fs.rename(rawClipPath, clipPath) } catch {}
        finalPath = clipPath
      }

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
        clip_length_range: { min: minLen, max: maxLen },
        style_preset: stylePreset || null,
        language: language || 'auto',
        overlays_config: overlaysConfig || null,
        is_real: true,
        created_at: new Date(),
      }
      await db.collection('generated_clips').insertOne(doc)
      createdClips.push(doc)
    }

    if (createdClips.length === 0) throw new Error('No clips were successfully cut. The video may be too short or codec is unsupported.')

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
