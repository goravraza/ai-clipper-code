// Cloudflare R2 helpers — uses AWS S3 v3 SDK (R2 is S3-compatible).
// Credentials are read from integration_credentials (provider='cloudflare_r2') OR env vars.
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CreateBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'

async function getR2Config(db) {
  let cfg = null
  if (db) {
    try {
      const integ = await db.collection('integration_credentials').findOne({ provider: 'cloudflare_r2', is_active: { $ne: false } })
      if (integ?.credentials) cfg = integ.credentials
    } catch {}
  }
  return {
    accountId: cfg?.account_id || process.env.R2_ACCOUNT_ID,
    accessKeyId: cfg?.access_key_id || process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: cfg?.secret_access_key || process.env.R2_SECRET_ACCESS_KEY,
    bucket: cfg?.bucket || process.env.R2_BUCKET || 'clipforge-videos',
    publicDomain: cfg?.public_domain || process.env.R2_PUBLIC_DOMAIN || null,
  }
}

export async function getR2Client(db) {
  const cfg = await getR2Config(db)
  if (!cfg.accessKeyId || !cfg.secretAccessKey || !cfg.accountId) return { client: null, cfg }
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
  return { client, cfg }
}

export async function ensureR2Bucket(db) {
  const { client, cfg } = await getR2Client(db)
  if (!client) throw new Error('Cloudflare R2 not configured. Add credentials in Admin → Integrations.')
  try {
    // Bucket-scoped tokens may not allow ListBuckets — use HeadBucket which works with scoped tokens
    await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: '__placeholder_does_not_exist' }))
  } catch (e) {
    // 404 = bucket exists, key missing (OK). Other errors → bucket may not exist; try to create.
    if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== 'NotFound') {
      try { await client.send(new CreateBucketCommand({ Bucket: cfg.bucket })) } catch (createErr) { /* may already exist or no permission — that's OK; PutObject will surface real error */ }
    }
  }
  return cfg.bucket
}

// Upload a local file path to R2 and return { key, signedUrl, publicUrl, size }
export async function uploadToR2({ db, localPath, key, contentType = 'video/mp4', expiresInSeconds = 7 * 86400 }) {
  const { client, cfg } = await getR2Client(db)
  if (!client) throw new Error('Cloudflare R2 not configured.')
  await ensureR2Bucket(db)
  const buffer = await fs.readFile(localPath)
  await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: buffer, ContentType: contentType }))
  const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), { expiresIn: Math.min(expiresInSeconds, 7 * 86400) })
  const publicUrl = cfg.publicDomain ? `${cfg.publicDomain.replace(/\/$/, '')}/${key}` : null
  return { key, signedUrl, publicUrl, size: buffer.length, bucket: cfg.bucket }
}

// Get a fresh signed URL for an existing R2 key
export async function getR2SignedUrl({ db, key, expiresInSeconds = 3600 }) {
  const { client, cfg } = await getR2Client(db)
  if (!client) throw new Error('Cloudflare R2 not configured.')
  return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), { expiresIn: Math.min(expiresInSeconds, 7 * 86400) })
}

// Delete an R2 object
export async function deleteFromR2({ db, key }) {
  const { client, cfg } = await getR2Client(db)
  if (!client) return false
  try { await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })); return true } catch (e) { console.error('R2 delete failed', e.message); return false }
}

// Check if an R2 key exists
export async function r2KeyExists({ db, key }) {
  const { client, cfg } = await getR2Client(db)
  if (!client) return false
  try { await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key })); return true } catch { return false }
}
