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
    if (path_.startsWith('/files/') && method === 'GET') {
      const sub = segments.slice(1).join('/')
      // Prevent path traversal
      if (sub.includes('..')) return new NextResponse('Bad path', { status: 400 })
      const filePath = path.join(UPLOAD_DIR, sub)
      try {
        const stat = await fs.stat(filePath)
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mime = { mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp' }[ext] || 'application/octet-stream'
        const data = await fs.readFile(filePath)
        return new NextResponse(data, { headers: { 'content-type': mime, 'content-length': String(stat.size), 'cache-control': 'public, max-age=31536000, immutable' } })
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
      const list = await db.collection('generated_clips').find({ user_id: user.id }).sort({ virality_score: -1 }).toArray()
      return NextResponse.json(list.map(strip))
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
    // POST /api/upload  multipart form: { file, kind: 'meme_video' | 'meme_thumbnail' }
    if (path_ === '/upload' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      const kind = form.get('kind') || 'meme_video'
      if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file' }, { status: 400 })
      const ext = (file.name?.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const id = uuidv4()
      const subdir = kind === 'meme_thumbnail' ? 'thumbs' : 'memes'
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
    if (path_ === '/ai/analyze' && method === 'POST') {
      const user = await getUser(request, db)
      const body = await request.json()
      const url = body.url || ''
      const topic = body.topic || ''
      const meta = await metadataForUrl(url)
      const titleHint = meta.title ? `\nVideo title: "${meta.title}"` : ''
      const authorHint = meta.author ? `\nCreator: ${meta.author}` : ''
      const prompt = `You are an expert short-form video editor. A creator just uploaded this video URL: "${url}"${titleHint}${authorHint}${topic ? `\nTopic hint: ${topic}` : ''}\n\nImagine you have already watched it. Generate exactly 3 highly-engaging 30-60 second clip suggestions that would perform well on TikTok / Reels / YouTube Shorts.\n\nReturn ONLY valid JSON, no markdown, no commentary, in this shape:\n{\n  "clips": [\n    {\n      "clip_title": "a punchy curiosity-gap title (under 60 chars)",\n      "start_time_seconds": integer between 30 and 1800,\n      "end_time_seconds": integer (start + 30 to 60),\n      "virality_score": integer 70-99,\n      "hook_text": "a 4-8 word scroll-stopping opener",\n      "why": "one short sentence on why this will go viral"\n    }\n  ]\n}\nMake the three titles dramatically different in angle. Sort by virality_score descending.`
      let content = ''
      try {
        content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.9, db })
      } catch (e) {
        return NextResponse.json({ error: 'AI failed: ' + e.message }, { status: 500 })
      }
      const parsed = safeJsonParse(content)
      if (!parsed?.clips || !Array.isArray(parsed.clips)) {
        return NextResponse.json({ error: 'AI returned unparseable response', raw: content.slice(0, 500) }, { status: 500 })
      }
      const videoId = uuidv4()
      await db.collection('videos_processed').insertOne({
        id: videoId, user_id: user.id, original_url: url,
        source_type: meta.source_type || 'other',
        status: 'completed', title: meta.title || null, thumbnail_url: meta.thumbnail || null,
        created_at: new Date(),
      })
      const created = []
      for (let i = 0; i < parsed.clips.length; i++) {
        const c = parsed.clips[i]
        const start = Math.max(0, Number(c.start_time_seconds) || (60 + i * 200))
        const endRaw = Number(c.end_time_seconds) || (start + 45)
        const end = Math.min(start + 60, Math.max(start + 30, endRaw))
        // Prefer the real video thumbnail; fall back to pool
        const thumb = meta.thumbnail || THUMB_POOL[Math.floor(Math.random() * THUMB_POOL.length)]
        const doc = {
          id: uuidv4(), video_id: videoId, user_id: user.id,
          clip_title: (c.clip_title || `Viral Clip ${i+1}`).slice(0, 90),
          start_time_seconds: start, end_time_seconds: end,
          virality_score: Math.min(99, Math.max(50, Number(c.virality_score) || 80)),
          storage_url_mp4: `https://cdn.clipforge.ai/clips/${videoId}-${i+1}.mp4`,
          thumbnail_url: thumb,
          source_video_url: url,
          source_type: meta.source_type || 'other',
          is_scheduled: false, scheduled_time: null,
          hook_type: c.hook_text ? 'text' : 'none',
          hook_text: (c.hook_text || '').slice(0, 120),
          hook_meme_id: null,
          subtitle_language: 'en',
          ai_rationale: (c.why || '').slice(0, 200),
          created_at: new Date(),
        }
        await db.collection('generated_clips').insertOne(doc)
        created.push(strip(doc))
      }
      await logActivity(db, user.id, 'ai_analyze_completed', request, { url, clips: created.length, source: meta.source_type })
      return NextResponse.json({ video_id: videoId, source_type: meta.source_type, thumbnail: meta.thumbnail, title: meta.title, clips: created })
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
