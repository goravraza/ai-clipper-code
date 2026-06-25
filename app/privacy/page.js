import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'

export const metadata = { title: 'Privacy Policy — ClipForge AI' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Privacy Policy</span></div>
          <div className="w-24" />
        </div>
      </header>
      <main className="container max-w-3xl py-12">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: June 2025</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Data we collect</h2>
        <p>Account info (email, name), uploaded video URLs, and usage metadata such as IP and timestamps for security auditing.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. How we use it</h2>
        <p>To process your clips, deliver service updates, prevent fraud, and improve product features.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Third-party processors</h2>
        <p>We use Google Gemini for AI inference, Razorpay and Lemon Squeezy for payments. Your data is shared only as necessary to provide the service.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Your rights</h2>
        <p>You may request export or deletion of your account data at any time by emailing privacy@clipforge.ai.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">5. Cookies</h2>
        <p>We use httpOnly session cookies for authentication. We do not run third-party advertising trackers.</p>
      </main>
    </div>
  )
}
