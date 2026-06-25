'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Chrome } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  function signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/auth/callback`
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] gradient-bg opacity-20 blur-3xl rounded-full pointer-events-none" />
      <Card className="relative max-w-md w-full">
        <CardContent className="py-10 px-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to ClipForge<span className="gradient-text">AI</span></h1>
            <p className="text-muted-foreground text-sm mt-2">Sign in to access your workspace and start clipping.</p>
          </div>
          <Button onClick={signInWithGoogle} size="lg" className="w-full gap-2">
            <Chrome className="h-4 w-4" /> Continue with Google
          </Button>
          <Link href="/" className="block text-xs text-muted-foreground hover:text-foreground">← Continue as demo user</Link>
        </CardContent>
      </Card>
    </div>
  )
}
