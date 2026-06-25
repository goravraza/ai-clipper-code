'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLink, setResetLink] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/auth/forgot-password', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email }) })
      const data = await r.json()
      toast.success('Check your inbox', { description: 'If an account exists for that email, we sent a reset link.' })
      if (data.reset_link) setResetLink(data.reset_link)
    } catch (err) {
      toast.error('Request failed', { description: err.message })
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 relative">
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
      <Card className="relative max-w-md w-full">
        <CardContent className="py-8 px-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg glow"><Sparkles className="h-7 w-7 text-white" /></div></div>
            <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm mt-1">We’ll email you a secure reset link.</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <Button type="submit" disabled={loading} className="w-full gradient-bg text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Send reset link
            </Button>
          </form>
          {resetLink && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="text-muted-foreground mb-1">DEMO MODE — reset link (in production this is emailed):</p>
              <Link href={resetLink} className="text-primary hover:underline break-all font-mono">{resetLink}</Link>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Remembered it? <Link href="/login" className="text-primary hover:underline">Sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  )
}
