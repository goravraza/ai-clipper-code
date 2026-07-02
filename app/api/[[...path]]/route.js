import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'clipforge'
const LLM_KEY = process.env.EMERGENT_LLM_KEY
const LLM_URL = 'https://integrations.emergentagent.com/llm/chat/completions'
const LLM_MODEL = 'gemini/gemini-3.5-flash'
const UPLOAD_DIR = '/app/data/uploads'

let cachedClient = null
async function getDb() {
  if (cachedClient) return cachedClient.db(DB_NAME)
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  cachedClient = client
  const db = client.db(DB_NAME)
  await seedIfEmpty(db)
  // STARTUP CLEANUP: any in-progress jobs from BEFORE this boot are dead (process was killed).
  // Mark them failed so the user's UI shows an actionable error instead of polling forever.
  try {
    await db.collection('videos_processed').updateMany(
      { status: { $in: ['queued', 'downloading', 'downloaded', 'transcribing', 'analyzing', 'cutting'] }, created_at: { $lt: new Date(Date.now() - 60 * 1000) } },
      { $set: { status: 'failed', error_message: 'Processing was interrupted by a server restart (likely memory limit). Please re-submit the URL.', failed_at: new Date() } }
    )
  } catch (e) { console.warn('Stale-job cleanup failed:', e.message) }
  return db
}

const DEFAULT_USER_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_USER_ID = '22222222-2222-2222-2222-222222222222'
const ADMIN_EMAILS = new Set([
  'prathamch37@gmail.com',
])

async function seedIfEmpty(db) {
  const pkgCount = await db.collection('pricing_packages').countDocuments()
  if (pkgCount === 0) {
    await db.collection('pricing_packages').insertMany([
      { id: uuidv4(), name: 'Starter Pack', credit_amount_minutes: 300, price_inr: 499, price_usd: 6.99, discount_percentage: 0, is_featured: false, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Growth Pack', credit_amount_minutes: 1000, price_inr: 1299, price_usd: 15.99, discount_percentage: 20, is_featured: true, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Enterprise Pack', credit_amount_minutes: 3000, price_inr: 2999, price_usd: 35.99, discount_percentage: 40, is_featured: false, is_active: true, created_at: new Date() },
    ])
  }
  const existing = await db.collection('profiles').findOne({ id: DEFAULT_USER_ID })
  if (!existing) {
    await db.collection('profiles').insertOne({ id: DEFAULT_USER_ID, email: 'creator@clipforge.ai', credit_balance_minutes: 30, is_admin: false, theme_preference: 'dark', created_at: new Date() })
  }
  const admin = await db.collection('profiles').findOne({ id: ADMIN_USER_ID })
  if (!admin) {
    await db.collection('profiles').insertOne({ id: ADMIN_USER_ID, email: 'admin@clipforge.ai', credit_balance_minutes: 9999, is_admin: true, theme_preference: 'dark', created_at: new Date() })
  }
  const memeCount = await db.collection('memes').countDocuments()
  if (memeCount === 0) {
    await db.collection('memes').insertMany([
      { id: uuidv4(), name: 'POV: You opened TikTok', category: 'reaction', video_url: 'https://media.tenor.com/mock/pov-tiktok.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=400&q=80', duration_seconds: 3, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Wait For It...', category: 'suspense', video_url: 'https://media.tenor.com/mock/wait-for-it.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=400&q=80', duration_seconds: 3, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Plot Twist Drum Roll', category: 'reveal', video_url: 'https://media.tenor.com/mock/plot-twist.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=400&q=80', duration_seconds: 3, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'When The Beat Drops', category: 'hype', video_url: 'https://media.tenor.com/mock/beat-drop.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80', duration_seconds: 3, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Bro Just Said What?!', category: 'shock', video_url: 'https://media.tenor.com/mock/bro-said-what.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400&q=80', duration_seconds: 3, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Vine Boom Sound Effect', category: 'sfx', video_url: 'https://media.tenor.com/mock/vine-boom.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=400&q=80', duration_seconds: 2, is_active: true, created_at: new Date() },
    ])
  }
  const clipCount = await db.collection('generated_clips').countDocuments()
  if (clipCount === 0) {
    const videoId = uuidv4()
    await db.collection('videos_processed').insertOne({ id: videoId, user_id: DEFAULT_USER_ID, original_url: 'https://youtube.com/watch?v=demo-podcast', status: 'completed', created_at: new Date() })
    await db.collection('generated_clips').insertMany([
      { id: uuidv4(), video_id: videoId, user_id: DEFAULT_USER_ID, clip_title: 'The Secret to Going Viral in 2025', start_time_seconds: 142, end_time_seconds: 198, virality_score: 94, storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-1.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1593697909683-bccb1b9e68a4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHwzfHxwb2RjYXN0JTIwY3JlYXRvcnxlbnwwfHx8fDE3ODIzNzQ5NDJ8MA&ixlib=rb-4.1.0&q=85', is_scheduled: false, scheduled_time: null, hook_type: 'text', hook_text: 'You won\u2019t believe this\u2026', hook_meme_id: null, subtitle_language: 'en', created_at: new Date() },
      { id: uuidv4(), video_id: videoId, user_id: DEFAULT_USER_ID, clip_title: 'Why 99% of Creators Fail (Hard Truth)', start_time_seconds: 412, end_time_seconds: 471, virality_score: 88, storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-2.mp4', thumbnail_url: 'https://images.unsplash.com/photo-1581368135153-a506cf13b1e1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHw0fHxwb2RjYXN0JTIwY3JlYXRvcnxlbnwwfHx8fDE3ODIzNzQ5NDJ8MA&ixlib=rb-4.1.0&q=85', is_scheduled: false, scheduled_time: null, hook_type: 'none', hook_text: '', hook_meme_id: null, subtitle_language: 'en', created_at: new Date() },
      { id: uuidv4(), video_id: videoId, user_id: DEFAULT_USER_ID, clip_title: '3 Hooks That Stop the Scroll Instantly', start_time_seconds: 622, end_time_seconds: 678, virality_score: 79, storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-3.mp4', thumbnail_url: 'https://images.pexels.com/photos/7600898/pexels-photo-7600898.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940', is_scheduled: false, scheduled_time: null, hook_type: 'none', hook_text: '', hook_meme_id: null, subtitle_language: 'en', created_at: new Date() },
    ])
  }
  // index for sessions
  await db.collection('sessions').createIndex({ session_token: 1 }, { unique: true }).catch(()=>{})
  await db.collection('profiles').createIndex({ email: 1 }, { unique: true, sparse: true }).catch(()=>{})
  await db.collection('coupon_codes').createIndex({ code: 1 }, { unique: true }).catch(()=>{})

  // seed sample coupons
  const couponCount = await db.collection('coupon_codes').countDocuments()
  if (couponCount === 0) {
    await db.collection('coupon_codes').insertMany([
      { id: uuidv4(), code: 'LAUNCH25', discount_percent: 25, max_redemptions: 1000, current_redemptions: 0, expires_at: new Date(Date.now() + 90*24*3600*1000), is_active: true, created_at: new Date() },
      { id: uuidv4(), code: 'CREATOR50', discount_percent: 50, max_redemptions: 100, current_redemptions: 0, expires_at: new Date(Date.now() + 30*24*3600*1000), is_active: true, created_at: new Date() },
      { id: uuidv4(), code: 'BLACKFRIDAY', discount_percent: 70, max_redemptions: 500, current_redemptions: 0, expires_at: new Date(Date.now() + 365*24*3600*1000), is_active: false, created_at: new Date() },
    ])
  }
}

function strip(doc) { if (!doc) return doc; const { _id, ...rest } = doc; return rest }

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  try { return crypto.scryptSync(password, salt, 64).toString('hex') === hash } catch { return false }
}
function isAdminProfile(p) { return !!(p && (p.is_admin === true || p.role === 'admin')) }
async function logActivity(db, userId, action, request, meta = {}) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    await db.collection('logs_activity').insertOne({
      id: uuidv4(), user_id: userId || null, action_performed: action,
      ip_address: ip, meta, created_at: new Date(),
    })
  } catch {}
}

function maskCredentials(creds) {
  const masked = {}
  for (const [k, v] of Object.entries(creds || {})) {
    if (typeof v === 'string' && v.length > 8) masked[k] = `${v.slice(0,4)}\u2022\u2022\u2022\u2022${v.slice(-4)}`
    else if (typeof v === 'string' && v.length > 0) masked[k] = '\u2022\u2022\u2022\u2022'
    else masked[k] = v
  }
  return masked
}
function isMaskedValue(v) {
  return typeof v === 'string' && (v.includes('\u2022\u2022\u2022\u2022') || v === '****')
}

function parseCookies(cookieHeader) {
  const out = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) out[k] = decodeURIComponent(v.join('='))
  }
  return out
}

/**
 * Returns the current user's profile based on session cookie.
 * If no cookie or session expired, returns the DEFAULT demo profile (so app keeps working unauthenticated).
 * Pass {requireAdmin:true} to also let ?admin=true query impersonate the admin demo profile (for /admin page testing).
 */
async function getUser(request, db, opts = {}) {
  const cookies = parseCookies(request.headers.get('cookie'))
  const sessionToken = cookies.session_token
  if (sessionToken) {
    const session = await db.collection('sessions').findOne({ session_token: sessionToken })
    if (session && (!session.expires_at || new Date(session.expires_at) > new Date())) {
      const profile = await db.collection('profiles').findOne({ id: session.user_id })
      if (profile) return profile
    }
  }
  // unauthenticated fallback / impersonation for admin testing
  if (opts.allowAdminImpersonation) {
    const url = new URL(request.url)
    if (url.searchParams.get('admin') === 'true') {
      return await db.collection('profiles').findOne({ id: ADMIN_USER_ID })
    }
  }
  return await db.collection('profiles').findOne({ id: DEFAULT_USER_ID })
}

async function callLLM(messages, { json = false, temperature = 0.7, db = null } = {}) {
  // Prefer admin-configured Gemini key from integrations table; fall back to OpenAI; then Emergent gateway
  let userGeminiKey = null
  let userGeminiModel = 'gemini-2.0-flash'
  let userOpenAIKey = null
  let userOpenAIModel = 'gpt-4o-mini'
  let userAnthropicKey = null
  if (db) {
    try {
      const integ = await db.collection('integration_credentials').find({ is_active: { $ne: false } }).toArray()
      for (const i of integ) {
        if (i.provider === 'gemini' && i.credentials?.api_key) {
          userGeminiKey = i.credentials.api_key
          if (i.credentials.model) userGeminiModel = i.credentials.model
        }
        if (i.provider === 'openai' && i.credentials?.api_key) {
          userOpenAIKey = i.credentials.api_key
          if (i.credentials.model) userOpenAIModel = i.credentials.model
        }
        if (i.provider === 'anthropic' && i.credentials?.api_key) userAnthropicKey = i.credentials.api_key
      }
    } catch {}
  }

  const errors = []

  // 1) Try Gemini direct
  if (userGeminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(userGeminiModel)}:generateContent?key=${encodeURIComponent(userGeminiKey)}`
      const promptText = messages.map(m => m.content).join('\n\n')
      const body = { contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) } }
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (r.ok) {
        const data = await r.json()
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      }
      const txt = await r.text()
      errors.push(`Gemini ${r.status}: ${txt.slice(0,150)}`)
    } catch (e) { errors.push(`Gemini error: ${e.message}`) }
  }

  // 2) Fallback to OpenAI direct
  if (userOpenAIKey) {
    try {
      const body = { model: userOpenAIModel, messages, temperature }
      if (json) body.response_format = { type: 'json_object' }
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${userOpenAIKey}` }, body: JSON.stringify(body) })
      if (r.ok) {
        const data = await r.json()
        return data.choices?.[0]?.message?.content || ''
      }
      const txt = await r.text()
      errors.push(`OpenAI ${r.status}: ${txt.slice(0,150)}`)
    } catch (e) { errors.push(`OpenAI error: ${e.message}`) }
  }

  // 3) Fallback to Anthropic
  if (userAnthropicKey) {
    try {
      const promptText = messages.map(m => m.content).join('\n\n')
      const body = { model: 'claude-3-5-sonnet-20241022', max_tokens: 2048, messages: [{ role: 'user', content: promptText }] }
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': userAnthropicKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) })
      if (r.ok) {
        const data = await r.json()
        return data.content?.[0]?.text || ''
      }
      const txt = await r.text()
      errors.push(`Anthropic ${r.status}: ${txt.slice(0,150)}`)
    } catch (e) { errors.push(`Anthropic error: ${e.message}`) }
  }

  // 4) Final fallback: Emergent gateway
  if (LLM_KEY) {
    try {
      const body = { model: LLM_MODEL, messages, temperature }
      if (json) body.response_format = { type: 'json_object' }
      const r = await fetch(LLM_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${LLM_KEY}` }, body: JSON.stringify(body) })
      if (r.ok) {
        const data = await r.json()
        return data.choices?.[0]?.message?.content || ''
      }
      const txt = await r.text()
      errors.push(`Emergent ${r.status}: ${txt.slice(0,150)}`)
    } catch (e) { errors.push(`Emergent error: ${e.message}`) }
  }

  if (errors.length === 0) throw new Error('No LLM key configured. Add Gemini, OpenAI, or Anthropic API key in Admin → Integrations.')
  throw new Error(`All LLM providers failed:\n${errors.join('\n')}`)
}

function extractYouTubeId(url) {
  if (!url) return null
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}
function extractInstagramShortcode(url) {
  if (!url) return null
  const m = String(url).match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/)
  return m ? m[1] : null
}
async function thumbnailForUrl(url) {
  const ytId = extractYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
  return null
}
async function metadataForUrl(url) {
  const ytId = extractYouTubeId(url)
  if (ytId) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${ytId}&format=json`)
      if (r.ok) {
        const d = await r.json()
        return { title: d.title, author: d.author_name, thumbnail: d.thumbnail_url || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`, source_type: 'youtube' }
      }
    } catch {}
    return { title: null, thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`, source_type: 'youtube' }
  }
  if (extractInstagramShortcode(url)) return { source_type: 'instagram', thumbnail: null }
  if (/tiktok\.com/.test(url)) return { source_type: 'tiktok', thumbnail: null }
  return { source_type: 'other', thumbnail: null }
}

function safeJsonParse(text) {
  // strip code fences if any
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(cleaned) } catch {
    // try to find a JSON object/array within text
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
    return null
  }
}

const THUMB_POOL = [
  'https://images.unsplash.com/photo-1593697909683-bccb1b9e68a4?w=600&q=80',
  'https://images.unsplash.com/photo-1581368135153-a506cf13b1e1?w=600&q=80',
  'https://images.pexels.com/photos/7600898/pexels-photo-7600898.jpeg?auto=compress&w=600',
  'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=600&q=80',
  'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600&q=80',
  'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=600&q=80',
]

async function handle(request, { params }) {
  const segments = (await params).path || []
  const path_ = '/' + segments.join('/')
  const method = request.method

  try {
    // File serving (no DB needed)
    if (path_.startsWith('/files/') && (method === 'GET' || method === 'HEAD')) {
      const sub = segments.slice(1).join('/')
      // Prevent path traversal
      if (sub.includes('..')) return new NextResponse('Bad path', { status: 400 })
      const filePath = path.join(UPLOAD_DIR, sub)
      try {
        const stat = await fs.stat(filePath)
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mime = { mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp' }[ext] || 'application/octet-stream'
        const headers = { 'content-type': mime, 'content-length': String(stat.size), 'cache-control': 'public, max-age=31536000, immutable', 'accept-ranges': 'bytes' }
        if (method === 'HEAD') return new NextResponse(null, { headers })
        const data = await fs.readFile(filePath)
        return new NextResponse(data, { headers })
      } catch { return new NextResponse('Not found', { status: 404 }) }
    }

    const db = await getDb()

    if (path_ === '/' && method === 'GET') return NextResponse.json({ status: 'ok', service: 'ClipForge AI', version: '2.0.0' })

    // ============= AUTH =============
    // POST /api/auth/session  body: { session_id }
    if (path_ === '/auth/session' && method === 'POST') {
      const body = await request.json()
      const sid = body.session_id
      if (!sid) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
      const r = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', { headers: { 'X-Session-ID': sid } })
      if (!r.ok) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      const data = await r.json()
      const email = data.email
      if (!email) return NextResponse.json({ error: 'No email returned' }, { status: 400 })
      let profile = await db.collection('profiles').findOne({ email })
      const shouldBeAdmin = ADMIN_EMAILS.has(email.toLowerCase())
      if (!profile) {
        profile = { id: uuidv4(), email, name: data.name || email.split('@')[0], picture: data.picture || null, credit_balance_minutes: shouldBeAdmin ? 9999 : 30, is_admin: shouldBeAdmin, theme_preference: 'dark', created_at: new Date() }
        await db.collection('profiles').insertOne(profile)
      } else {
        const updates = { name: data.name || profile.name, picture: data.picture || profile.picture, last_login_at: new Date() }
        // promote to admin if email is in allowlist (never demote)
        if (shouldBeAdmin && !profile.is_admin) updates.is_admin = true
        await db.collection('profiles').updateOne({ id: profile.id }, { $set: updates })
        profile = await db.collection('profiles').findOne({ id: profile.id })
      }
      const token = data.session_token || uuidv4()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await db.collection('sessions').updateOne({ session_token: token }, { $set: { session_token: token, user_id: profile.id, expires_at: expiresAt, created_at: new Date() } }, { upsert: true })
      const res = NextResponse.json({ user: strip(profile) })
      res.headers.set('Set-Cookie', `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*60*60}; Secure`)
      return res
    }

    if (path_ === '/auth/me' && method === 'GET') {
      const user = await getUser(request, db)
      const isAuthenticated = !!parseCookies(request.headers.get('cookie')).session_token
      return NextResponse.json({ user: strip(user), is_authenticated: isAuthenticated })
    }

    if (path_ === '/auth/logout' && method === 'POST') {
      const cookies = parseCookies(request.headers.get('cookie'))
      if (cookies.session_token) await db.collection('sessions').deleteOne({ session_token: cookies.session_token })
      const res = NextResponse.json({ ok: true })
      res.headers.set('Set-Cookie', `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
      return res
    }

    // ============= GEO =============
    if (path_ === '/geo' && method === 'GET') {
      const url = new URL(request.url)
      const force = url.searchParams.get('force')
      const country = force || (Math.random() < 0.5 ? 'IN' : 'US')
      return NextResponse.json({ country_code: country, country_name: country === 'IN' ? 'India' : 'United States', currency: country === 'IN' ? 'INR' : 'USD', symbol: country === 'IN' ? '₹' : '$', payment_processor: country === 'IN' ? 'razorpay' : 'lemon_squeezy' })
    }

    // ============= PROFILE =============
    if (path_ === '/profile' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      return NextResponse.json(strip(user))
    }
    if (path_ === '/profile' && method === 'PUT') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      const body = await request.json()
      const updates = {}
      if (typeof body.theme_preference === 'string') updates.theme_preference = body.theme_preference
      if (typeof body.credit_balance_minutes === 'number') updates.credit_balance_minutes = body.credit_balance_minutes
      if (typeof body.preferred_language === 'string') updates.preferred_language = body.preferred_language
      await db.collection('profiles').updateOne({ id: user.id }, { $set: updates })
      const p = await db.collection('profiles').findOne({ id: user.id })
      return NextResponse.json(strip(p))
    }

    // ============= PRICING PACKAGES =============
    if (path_ === '/pricing-packages' && method === 'GET') {
      const list = await db.collection('pricing_packages').find({}).sort({ credit_amount_minutes: 1 }).toArray()
      return NextResponse.json(list.map(strip))
    }
    if (path_ === '/pricing-packages' && method === 'POST') {
      const body = await request.json()
      const doc = { id: uuidv4(), name: body.name || 'New Pack', credit_amount_minutes: Number(body.credit_amount_minutes) || 100, price_inr: Number(body.price_inr) || 0, price_usd: Number(body.price_usd) || 0, discount_percentage: Number(body.discount_percentage) || 0, is_featured: !!body.is_featured, is_active: body.is_active !== false, created_at: new Date() }
      await db.collection('pricing_packages').insertOne(doc)
      return NextResponse.json(strip(doc))
    }
    if (path_.startsWith('/pricing-packages/') && method === 'PUT') {
      const id = segments[1]
      const body = await request.json()
      const allowed = ['name','credit_amount_minutes','price_inr','price_usd','discount_percentage','is_featured','is_active']
      const updates = {}; for (const k of allowed) if (k in body) updates[k] = body[k]
      await db.collection('pricing_packages').updateOne({ id }, { $set: updates })
      const p = await db.collection('pricing_packages').findOne({ id })
      return NextResponse.json(strip(p))
    }
    if (path_.startsWith('/pricing-packages/') && method === 'DELETE') {
      const id = segments[1]; await db.collection('pricing_packages').deleteOne({ id }); return NextResponse.json({ ok: true })
    }

    // ============= CLIPS =============
    if (path_ === '/clips' && method === 'GET') {
      const user = await getUser(request, db)
      // Newest first so freshly-generated clips appear at the top after ingestion.
      // Within the same video, sort by virality_score desc.
      const list = await db.collection('generated_clips').find({ user_id: user.id }).sort({ created_at: -1, virality_score: -1 }).toArray()
      return NextResponse.json(list.map(strip))
    }

    // ============= PROJECTS (group clips by their parent source video) =============
    // GET /api/projects — list of source-video projects with clip counts + preview thumbs
    if (path_ === '/projects' && method === 'GET') {
      const user = await getUser(request, db)
      const videos = await db.collection('videos_processed').find({ user_id: user.id }).sort({ created_at: -1 }).toArray()
      const allClips = await db.collection('generated_clips').find({ user_id: user.id }).sort({ created_at: -1, virality_score: -1 }).toArray()

      // Index clips by video_id
      const byVid = new Map()
      for (const c of allClips) {
        const k = c.video_id || '__orphan__'
        if (!byVid.has(k)) byVid.set(k, [])
        byVid.get(k).push(c)
      }

      const projects = videos.map(v => {
        const cs = byVid.get(v.id) || []
        return {
          id: v.id,
          title: v.title || v.original_url || 'Untitled project',
          original_url: v.original_url || null,
          source_type: v.source_type || 'other',
          thumbnail_url: v.thumbnail_url || (cs[0]?.thumbnail_url || null),
          status: v.status || 'completed',
          progress: v.progress ?? null,
          error_message: v.error_message || null,
          clip_length_range: v.clip_length_range || null,
          created_at: v.created_at,
          updated_at: v.updated_at || v.created_at,
          clip_count: cs.length,
          clip_thumbnails: cs.slice(0, 4).map(c => c.thumbnail_url).filter(Boolean),
          avg_virality: cs.length ? Math.round(cs.reduce((a, c) => a + (c.virality_score || 0), 0) / cs.length) : 0,
        }
      })

      // Build a virtual "Unsorted" project for clips whose parent video was deleted
      const orphans = byVid.get('__orphan__') || []
      // Also include clips whose video_id doesn't match any existing video
      const knownIds = new Set(videos.map(v => v.id))
      const extraOrphans = []
      for (const [k, list] of byVid.entries()) {
        if (k === '__orphan__') continue
        if (!knownIds.has(k)) extraOrphans.push(...list)
      }
      const allOrphans = [...orphans, ...extraOrphans]
      if (allOrphans.length > 0) {
        projects.push({
          id: '__unsorted__',
          title: 'Unsorted Clips',
          original_url: null,
          source_type: 'other',
          thumbnail_url: allOrphans[0]?.thumbnail_url || null,
          status: 'completed',
          progress: null,
          error_message: null,
          clip_length_range: null,
          created_at: allOrphans[0]?.created_at || new Date(0),
          updated_at: allOrphans[0]?.created_at || new Date(0),
          clip_count: allOrphans.length,
          clip_thumbnails: allOrphans.slice(0, 4).map(c => c.thumbnail_url).filter(Boolean),
          avg_virality: Math.round(allOrphans.reduce((a, c) => a + (c.virality_score || 0), 0) / allOrphans.length),
          is_virtual: true,
        })
      }

      return NextResponse.json(projects)
    }

    // GET /api/projects/:id — one project with all its clips
    if (path_.startsWith('/projects/') && method === 'GET') {
      const user = await getUser(request, db)
      const id = segments[1]
      if (id === '__unsorted__') {
        const allClips = await db.collection('generated_clips').find({ user_id: user.id }).sort({ virality_score: -1, created_at: -1 }).toArray()
        const videos = await db.collection('videos_processed').find({ user_id: user.id }, { projection: { id: 1 } }).toArray()
        const known = new Set(videos.map(v => v.id))
        const orphans = allClips.filter(c => !c.video_id || !known.has(c.video_id))
        return NextResponse.json({
          id: '__unsorted__',
          title: 'Unsorted Clips',
          source_type: 'other',
          status: 'completed',
          is_virtual: true,
          clips: orphans.map(strip),
        })
      }
      const v = await db.collection('videos_processed').findOne({ id, user_id: user.id })
      if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const clips = await db.collection('generated_clips').find({ video_id: id, user_id: user.id }).sort({ virality_score: -1, start_time_seconds: 1 }).toArray()
      return NextResponse.json({ ...strip(v), clips: clips.map(strip) })
    }

    // DELETE /api/projects/:id — delete a project + all its clips (R2 + DB)
    if (path_.startsWith('/projects/') && method === 'DELETE') {
      const user = await getUser(request, db)
      const id = segments[1]
      if (id === '__unsorted__') return NextResponse.json({ error: 'cannot delete virtual unsorted project' }, { status: 400 })
      const v = await db.collection('videos_processed').findOne({ id, user_id: user.id })
      if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const clips = await db.collection('generated_clips').find({ video_id: id, user_id: user.id }).toArray()
      // Best-effort R2 cleanup
      try {
        const { deleteFromR2 } = await import('@/lib/r2')
        for (const c of clips) {
          if (c.r2_key) { try { await deleteFromR2({ db, key: c.r2_key }) } catch {} }
        }
        if (v.r2_key) { try { await deleteFromR2({ db, key: v.r2_key }) } catch {} }
      } catch {}
      await db.collection('generated_clips').deleteMany({ video_id: id, user_id: user.id })
      await db.collection('videos_processed').deleteOne({ id, user_id: user.id })
      await logActivity(db, user.id, 'project_deleted', request, { project_id: id, title: v.title, clips_deleted: clips.length })
      return NextResponse.json({ ok: true, deleted_clips: clips.length })
    }

    // PUT /api/projects/:id — rename a project (only the title field for now)
    if (path_.startsWith('/projects/') && method === 'PUT') {
      const user = await getUser(request, db)
      const id = segments[1]
      if (id === '__unsorted__') return NextResponse.json({ error: 'cannot rename virtual unsorted project' }, { status: 400 })
      const body = await request.json()
      const updates = {}
      if (typeof body.title === 'string' && body.title.trim().length > 0) updates.title = body.title.trim().slice(0, 200)
      if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
      updates.updated_at = new Date()
      const r = await db.collection('videos_processed').updateOne({ id, user_id: user.id }, { $set: updates })
      if (r.matchedCount === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const v = await db.collection('videos_processed').findOne({ id })
      return NextResponse.json(strip(v))
    }
    if (path_.startsWith('/clips/') && method === 'PUT') {
      const id = segments[1]
      const body = await request.json()
      const allowed = ['clip_title','is_scheduled','scheduled_time','hook_type','hook_text','hook_meme_id','subtitle_language','trim_start','trim_end','crop_aspect','subtitle_font','subtitle_font_size','subtitle_stroke_color','subtitle_stroke_width','captions']
      const updates = {}; for (const k of allowed) if (k in body) updates[k] = body[k]
      await db.collection('generated_clips').updateOne({ id }, { $set: updates })
      const c = await db.collection('generated_clips').findOne({ id })
      return NextResponse.json(strip(c))
    }

    // ============= INTEGRATIONS (admin manages API keys for AI + payment providers) =============
    if (path_ === '/admin/integrations' && method === 'GET') {
      const list = await db.collection('integration_credentials').find({}).toArray()
      // Mask secrets in response
      const masked = list.map(strip).map(item => ({
        ...item,
        credentials: maskCredentials(item.credentials || {}),
        has_credentials: Object.keys(item.credentials || {}).length > 0,
      }))
      return NextResponse.json(masked)
    }
    // POST /api/admin/integrations  body: { provider, credentials, is_active }
    if (path_ === '/admin/integrations' && method === 'POST') {
      const body = await request.json()
      const provider = body.provider
      if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })
      const existing = await db.collection('integration_credentials').findOne({ provider })
      if (existing) {
        // merge credentials, never wipe unless explicit
        const merged = { ...(existing.credentials || {}), ...(body.credentials || {}) }
        // filter out empty strings so masked placeholders don't overwrite real values
        const cleaned = {}
        for (const [k, v] of Object.entries(merged)) {
          if (v !== '' && v !== null && v !== undefined && !isMaskedValue(v)) cleaned[k] = v
          else if (existing.credentials?.[k] && isMaskedValue(v)) cleaned[k] = existing.credentials[k]
        }
        await db.collection('integration_credentials').updateOne({ provider }, { $set: { credentials: cleaned, is_active: body.is_active !== false, updated_at: new Date() } })
      } else {
        const cleaned = {}
        for (const [k, v] of Object.entries(body.credentials || {})) {
          if (v !== '' && v !== null && v !== undefined && !isMaskedValue(v)) cleaned[k] = v
        }
        await db.collection('integration_credentials').insertOne({
          id: uuidv4(), provider, credentials: cleaned, is_active: body.is_active !== false,
          created_at: new Date(), updated_at: new Date(),
        })
      }
      const updated = await db.collection('integration_credentials').findOne({ provider })
      return NextResponse.json({ ...strip(updated), credentials: maskCredentials(updated.credentials || {}), has_credentials: Object.keys(updated.credentials || {}).length > 0 })
    }
    if (path_.startsWith('/admin/integrations/') && method === 'DELETE') {
      const provider = segments[2]
      await db.collection('integration_credentials').deleteOne({ provider })
      return NextResponse.json({ ok: true })
    }

    // ============= AUTO CAPTIONS =============
    // POST /api/ai/captions  body: { clip_id, language? }
    if (path_ === '/ai/captions' && method === 'POST') {
      const body = await request.json()
      const clipId = body.clip_id
      const language = body.language || 'en'
      if (!clipId) return NextResponse.json({ error: 'clip_id required' }, { status: 400 })
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'clip not found' }, { status: 404 })
      const duration = clip.end_time_seconds - clip.start_time_seconds
      const langName = body.language_name || language
      const prompt = `You are an auto-captioning AI for a short-form vertical video.\n\nClip title: "${clip.clip_title}"\nDuration: ${duration} seconds.\nHook: "${clip.hook_text || ''}"\nLanguage: ${langName}\n\nGenerate 6-10 short, punchy subtitle captions that would naturally appear in this clip, each 2-6 words long, in ${langName}. Distribute timestamps evenly across the ${duration} seconds.\n\nReturn ONLY valid JSON in this exact shape (no markdown, no commentary):\n{\n  "captions": [\n    { "start_time": 0.0, "end_time": 2.5, "text": "string" }\n  ]\n}\nMake the captions feel authentic to the title's topic. Use sentence-case (not ALL CAPS).`
      let content = ''
      try { content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.6, db }) }
      catch (e) { return NextResponse.json({ error: 'AI failed: ' + e.message }, { status: 500 }) }
      const parsed = safeJsonParse(content)
      if (!parsed?.captions) return NextResponse.json({ error: 'AI returned unparseable response', raw: content.slice(0,500) }, { status: 500 })
      // normalise timestamps
      const captions = parsed.captions.slice(0, 12).map(c => ({
        start_time: Math.max(0, Number(c.start_time) || 0),
        end_time: Math.min(duration, Number(c.end_time) || (Number(c.start_time) + 2)),
        text: String(c.text || '').slice(0, 80),
      }))
      await db.collection('generated_clips').updateOne({ id: clipId }, { $set: { captions, captions_language: language, captions_generated_at: new Date() } })
      const updated = await db.collection('generated_clips').findOne({ id: clipId })
      return NextResponse.json(strip(updated))
    }

    // ============= MEMES =============
    if (path_ === '/memes' && method === 'GET') {
      const list = await db.collection('memes').find({}).sort({ created_at: -1 }).toArray()
      return NextResponse.json(list.map(strip))
    }
    if (path_ === '/memes' && method === 'POST') {
      const body = await request.json()
      const doc = { id: uuidv4(), name: body.name || 'Untitled Meme', category: body.category || 'general', video_url: body.video_url || '', thumbnail_url: body.thumbnail_url || '', duration_seconds: Number(body.duration_seconds) || 3, is_active: body.is_active !== false, created_at: new Date() }
      await db.collection('memes').insertOne(doc)
      return NextResponse.json(strip(doc))
    }
    if (path_.startsWith('/memes/') && method === 'PUT') {
      const id = segments[1]; const body = await request.json()
      const allowed = ['name','category','video_url','thumbnail_url','duration_seconds','is_active']
      const updates = {}; for (const k of allowed) if (k in body) updates[k] = body[k]
      await db.collection('memes').updateOne({ id }, { $set: updates })
      const m = await db.collection('memes').findOne({ id })
      return NextResponse.json(strip(m))
    }
    if (path_.startsWith('/memes/') && method === 'DELETE') {
      const id = segments[1]; await db.collection('memes').deleteOne({ id }); return NextResponse.json({ ok: true })
    }

    // ============= UPLOAD =============
    // POST /api/upload  multipart form: { file, kind: 'meme_video' | 'meme_thumbnail' | 'workspace_video' }
    if (path_ === '/upload' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      const kind = form.get('kind') || 'meme_video'
      if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 })
      const ext = (file.name?.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const id = uuidv4()

      // ============= WORKSPACE VIDEO UPLOAD \u2014 kicks off full processing =============
      if (kind === 'workspace_video') {
        const user = await getUser(request, db)
        const clipMin = Math.max(5, parseInt(form.get('clip_min')) || 30)
        const clipMax = Math.max(clipMin + 5, parseInt(form.get('clip_max')) || 60)
        const addCaptions = form.get('add_captions') !== 'false'
        const language = form.get('language') || 'auto'
        const stylePreset = form.get('style_preset') || null
        let styleAss = null, overlaysConfig = null
        try { styleAss = form.get('style_ass') ? JSON.parse(form.get('style_ass')) : null } catch {}
        try { overlaysConfig = form.get('overlays_config') ? JSON.parse(form.get('overlays_config')) : null } catch {}

        const originalsDir = '/app/data/uploads/originals/' + id
        await fs.mkdir(originalsDir, { recursive: true })
        const filename = `video.${ext}`
        const fullPath = path.join(originalsDir, filename)
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(fullPath, buffer)

        const estimatedMinutes = Math.max(1, Math.ceil(buffer.length / (1024 * 1024 * 2)))
        if ((user?.credit_balance_minutes ?? 0) < estimatedMinutes) {
          await fs.rm(originalsDir, { recursive: true, force: true }).catch(()=>{})
          return NextResponse.json({ error: `Insufficient credits. You have ${user?.credit_balance_minutes || 0} min — this video needs ~${estimatedMinutes} min. Buy a package below.` }, { status: 402 })
        }

        await db.collection('videos_processed').insertOne({
          id, user_id: user.id, original_url: `local:${file.name}`,
          source_type: 'upload', title: file.name, thumbnail_url: null,
          status: 'queued', progress: 0,
          clip_length_range: { min: clipMin, max: clipMax },
          add_captions: addCaptions,
          language, style_preset: stylePreset, style_ass: styleAss, overlays_config: overlaysConfig,
          created_at: new Date(), updated_at: new Date(),
        })
        await logActivity(db, user.id, 'video_uploaded', request, { filename: file.name, size: buffer.length, clip_range: `${clipMin}-${clipMax}s`, style: stylePreset, language })

        const { processVideoInBackground } = await import('@/lib/video-processor')
        processVideoInBackground({ videoId: id, localFile: fullPath, userId: user.id, db, callLLM, clipLengthRange: { min: clipMin, max: clipMax }, addCaptions, language, stylePreset, styleAss, overlaysConfig }).catch(e => console.error('bg fail', e))

        return NextResponse.json({ video_id: id, status: 'queued', title: file.name, size: buffer.length, clip_length_range: { min: clipMin, max: clipMax }, add_captions: addCaptions, language, style_preset: stylePreset })
      }

      const subdir = kind === 'meme_thumbnail' ? 'thumbs' : kind === 'logo' ? 'logos' : 'memes'
      const dir = path.join(UPLOAD_DIR, subdir)
      await fs.mkdir(dir, { recursive: true })
      const filename = `${id}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(path.join(dir, filename), buffer)
      const url = `/api/files/${subdir}/${filename}`
      return NextResponse.json({ url, filename, size: buffer.length })
    }

    // ============= VIDEOS / AI =============
    if (path_ === '/videos' && method === 'POST') {
      const user = await getUser(request, db)
      const body = await request.json()
      const video = { id: uuidv4(), user_id: user.id, original_url: body.url || '', status: 'processing', created_at: new Date() }
      await db.collection('videos_processed').insertOne(video)
      return NextResponse.json(strip(video))
    }

    // POST /api/ai/analyze  body: { url, topic? }
    // Uses Gemini to imagine 3 viral 30-60s clip moments for the given video URL.
    // POST /api/ai/analyze  — starts REAL video processing in background
    if (path_ === '/ai/analyze' && method === 'POST') {
      const user = await getUser(request, db)
      const body = await request.json()
      const url = body.url || ''
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
      const clipMin = Math.max(5, parseInt(body.clip_min) || 30)
      const clipMax = Math.max(clipMin + 5, parseInt(body.clip_max) || 60)
      const addCaptions = body.add_captions !== false
      const language = body.language || 'auto'
      const stylePreset = body.style_preset || null
      const styleAss = body.style_ass || null
      const overlaysConfig = body.overlays_config || null

      if ((user?.credit_balance_minutes ?? 0) < 1) {
        return NextResponse.json({ error: 'Insufficient credits. Buy a package below to continue.' }, { status: 402 })
      }

      const meta = await metadataForUrl(url)
      const videoId = uuidv4()
      await db.collection('videos_processed').insertOne({
        id: videoId, user_id: user.id, original_url: url,
        source_type: meta.source_type || 'other',
        title: meta.title || null, thumbnail_url: meta.thumbnail || null,
        status: 'queued', progress: 0,
        clip_length_range: { min: clipMin, max: clipMax },
        add_captions: addCaptions,
        language, style_preset: stylePreset, style_ass: styleAss, overlays_config: overlaysConfig,
        created_at: new Date(), updated_at: new Date(),
      })
      await logActivity(db, user.id, 'ai_analyze_started', request, { url, clip_range: `${clipMin}-${clipMax}s`, style: stylePreset, language })

      const { processVideoInBackground } = await import('@/lib/video-processor')
      processVideoInBackground({ videoId, url, userId: user.id, db, callLLM, clipLengthRange: { min: clipMin, max: clipMax }, addCaptions, language, stylePreset, styleAss, overlaysConfig }).catch(e => console.error('bg fail', e))

      return NextResponse.json({ video_id: videoId, status: 'queued', source_type: meta.source_type, thumbnail: meta.thumbnail, title: meta.title, clip_length_range: { min: clipMin, max: clipMax }, add_captions: addCaptions, language, style_preset: stylePreset })
    }

    // GET /api/videos/:id  — poll processing status
    if (path_.startsWith('/videos/') && method === 'GET') {
      const id = segments[1]
      const v = await db.collection('videos_processed').findOne({ id })
      if (!v) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const clips = await db.collection('generated_clips').find({ video_id: id }).sort({ virality_score: -1 }).toArray()
      return NextResponse.json({ ...strip(v), clips: clips.map(strip) })
    }

    // POST /api/ai/translate  body: { language: 'es', strings: { key: 'English text', ... } }
    if (path_ === '/ai/translate' && method === 'POST') {
      const body = await request.json()
      const language = body.language || 'en'
      const strings = body.strings || {}
      const langName = body.language_name || language
      if (language === 'en') return NextResponse.json({ translations: strings })

      // cache key
      const cacheKey = `${language}:${Object.keys(strings).sort().join(',')}`
      const cached = await db.collection('translations_cache').findOne({ key: cacheKey })
      if (cached) return NextResponse.json({ translations: cached.value, cached: true })

      const prompt = `Translate each value in this JSON object to ${langName}. Keep the JSON keys exactly the same. Return ONLY valid JSON, no markdown.\n\n${JSON.stringify(strings)}`
      let content = ''
      try { content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.2, db }) }
      catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
      const translations = safeJsonParse(content)
      if (!translations) return NextResponse.json({ error: 'Translation parse failed', raw: content.slice(0,500) }, { status: 500 })
      await db.collection('translations_cache').updateOne({ key: cacheKey }, { $set: { key: cacheKey, value: translations, language, created_at: new Date() } }, { upsert: true })
      return NextResponse.json({ translations })
    }

    // ============= EMAIL/PASSWORD AUTH =============
    if (path_ === '/auth/signup' && method === 'POST') {
      const body = await request.json()
      const email = String(body.email || '').toLowerCase().trim()
      const password = String(body.password || '')
      const name = String(body.name || '').trim() || email.split('@')[0]
      if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
      if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      const existing = await db.collection('profiles').findOne({ email })
      if (existing && existing.password_hash) return NextResponse.json({ error: 'An account already exists with this email' }, { status: 409 })
      const isAdmin = ADMIN_EMAILS.has(email)
      let profile
      if (existing) {
        await db.collection('profiles').updateOne({ id: existing.id }, { $set: { password_hash: hashPassword(password), name: existing.name || name, email_verified: false } })
        profile = await db.collection('profiles').findOne({ id: existing.id })
      } else {
        profile = { id: uuidv4(), email, name, password_hash: hashPassword(password), credit_balance_minutes: isAdmin ? 9999 : 30, is_admin: isAdmin, role: isAdmin ? 'admin' : 'user', theme_preference: 'dark', email_verified: false, verification_token: crypto.randomBytes(16).toString('hex'), created_at: new Date() }
        await db.collection('profiles').insertOne(profile)
      }
      await logActivity(db, profile.id, 'user_signup', request, { email })
      // create session
      const token = uuidv4()
      await db.collection('sessions').insertOne({ session_token: token, user_id: profile.id, expires_at: new Date(Date.now()+7*86400000), created_at: new Date() })
      const verifyLink = `/auth/verify?token=${profile.verification_token}`
      const res = NextResponse.json({ user: strip({ ...profile, password_hash: undefined, verification_token: undefined }), verification_link: verifyLink })
      res.headers.set('Set-Cookie', `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*86400}; Secure`)
      return res
    }

    if (path_ === '/auth/signin' && method === 'POST') {
      const body = await request.json()
      const email = String(body.email || '').toLowerCase().trim()
      const password = String(body.password || '')
      const profile = await db.collection('profiles').findOne({ email })
      if (!profile || !profile.password_hash || !verifyPassword(password, profile.password_hash)) {
        await logActivity(db, null, 'signin_failed', request, { email })
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }
      // promote to admin if email is in allowlist
      if (ADMIN_EMAILS.has(email) && !isAdminProfile(profile)) {
        await db.collection('profiles').updateOne({ id: profile.id }, { $set: { is_admin: true, role: 'admin' } })
        profile.is_admin = true; profile.role = 'admin'
      }
      await logActivity(db, profile.id, 'user_signin', request, { email })
      const token = uuidv4()
      await db.collection('sessions').insertOne({ session_token: token, user_id: profile.id, expires_at: new Date(Date.now()+7*86400000), created_at: new Date() })
      const res = NextResponse.json({ user: strip({ ...profile, password_hash: undefined, verification_token: undefined }) })
      res.headers.set('Set-Cookie', `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*86400}; Secure`)
      return res
    }

    if (path_ === '/auth/forgot-password' && method === 'POST') {
      const body = await request.json()
      const email = String(body.email || '').toLowerCase().trim()
      const profile = await db.collection('profiles').findOne({ email })
      if (!profile) return NextResponse.json({ ok: true }) // don't reveal account existence
      const resetToken = crypto.randomBytes(24).toString('hex')
      await db.collection('profiles').updateOne({ id: profile.id }, { $set: { reset_token: resetToken, reset_token_expires: new Date(Date.now()+3600000) } })
      await logActivity(db, profile.id, 'password_reset_requested', request, { email })
      // MOCK email — return link in response for dev/demo
      const resetLink = `/reset-password?token=${resetToken}`
      return NextResponse.json({ ok: true, reset_link: resetLink, note: 'In production this link would be emailed. Shown here for demo.' })
    }

    if (path_ === '/auth/reset-password' && method === 'POST') {
      const body = await request.json()
      const token = String(body.token || '')
      const newPassword = String(body.password || '')
      if (newPassword.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
      const profile = await db.collection('profiles').findOne({ reset_token: token })
      if (!profile || !profile.reset_token_expires || new Date(profile.reset_token_expires) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
      }
      await db.collection('profiles').updateOne({ id: profile.id }, { $set: { password_hash: hashPassword(newPassword) }, $unset: { reset_token: '', reset_token_expires: '' } })
      await logActivity(db, profile.id, 'password_reset_completed', request, {})
      return NextResponse.json({ ok: true })
    }


    // POST /api/clips/:id/restyle  — re-burn captions with new style/position WITHOUT re-fetching from YouTube
    if (path_.startsWith('/clips/') && path_.endsWith('/restyle') && method === 'POST') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      const body = await request.json()
      const styleAss = body.style_ass || null
      const stylePreset = body.style_preset || clip.style_preset
      const overlaysConfig = body.overlays_config || clip.overlays_config
      const fontSize = body.font_size || styleAss?.fontSize
      const outlineSize = body.outline_size

      try {
        const clipFile = clip.storage_url_mp4.replace('/api/files/', '')
        const srcPath = path.join('/app/data/uploads', clipFile)
        if (!(await fs.stat(srcPath).catch(()=>null))) return NextResponse.json({ error: 'Source clip file missing' }, { status: 410 })

        const tmpDir = `/tmp/restyle_${clipId}`
        await fs.mkdir(tmpDir, { recursive: true })

        const ass = { ...(styleAss || {}) }
        if (fontSize)    ass.fontSize = Number(fontSize)
        if (outlineSize !== undefined) ass.outline = Number(outlineSize)

        // Build subtitles filter
        const { spawn } = await import('child_process')
        const captionPos = overlaysConfig?.caption?.position_percent ?? 78
        const marginV = Math.max(20, Math.round((100 - Math.max(0, Math.min(100, captionPos))) * 9))
        const baseStyle = { fontName:'DejaVu Sans', fontSize:18, primary:'&H00FFFFFF&', outlineColour:'&H00000000&', borderStyle:1, outline:2, shadow:0, bold:1 }
        const s = { ...baseStyle, ...ass }
        const styleParts = [
          `FontName=${s.fontName}`, `FontSize=${s.fontSize}`, `PrimaryColour=${s.primary}`,
          s.back ? `BackColour=${s.back}` : null,
          `OutlineColour=${s.outlineColour}`, `BorderStyle=${s.borderStyle}`, `Outline=${s.outline}`, `Shadow=${s.shadow}`, `Bold=${s.bold}`, `Alignment=2`, `MarginV=${marginV}`,
        ].filter(Boolean).join(',')

        // Re-burn caption pass if we have stored SRT, otherwise just re-encode (effectively a no-op style swap fails gracefully)
        const srtContent = clip.srt_content
        const newPath = path.join('/app/data/uploads/clips', `${clipId}.mp4`)  // overwrite same key so existing references work
        const tmpOut = path.join(tmpDir, 'restyled.mp4')

        await new Promise((resolve, reject) => {
          let vf = null
          if (srtContent) {
            const srtPath = path.join(tmpDir, 'cap.srt')
            require('fs').writeFileSync(srtPath, srtContent, 'utf-8')
            const escSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
            vf = `subtitles='${escSrt}':force_style='${styleParts}'`
          }
          const args = ['-y', '-i', srcPath]
          if (vf) args.push('-vf', vf)
          args.push('-c:v','libx264','-preset','veryfast','-crf','22','-c:a','copy','-movflags','+faststart', tmpOut)
          const p = spawn('/usr/bin/ffmpeg', args)
          let stderr = ''
          p.stderr.on('data', d => { stderr += d.toString() })
          p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(0,300)}`)))
          p.on('error', reject)
        })

        await fs.copyFile(tmpOut, newPath)
        try { await fs.unlink(tmpOut) } catch {}
        try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
        await db.collection('generated_clips').updateOne(
          { id: clipId },
          { $set: { style_preset: stylePreset, overlays_config: overlaysConfig, restyled_at: new Date(), restyled_count: (clip.restyled_count || 0) + 1, captions_burned: !!srtContent } }
        )
        await logActivity(db, user.id, 'clip_restyled', request, { clip_id: clipId, style: stylePreset })

        // Bust R2 cache if previously uploaded
        if (clip.r2_key) {
          try { const { deleteFromR2 } = await import('@/lib/r2'); await deleteFromR2({ db, key: clip.r2_key }); await db.collection('generated_clips').updateOne({ id: clipId }, { $unset: { r2_key: '', r2_size: '', r2_uploaded_at: '' } }) } catch {}
        }

        const updated = await db.collection('generated_clips').findOne({ id: clipId })
        return NextResponse.json({ ok: true, clip: strip(updated) })
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // POST /api/clips/:id/transcribe — on-demand per-clip transcription for clips that don't have one.
    // Used when the original ingestion couldn't transcribe (e.g. YT blocked audio-only stream).
    // Extracts audio from the clip's local MP4 and runs Groq/OpenAI Whisper on it. Free for now — we already
    // charged for the source video ingestion. Returns the resulting segments + persists srt_content.
    if (path_.startsWith('/clips/') && path_.endsWith('/transcribe') && method === 'POST') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      if (clip.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      // Idempotency — if we already have a transcript, just return it.
      if (clip.srt_content && clip.srt_content.trim().length > 20) {
        return NextResponse.json({ ok: true, already_transcribed: true, srt_content: clip.srt_content })
      }
      // Resolve local file path from storage_url_mp4 (/api/files/clips/<name>.mp4)
      const mp4Match = /\/api\/files\/clips\/([^?]+\.mp4)/.exec(clip.storage_url_mp4 || '')
      if (!mp4Match) return NextResponse.json({ error: 'Clip has no local MP4 to transcribe' }, { status: 400 })
      const localMp4 = path.join('/app/data/uploads/clips', mp4Match[1])
      try { await fs.access(localMp4) } catch { return NextResponse.json({ error: 'Local MP4 not found on disk' }, { status: 410 }) }
      try {
        const { transcribeClipOnDemand } = await import('@/lib/video-processor')
        const result = await transcribeClipOnDemand({
          db,
          clipId,
          clipPath: localMp4,
          clipDuration: (clip.end_time_seconds - clip.start_time_seconds) || 30,
          language: clip.language || 'auto',
        })
        if (!result?.ok) {
          return NextResponse.json({ error: result?.error || 'Transcription failed', hint: result?.hint }, { status: 500 })
        }
        await db.collection('generated_clips').updateOne({ id: clipId }, {
          $set: {
            srt_content: result.srt_content,
            caption_segments: result.segments || null,
            transcription_source: 'whisper_on_demand',
            transcribed_at: new Date(),
          }
        })
        return NextResponse.json({ ok: true, srt_content: result.srt_content, segments: result.segments || [], segments_count: result.segments_count, source: 'whisper_on_demand' })
      } catch (e) {
        return NextResponse.json({ error: 'Transcription failed', message: e.message }, { status: 500 })
      }
    }

    // GET /api/clips/:id/transcript — return parsed segments [{start, end, text, words?}] for the editor.
    // Prefers `caption_segments` (which carries word-level timings for karaoke highlighting) if stored;
    // falls back to parsing `srt_content` for legacy clips.
    if (path_.startsWith('/clips/') && path_.endsWith('/transcript') && method === 'GET') {
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      // Prefer stored caption_segments (has word timings)
      if (Array.isArray(clip.caption_segments) && clip.caption_segments.length > 0) {
        return NextResponse.json({
          segments: clip.caption_segments.map(s => ({
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            text: String(s.text || ''),
            words: Array.isArray(s.words) ? s.words : [],
          })),
          clip_id: clipId,
          has_srt: true,
          has_word_timings: clip.caption_segments.some(s => Array.isArray(s.words) && s.words.length > 0),
        })
      }
      const src = clip.srt_content || ''
      const segs = []
      if (src.trim()) {
        const lines = src.split(/\r?\n/)
        let i = 0
        while (i < lines.length) {
          const idxLine = lines[i++]
          if (!idxLine || !/^\d+$/.test(idxLine.trim())) continue
          const timing = lines[i++] || ''
          const m = timing.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
          if (!m) continue
          const startS = (+m[1] * 3600 + +m[2] * 60 + +m[3]) + +m[4] / 1000
          const endS = (+m[5] * 3600 + +m[6] * 60 + +m[7]) + +m[8] / 1000
          const textLines = []
          while (i < lines.length && lines[i].trim() !== '') { textLines.push(lines[i++]) }
          i++
          segs.push({ start: startS, end: endS, text: textLines.join(' ').trim(), words: [] })
        }
      }
      return NextResponse.json({ segments: segs, clip_id: clipId, has_srt: !!src.trim(), has_word_timings: false })
    }

    // PUT /api/clips/:id/transcript — save edited segments back; rebuilds srt_content
    if (path_.startsWith('/clips/') && path_.endsWith('/transcript') && method === 'PUT') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      const body = await request.json().catch(() => ({}))
      const incoming = Array.isArray(body.segments) ? body.segments : []
      const cleaned = incoming.map(s => ({
        start: Math.max(0, Number(s.start) || 0),
        end: Math.max(0, Number(s.end) || 0),
        text: String(s.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500),
      })).filter(s => s.text && s.end > s.start)
      // Re-serialize SRT
      const srtTime = (sec) => {
        const x = Math.max(0, sec)
        const hh = String(Math.floor(x/3600)).padStart(2,'0')
        const mm = String(Math.floor((x%3600)/60)).padStart(2,'0')
        const ss = String(Math.floor(x%60)).padStart(2,'0')
        const ms = String(Math.floor((x - Math.floor(x))*1000)).padStart(3,'0')
        return `${hh}:${mm}:${ss},${ms}`
      }
      const srt = cleaned.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n')
      await db.collection('generated_clips').updateOne({ id: clipId }, { $set: { srt_content: srt, transcript_edited_at: new Date() } })
      await logActivity(db, user.id, 'clip_transcript_edited', request, { clip_id: clipId, segments_count: cleaned.length })
      return NextResponse.json({ ok: true, segments_count: cleaned.length })
    }

    // POST /api/clips/:id/render  — UNIFIED edit: re-renders MP4 applying ALL edits in one ffmpeg pass.
    // Body: { trim_start, trim_end, crop_aspect, speed, style_preset, style_ass, font_size, outline_size,
    //         caption_position_percent, logo_url, logo_position, title_text, title_position, clip_title, template_id }
    if (path_.startsWith('/clips/') && path_.endsWith('/render') && method === 'POST') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      if (!clip.storage_url_mp4 || !clip.storage_url_mp4.startsWith('/api/files/')) {
        return NextResponse.json({ error: 'No rendered MP4 available — clip must be generated first' }, { status: 410 })
      }
      const body = await request.json().catch(() => ({}))
      // Probe actual MP4 duration via ffprobe — DB's start/end_time are the ORIGINAL bounds,
      // but the file on disk may already be shorter (e.g. if a previous trim was applied).
      let srcDuration = (clip.end_time_seconds || 0) - (clip.start_time_seconds || 0)
      try {
        const srcCheckPath = path.join(UPLOAD_DIR, clip.storage_url_mp4.replace(/^\/api\/files\//, ''))
        const { execFile } = await import('child_process')
        const probed = await new Promise((resolve) => {
          execFile('/usr/bin/ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', srcCheckPath], (err, stdout) => {
            if (err) return resolve(null)
            const d = parseFloat(stdout.trim())
            resolve(Number.isFinite(d) && d > 0 ? d : null)
          })
        })
        if (probed) srcDuration = probed
      } catch {}
      const trimStart = Number.isFinite(body.trim_start) ? Math.max(0, Number(body.trim_start)) : 0
      const trimEnd = Number.isFinite(body.trim_end) ? Math.min(srcDuration, Number(body.trim_end)) : srcDuration
      if (trimEnd - trimStart < 1) return NextResponse.json({ error: 'Trim range must be at least 1 second' }, { status: 400 })
      const speed = Math.max(0.5, Math.min(2.0, Number(body.speed) || 1.0))
      const cropAspect = body.crop_aspect || clip.crop_aspect || null
      const stylePreset = body.style_preset || clip.style_preset || null
      const captionPos = Number.isFinite(body.caption_position_percent) ? Math.max(5, Math.min(95, Number(body.caption_position_percent))) : (clip.overlays_config?.caption?.position_percent ?? 78)
      // Drag-positioned caption coords (anchor = caption CENTER, % of frame).
      // If caption_y_percent is set, it overrides captionPos (which is legacy position-from-top).
      const captionXPercent = Number.isFinite(body.caption_x_percent) ? Math.max(5, Math.min(95, Number(body.caption_x_percent))) : 50
      const captionYPercent = Number.isFinite(body.caption_y_percent) ? Math.max(5, Math.min(95, Number(body.caption_y_percent))) : captionPos
      // FILL MODE for aspect-ratio change: 'crop' (default), 'blur' (blurred background), 'color' (solid bars)
      const fillMode = ['crop', 'blur', 'color'].includes(body.fill_mode) ? body.fill_mode : 'crop'
      const fillColor = /^#[0-9a-f]{6}$/i.test(String(body.fill_color || '')) ? body.fill_color : '#000000'
      const fontSize = Number(body.font_size) || (body.style_ass?.fontSize) || 18
      const outlineSize = Number.isFinite(body.outline_size) ? Number(body.outline_size) : 2
      const styleAss = { ...(body.style_ass || clip.style_ass || {}) }
      if (fontSize) styleAss.fontSize = fontSize
      if (outlineSize !== undefined) styleAss.outline = outlineSize
      const logoUrl = body.logo_url || null
      const logoPosition = body.logo_position || 'top-right'  // top-left | top-right | bottom-left | bottom-right | custom
      // Optional drag-positioned coords (0–100 % of frame). If both set, override the 9-corner preset.
      const logoX = Number.isFinite(body.logo_x_percent) ? Math.max(0, Math.min(100, Number(body.logo_x_percent))) : null
      const logoY = Number.isFinite(body.logo_y_percent) ? Math.max(0, Math.min(100, Number(body.logo_y_percent))) : null
      const logoScale = Number.isFinite(body.logo_scale_percent) ? Math.max(5, Math.min(50, Number(body.logo_scale_percent))) : 12  // logo width as % of frame width
      const titleText = String(body.title_text || '').trim().slice(0, 120)
      const titlePosition = body.title_position || 'top'  // top | bottom
      const newClipTitle = body.clip_title ? String(body.clip_title).slice(0, 90) : null
      const templateId = body.template_id || clip.template_id || null

      // ============= CREDIT CHECK & DEDUCTION (Double-Dip render billing) =============
      // Rate: 0.25 credit-minutes per 1 second of EXPORTED clip duration (post trim + speed).
      // Example: 45s output = 45 × 0.25 = 11.25 credits.
      // Deducted atomically BEFORE ffmpeg starts. Refunded on render failure.
      const outputDurationSec = Math.max(1, (trimEnd - trimStart) / speed)
      const renderCost = Math.round(outputDurationSec * 0.25 * 100) / 100  // 2-decimal precision
      let creditsDeducted = false
      try {
        const updated = await db.collection('profiles').findOneAndUpdate(
          { id: user.id, credit_balance_minutes: { $gte: renderCost } },
          { $inc: { credit_balance_minutes: -renderCost } },
          { returnDocument: 'after' }
        )
        // Mongo driver v6 returns the doc directly; older versions return { value: doc }
        const updatedDoc = updated?.value ?? updated
        if (!updatedDoc) {
          const fresh = await db.collection('profiles').findOne({ id: user.id }, { projection: { credit_balance_minutes: 1 } })
          const have = fresh?.credit_balance_minutes ?? 0
          return NextResponse.json({
            error: 'insufficient_credits',
            message: `Low credits — this ${Math.round(outputDurationSec)}s render costs ${renderCost} credits but you only have ${have.toFixed(2)}. Buy more credits to continue.`,
            required: renderCost,
            available: have,
            duration_seconds: outputDurationSec,
          }, { status: 402 })
        }
        creditsDeducted = true
        // Audit trail
        try {
          await db.collection('credit_transactions').insertOne({
            id: uuidv4(),
            user_id: user.id,
            clip_id: clipId,
            amount: -renderCost,
            reason: 'clip_render',
            duration_seconds: outputDurationSec,
            balance_after: updatedDoc.credit_balance_minutes,
            created_at: new Date(),
          })
        } catch {}
      } catch (creditErr) {
        return NextResponse.json({ error: 'Credit check failed', message: creditErr.message }, { status: 500 })
      }

      // Helper to refund credits if the render fails downstream
      const refundCredits = async (reason) => {
        if (!creditsDeducted) return
        try {
          await db.collection('profiles').updateOne({ id: user.id }, { $inc: { credit_balance_minutes: renderCost } })
          await db.collection('credit_transactions').insertOne({
            id: uuidv4(),
            user_id: user.id,
            clip_id: clipId,
            amount: renderCost,
            reason: 'clip_render_refund',
            error_reason: String(reason || 'unknown').slice(0, 200),
            duration_seconds: outputDurationSec,
            created_at: new Date(),
          })
          creditsDeducted = false
        } catch {}
      }
      // =============================================================================

      // Source file
      const srcPath = path.join(UPLOAD_DIR, clip.storage_url_mp4.replace(/^\/api\/files\//, ''))
      if (!(await fs.stat(srcPath).catch(()=>null))) return NextResponse.json({ error: 'Source MP4 missing on server' }, { status: 410 })

      // Need a non-burned source to re-burn captions. Look for cached "raw_<id>.mp4" in /clips dir, else use the current MP4 as input (captions may already be burned, but we'll proceed — re-burn over burned text is acceptable in edit flow).
      const tmpDir = `/tmp/render_${clipId}_${Date.now()}`
      await fs.mkdir(tmpDir, { recursive: true })
      const tmpOut = path.join(tmpDir, 'out.mp4')

      try {
        const { spawn } = await import('child_process')

        // Probe source dims FIRST so we can compute output frame dims and use them for ASS PlayRes.
        let frameW = 1080, frameH = 1920
        try {
          const { execFile } = await import('child_process')
          const { stdout: dim } = await new Promise((resolve, reject) => {
            execFile('/usr/bin/ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0', srcPath], (err, stdout) => err ? reject(err) : resolve({ stdout }))
          })
          const [w, h] = dim.trim().split(',').map(Number)
          if (w && h) {
            if (cropAspect && /^\d+:\d+$/.test(cropAspect)) {
              if (cropAspect === '9:16') { frameW = 1080; frameH = 1920 }
              else if (cropAspect === '16:9') { frameW = 1920; frameH = 1080 }
              else if (cropAspect === '1:1') { frameW = 1080; frameH = 1080 }
              else {
                const [aw, ah] = cropAspect.split(':').map(Number)
                frameW = 1080; frameH = Math.round(1080 * ah / aw)
              }
            } else { frameW = w; frameH = h }
          }
        } catch {}

        // Build subtitles filter — accepts user-edited caption_segments override from the editor.
        // We emit a real ASS file (not SRT + force_style) so we can:
        //   • Set PlayResX/Y to the EXACT output frame dims — makes \pos(x,y) work in actual pixels.
        //   • Use WrapStyle=2 (NO automatic line wrapping) so our explicit 4-word chunking is final.
        //   • Position each cue with \pos(cx,cy) + \an5 to mirror the drag-coords from the preview.
        // The user-facing `font_size` value still behaves like the legacy "default 288 PlayResY" semantics,
        // so we scale it up by (frameH / 288) when writing FontSize so visual size matches old defaults.
        let subtitleFilter = ''
        const userCaptionSegments = Array.isArray(body.caption_segments) ? body.caption_segments : null
        const ASS_FONT_SCALE = frameH / 288  // ≈ 6.67 for 9:16, ≈ 3.75 for 16:9, 3.75 for 1:1
        const assFontSize = Math.max(8, Math.round(fontSize * ASS_FONT_SCALE))
        const assOutline = Math.max(0, Math.min(8, Math.round(outlineSize * ASS_FONT_SCALE / 3)))
        // Caption center anchor in OUTPUT frame pixels (matches preview's caption_x/y_percent)
        const cx = Math.round(Math.max(5, Math.min(95, captionXPercent)) / 100 * frameW)
        const cy = Math.round(Math.max(5, Math.min(95, captionYPercent)) / 100 * frameH)
        // ASS color helpers — Style fields use &HAABBGGRR (no trailing &); inline override tags use trailing &.
        const stripTrailAmp = (c) => c ? String(c).replace(/&$/, '') : c
        // Build .ass file content from chunked cues (≤4 words/line, hard split for very long cues)
        const writeAss = async (cues) => {
          const fmt = (s) => {
            const sec = Math.max(0, s)
            const hh = Math.floor(sec / 3600)
            const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
            const ss = String(Math.floor(sec % 60)).padStart(2, '0')
            const cs = String(Math.floor((sec - Math.floor(sec)) * 100)).padStart(2, '0')
            return `${hh}:${mm}:${ss}.${cs}`
          }
          const MAX_WORDS_PER_LINE = 4
          // Chunked cues carry through the ORIGINAL cue's `words` array (word-level timing) if the
          // upstream transcriber provided it. This is needed to emit karaoke-style word highlighting.
          const chunked = []
          for (const c of cues) {
            const text = String(c.text || '').replace(/\s+/g, ' ').trim()
            if (!text || !(c.end > c.start)) continue
            const words = text.split(/\s+/)
            // Word-level timings, if any. Shape: [{start, end, text}]. Timings are in the SAME frame as `c.start/end`.
            const wordTimings = Array.isArray(c.words) ? c.words.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end)) : []
            if (words.length <= MAX_WORDS_PER_LINE) {
              chunked.push({ start: c.start, end: c.end, text, words: wordTimings })
            } else if (words.length <= MAX_WORDS_PER_LINE * 2) {
              const half = Math.ceil(words.length / 2)
              // Use literal \N for ASS line break inside Dialogue text
              chunked.push({ start: c.start, end: c.end, text: words.slice(0, half).join(' ') + '\\N' + words.slice(half).join(' '), words: wordTimings })
            } else {
              const numChunks = Math.ceil(words.length / MAX_WORDS_PER_LINE)
              const per = (c.end - c.start) / numChunks
              for (let k = 0; k < numChunks; k++) {
                const slice = words.slice(k * MAX_WORDS_PER_LINE, (k + 1) * MAX_WORDS_PER_LINE).join(' ')
                if (slice) {
                  const chunkStart = c.start + k * per
                  const chunkEnd = c.start + (k + 1) * per
                  const chunkWords = wordTimings.filter(w => w.start >= chunkStart - 0.05 && w.end <= chunkEnd + 0.05)
                  chunked.push({ start: chunkStart, end: chunkEnd, text: slice, words: chunkWords })
                }
              }
            }
          }
          if (chunked.length === 0) return null

          // Resolve final style. Default white text + black outline. Merge user style_ass on top.
          const s = {
            fontName: 'DejaVu Sans',
            primary: '&H00FFFFFF&',
            outlineColour: '&H00000000&',
            back: null,
            borderStyle: 1,
            bold: 1,
            ...(styleAss || {}),
          }
          const primary = stripTrailAmp(s.primary || '&H00FFFFFF')
          // libass 0.17.x QUIRK: for BorderStyle=3 (opaque box), the field used to color the box is
          // actually `OutlineColour` (\3c), NOT `BackColour`. This contradicts the VSFilter/ASS spec
          // but is how libass has implemented it since ~0.14. So when the preset has a `back` color
          // (which is our high-level "background box color" concept), we plug it into the OutlineColour
          // slot of the .ass Style row. `BackColour` becomes the drop-shadow color instead.
          const styleBack = s.back ? stripTrailAmp(s.back) : null
          const styleOutlineCol = stripTrailAmp(s.outlineColour || '&H00000000')
          const outlineCol = styleBack || styleOutlineCol   // if back defined, it fills the opaque box
          const back = styleBack ? '&H80000000' : '&H80000000'  // shadow color; not used visually
          // borderStyle: 1 = outline+drop-shadow, 3 = opaque box (for "back" presets)
          const borderStyle = s.borderStyle || (s.back ? 3 : 1)
          const bold = s.bold ? -1 : 0
          // CRITICAL: For BorderStyle=3 (opaque box), the "Outline" field is actually the PADDING
          // between the text and the edges of the box. If it's 0, the box collapses and becomes
          // invisible — you get plain text with no background. So we ENFORCE a minimum padding of
          // ~1/6 of the font size when using a background box style.
          // ADDITIONAL: libass 0.17.x requires Shadow > 0 for BorderStyle=3 boxes to actually render.
          // When Shadow=0 in this build, the opaque box is silently skipped — leaving plain text with
          // no background. So we force a small Shadow value (matching Outline scale) when back is set.
          let effectiveOutline = assOutline
          let effectiveShadow = 0
          if (borderStyle === 3) {
            const minPad = Math.max(10, Math.round(assFontSize / 6))
            effectiveOutline = Math.max(minPad, assOutline)
            // Small shadow to force libass to draw the box (0 disables the box in libass 0.17.1)
            effectiveShadow = Math.max(2, Math.round(assFontSize / 40))
          }
          // Word-level accent color — used for karaoke-style word highlight (see writeAssWithWords below).
          // Fallback to a bright yellow if user didn't provide one.
          const accentColour = stripTrailAmp(s.accent || s.accentColour || '&H0000FFFF&') // ASS = &HAABBGGRR → 00FFFF = pure yellow (RR=FF GG=FF BB=00 → RGB(0xFF, 0xFF, 0x00) is wrong; correct: &H0000FFFF = alpha 00 blue 00 green FF red FF → RGB(255,255,0) YELLOW ✓)
          // Style.MarginL/R/V are unused because we override per-cue with \pos. Set generous side margins anyway.
          const styleMarginH = Math.round(frameW * 0.05)
          const styleLine = `Style: Default,${s.fontName},${assFontSize},${primary},&H000000FF,${outlineCol},${back},${bold},0,0,0,100,100,0,0,${borderStyle},${effectiveOutline},${effectiveShadow},5,${styleMarginH},${styleMarginH},0,1`

          // Word-level HIGHLIGHTING (Vizard/Opus-Clip style) — when we have per-word timings,
          // emit one Dialogue line PER active word window. Each line renders the FULL cue text with
          // one word colored in the accent color (default yellow) so the "spoken word" pulses through.
          // If no word timings are available, we fall back to a single Dialogue per cue.
          const wordHighlight = body.word_highlight !== false // default ON when word timings exist
          const events = []
          for (const c of chunked) {
            const usableWords = wordHighlight && Array.isArray(c.words) && c.words.length > 0
              ? c.words.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start && w.end > c.start && w.start < c.end)
              : []
            if (usableWords.length === 0) {
              // No word timings → single static cue
              events.push(`Dialogue: 0,${fmt(c.start)},${fmt(c.end)},Default,,0,0,0,,{\\an5\\pos(${cx},${cy})}${c.text}`)
              continue
            }
            // Split the cue text into "renderable tokens" that align with word timings.
            // Explicit \N line breaks are preserved.
            const cueTextTokens = c.text.split(/(\\N|\s+)/).filter(t => t.length > 0)  // words, spaces, line breaks
            // Map WORD tokens to word-timing entries by order (spaces / \N don't consume timings).
            const wordTokenIndices = []
            for (let i = 0; i < cueTextTokens.length; i++) {
              const t = cueTextTokens[i]
              if (t === '\\N') continue
              if (/^\s+$/.test(t)) continue
              wordTokenIndices.push(i)
            }
            const timedWords = usableWords.slice(0, wordTokenIndices.length)
            // For each timed word, emit a Dialogue line covering that word's time window.
            // The active word gets accent color + slight bold outline; other words stay primary.
            let prevEnd = c.start
            for (let wi = 0; wi < timedWords.length; wi++) {
              const w = timedWords[wi]
              const activeIdx = wordTokenIndices[wi]
              const wStart = Math.max(c.start, Math.min(c.end - 0.01, w.start))
              const wEnd = Math.max(wStart + 0.05, Math.min(c.end, w.end))
              // If there's a gap before this word (start of cue OR gap between words), emit a
              // "no-highlight" filler so the text is visible with all words in primary color.
              if (wStart > prevEnd + 0.02) {
                const noHi = cueTextTokens.join('')
                events.push(`Dialogue: 0,${fmt(prevEnd)},${fmt(wStart)},Default,,0,0,0,,{\\an5\\pos(${cx},${cy})}${noHi}`)
              }
              // Build the highlighted variant — rebuild the text with an accent-color override
              // wrapping the active word ONLY. We only change PrimaryColour (\c) — NOT the outline
              // (\3c) — because with BorderStyle=3 the "outline" is the box padding and changing its
              // color would draw a giant accent-colored box over the word text.
              const parts = []
              for (let ti = 0; ti < cueTextTokens.length; ti++) {
                const tok = cueTextTokens[ti]
                if (ti === activeIdx) {
                  // Accent text color, then \r resets to Default style for the rest.
                  parts.push(`{\\c${accentColour}}${tok}{\\r}`)
                } else {
                  parts.push(tok)
                }
              }
              events.push(`Dialogue: 0,${fmt(wStart)},${fmt(wEnd)},Default,,0,0,0,,{\\an5\\pos(${cx},${cy})}${parts.join('')}`)
              prevEnd = wEnd
            }
            // Trailing tail after the last word — show the cue with all words in primary until c.end
            if (prevEnd < c.end - 0.02) {
              events.push(`Dialogue: 0,${fmt(prevEnd)},${fmt(c.end)},Default,,0,0,0,,{\\an5\\pos(${cx},${cy})}${cueTextTokens.join('')}`)
            }
          }
          const eventsBlock = events.join('\n')

          const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${frameW}
PlayResY: ${frameH}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventsBlock}
`
          const assPath = path.join(tmpDir, 'cap.ass')
          await fs.writeFile(assPath, ass, 'utf-8')
          // DEBUG: keep a copy at a stable path for inspection while iterating on styles.
          try { await fs.writeFile('/tmp/last_cap.ass', ass, 'utf-8') } catch {}
          return { assPath, chunked }
        }

        let assResult = null
        if (userCaptionSegments && userCaptionSegments.length > 0) {
          // Editor passes already-clip-local cues. Adjust for trim window + speed.
          // Preserve `words[]` (word-level timings for karaoke highlighting) and re-map their
          // timings by the same (trim+speed) transform we apply to the cue itself.
          const adjusted = userCaptionSegments.map(s => {
            const startS = Math.max(0, Number(s.start) || 0)
            const endS = Math.max(startS + 0.1, Number(s.end) || startS + 0.5)
            const ns = startS - trimStart
            const ne = endS - trimStart
            if (ne <= 0 || ns >= (trimEnd - trimStart)) return null
            const cueStart = Math.max(0, ns) / speed
            const cueEnd = Math.min(trimEnd - trimStart, ne) / speed
            // Re-map words (if present) into clip-local + speed-adjusted time
            let words = null
            if (Array.isArray(s.words) && s.words.length > 0) {
              words = s.words.map(w => {
                const ws = Math.max(0, Number(w.start) || 0) - trimStart
                const we = Math.max(ws + 0.05, Number(w.end) || ws + 0.1) - trimStart
                if (we <= 0 || ws >= (trimEnd - trimStart)) return null
                return {
                  start: Math.max(0, ws) / speed,
                  end: Math.min(trimEnd - trimStart, we) / speed,
                  text: String(w.text || w.word || '').trim(),
                }
              }).filter(Boolean)
            }
            return { start: cueStart, end: cueEnd, text: String(s.text || ''), words }
          }).filter(Boolean)
          assResult = await writeAss(adjusted)
        } else if (clip.srt_content && clip.srt_content.trim().length > 0) {
          // Parse cached SRT and shift to trim window + speed
          const lines = clip.srt_content.split(/\r?\n/)
          const parsed = []
          let i = 0
          while (i < lines.length) {
            const idxLine = lines[i++]
            if (!idxLine || !/^\d+$/.test(idxLine.trim())) continue
            const timing = lines[i++] || ''
            const m = timing.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
            if (!m) continue
            const startS = (+m[1] * 3600 + +m[2] * 60 + +m[3]) + +m[4] / 1000
            const endS = (+m[5] * 3600 + +m[6] * 60 + +m[7]) + +m[8] / 1000
            const textLines = []
            while (i < lines.length && lines[i].trim() !== '') { textLines.push(lines[i++]) }
            i++
            const ns = startS - trimStart
            const ne = endS - trimStart
            if (ne <= 0 || ns >= (trimEnd - trimStart)) continue
            parsed.push({ start: Math.max(0, ns) / speed, end: Math.min(trimEnd - trimStart, ne) / speed, text: textLines.join(' ') })
          }
          assResult = await writeAss(parsed)
        }

        if (assResult?.assPath) {
          const escAss = assResult.assPath.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'")
          // ffmpeg's subtitles filter auto-detects .ass extension and uses libass directly.
          subtitleFilter = `subtitles='${escAss}'`
          try {
            // Persist a back-compat SRT-style record of what was rendered (for the CC tab on next open)
            const srtBack = assResult.chunked.map((c, i) => {
              const t = (s) => {
                const sec = Math.max(0, s)
                const hh = String(Math.floor(sec/3600)).padStart(2,'0')
                const mm = String(Math.floor((sec%3600)/60)).padStart(2,'0')
                const ss = String(Math.floor(sec%60)).padStart(2,'0')
                const ms = String(Math.floor((sec - Math.floor(sec))*1000)).padStart(3,'0')
                return `${hh}:${mm}:${ss},${ms}`
              }
              const cleanTxt = String(c.text || '').replace(/\\N/g, '\n')
              return `${i + 1}\n${t(c.start)} --> ${t(c.end)}\n${cleanTxt}\n`
            }).join('\n')
            await db.collection('generated_clips').updateOne({ id: clipId }, { $set: { srt_content_rendered: srtBack } })
          } catch {}
        }

        // Build video filter chain: crop/scale → setpts → subtitles → drawtext (title)
        // Supports three FILL MODES for aspect-ratio change:
        //   'crop'  — center crop (loses sides)
        //   'blur'  — blurred copy of original as background, foreground letterboxed (Reels-style)
        //   'color' — solid color bars top/bottom or left/right
        let vfilters = []
        let useFilterComplex = false
        let filterComplex = null
        const targetW = cropAspect === '16:9' ? 1920 : 1080
        const targetH = cropAspect === '9:16' ? 1920 : cropAspect === '1:1' ? 1080 : cropAspect === '16:9' ? 1080 : 1920
        if (cropAspect && /^\d+:\d+$/.test(cropAspect)) {
          const [aw, ah] = cropAspect.split(':').map(Number)
          if (fillMode === 'crop') {
            vfilters.push(`crop='min(iw\\,ih*${aw}/${ah})':'min(ih\\,iw*${ah}/${aw})':(iw-out_w)/2:(ih-out_h)/2`)
            vfilters.push(`scale=${targetW}:${targetH}:flags=lanczos`)
            // Subtle unsharp mask — sharpens edges after upscaling without adding grain.
            // Params: luma_msize_x=3 luma_msize_y=3 luma_amount=0.5, chroma disabled (0.0).
            vfilters.push(`unsharp=3:3:0.5:3:3:0.0`)
          } else if (fillMode === 'blur') {
            // Build via filter_complex: [main] = scaled-to-fit; [bg] = scaled-to-cover + boxblur; overlay center.
            // foreground is letterboxed; background is the blurred full-bleed of the original.
            const fc = []
            fc.push(`[0:v]split=2[v0][v1]`)
            // background: scale to cover, then strong blur
            fc.push(`[v0]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=luma_radius=30:luma_power=2,setsar=1[bg]`)
            // foreground: scale to fit inside target frame, then subtle unsharp for crisp faces/text
            fc.push(`[v1]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,unsharp=3:3:0.5:3:3:0.0,setsar=1[fg]`)
            fc.push(`[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`)
            filterComplex = fc.join(';')
            useFilterComplex = true
          } else if (fillMode === 'color') {
            // Letterbox / pillarbox with a solid color bar.
            vfilters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`)
            vfilters.push(`unsharp=3:3:0.5:3:3:0.0`)
            vfilters.push(`pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=${fillColor}`)
          }
        } else {
          vfilters.push(`scale='min(iw,1080)':'-2':flags=lanczos`)
          vfilters.push(`unsharp=3:3:0.5:3:3:0.0`)
        }
        if (speed !== 1.0) {
          vfilters.push(`setpts=PTS/${speed}`)
        }
        if (subtitleFilter) vfilters.push(subtitleFilter)

        // Title overlay via drawtext (font path on system)
        if (titleText) {
          const esc = titleText.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019")
          const fontfile = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
          const yExpr = titlePosition === 'bottom' ? 'h-text_h-40' : '40'
          vfilters.push(`drawtext=fontfile=${fontfile}:text='${esc}':fontcolor=white:fontsize=42:borderw=4:bordercolor=black:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=${yExpr}`)
        }

        // Logo overlay + filter chain orchestration.
        // Cases: (A) no logo + no blur → -vf chain  (B) no logo + blur → -filter_complex with blur+overlay
        //        (C) logo + no blur → existing -filter_complex with vf→logo overlay
        //        (D) logo + blur → combined blur fill + remaining vfilters + logo overlay
        const args = ['-y', '-ss', String(trimStart), '-to', String(trimEnd), '-i', srcPath]
        let logoTmp = null
        if (logoUrl) {
          try {
            if (logoUrl.startsWith('/api/files/')) {
              logoTmp = path.join(UPLOAD_DIR, logoUrl.replace(/^\/api\/files\//, ''))
            } else if (/^https?:\/\//.test(logoUrl)) {
              logoTmp = path.join(tmpDir, 'logo.png')
              const lr = await fetch(logoUrl)
              if (lr.ok) {
                const buf = Buffer.from(await lr.arrayBuffer())
                await fs.writeFile(logoTmp, buf)
              } else logoTmp = null
            }
          } catch (e) { console.error('logo prep failed', e.message); logoTmp = null }
        }
        const hasLogo = logoTmp && (await fs.stat(logoTmp).catch(()=>null))
        if (hasLogo) args.push('-i', logoTmp)

        // Compute logo overlay coords (used in cases C & D)
        let logoFilter = null
        if (hasLogo) {
          const logoW = `iw*${logoScale}/100`
          let xExpr, yExpr
          if (logoX !== null && logoY !== null) {
            xExpr = `(W*${logoX}/100)-(w/2)`
            yExpr = `(H*${logoY}/100)-(h/2)`
          } else {
            xExpr = logoPosition.endsWith('right') ? 'W-w-20' : '20'
            yExpr = logoPosition.startsWith('bottom') ? 'H-h-20' : '20'
          }
          logoFilter = { logoW, xExpr, yExpr }
        }

        if (useFilterComplex) {
          // BLUR FILL — start from filterComplex (which produces [out]), then apply remaining vfilters (subtitles, drawtext, etc.)
          // then optionally overlay logo.
          let fc = filterComplex  // ends with ...[out]
          const remainingVf = vfilters.length ? vfilters.join(',') : null
          if (remainingVf) fc += `;[out]${remainingVf}[vfilt]`
          const mainLabel = remainingVf ? '[vfilt]' : '[out]'
          if (hasLogo) {
            fc += `;[1:v]scale=${logoFilter.logoW}:-1[lg];${mainLabel}[lg]overlay=${logoFilter.xExpr}:${logoFilter.yExpr}`
          } else {
            // Need to map [out]/[vfilt] as the final video — use null filter to make it the primary stream
            fc += `;${mainLabel}null[vout]`
            args.push('-map', '[vout]', '-map', '0:a?')
          }
          args.push('-filter_complex', fc)
        } else if (hasLogo) {
          const vfChain = vfilters.length ? vfilters.join(',') : 'null'
          args.push('-filter_complex', `[0:v]${vfChain}[v];[1:v]scale=${logoFilter.logoW}:-1[lg];[v][lg]overlay=${logoFilter.xExpr}:${logoFilter.yExpr}`)
        } else if (vfilters.length) {
          args.push('-vf', vfilters.join(','))
        }
        // Audio: keep but adjust tempo if speed changed (atempo only valid 0.5–2.0)
        if (speed !== 1.0) {
          args.push('-filter:a', `atempo=${speed}`)
        }
        // HD encoding: preset 'veryfast' + CRF 20 gives near-lossless visual quality (per Senior Backend Video Engineer spec)
        // at ~2× the encode speed of preset 'medium'. Comfortable under proxy timeouts for 30–45s clips.
        // -vsync cfr forces a constant frame rate so subtitle ASS timestamps stay perfectly in sync with the video track
        // (avoids drift when the source has variable-frame-rate). -async 1 keeps audio timestamps aligned.
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
          '-tune', 'fastdecode', '-threads', '0',
          '-profile:v', 'high', '-level', '4.1',
          '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',  // 2s GOP for smooth seeking
          '-maxrate', '10000k', '-bufsize', '15000k',
          '-vsync', 'cfr', '-async', '1',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
          '-movflags', '+faststart', tmpOut)

        await new Promise((resolve, reject) => {
          const p = spawn('/usr/bin/ffmpeg', args)
          let stderr = ''
          p.stderr.on('data', d => { stderr += d.toString() })
          p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-400)}`)))
          p.on('error', reject)
        })

        // Replace in place (same key so old URL still works)
        await fs.copyFile(tmpOut, srcPath)
        // Regenerate thumb
        try {
          const thumbPath = srcPath.replace(/\.mp4$/, '.jpg')
          await new Promise((resolve) => {
            const p = spawn('/usr/bin/ffmpeg', ['-y', '-ss', String((trimEnd - trimStart) / 2), '-i', srcPath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=540:-2', thumbPath])
            p.on('close', () => resolve()); p.on('error', () => resolve())
          })
        } catch {}

        const setFields = {
          trim_start: trimStart, trim_end: trimEnd, crop_aspect: cropAspect, speed,
          style_preset: stylePreset, style_ass: styleAss, font_size: fontSize, outline_size: outlineSize,
          caption_x_percent: captionXPercent, caption_y_percent: captionYPercent,
          fill_mode: fillMode, fill_color: fillColor,
          logo_url: logoUrl, logo_position: logoUrl ? logoPosition : null,
          logo_x_percent: logoX, logo_y_percent: logoY, logo_scale_percent: logoScale,
          title_text: titleText || null, title_position: titleText ? titlePosition : null,
          template_id: templateId,
          last_rendered_at: new Date(),
          render_version: (clip.render_version || 0) + 1,
          overlays_config: { ...(clip.overlays_config || {}), caption: { ...(clip.overlays_config?.caption || {}), position_percent: captionPos } },
        }
        if (newClipTitle) setFields.clip_title = newClipTitle
        await db.collection('generated_clips').updateOne({ id: clipId }, { $set: setFields })

        // Bust R2 cache
        if (clip.r2_key) {
          try { const { deleteFromR2 } = await import('@/lib/r2'); await deleteFromR2({ db, key: clip.r2_key }); await db.collection('generated_clips').updateOne({ id: clipId }, { $unset: { r2_key: '', r2_size: '', r2_uploaded_at: '' } }) } catch {}
        }

        try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
        await logActivity(db, user.id, 'clip_rendered', request, { clip_id: clipId, trim: [trimStart, trimEnd], crop: cropAspect, speed, has_logo: !!logoUrl, has_title: !!titleText, template: templateId, credits_charged: renderCost })
        const updated = await db.collection('generated_clips').findOne({ id: clipId })
        const freshProfile = await db.collection('profiles').findOne({ id: user.id }, { projection: { credit_balance_minutes: 1 } })
        return NextResponse.json({
          ok: true,
          clip: strip(updated),
          final_duration: (trimEnd - trimStart) / speed,
          credits_charged: renderCost,
          credits_remaining: freshProfile?.credit_balance_minutes ?? null,
        })
      } catch (e) {
        try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
        // Refund credits since the render failed before completing
        await refundCredits(e.message)
        return NextResponse.json({ error: 'Render failed: ' + e.message, credits_refunded: renderCost }, { status: 500 })
      }
    }

    // GET /api/clips/:id/download  — stream the clip with Content-Disposition: attachment (forces download)
    if (path_.startsWith('/clips/') && path_.endsWith('/download') && method === 'GET') {
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      if (!clip.storage_url_mp4 || !clip.storage_url_mp4.startsWith('/api/files/')) {
        return NextResponse.json({ error: 'No rendered MP4 for this clip' }, { status: 410 })
      }
      try {
        const localPath = path.join(UPLOAD_DIR, clip.storage_url_mp4.replace(/^\/api\/files\//, ''))
        const stat = await fs.stat(localPath)
        const data = await fs.readFile(localPath)
        const safeName = String(clip.clip_title || 'clip').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'clip'
        return new NextResponse(data, { headers: {
          'content-type': 'video/mp4',
          'content-length': String(stat.size),
          'content-disposition': `attachment; filename="${safeName}.mp4"`,
          'cache-control': 'private, no-cache',
        } })
      } catch (e) { return NextResponse.json({ error: 'File missing on server' }, { status: 410 }) }
    }

    // POST /api/clips/:id/apply-trim  — actually re-render the MP4 with trim/crop bounds (the saved fields alone are metadata-only)
    if (path_.startsWith('/clips/') && path_.endsWith('/apply-trim') && method === 'POST') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      if (!clip.storage_url_mp4 || !clip.storage_url_mp4.startsWith('/api/files/')) {
        return NextResponse.json({ error: 'No rendered MP4 for this clip — cannot trim' }, { status: 410 })
      }
      const body = await request.json().catch(() => ({}))
      const duration = (clip.end_time_seconds || 0) - (clip.start_time_seconds || 0)
      let trimStart = Number.isFinite(body.trim_start) ? Math.max(0, Number(body.trim_start)) : 0
      let trimEnd = Number.isFinite(body.trim_end) ? Math.min(duration, Number(body.trim_end)) : duration
      if (trimEnd - trimStart < 1) return NextResponse.json({ error: 'Trim range must be at least 1 second' }, { status: 400 })
      const cropAspect = body.crop_aspect || clip.crop_aspect || null
      const localPath = path.join(UPLOAD_DIR, clip.storage_url_mp4.replace(/^\/api\/files\//, ''))
      if (!(await fs.stat(localPath).catch(()=>null))) return NextResponse.json({ error: 'Source MP4 missing on server' }, { status: 410 })

      try {
        const { spawn } = await import('child_process')
        const tmpOut = path.join(UPLOAD_DIR, 'clips', `${clipId}.trim.mp4`)
        // Build ffmpeg args: trim using -ss/-to (re-encode to keep keyframe accuracy), apply crop filter if asked
        const args = ['-y', '-ss', String(trimStart), '-to', String(trimEnd), '-i', localPath]
        if (cropAspect && /^\d+:\d+$/.test(cropAspect)) {
          const [aw, ah] = cropAspect.split(':').map(Number)
          // crop to target aspect from center, apply subtle unsharp for crispness, then align to even pixels
          const cropExpr = `crop='min(iw,ih*${aw}/${ah})':'min(ih,iw*${ah}/${aw})':(iw-out_w)/2:(ih-out_h)/2,unsharp=3:3:0.5:3:3:0.0,scale=trunc(iw/2)*2:trunc(ih/2)*2`
          args.push('-vf', cropExpr)
        }
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
          '-vsync', 'cfr', '-async', '1',
          '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tmpOut)
        await new Promise((resolve, reject) => {
          const p = spawn('/usr/bin/ffmpeg', args)
          let stderr = ''
          p.stderr.on('data', d => { stderr += d.toString() })
          p.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${stderr.slice(-300)}`)))
          p.on('error', reject)
        })
        await fs.rename(tmpOut, localPath)
        // Re-generate thumbnail at the trimmed midpoint
        try {
          const thumbPath = localPath.replace(/\.mp4$/, '.jpg')
          await new Promise((resolve) => {
            const p = spawn('/usr/bin/ffmpeg', ['-y', '-ss', String((trimEnd - trimStart) / 2), '-i', localPath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=540:-2', thumbPath])
            p.on('close', () => resolve())
            p.on('error', () => resolve())
          })
        } catch {}
        await db.collection('generated_clips').updateOne(
          { id: clipId },
          { $set: { trim_start: trimStart, trim_end: trimEnd, crop_aspect: cropAspect, trim_applied_at: new Date(), trim_version: (clip.trim_version || 0) + 1 } }
        )
        // Bust R2 cache if it was uploaded — the trimmed MP4 is now different
        if (clip.r2_key) {
          try { const { deleteFromR2 } = await import('@/lib/r2'); await deleteFromR2({ db, key: clip.r2_key }); await db.collection('generated_clips').updateOne({ id: clipId }, { $unset: { r2_key: '', r2_size: '', r2_uploaded_at: '' } }) } catch {}
        }
        await logActivity(db, user.id, 'clip_trim_applied', request, { clip_id: clipId, trim_start: trimStart, trim_end: trimEnd, crop_aspect: cropAspect })
        const updated = await db.collection('generated_clips').findOne({ id: clipId })
        return NextResponse.json({ ok: true, clip: strip(updated), final_duration: trimEnd - trimStart })
      } catch (e) {
        return NextResponse.json({ error: 'Trim render failed: ' + e.message }, { status: 500 })
      }
    }

    // ============= R2 / FULL VIDEO DOWNLOAD =============
    // POST /api/clips/:id/upload-to-r2  — upload a generated clip to R2 and return a signed URL
    if (path_.startsWith('/clips/') && path_.endsWith('/upload-to-r2') && method === 'POST') {
      const user = await getUser(request, db)
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
      try {
        const { uploadToR2 } = await import('@/lib/r2')
        const localPath = path.join('/app/data/uploads', clip.storage_url_mp4.replace(/^\/api\/files\//, ''))
        const key = `clips/${user.id}/${clipId}.mp4`
        const result = await uploadToR2({ db, localPath, key, contentType: 'video/mp4', expiresInSeconds: 7 * 86400 })
        await db.collection('generated_clips').updateOne({ id: clipId }, { $set: { r2_key: result.key, r2_bucket: result.bucket, r2_size: result.size, r2_uploaded_at: new Date() } })
        await logActivity(db, user.id, 'clip_uploaded_to_r2', request, { clip_id: clipId, size: result.size })
        return NextResponse.json({ ok: true, signed_url: result.signedUrl, public_url: result.publicUrl, size: result.size, expires_in_seconds: 7 * 86400 })
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // POST /api/videos/:id/download-full  — fetch full video (via cookies+proxy), upload to R2, return signed URL
    if (path_.startsWith('/videos/') && path_.endsWith('/download-full') && method === 'POST') {
      const user = await getUser(request, db)
      const vid = segments[1]
      const video = await db.collection('videos_processed').findOne({ id: vid })
      if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

      try {
        const { fetchFullVideoFromYouTube } = await import('@/lib/video-processor')
        const { uploadToR2 } = await import('@/lib/r2')
        const tmpDir = `/tmp/fullvideo_${vid}`
        await fs.mkdir(tmpDir, { recursive: true })
        const localFull = video.source_type === 'upload'
          ? path.join('/app/data/uploads/originals', vid, (await fs.readdir(path.join('/app/data/uploads/originals', vid)).catch(()=>[]))[0] || '')
          : await fetchFullVideoFromYouTube({ url: video.original_url, outDir: tmpDir, db, maxHeight: 720 })

        const key = `full/${user.id}/${vid}.mp4`
        const result = await uploadToR2({ db, localPath: localFull, key, contentType: 'video/mp4', expiresInSeconds: 7 * 86400 })
        await db.collection('videos_processed').updateOne({ id: vid }, { $set: { r2_key: result.key, r2_size: result.size, r2_uploaded_at: new Date() } })
        try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
        await logActivity(db, user.id, 'full_video_uploaded_to_r2', request, { video_id: vid, size: result.size })
        return NextResponse.json({ ok: true, signed_url: result.signedUrl, public_url: result.publicUrl, size: result.size, expires_in_seconds: 7 * 86400 })
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 })
      }
    }

    // GET /api/clips/:id/signed-url  — fetch fresh signed URL for previously-uploaded R2 clip
    if (path_.startsWith('/clips/') && path_.endsWith('/signed-url') && method === 'GET') {
      const clipId = segments[1]
      const clip = await db.collection('generated_clips').findOne({ id: clipId })
      if (!clip?.r2_key) return NextResponse.json({ error: 'Clip not on R2 — upload first' }, { status: 404 })
      try {
        const { getR2SignedUrl } = await import('@/lib/r2')
        const signedUrl = await getR2SignedUrl({ db, key: clip.r2_key, expiresInSeconds: 3600 })
        return NextResponse.json({ signed_url: signedUrl, expires_in_seconds: 3600 })
      } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
    }

    // ============= PACKAGE PURCHASE (simulated checkout, adds credits) =============
    if (path_ === '/packages/purchase' && method === 'POST') {
      const user = await getUser(request, db)
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      const body = await request.json()
      const pkg = await db.collection('pricing_packages').findOne({ id: body.package_id })
      if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

      // Geo to determine currency
      const ipHeader = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
      const isIndia = /^(India|IN)$/i.test(body.country || '') || /^\s*(IN)\s*$/i.test(ipHeader)
      const currency = isIndia ? 'INR' : 'USD'
      let amount = isIndia ? pkg.price_inr : pkg.price_usd
      const billingCycle = body.billing_cycle === 'year' ? 'year' : 'month'
      if (billingCycle === 'year') amount = amount * 12 * 0.8

      // Coupon
      let couponDiscount = 0
      let appliedCoupon = null
      if (body.coupon_code) {
        const code = String(body.coupon_code).trim().toUpperCase()
        const c = await db.collection('coupon_codes').findOne({ code })
        if (c && c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date()) && (!c.max_redemptions || c.current_redemptions < c.max_redemptions)) {
          couponDiscount = c.discount_percent
          appliedCoupon = c
          amount = amount * (1 - couponDiscount / 100)
          await db.collection('coupon_codes').updateOne({ id: c.id }, { $inc: { current_redemptions: 1 } })
        }
      }

      const creditsAdded = pkg.credit_amount_minutes * (billingCycle === 'year' ? 12 : 1)
      const txnId = uuidv4()

      // === MOCK PAYMENT: in production, replace with Stripe Checkout / Razorpay Order creation ===
      // Successful payment → credit the user
      const updateRes = await db.collection('profiles').findOneAndUpdate(
        { id: user.id },
        { $inc: { credit_balance_minutes: creditsAdded } },
        { returnDocument: 'after' }
      )
      const updated = updateRes?.value || updateRes
      const newBalance = updated?.credit_balance_minutes ?? (user.credit_balance_minutes + creditsAdded)

      await db.collection('credit_transactions').insertOne({
        id: txnId, user_id: user.id, package_id: pkg.id, package_name: pkg.name,
        amount: creditsAdded, currency, price_paid: Math.round(amount * 100) / 100,
        coupon_code: appliedCoupon?.code || null, coupon_discount_percent: couponDiscount,
        billing_cycle: billingCycle, payment_processor: isIndia ? 'razorpay' : 'lemon_squeezy',
        payment_status: 'completed_simulated', reason: 'package_purchase',
        created_at: new Date(),
      })
      await logActivity(db, user.id, 'package_purchased', request, { package: pkg.name, amount, currency, credits: creditsAdded })

      return NextResponse.json({
        ok: true,
        package_name: pkg.name,
        credits_added: creditsAdded,
        new_balance_minutes: newBalance,
        amount_paid: Math.round(amount * 100) / 100,
        currency,
        billing_cycle: billingCycle,
        coupon_applied: appliedCoupon?.code || null,
        transaction_id: txnId,
        payment_status: 'completed_simulated',
        message: `+${creditsAdded} minutes added. (MOCK payment — real Stripe/Razorpay wiring pending.)`,
      })
    }

    // GET /api/transactions  — user's purchase history
    if (path_ === '/transactions' && method === 'GET') {
      const user = await getUser(request, db)
      const list = await db.collection('credit_transactions').find({ user_id: user.id }).sort({ created_at: -1 }).limit(50).toArray()
      return NextResponse.json(list.map(strip))
    }


    // ============= COUPONS =============
    // Public validate
    if (path_ === '/coupons/validate' && method === 'GET') {
      const url = new URL(request.url)
      const code = (url.searchParams.get('code') || '').trim().toUpperCase()
      if (!code) return NextResponse.json({ valid: false, error: 'No code provided' })
      const c = await db.collection('coupon_codes').findOne({ code })
      if (!c) return NextResponse.json({ valid: false, error: 'Code not found' })
      if (!c.is_active) return NextResponse.json({ valid: false, error: 'Code inactive' })
      if (c.expires_at && new Date(c.expires_at) < new Date()) return NextResponse.json({ valid: false, error: 'Code expired' })
      if (c.max_redemptions && c.current_redemptions >= c.max_redemptions) return NextResponse.json({ valid: false, error: 'Code fully redeemed' })
      return NextResponse.json({ valid: true, code: c.code, discount_percent: c.discount_percent })
    }
    // Admin CRUD
    if (path_ === '/admin/coupons' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const list = await db.collection('coupon_codes').find({}).sort({ created_at: -1 }).toArray()
      return NextResponse.json(list.map(strip))
    }
    if (path_ === '/admin/coupons' && method === 'POST') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const body = await request.json()
      const code = String(body.code || `PROMO${Math.random().toString(36).slice(2,7).toUpperCase()}`).toUpperCase()
      const doc = {
        id: uuidv4(), code,
        discount_percent: Math.max(1, Math.min(100, Number(body.discount_percent) || 10)),
        max_redemptions: Number(body.max_redemptions) || 100,
        current_redemptions: 0,
        expires_at: body.expires_at ? new Date(body.expires_at) : new Date(Date.now() + 30*86400000),
        is_active: body.is_active !== false,
        created_at: new Date(),
      }
      try { await db.collection('coupon_codes').insertOne(doc) } catch (e) {
        return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
      }
      await logActivity(db, user.id, 'coupon_created', request, { code: doc.code })
      return NextResponse.json(strip(doc))
    }
    if (path_.startsWith('/admin/coupons/') && method === 'PUT') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const id = segments[2]
      const body = await request.json()
      const allowed = ['code','discount_percent','max_redemptions','expires_at','is_active']
      const updates = {}
      for (const k of allowed) if (k in body) updates[k] = k === 'expires_at' && body[k] ? new Date(body[k]) : body[k]
      if (updates.code) updates.code = String(updates.code).toUpperCase()
      await db.collection('coupon_codes').updateOne({ id }, { $set: updates })
      const c = await db.collection('coupon_codes').findOne({ id })
      return NextResponse.json(strip(c))
    }
    if (path_.startsWith('/admin/coupons/') && method === 'DELETE') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      await db.collection('coupon_codes').deleteOne({ id: segments[2] })
      return NextResponse.json({ ok: true })
    }

    // ============= USERS (admin) =============
    if (path_ === '/admin/users' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const list = await db.collection('profiles').find({}).sort({ created_at: -1 }).limit(200).toArray()
      // strip secrets
      const safe = list.map(p => { const x = strip(p); delete x.password_hash; delete x.reset_token; delete x.verification_token; return x })
      // attach clip counts
      for (const u of safe) {
        u.clip_count = await db.collection('generated_clips').countDocuments({ user_id: u.id })
      }
      return NextResponse.json(safe)
    }
    if (path_.startsWith('/admin/users/') && method === 'PUT') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const id = segments[2]
      const body = await request.json()
      const allowed = ['credit_balance_minutes','is_admin','role','email','name']
      const updates = {}
      for (const k of allowed) if (k in body) updates[k] = body[k]
      if ('is_admin' in updates) updates.role = updates.is_admin ? 'admin' : 'user'
      if ('role' in updates) updates.is_admin = updates.role === 'admin'
      await db.collection('profiles').updateOne({ id }, { $set: updates })
      await logActivity(db, user.id, 'user_updated_by_admin', request, { target_id: id, updates })
      const p = await db.collection('profiles').findOne({ id })
      const x = strip(p); delete x.password_hash; delete x.reset_token; delete x.verification_token
      return NextResponse.json(x)
    }

    // ============= NEWSLETTERS =============
    if (path_ === '/admin/newsletters' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const list = await db.collection('newsletters_sent').find({}).sort({ created_at: -1 }).limit(50).toArray()
      return NextResponse.json(list.map(strip))
    }
    if (path_ === '/admin/newsletters' && method === 'POST') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const body = await request.json()
      const totalUsers = await db.collection('profiles').countDocuments()
      const doc = {
        id: uuidv4(), subject: String(body.subject || 'Untitled').slice(0,200),
        body_content: String(body.body_content || ''),
        total_sent: totalUsers, sent_by: user.id, created_at: new Date(),
      }
      await db.collection('newsletters_sent').insertOne(doc)
      // Also push an in-app notification to all users
      await db.collection('in_app_notifications').insertOne({
        id: uuidv4(), broadcast_id: doc.id, subject: doc.subject, body: doc.body_content,
        created_at: new Date(), expires_at: new Date(Date.now() + 14*86400000),
      })
      await logActivity(db, user.id, 'newsletter_sent', request, { subject: doc.subject, total_sent: totalUsers })
      return NextResponse.json(strip(doc))
    }
    // user-facing: latest in-app notifications
    if (path_ === '/notifications' && method === 'GET') {
      const list = await db.collection('in_app_notifications').find({ expires_at: { $gt: new Date() } }).sort({ created_at: -1 }).limit(5).toArray()
      return NextResponse.json(list.map(strip))
    }

    // ============= ANALYTICS =============
    if (path_ === '/admin/analytics' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const [totalUsers, totalClips, totalVideos, activeSubs, totalCreditsRaw, totalRevenueRaw] = await Promise.all([
        db.collection('profiles').countDocuments(),
        db.collection('generated_clips').countDocuments(),
        db.collection('videos_processed').countDocuments(),
        db.collection('user_subscriptions').countDocuments({ status: 'active' }),
        db.collection('profiles').aggregate([{ $group: { _id: null, total: { $sum: '$credit_balance_minutes' } } }]).toArray(),
        db.collection('user_subscriptions').aggregate([{ $group: { _id: null, total: { $sum: '$amount_usd' } } }]).toArray(),
      ])
      // generate last-14-day time series of clip creation
      const since = new Date(Date.now() - 14*86400000)
      const clips = await db.collection('generated_clips').find({ created_at: { $gt: since } }).project({ created_at: 1 }).toArray()
      const buckets = {}
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i*86400000)
        const k = d.toISOString().slice(0,10)
        buckets[k] = 0
      }
      for (const c of clips) {
        const k = new Date(c.created_at).toISOString().slice(0,10)
        if (k in buckets) buckets[k]++
      }
      const series = Object.entries(buckets).map(([date, count]) => ({ date, clips: count }))
      return NextResponse.json({
        totals: {
          users: totalUsers,
          clips: totalClips,
          videos: totalVideos,
          active_subscriptions: activeSubs,
          total_credits_remaining: totalCreditsRaw[0]?.total || 0,
          total_revenue_usd: totalRevenueRaw[0]?.total || 0,
        },
        clips_by_day: series,
      })
    }
    if (path_ === '/admin/activity' && method === 'GET') {
      const user = await getUser(request, db, { allowAdminImpersonation: true })
      if (!isAdminProfile(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      const list = await db.collection('logs_activity').find({}).sort({ created_at: -1 }).limit(100).toArray()
      return NextResponse.json(list.map(strip))
    }

    return NextResponse.json({ error: 'Not Found', path: path_, method }, { status: 404 })
  } catch (e) {
    console.error('API error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
