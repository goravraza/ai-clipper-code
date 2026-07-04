'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, ShieldCheck, Coins, Save } from 'lucide-react'

export default function UsersTab() {
  const [users, setUsers] = useState(null)
  const [tiers, setTiers] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => {
    load()
    fetch('/api/admin/pricing-tiers?admin=true').then(r => r.json()).then(d => setTiers(Array.isArray(d) ? d : [])).catch(() => setTiers([]))
  }, [])
  async function load() { fetch('/api/admin/users?admin=true').then(r=>r.json()).then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>setUsers([])) }

  async function update(u) {
    const r = await fetch(`/api/admin/users/${u.id}?admin=true`, { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(u) })
    const updated = await r.json()
    setUsers(prev => prev.map(x => x.id === updated.id ? { ...updated, clip_count: x.clip_count } : x))
    toast.success(`Updated ${updated.email}`)
  }

  const filtered = (users || []).filter(u => !search || (u.email||'').toLowerCase().includes(search.toLowerCase()) || (u.name||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold">User Audit & Wallets</h1><p className="text-muted-foreground text-sm">Modify token balances, change role, view per-user clip count.</p></div>
        <Input placeholder="Search by email or name…" value={search} onChange={e=>setSearch(e.target.value)} className="max-w-xs" />
      </div>
      {users === null ? (
        <div className="grid gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3" />No users found.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(u => <UserRow key={u.id} user={u} tiers={tiers} onSave={update} />)}
        </div>
      )}
    </div>
  )
}

function UserRow({ user, tiers, onSave }) {
  const [credits, setCredits] = useState(user.credit_balance_minutes || 0)
  const [role, setRole] = useState(user.role || (user.is_admin ? 'admin' : 'user'))
  const [planKey, setPlanKey] = useState(user.plan_key || 'free')
  const dirty = credits !== user.credit_balance_minutes || role !== (user.role || (user.is_admin ? 'admin' : 'user')) || planKey !== (user.plan_key || 'free')
  const initials = (user.email || user.name || 'U').slice(0,2).toUpperCase()
  const currentTier = tiers.find(t => t.key === planKey)
  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.picture} alt={user.email} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{user.name || user.email}</span>
            {(user.is_admin || user.role === 'admin') && <Badge className="gradient-bg text-white border-transparent gap-1"><ShieldCheck className="h-3 w-3" /> Admin</Badge>}
            {currentTier && <Badge variant="outline" className="text-[10px]">{currentTier.name}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground truncate">{user.email} • {user.clip_count || 0} clips • joined {new Date(user.created_at).toLocaleDateString()}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <Input type="number" value={credits} onChange={e=>setCredits(Number(e.target.value))} className="w-24 h-8 text-xs" />
          </div>
          {tiers.length > 0 && (
            <Select value={planKey} onValueChange={setPlanKey}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiers.map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">user</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!dirty} onClick={() => onSave({ id: user.id, credit_balance_minutes: credits, role, plan_key: planKey })} className={dirty ? 'gradient-bg text-white' : ''}>
            <Save className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
