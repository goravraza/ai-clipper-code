// Public page renderer for CMS pages. Fetches by slug server-side so Google can index.
// Metadata (title, description, og image) is set from the page's SEO fields.

import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

async function fetchPage(slug) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('host') || 'localhost:3000'
  const url = `${proto}://${host}/api/pages/${encodeURIComponent(slug)}`
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const p = await fetchPage(slug)
  if (!p) return { title: 'Page not found' }
  return {
    title: p.meta_title || p.title,
    description: p.meta_description || undefined,
    openGraph: {
      title: p.meta_title || p.title,
      description: p.meta_description || undefined,
      images: p.og_image_url ? [{ url: p.og_image_url }] : undefined,
    },
  }
}

export default async function CmsPage({ params }) {
  const { slug } = await params
  const p = await fetchPage(slug)
  if (!p) notFound()
  return (
    <main className="min-h-screen bg-background">
      <article className="container max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-4xl font-bold mb-6">{p.title}</h1>
        <div className="prose prose-invert prose-headings:font-bold prose-a:text-primary max-w-none" dangerouslySetInnerHTML={{ __html: p.content_html || '' }} />
        <div className="text-xs text-muted-foreground mt-12 pt-8 border-t border-border">Last updated {new Date(p.updated_at || p.created_at).toLocaleDateString()}</div>
      </article>
    </main>
  )
}
