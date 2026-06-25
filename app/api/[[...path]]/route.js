import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { createReadStream } from 'fs'

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
}

function strip(doc) { if (!doc) return doc; const { _id, ...rest } = doc; return rest }

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

async function callLLM(messages, { json = false, temperature = 0.7 } = {}) {
  if (!LLM_KEY) throw new Error('LLM key not configured')
  const body = { model: LLM_MODEL, messages, temperature }
  if (json) body.response_format = { type: 'json_object' }
  const r = await fetch(LLM_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${LLM_KEY}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new Error(`LLM error ${r.status}: ${txt.slice(0,200)}`)
  }
  const data = await r.json()
  return data.choices?.[0]?.message?.content || ''
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
      try { content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.6 }) }
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
      const prompt = `You are an expert short-form video editor. A creator just uploaded this video URL: "${url}"${topic ? ` (topic hint: ${topic})` : ''}.\n\nImagine you have already watched it. Generate exactly 3 highly-engaging 30-60 second clip suggestions that would perform well on TikTok / Reels / YouTube Shorts.\n\nReturn ONLY valid JSON, no markdown, no commentary, in this shape:\n{\n  "clips": [\n    {\n      "clip_title": "a punchy curiosity-gap title (under 60 chars)",\n      "start_time_seconds": integer between 30 and 1800,\n      "end_time_seconds": integer (start + 30 to 60),\n      "virality_score": integer 70-99,\n      "hook_text": "a 4-8 word scroll-stopping opener",\n      "why": "one short sentence on why this will go viral"\n    }\n  ]\n}\nMake the three titles dramatically different in angle. Sort by virality_score descending.`
      let content = ''
      try {
        content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.9 })
      } catch (e) {
        return NextResponse.json({ error: 'AI failed: ' + e.message }, { status: 500 })
      }
      const parsed = safeJsonParse(content)
      if (!parsed?.clips || !Array.isArray(parsed.clips)) {
        return NextResponse.json({ error: 'AI returned unparseable response', raw: content.slice(0, 500) }, { status: 500 })
      }
      // create video + clips in DB
      const videoId = uuidv4()
      await db.collection('videos_processed').insertOne({ id: videoId, user_id: user.id, original_url: url, status: 'completed', created_at: new Date() })
      const created = []
      for (let i = 0; i < parsed.clips.length; i++) {
        const c = parsed.clips[i]
        const start = Math.max(0, Number(c.start_time_seconds) || (60 + i * 200))
        const endRaw = Number(c.end_time_seconds) || (start + 45)
        const end = Math.min(start + 60, Math.max(start + 30, endRaw))
        const doc = {
          id: uuidv4(), video_id: videoId, user_id: user.id,
          clip_title: (c.clip_title || `Viral Clip ${i+1}`).slice(0, 90),
          start_time_seconds: start, end_time_seconds: end,
          virality_score: Math.min(99, Math.max(50, Number(c.virality_score) || 80)),
          storage_url_mp4: `https://cdn.clipforge.ai/clips/${videoId}-${i+1}.mp4`,
          thumbnail_url: THUMB_POOL[Math.floor(Math.random() * THUMB_POOL.length)],
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
      return NextResponse.json({ video_id: videoId, clips: created })
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
      try { content = await callLLM([{ role: 'user', content: prompt }], { json: true, temperature: 0.2 }) }
      catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }) }
      const translations = safeJsonParse(content)
      if (!translations) return NextResponse.json({ error: 'Translation parse failed', raw: content.slice(0,500) }, { status: 500 })
      await db.collection('translations_cache').updateOne({ key: cacheKey }, { $set: { key: cacheKey, value: translations, language, created_at: new Date() } }, { upsert: true })
      return NextResponse.json({ translations })
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
