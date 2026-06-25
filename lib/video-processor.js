// Real video processing pipeline using yt-dlp + ffmpeg
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const execFileP = promisify(execFile)
const UPLOAD_DIR = '/app/data/uploads'
const ORIGINALS_DIR = path.join(UPLOAD_DIR, 'originals')
const CLIPS_DIR = path.join(UPLOAD_DIR, 'clips')
const YT_DLP = process.env.YT_DLP_PATH || '/usr/local/bin/yt-dlp'
const FFMPEG = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH || '/usr/bin/ffprobe'

async function ensureDirs() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true })
  await fs.mkdir(CLIPS_DIR, { recursive: true })
}

// Run a command with timeout, capturing output
function runCmd(cmd, args, { timeout = 240000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd })
    let stdout = '', stderr = ''
    const t = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error(`${cmd} timeout after ${timeout/1000}s`)) }, timeout)
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', err => { clearTimeout(t); reject(err) })
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
      const start = +m[1]*3600 + +m[2]*60 + +m[3] + +m[4]/1000
      const end = +m[5]*3600 + +m[6]*60 + +m[7] + +m[8]/1000
      current = { start, end, text: '' }
      segments.push(current)
    } else if (current && line.trim() && !line.startsWith('WEBVTT') && !line.includes('-->') && !/^\d+$/.test(line.trim())) {
      // strip inline tags like <00:00:00.000><c>word</c>
      const clean = line.replace(/<[^>]+>/g, '').trim()
      if (clean) current.text = (current.text ? current.text + ' ' : '') + clean
    }
  }
  // dedupe consecutive duplicate text segments (YouTube auto-captions often have rolling duplicates)
  const out = []
  for (const s of segments) {
    if (!s.text) continue
    const last = out[out.length-1]
    if (last && last.text === s.text) { last.end = s.end; continue }
    out.push(s)
  }
  return out
}

// Build a single transcript string with timestamps
function transcriptToText(segments) {
  return segments.map(s => `[${Math.floor(s.start)}s] ${s.text}`).join('\n')
}

// MAIN background processor
// If localFile is provided, skip yt-dlp; otherwise download from URL
export async function processVideoInBackground({ videoId, url, localFile, userId, db, callLLM }) {
  await ensureDirs()
  const videoDir = path.join(ORIGINALS_DIR, videoId)
  await fs.mkdir(videoDir, { recursive: true })

  async function setStage(stage, meta = {}) {
    await db.collection('videos_processed').updateOne(
      { id: videoId },
      { $set: { status: stage, ...meta, updated_at: new Date() } }
    )
  }

  try {
    let videoPath
    let segments = []

    if (localFile) {
      // ============= LOCAL FILE PATH =============
      await setStage('uploaded', { progress: 25 })
      videoPath = localFile
    } else {
      // ============= STAGE 1: DOWNLOAD via yt-dlp =============
      await setStage('downloading', { progress: 5 })
      const outTemplate = path.join(videoDir, 'video.%(ext)s')
      try {
        await runCmd(YT_DLP, [
          '--remote-components', 'ejs:github',
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
      }
    }

    const stat = await fs.stat(videoPath)
    await setStage('downloaded', { progress: 35, downloaded_bytes: stat.size })

    // ============= STAGE 2: TRANSCRIBE =============
    await setStage('transcribing', { progress: 45 })
    const hasTranscript = segments.length > 5
    const transcript = hasTranscript ? transcriptToText(segments).slice(0, 12000) : ''

    let duration = 300
    try {
      const { stdout } = await execFileP(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', videoPath])
      duration = Math.floor(parseFloat(stdout.trim()) || 300)
    } catch {}

    // ============= STAGE 3: AI ANALYSIS =============
    await setStage('analyzing', { progress: 55, transcript_segments: segments.length, duration_seconds: duration })

    const prompt = hasTranscript
      ? `You are an expert short-form video editor. Below is a timestamped transcript of a long video. Pick 3 highly-engaging 30-60 second segments most likely to go viral on TikTok / Shorts / Reels.\n\nTRANSCRIPT:\n${transcript}\n\nReturn ONLY valid JSON, no markdown, in this exact shape:\n{\n  "clips": [\n    {\n      "clip_title": "punchy curiosity-gap title under 60 chars",\n      "start_time_seconds": integer (must exist in transcript range),\n      "end_time_seconds": integer (start + 30 to 60),\n      "virality_score": 70-99,\n      "hook_text": "4-8 word scroll-stopping opener",\n      "transcript_segment": "the exact text spoken during this clip",\n      "why": "one sentence on why this will go viral"\n    }\n  ]\n}\nMake titles dramatically different. Sort by virality_score desc.`
      : `Generate 3 plausible 30-60s viral clip suggestions for a ${duration}s video at URL ${url}. Return ONLY valid JSON: { "clips": [ { "clip_title": "...", "start_time_seconds": int, "end_time_seconds": int, "virality_score": 70-99, "hook_text": "...", "transcript_segment": "", "why": "..." } ] }`

    let raw
    try { raw = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.8, db }) }
    catch (e) { throw new Error('AI analysis failed: ' + e.message) }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    let parsed
    try { parsed = JSON.parse(cleaned) } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) parsed = JSON.parse(m[0])
    }
    if (!parsed?.clips || !Array.isArray(parsed.clips)) throw new Error('AI returned invalid format')

    // ============= STAGE 4: CUT CLIPS =============
    await setStage('cutting', { progress: 75 })
    const createdClips = []
    for (let i = 0; i < parsed.clips.length; i++) {
      const c = parsed.clips[i]
      const start = Math.max(0, Math.min(Number(c.start_time_seconds) || 0, duration - 5))
      let end = Math.max(start + 15, Math.min(Number(c.end_time_seconds) || (start + 45), duration))
      end = Math.min(end, start + 60)

      const clipId = uuidv4()
      const clipFilename = `${clipId}.mp4`
      const clipPath = path.join(CLIPS_DIR, clipFilename)
      const clipDuration = end - start

      // ffmpeg cut: -ss before -i for fast seek, then -t for duration
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
      } catch {}

      const doc = {
        id: clipId, video_id: videoId, user_id: userId,
        clip_title: String(c.clip_title || `Clip ${i+1}`).slice(0, 90),
        start_time_seconds: Math.floor(start),
        end_time_seconds: Math.floor(end),
        virality_score: Math.min(99, Math.max(50, Number(c.virality_score) || 80)),
        transcript_segment: String(c.transcript_segment || '').slice(0, 1000),
        storage_url_mp4: `/api/files/clips/${clipFilename}`,
        thumbnail_url: `/api/files/clips/${thumbFilename}`,
        source_video_url: url,
        is_scheduled: false, scheduled_time: null,
        hook_type: c.hook_text ? 'text' : 'none',
        hook_text: String(c.hook_text || '').slice(0, 120),
        hook_meme_id: null,
        subtitle_language: 'en',
        ai_rationale: String(c.why || '').slice(0, 200),
        is_real: true,
        created_at: new Date(),
      }
      await db.collection('generated_clips').insertOne(doc)
      createdClips.push(doc)
    }

    // ============= STAGE 5: DONE =============
    await setStage('completed', {
      progress: 100,
      clip_count: createdClips.length,
      transcript_segments: segments.length,
      duration_seconds: duration,
    })

    // cleanup the original video file (keep clips)
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}

    return { ok: true, clips: createdClips.length }
  } catch (err) {
    console.error('Video processing failed', err)
    await db.collection('videos_processed').updateOne(
      { id: videoId },
      { $set: { status: 'failed', error_message: err.message?.slice(0, 500), updated_at: new Date() } }
    )
    // cleanup
    try { await fs.rm(videoDir, { recursive: true, force: true }) } catch {}
    return { ok: false, error: err.message }
  }
}
