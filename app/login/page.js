'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sparkles, Chrome, Loader2, Mail, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/auth/callback`
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`
  }

  async function signInWithEmail(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await fetch('/api/auth/signin', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email, password }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Sign in failed')
      toast.success('Welcome back!', { description: data.user.email })
      router.replace('/')
    } catch (err) {
      toast.error('Sign in failed', { description: err.message })
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg glow">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back to ClipForge<span className="gradient-text">AI</span></h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to continue clipping.</p>
          </div>

          <Tabs defaultValue="email">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 mr-1.5" /> Email</TabsTrigger>
              <TabsTrigger value="google"><Chrome className="h-3.5 w-3.5 mr-1.5" /> Google</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="space-y-3 pt-4">
              <form onSubmit={signInWithEmail} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
                  </div>
                  <Input id="password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" disabled={loading} className="w-full gradient-bg text-white">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />} Sign in
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">No account? <Link href="/signup" className="text-primary hover:underline">Create one</Link></p>
            </TabsContent>
            <TabsContent value="google" className="space-y-3 pt-4">
              <Button onClick={signInWithGoogle} size="lg" className="w-full gap-2" variant="outline">
                <Chrome className="h-4 w-4" /> Continue with Google
              </Button>
              <p className="text-center text-xs text-muted-foreground">One-click, no password needed.</p>
            </TabsContent>
          </Tabs>

          <Link href="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">← Continue as demo user</Link>
        </CardContent>
      </Card>
    </div>
  )
}
