'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const m = hash.match(/session_id=([^&]+)/)
    if (!m) {
      router.replace('/?auth_error=missing_session')
      return
    }
    const sessionId = decodeURIComponent(m[1])
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Session exchange failed')
        // clear hash
        if (typeof window !== 'undefined') window.location.hash = ''
        router.replace('/')
      })
      .catch(() => router.replace('/?auth_error=session_exchange_failed'))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}
