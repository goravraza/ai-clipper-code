'use client'

// Lightweight singleton store for the current user's feature-access map.
// Fetches once on first use; components subscribe via useFeatures().
// Broadcasts a `upgrade-open` window event to trigger the shared UpgradeDialog.

import { useEffect, useState } from 'react'

let cached = null
let pending = null
const listeners = new Set()

function notify() {
  for (const l of listeners) { try { l(cached) } catch { /* subscriber threw */ } }
}

export function loadFeatures(force = false) {
  if (cached && !force) return Promise.resolve(cached)
  if (pending) return pending
  pending = fetch('/api/user/features', { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { cached = d; pending = null; notify(); return d })
    .catch(() => { pending = null; return null })
  return pending
}

export function refreshFeatures() { return loadFeatures(true) }

export function useFeatures() {
  const [data, setData] = useState(cached)
  useEffect(() => {
    if (!cached) loadFeatures()
    const cb = (d) => setData(d)
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])
  return data
}

// True if the given feature key is enabled for the current user.
// While the feature map is still loading, returns true (fail-open UX — we
// don't want a flash-of-locked state on first paint).
export function useFeatureEnabled(featureKey) {
  const data = useFeatures()
  if (!data) return true
  return !!(data.features && data.features[featureKey])
}

export function openUpgradeDialog(featureKey) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('upgrade-open', { detail: { featureKey } }))
}
