import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

export const metadata = { title: 'Terms of Service — ClipForge AI' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><span className="font-semibold">Terms of Service</span></div>
          <div className="w-24" />
        </div>
      </header>
      <main className="container max-w-3xl py-12 prose prose-invert dark:prose-invert">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: June 2025</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
        <p>By accessing ClipForge AI you agree to be bound by these Terms. If you do not agree, do not use the service.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. Account</h2>
        <p>You are responsible for safeguarding your password and for any activities on your account.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Credits & Billing</h2>
        <p>Credits are non-transferable and non-refundable except as stated in our Refund Policy.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Content</h2>
        <p>You retain ownership of content you upload. You grant us a limited license to process it for clipping/captioning purposes.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">5. Prohibited Use</h2>
        <p>You may not upload content that infringes copyright, contains illegal material, or violates platform policies.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">6. Termination</h2>
        <p>We may suspend or terminate accounts that violate these Terms.</p>
      </main>
    </div>
  )
}
