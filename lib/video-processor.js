// Real video processing pipeline using yt-dlp + ffmpeg + OpenAI Whisper
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const execFileP = promisify(execFile)
const UPLOAD_DIR = '/app/data/uploads'
const ORIGINALS_DIR = path.join(UPLOAD_DIR, 'originals')
const CLIPS_DIR = path.join(UPLOAD_DIR, 'clips')

// Resolve binaries — prefer system path, then virtualenv, then PATH lookup
const YT_DLP = process.env.YT_DLP_PATH || '/root/.venv/bin/yt-dlp'
const FFMPEG = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || '/usr/bin/ffprobe'

async function ensureDirs() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true })
  await fs.mkdir(CLIPS_DIR, { recursive: true })
}

async function fileExists(p) {
  try { await fs.access(p); return true } catch { return false }
}

// Run a command with timeout, capturing output
function runCmd(cmd, args, { timeout = 240000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    let proc
    try {
      proc = spawn(cmd, args, { cwd })
    } catch (spawnErr) {
      return reject(new Error(`spawn ${cmd} failed: ${spawnErr.message}`))
    }
    let stdout = '', stderr = ''
    const t = setTimeout(() => { try { proc.kill('SIGKILL') } catch {}; reject(new Error(`${cmd} timeout after ${timeout / 1000}s`)) }, timeout)
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', err => { clearTimeout(t); reject(new Error(`${cmd} spawn error: ${err.message}`)) })
    proc.on('close', code => {
      clearTimeout(t)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`))
    })
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

// Fetch the OpenAI API key from integration_credentials (if any)
async function getOpenAIKey(db) {
  if (!db) return null
  try {
    const integ = await db.collection('integration_credentials').findOne({ provider: 'openai', is_active: { $ne: false } })
    return integ?.credentials?.api_key || null
  } catch { return null }
}

// Extract audio from video to a low-bitrate mp3 for Whisper (≤25MB limit)
async function extractAudio(videoPath, outputPath) {
  await runCmd(FFMPEG, [
    '-y', '-i', videoPath,
    '-vn', '-ac', '1', '-ar', '16000',
    '-b:a', '64k',
    '-f', 'mp3',
    outputPath,
  ], { timeout: 120000 })
}

// Call OpenAI Whisper API with verbose_json so we get word/segment timestamps
async function transcribeWithWhisper(audioPath, apiKey) {
  const audioBuf = await fs.readFile(audioPath)
  const blob = new Blob([audioBuf], { type: 'audio/mpeg' })
  const form = new FormData()
  form.append('file', blob, 'audio.mp3')
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Whisper ${r.status}: ${txt.slice(0, 200)}`)
  }
  const data = await r.json()
  // data.segments: [{ id, start, end, text, ... }]
  return (data.segments || []).map(s => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() })).filter(s => s.text)
}

// MAIN background processor
// If localFile is provided, skip yt-dlp; otherwise download from URL
export async function processVideoInBackground({ videoId, url, localFile, userId, db, callLLM }) {
  await ensureDirs()
  const videoDir = path.join(ORIGINALS_DIR, videoId)
  await fs.mkdir(videoDir, { recursive: true })

  async function setStage(stage, meta = {}) {
    try {
      await db.collection('videos_processed').updateOne(
        { id: videoId },
        { $set: { status: stage, ...meta, updated_at: new Date() } }
      )
    } catch (e) { console.error('setStage failed', e.message) }
  }

  try {
    let videoPath
    let segments = []
    let transcriptionSource = 'none'

    if (localFile) {
      // ============= LOCAL FILE PATH =============
      await setStage('uploaded', { progress: 25 })
      if (!(await fileExists(localFile))) throw new Error('Uploaded file not found on disk')
      videoPath = localFile
    } else {
      // ============= STAGE 1: DOWNLOAD via yt-dlp =============
      await setStage('downloading', { progress: 5 })
      if (!(await fileExists(YT_DLP))) {
        throw new Error(`yt-dlp not installed at ${YT_DLP}. Use the local file drop zone instead.`)
      }
      const outTemplate = path.join(videoDir, 'video.%(ext)s')
      try {
        await runCmd(YT_DLP, [
          '-f', 'best[height<=480][ext=mp4]/best[height<=480]/best',
          '--no-playlist',
          '--write-auto-subs', '--sub-langs', 'en,en-orig',
          '--sub-format', 'vtt',
          '--download-sections', '*0-300',
          '--force-keyframes-at-cuts',
          '-o', outTemplate,
          url,
        ], { timeout: 180000 })
      } catch (dlErr) {
        throw new Error(`Video download failed: ${dlErr.message.slice(0, 200)}. YouTube often blocks server IPs — try uploading the file directly via the drop zone instead.`)
      }
      const files = await fs.readdir(videoDir)
      const videoFile = files.find(f => /\.(mp4|webm|mkv)$/.test(f))
      if (!videoFile) throw new Error('Download produced no video file')
      videoPath = path.join(videoDir, videoFile)
      const vttFile = files.find(f => /\.(en|en-orig)\.vtt$/.test(f)) || files.find(f => /\.vtt$/.test(f))
      if (vttFile) {
        const vttContent = await fs.readFile(path.join(videoDir, vttFile), 'utf-8')
        segments = parseVTT(vttContent)
        if (segments.length > 0) transcriptionSource = 'youtube-auto'
      }
    }

    const stat = await fs.stat(videoPath)
    await setStage('downloaded', { progress: 35, downloaded_bytes: stat.size })

    // ============= STAGE 2: PROBE DURATION =============
    let duration = 300
    if (await fileExists(FFPROBE)) {
      try {
        const { stdout } = await execFileP(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
        duration = Math.floor(parseFloat(stdout.trim()) || 300)
      } catch (e) { console.error('ffprobe failed', e.message) }
    }

    // ============= STAGE 2.5: WHISPER TRANSCRIPTION (if no captions yet) =============
    await setStage('transcribing', { progress: 45, duration_seconds: duration })
    if (segments.length < 5) {
      const apiKey = await getOpenAIKey(db)
      if (apiKey && (await fileExists(FFMPEG))) {
        try {
          const audioPath = path.join(videoDir, 'audio.mp3')
          await extractAudio(videoPath, audioPath)
          const audioStat = await fs.stat(audioPath)
          // Whisper limit ≈ 25MB. If larger, transcribe first 25MB only by limiting duration.
          if (audioStat.size > 24 * 1024 * 1024) {
            // re-extract first 25 minutes (~24MB at 64k mono mp3)
            await runCmd(FFMPEG, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-t', '1500', '-f', 'mp3', audioPath], { timeout: 120000 })
          }
          const whisperSegs = await transcribeWithWhisper(audioPath, apiKey)
          if (whisperSegs.length > 0) {
            segments = whisperSegs
            transcriptionSource = 'whisper'
          }
          try { await fs.unlink(audioPath) } catch {}
        } catch (whisperErr) {
          console.error('Whisper transcription failed, continuing without transcript:', whisperErr.message)
        }
      }
    }

    const hasTranscript = segments.length > 5
    const transcript = hasTranscript ? transcriptToText(segments).slice(0, 12000) : ''

    // ============= STAGE 3: AI ANALYSIS =============
    await setStage('analyzing', { progress: 60, transcript_segments: segments.length, duration_seconds: duration, transcription_source: transcriptionSource })

    const prompt = hasTranscript
      ? `You are an expert short-form video editor. Below is a timestamped transcript of a long video. Pick 3 highly-engaging 30-60 second segments most likely to go viral on TikTok / Shorts / Reels.\n\nTRANSCRIPT:\n${transcript}\n\nReturn ONLY valid JSON, no markdown, in this exact shape:\n{\n  "clips": [\n    {\n      "clip_title": "punchy curiosity-gap title under 60 chars",\n      "start_time_seconds": integer (must exist in transcript range),\n      "end_time_seconds": integer (start + 30 to 60),\n      "virality_score": 70-99,\n      "hook_text": "4-8 word scroll-stopping opener",\n      "transcript_segment": "the exact text spoken during this clip",\n      "why": "one sentence on why this will go viral"\n    }\n  ]\n}\nMake titles dramatically different. Sort by virality_score desc.`
      : `Generate 3 plausible 30-60s viral clip suggestions for a ${duration}s video (no transcript available). Spread the start times across the video. Return ONLY valid JSON: { "clips": [ { "clip_title": "...", "start_time_seconds": int, "end_time_seconds": int, "virality_score": 70-99, "hook_text": "...", "transcript_segment": "", "why": "..." } ] }`

    let raw
    try { raw = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.8, db }) }
    catch (e) { throw new Error('AI analysis failed: ' + e.message) }

    const cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(cleaned) } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
    }
    if (!parsed?.clips || !Array.isArray(parsed.clips)) throw new Error('AI returned invalid format')

    // ============= STAGE 4: CUT CLIPS =============
    await setStage('cutting', { progress: 80 })
    const createdClips = []
    for (let i = 0; i < parsed.clips.length; i++) {
      const c = parsed.clips[i]
      const start = Math.max(0, Math.min(Number(c.start_time_seconds) || 0, Math.max(0, duration - 5)))
      let end = Math.max(start + 15, Math.min(Number(c.end_time_seconds) || (start + 45), duration))
      end = Math.min(end, start + 60)

      const clipId = uuidv4()
      const clipFilename = `${clipId}.mp4`
      const clipPath = path.join(CLIPS_DIR, clipFilename)
      const clipDuration = end - start
      if (clipDuration < 5) { console.error('Clip too short, skipping'); continue }

      // Find transcript segment for this clip
      const clipTranscript = segments
        .filter(s => s.start >= start - 1 && s.end <= end + 1)
        .map(s => s.text)
        .join(' ')
        .slice(0, 1000)

      try {
        await runCmd(FFMPEG, [
          '-y', '-ss', String(start), '-i', videoPath, '-t', String(clipDuration),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          clipPath,
        ], { timeout: 120000 })
      } catch (cutErr) {
        console.error('Clip cut failed', cutErr.message)
        continue
      }

      // generate thumbnail at midpoint of clip
      const thumbFilename = `${clipId}.jpg`
      const thumbPath = path.join(CLIPS_DIR, thumbFilename)
      try {
        await runCmd(FFMPEG, [
          '-y', '-ss', String(Math.floor(clipDuration / 2)),
          '-i', clipPath, '-frames:v', '1', '-q:v', '3',
          '-vf', 'scale=540:-2',
          thumbPath,
        ], { timeout: 30000 })
      } catch (thumbErr) { console.error('Thumb failed', thumbErr.message) }

      const doc = {
        id: clipId, video_id: videoId, user_id: userId,
        clip_title: String(c.clip_title || `Clip ${i + 1}`).slice(0, 90),
        start_time_seconds: Math.floor(start),
        end_time_seconds: Math.floor(end),
        virality_score: Math.min(99, Math.max(50, Number(c.virality_score) || 80)),
        transcript_segment: clipTranscript || String(c.transcript_segment || '').slice(0, 1000),
        storage_url_mp4: `/api/files/clips/${clipFilename}`,
        thumbnail_url: `/api/files/clips/${thumbFilename}`,
        source_video_url: url || `local:${path.basename(localFile || '')}`,
        is_scheduled: false, scheduled_time: null,
        hook_type: c.hook_text ? 'text' : 'none',
        hook_text: String(c.hook_text || '').slice(0, 120),
        hook_meme_id: null,
        subtitle_language: 'en',
        ai_rationale: String(c.why || '').slice(0, 200),
        transcription_source: transcriptionSource,
        is_real: true,
        created_at: new Date(),
      }
      await db.collection('generated_clips').insertOne(doc)
      createdClips.push(doc)
    }

    if (createdClips.length === 0) {
      throw new Error('No clips were successfully cut. The video may be too short or codec is unsupported.')
    }

    // ============= STAGE 5: DONE =============
    await setStage('completed', {
      progress: 100,
      clip_count: createdClips.length,
      transcript_segments: segments.length,
      duration_seconds: duration,
      transcription_source: transcriptionSource,
    })

    // cleanup the original video file (keep clips)
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}

    return { ok: true, clips: createdClips.length, transcription_source: transcriptionSource }
  } catch (err) {
    console.error('Video processing failed', err)
    await setStage('failed', { error_message: String(err?.message || err).slice(0, 500), progress: 0 })
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}
    return { ok: false, error: String(err?.message || err) }
  }
}
