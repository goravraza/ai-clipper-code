'use client'

// Global upgrade dialog. Listens for `window.upgrade-open` events. Lists all
// active tiers with their features so the user can compare and pick a plan.
// Currently the CTAs just take the user to the /#pricing anchor + toast —
// the payment gateway wiring lives in a later phase.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Check, X, Lock } from 'lucide-react'
import { useFeatures, refreshFeatures } from '@/app/_lib/useFeatures'

export default function UpgradeDialog() {
  const data = useFeatures()
  const [open, setOpen] = useState(false)
  const [triggerFeature, setTriggerFeature] = useState(null)

  useEffect(() => {
    if (!data) refreshFeatures()
    const onOpen = (e) => {
      setTriggerFeature(e?.detail?.featureKey || null)
      setOpen(true)
    }
    window.addEventListener('upgrade-open', onOpen)
    return () => window.removeEventListener('upgrade-open', onOpen)
  }, [data])

  const catalog = data?.catalog || []
  const tiers = (data?.tiers || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentPlan = data?.plan_key
  const triggered = triggerFeature ? catalog.find(c => c.key === triggerFeature) : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {triggered ? `Unlock “${triggered.label}”` : 'Upgrade your plan'}
          </DialogTitle>
          <DialogDescription>
            {triggered
              ? triggered.description
              : 'Get access to premium captions, branding controls, HD export & more.'}
          </DialogDescription>
        </DialogHeader>

        {tiers.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading plans…</div>
        ) : (
          <div className={`grid gap-4 ${tiers.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {tiers.map(tier => (
              <TierCard
                key={tier.id || tier.key}
                tier={tier}
                catalog={catalog}
                data={data}
                isCurrent={tier.key === currentPlan}
                triggerFeature={triggerFeature}
                onClose={() => setOpen(false)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TierCard({ tier, catalog, data, isCurrent, triggerFeature, onClose }) {
  const matrix = data?.matrix || {}
  const enabled = matrix[tier.key] || null

  return (
    <div className={`rounded-lg border p-5 flex flex-col gap-3 relative ${isCurrent ? 'border-primary bg-primary/5' : 'border-border'}`}>
      {isCurrent && (
        <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground border-transparent text-[10px]">Current plan</Badge>
      )}
      <div>
        <div className="text-lg font-bold">{tier.name}</div>
        {tier.tagline && <div className="text-xs text-muted-foreground mt-0.5">{tier.tagline}</div>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">${tier.price_usd || 0}</span>
        <span className="text-xs text-muted-foreground">/mo</span>
      </div>

      <div className="space-y-1.5 mt-1 text-xs">
        {catalog.map(f => {
          const isOn = enabled ? !!enabled[f.key] : null
          const isTrigger = triggerFeature === f.key
          return (
            <div key={f.key} className={`flex items-center gap-2 ${isTrigger ? 'font-semibold' : ''}`}>
              {isOn === null ? (
                <span className="h-3.5 w-3.5 rounded-full bg-muted animate-pulse" />
              ) : isOn ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              )}
              <span className={isOn === false ? 'text-muted-foreground/70' : ''}>{f.label}</span>
              {isTrigger && <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1.5">You need this</Badge>}
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-2">
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            <Check className="h-3.5 w-3.5 mr-1" /> You’re on this plan
          </Button>
        ) : (
          <Link href="/#pricing" onClick={() => { onClose(); toast.message('Payment checkout is coming soon.', { description: `Contact us to upgrade to ${tier.name}.` }) }}>
            <Button className="w-full gradient-bg text-white">
              <Lock className="h-3.5 w-3.5 mr-1" /> Upgrade to {tier.name}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
