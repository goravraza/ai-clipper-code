'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, Loader2, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/auth/signup', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ name, email, password }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Signup failed')
      toast.success('Account created!', { description: '30 free credits added to your wallet.' })
      if (data.verification_link) toast.info('Verify your email', { description: `Mock link: ${data.verification_link}` })
      router.replace('/')
    } catch (err) {
      toast.error('Signup failed', { description: err.message })
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 relative">
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] gradient-bg opacity-20 blur-3xl rounded-full pointer-events-none" />
      <Card className="relative max-w-md w-full">
        <CardContent className="py-8 px-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg glow"><Sparkles className="h-7 w-7 text-white" /></div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Create your ClipForge<span className="gradient-text">AI</span> account</h1>
            <p className="text-muted-foreground text-sm mt-1">Get 30 free clipping minutes on signup.</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Full name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Creator" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Password</Label><Input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
            <Button type="submit" disabled={loading} className="w-full gradient-bg text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />} Create account
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">Have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link></p>
        </CardContent>
      </Card>
    </div>
  )
}
