import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export const metadata = { title: 'Refund Policy — ClipForge AI' }

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /><span className="font-semibold">Refund Policy</span></div>
          <div className="w-24" />
        </div>
      </header>
      <main className="container max-w-3xl py-12">
        <h1 className="text-3xl font-bold mb-4">Refund Policy</h1>
        <p className="text-muted-foreground">Last updated: June 2025</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. 7-day money-back guarantee</h2>
        <p>If less than 20% of your purchased credits are used within 7 days of purchase, you may request a full refund.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. How to request</h2>
        <p>Email refunds@clipforge.ai with your order ID. We process refunds within 5–7 business days back to your original payment method.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Exceptions</h2>
        <p>Refunds may be denied for accounts that violate the Terms of Service or show abusive usage patterns.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Currency</h2>
        <p>Refunds are returned in the original purchase currency (INR via Razorpay, USD via Lemon Squeezy).</p>
      </main>
    </div>
  )
}
