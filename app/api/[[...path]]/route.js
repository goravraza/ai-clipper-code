import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'clipforge'

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

async function seedIfEmpty(db) {
  // seed pricing packages
  const pkgCount = await db.collection('pricing_packages').countDocuments()
  if (pkgCount === 0) {
    await db.collection('pricing_packages').insertMany([
      { id: uuidv4(), name: 'Starter Pack', credit_amount_minutes: 300, price_inr: 499, price_usd: 6.99, discount_percentage: 0, is_featured: false, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Growth Pack', credit_amount_minutes: 1000, price_inr: 1299, price_usd: 15.99, discount_percentage: 20, is_featured: true, is_active: true, created_at: new Date() },
      { id: uuidv4(), name: 'Enterprise Pack', credit_amount_minutes: 3000, price_inr: 2999, price_usd: 35.99, discount_percentage: 40, is_featured: false, is_active: true, created_at: new Date() },
    ])
  }

  // seed default profile
  const existing = await db.collection('profiles').findOne({ id: DEFAULT_USER_ID })
  if (!existing) {
    await db.collection('profiles').insertOne({
      id: DEFAULT_USER_ID,
      email: 'creator@clipforge.ai',
      credit_balance_minutes: 30,
      is_admin: false,
      theme_preference: 'dark',
      created_at: new Date(),
    })
  }
  // seed admin profile
  const admin = await db.collection('profiles').findOne({ id: ADMIN_USER_ID })
  if (!admin) {
    await db.collection('profiles').insertOne({
      id: ADMIN_USER_ID,
      email: 'admin@clipforge.ai',
      credit_balance_minutes: 9999,
      is_admin: true,
      theme_preference: 'dark',
      created_at: new Date(),
    })
  }

  // seed sample clips
  const clipCount = await db.collection('generated_clips').countDocuments()
  if (clipCount === 0) {
    const videoId = uuidv4()
    await db.collection('videos_processed').insertOne({
      id: videoId,
      user_id: DEFAULT_USER_ID,
      original_url: 'https://youtube.com/watch?v=demo-podcast-episode',
      status: 'completed',
      created_at: new Date(),
    })
    await db.collection('generated_clips').insertMany([
      {
        id: uuidv4(),
        video_id: videoId,
        user_id: DEFAULT_USER_ID,
        clip_title: 'The Secret to Going Viral in 2025',
        start_time_seconds: 142,
        end_time_seconds: 198,
        virality_score: 94,
        storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-1.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1593697909683-bccb1b9e68a4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHwzfHxwb2RjYXN0JTIwY3JlYXRvcnxlbnwwfHx8fDE3ODIzNzQ5NDJ8MA&ixlib=rb-4.1.0&q=85',
        is_scheduled: false,
        scheduled_time: null,
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        video_id: videoId,
        user_id: DEFAULT_USER_ID,
        clip_title: 'Why 99% of Creators Fail (Hard Truth)',
        start_time_seconds: 412,
        end_time_seconds: 471,
        virality_score: 88,
        storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-2.mp4',
        thumbnail_url: 'https://images.unsplash.com/photo-1581368135153-a506cf13b1e1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHw0fHxwb2RjYXN0JTIwY3JlYXRvcnxlbnwwfHx8fDE3ODIzNzQ5NDJ8MA&ixlib=rb-4.1.0&q=85',
        is_scheduled: false,
        scheduled_time: null,
        created_at: new Date(),
      },
      {
        id: uuidv4(),
        video_id: videoId,
        user_id: DEFAULT_USER_ID,
        clip_title: '3 Hooks That Stop the Scroll Instantly',
        start_time_seconds: 622,
        end_time_seconds: 678,
        virality_score: 79,
        storage_url_mp4: 'https://cdn.clipforge.ai/clips/sample-3.mp4',
        thumbnail_url: 'https://images.pexels.com/photos/7600898/pexels-photo-7600898.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
        is_scheduled: false,
        scheduled_time: null,
        created_at: new Date(),
      },
    ])
  }
}

function strip(doc) {
  if (!doc) return doc
  // remove mongo _id
  const { _id, ...rest } = doc
  return rest
}

async function handle(request, { params }) {
  const segments = (await params).path || []
  const path = '/' + segments.join('/')
  const method = request.method
  const db = await getDb()

  try {
    // GET /api/ → health
    if (path === '/' && method === 'GET') {
      return NextResponse.json({ status: 'ok', service: 'ClipForge AI', version: '1.0.0' })
    }

    // GET /api/geo  → mocked geolocation
    if (path === '/geo' && method === 'GET') {
      const url = new URL(request.url)
      const force = url.searchParams.get('force')
      // mock — randomly pick India OR US, allow override via ?force=IN|US
      const country = force || (Math.random() < 0.5 ? 'IN' : 'US')
      return NextResponse.json({
        country_code: country,
        country_name: country === 'IN' ? 'India' : 'United States',
        currency: country === 'IN' ? 'INR' : 'USD',
        symbol: country === 'IN' ? '₹' : '$',
        payment_processor: country === 'IN' ? 'razorpay' : 'lemon_squeezy',
      })
    }

    // GET /api/profile?admin=true → return admin profile
    if (path === '/profile' && method === 'GET') {
      const url = new URL(request.url)
      const wantAdmin = url.searchParams.get('admin') === 'true'
      const id = wantAdmin ? ADMIN_USER_ID : DEFAULT_USER_ID
      const profile = await db.collection('profiles').findOne({ id })
      return NextResponse.json(strip(profile))
    }

    // PUT /api/profile  body: { theme_preference, ... }
    if (path === '/profile' && method === 'PUT') {
      const body = await request.json()
      const url = new URL(request.url)
      const wantAdmin = url.searchParams.get('admin') === 'true'
      const id = wantAdmin ? ADMIN_USER_ID : DEFAULT_USER_ID
      const updates = {}
      if (typeof body.theme_preference === 'string') updates.theme_preference = body.theme_preference
      if (typeof body.credit_balance_minutes === 'number') updates.credit_balance_minutes = body.credit_balance_minutes
      await db.collection('profiles').updateOne({ id }, { $set: updates })
      const p = await db.collection('profiles').findOne({ id })
      return NextResponse.json(strip(p))
    }

    // GET /api/pricing-packages
    if (path === '/pricing-packages' && method === 'GET') {
      const list = await db.collection('pricing_packages').find({}).sort({ credit_amount_minutes: 1 }).toArray()
      return NextResponse.json(list.map(strip))
    }

    // POST /api/pricing-packages  (admin create)
    if (path === '/pricing-packages' && method === 'POST') {
      const body = await request.json()
      const doc = {
        id: uuidv4(),
        name: body.name || 'New Pack',
        credit_amount_minutes: Number(body.credit_amount_minutes) || 100,
        price_inr: Number(body.price_inr) || 0,
        price_usd: Number(body.price_usd) || 0,
        discount_percentage: Number(body.discount_percentage) || 0,
        is_featured: !!body.is_featured,
        is_active: body.is_active !== false,
        created_at: new Date(),
      }
      await db.collection('pricing_packages').insertOne(doc)
      return NextResponse.json(strip(doc))
    }

    // PUT /api/pricing-packages/:id
    if (path.startsWith('/pricing-packages/') && method === 'PUT') {
      const id = segments[1]
      const body = await request.json()
      const allowed = ['name','credit_amount_minutes','price_inr','price_usd','discount_percentage','is_featured','is_active']
      const updates = {}
      for (const k of allowed) if (k in body) updates[k] = body[k]
      await db.collection('pricing_packages').updateOne({ id }, { $set: updates })
      const p = await db.collection('pricing_packages').findOne({ id })
      return NextResponse.json(strip(p))
    }

    // DELETE /api/pricing-packages/:id
    if (path.startsWith('/pricing-packages/') && method === 'DELETE') {
      const id = segments[1]
      await db.collection('pricing_packages').deleteOne({ id })
      return NextResponse.json({ ok: true })
    }

    // GET /api/clips
    if (path === '/clips' && method === 'GET') {
      const list = await db.collection('generated_clips').find({ user_id: DEFAULT_USER_ID }).sort({ virality_score: -1 }).toArray()
      return NextResponse.json(list.map(strip))
    }

    // PUT /api/clips/:id
    if (path.startsWith('/clips/') && method === 'PUT') {
      const id = segments[1]
      const body = await request.json()
      const allowed = ['clip_title','is_scheduled','scheduled_time']
      const updates = {}
      for (const k of allowed) if (k in body) updates[k] = body[k]
      await db.collection('generated_clips').updateOne({ id }, { $set: updates })
      const c = await db.collection('generated_clips').findOne({ id })
      return NextResponse.json(strip(c))
    }

    // POST /api/videos  — ingest URL (mock)
    if (path === '/videos' && method === 'POST') {
      const body = await request.json()
      const video = {
        id: uuidv4(),
        user_id: DEFAULT_USER_ID,
        original_url: body.url || '',
        status: 'queued',
        created_at: new Date(),
      }
      await db.collection('videos_processed').insertOne(video)
      return NextResponse.json(strip(video))
    }

    return NextResponse.json({ error: 'Not Found', path, method }, { status: 404 })
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
