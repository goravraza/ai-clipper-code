'use client'

// <FeatureGate feature="custom_colors">...</FeatureGate>
//   Wraps interactive UI. If the current user's plan lacks the feature, the
//   children get dimmed and click events are captured to open the shared
//   UpgradeDialog. Non-blocking: the layout stays identical, so we don't
//   cause layout shift when the feature map arrives from the network.

import { Lock } from 'lucide-react'
import { useFeatures, openUpgradeDialog } from '@/app/_lib/useFeatures'

export default function FeatureGate({
  feature,
  children,
  mode = 'overlay',     // 'overlay' (default) | 'hidden' | 'badge'
  className = '',
  label,                // optional CTA text
}) {
  const data = useFeatures()
  const enabled = data ? !!(data.features && data.features[feature]) : true
  if (enabled) return children
  if (mode === 'hidden') return null

  const onIntercept = (e) => {
    e.stopPropagation(); e.preventDefault()
    openUpgradeDialog(feature)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <button
        type="button"
        onClick={onIntercept}
        className="absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-primary/40 bg-background/50 backdrop-blur-[1px] hover:bg-background/60 hover:border-primary/70 transition-colors group cursor-pointer"
        title="Upgrade to unlock"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/95 text-primary-foreground px-3 py-1 text-xs font-semibold shadow-lg group-hover:scale-105 transition-transform">
          <Lock className="h-3.5 w-3.5" /> {label || 'Upgrade to unlock'}
        </span>
      </button>
    </div>
  )
}
