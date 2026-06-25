'use client'

import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, Loader2, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

function ResetPasswordInner() {
  const sp = useSearchParams()
  const token = sp.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) return toast.error('Passwords don’t match')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/reset-password', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ token, password }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Reset failed')
      toast.success('Password updated!', { description: 'Sign in with your new password.' })
      router.replace('/login')
    } catch (err) {
      toast.error('Reset failed', { description: err.message })
    } finally { setLoading(false) }
  }

  return (
    <Card className="relative max-w-md w-full">
      <CardContent className="py-8 px-8 space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg glow"><Sparkles className="h-7 w-7 text-white" /></div></div>
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose something strong & unique.</p>
        </div>
        {!token ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Reset token missing or invalid. <Link href="/forgot-password" className="underline">Request a new link</Link>.</div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">New password</Label><Input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Confirm</Label><Input type="password" required minLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full gradient-bg text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />} Update password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 relative">
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}>
        <ResetPasswordInner />
      </Suspense>
    </div>
  )
}
