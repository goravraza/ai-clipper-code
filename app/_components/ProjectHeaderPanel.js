'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Scissors, FileText, Download, Sparkles, Film, Loader2, ArrowLeft, Info, ChevronUp, ChevronDown, Search, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

function fmtDuration(sec) { sec = Number(sec) || 0; const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2,'0')}` }
function fmtSize(bytes) { if (!bytes) return '—'; const mb = bytes / (1024 * 1024); return mb > 1024 ? `${(mb/1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB` }

// HH:MM:SS number-spinner input
function TimeSpinner({ value, onChange, max = 86400 }) {
  const total = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)))
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const set = (nh, nm, ns) => onChange(Math.max(0, Math.min(max, nh*3600 + nm*60 + ns)))
  const Field = ({ v, onInc, onDec, label }) => (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onInc} className="p-0.5 hover:bg-muted rounded"><ChevronUp className="h-3.5 w-3.5" /></button>
      <div className="w-11 text-center text-xl font-mono font-semibold tabular-nums">{String(v).padStart(2,'0')}</div>
      <button type="button" onClick={onDec} className="p-0.5 hover:bg-muted rounded"><ChevronDown className="h-3.5 w-3.5" /></button>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground -mt-0.5">{label}</div>
    </div>
  )
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-start justify-center gap-1.5">
      <Field v={h} onInc={()=>set(h+1,m,s)} onDec={()=>set(h-1,m,s)} label="H" />
      <span className="text-xl font-bold mt-4">:</span>
      <Field v={m} onInc={()=>set(h,m+1,s)} onDec={()=>set(h,m-1,s)} label="M" />
      <span className="text-xl font-bold mt-4">:</span>
      <Field v={s} onInc={()=>set(h,m,s+1)} onDec={()=>set(h,m,s-1)} label="S" />
    </div>
  )
}

export function ProjectHeaderPanel({ project, projClips, videoDurationSec, videoSizeBytes, onOpenSupercut, onRefreshClips }) {
  const [drawerMode, setDrawerMode] = useState(null) // 'cut' | 'transcript' | null
  const [tab, setTab] = useState('timestamps')
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(Math.min(30, videoDurationSec || 30))
  const [creating, setCreating] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [chapters, setChapters] = useState([])
  const [generatingChapters, setGeneratingChapters] = useState(false)
  const [search, setSearch] = useState('')

  const openCut = () => { setDrawerMode('cut'); setTab('timestamps') }
  const openTranscript = () => { setDrawerMode('transcript'); setTab('text') }

  // Load transcript when transcript drawer opens
  useEffect(() => {
    if (drawerMode !== 'transcript' || !project?.id) return
    setTranscriptLoading(true)
    fetch(`/api/videos/${project.id}/transcript`).then(r => r.json()).then(d => {
      setTranscript(d?.text || d?.transcript || '')
      setChapters(Array.isArray(d?.chapters) ? d.chapters : [])
    }).catch(() => {}).finally(() => setTranscriptLoading(false))
  }, [drawerMode, project?.id])

  const doCreate = async () => {
    if (end <= start) return toast.error('End must be after start')
    setCreating(true)
    try {
      const r = await fetch(`/api/videos/${project.id}/cut-clip`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start_time_seconds: start, end_time_seconds: end }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Cut failed')
      toast.success('✨ Clip created', { description: `${fmtDuration(end - start)} clip added to your project` })
      setDrawerMode(null)
      onRefreshClips?.()
    } catch (e) { toast.error('Cut failed', { description: e.message }) }
    finally { setCreating(false) }
  }

  const genChapters = async () => {
    setGeneratingChapters(true)
    try {
      const r = await fetch(`/api/videos/${project.id}/chapters/auto`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Failed')
      setChapters(d.chapters || [])
      toast.success(`${d.chapters?.length || 0} chapters generated`)
    } catch (e) { toast.error('Chapter generation failed', { description: e.message }) }
    finally { setGeneratingChapters(false) }
  }

  const downloadFull = () => {
    // The source video isn't stored on disk (we cut only individual clip segments) — the fastest way to
    // let the user get the ORIGINAL video is to open the source page (YouTube/TikTok/etc) in a new tab
    // where they can use the platform's native download or a browser extension.
    if (project?.original_url) {
      window.open(project.original_url, '_blank', 'noopener,noreferrer')
    } else {
      toast.info('Source URL not available for this project')
    }
  }

  // Load the video transcript for the Cut & Clip → Transcript sub-tab.
  const [cutTranscript, setCutTranscript] = useState([])
  useEffect(() => {
    if (drawerMode !== 'cut' || !project?.id) return
    fetch(`/api/videos/${project.id}/transcript`).then(r => r.json()).then(d => {
      // Try to build phrase-level segments from clip srt_content if the flat text doesn't have timings.
      // Fetch each clip's transcript segments (with word timings) and merge.
      const list = []
      if (Array.isArray(projClips)) {
        for (const c of projClips) {
          if (Array.isArray(c.caption_segments) && c.caption_segments.length > 0) {
            for (const s of c.caption_segments) {
              list.push({ start: c.start_time_seconds + (s.start || 0), end: c.start_time_seconds + (s.end || 0), text: s.text || '' })
            }
          }
        }
      }
      list.sort((a, b) => a.start - b.start)
      setCutTranscript(list)
    }).catch(() => {})
  }, [drawerMode, project?.id, projClips])

  // Pick the first clip's local MP4 as a preview source for the drawer video player.
  const previewSrc = projClips?.[0]?.storage_url_mp4 ? `${projClips[0].storage_url_mp4}?v=${projClips[0].render_version || 0}` : null

  return (
    <>
      {/* HEADER CARD — title, meta bar, action buttons */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold truncate flex-1">{project?.title || 'Untitled project'}</div>
        </div>
        {/* meta bar with 3 icon actions on the right */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <span className="font-medium">{fmtDuration(videoDurationSec)}</span>
            <span>·</span>
            <span>{fmtSize(videoSizeBytes)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Cut & Clip" onClick={openCut}>
              <Scissors className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Transcript" onClick={openTranscript}>
              <FileText className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Download source video" onClick={downloadFull}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* primary action cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={openCut} className="gap-2"><Film className="h-4 w-4" /> Cut & Clip</Button>
          <Button variant="outline" onClick={onOpenSupercut} className="gap-2"><Sparkles className="h-4 w-4" /> Create Supercut</Button>
        </div>
      </Card>

      {/* RIGHT SLIDE-OUT DRAWER — Cut & Clip / Transcript */}
      <Sheet open={!!drawerMode} onOpenChange={(o) => !o && setDrawerMode(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base">
              {drawerMode === 'cut' ? (<><Scissors className="h-4 w-4" /> Cut & Clip</>) : (<><FileText className="h-4 w-4" /> Full Transcript</>)}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {drawerMode === 'cut' ? 'Select the part you like and create a clip from it.' : 'Full video transcript with searchable text and chapters.'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Video preview strip at the top of the drawer — visible for BOTH Cut & Clip and Transcript modes */}
            {previewSrc && (
              <div className="bg-black" onContextMenu={(e) => e.preventDefault()}>
                <video
                  ref={(el) => { if (el) el.currentTime = start }}
                  src={previewSrc}
                  className="w-full max-h-64 object-contain bg-black"
                  controls
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  playsInline
                  preload="metadata"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            )}

            {drawerMode === 'cut' && (
              <div className="p-4 space-y-4">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="timestamps">Timestamps</TabsTrigger>
                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="timestamps" className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground text-center">Start</div>
                        <TimeSpinner value={start} onChange={setStart} max={videoDurationSec || 86400} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground text-center">End</div>
                        <TimeSpinner value={end} onChange={setEnd} max={videoDurationSec || 86400} />
                      </div>
                    </div>
                    <div className="text-xs text-center text-muted-foreground">
                      Duration: <span className="font-mono font-semibold text-foreground">{fmtDuration(Math.max(0, end - start))}</span>
                    </div>
                  </TabsContent>
                  <TabsContent value="transcript" className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {cutTranscript.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        <FileText className="h-6 w-6 mx-auto mb-2 opacity-60" />
                        No transcript segments available. Open a clip in the editor first to auto-transcribe.
                      </div>
                    ) : (
                      <>
                        <div className="text-[11px] text-muted-foreground px-1">Click any phrase to select its time range as the cut. Shift+click extends the selection.</div>
                        {cutTranscript.map((s, i) => {
                          const active = start <= s.start && s.end <= end
                          return (
                            <button
                              key={i}
                              onClick={(e) => {
                                if (e.shiftKey) {
                                  setEnd(Math.max(start + 1, Math.floor(s.end)))
                                } else {
                                  setStart(Math.floor(s.start))
                                  setEnd(Math.max(Math.floor(s.start) + 5, Math.ceil(s.end)))
                                }
                              }}
                              className={`w-full text-left rounded-md border p-2 text-xs transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                            >
                              <div className="font-mono text-[10px] text-muted-foreground">{fmtDuration(s.start)} → {fmtDuration(s.end)}</div>
                              <div className="text-foreground/90 mt-0.5">{s.text}</div>
                            </button>
                          )
                        })}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {drawerMode === 'transcript' && (
              <div className="p-4 space-y-3">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="chapters">Chapters</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="mt-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8" />
                    </div>
                    {transcriptLoading ? (
                      <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-1.5" /> Loading transcript…</div>
                    ) : transcript ? (
                      <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 max-h-[60vh] overflow-y-auto">
                        {search
                          ? transcript.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi')).map((part, i) =>
                              i % 2 === 1 ? <mark key={i} className="bg-yellow-300 text-black px-0.5 rounded">{part}</mark> : <span key={i}>{part}</span>
                            )
                          : transcript}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">Transcript not available for this video yet.</div>
                    )}
                  </TabsContent>
                  <TabsContent value="chapters" className="mt-4 space-y-3">
                    {chapters.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border py-10 text-center">
                        <Sparkles className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">No chapters yet</div>
                        <div className="text-xs text-muted-foreground mt-1 mb-4">Let AI slice the video into logical chapters based on the transcript.</div>
                        <Button size="sm" onClick={genChapters} disabled={generatingChapters} className="gap-2">
                          {generatingChapters ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                          Generate Auto (AI decides)
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chapters.map((c, i) => (
                          <div key={i} className="rounded-lg border border-border p-2.5 flex items-center gap-2 text-xs">
                            <div className="font-mono text-muted-foreground">{fmtDuration(c.start)}</div>
                            <div className="flex-1 font-medium truncate">{c.title}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          {/* Persistent Create button for Cut & Clip mode */}
          {drawerMode === 'cut' && (
            <div className="border-t border-border p-3 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{fmtDuration(Math.max(0, end - start))}</div>
              <Button onClick={doCreate} disabled={creating || end <= start} className="flex-1 h-10">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

// Supercut sub-view — shown when the user clicks "Create Supercut"
export function SupercutView({ project, onBack }) {
  const [supercuts, setSupercuts] = useState([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!project?.id) return
    fetch(`/api/videos/${project.id}/supercuts`).then(r => r.json()).then(d => setSupercuts(Array.isArray(d?.supercuts) ? d.supercuts : [])).catch(() => {})
  }, [project?.id])

  const generate = async () => {
    setGenerating(true)
    try {
      const r = await fetch(`/api/videos/${project.id}/supercuts/auto`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success(`Supercut queued · ${d.segments || 0} segments will be stitched`)
      setSupercuts(prev => [d.supercut, ...prev])
    } catch (e) { toast.error('Supercut failed', { description: e.message }) }
    finally { setGenerating(false) }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button size="sm" variant="ghost" onClick={onBack} className="gap-1.5 -ml-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>
      <Card className="p-4 space-y-3 mb-4">
        <div className="text-sm font-semibold">{project?.title || 'Project'}</div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          A supercut is your video&apos;s best moments, stitched together by theme into one short clip.
        </div>
      </Card>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm"><span className="font-semibold">Supercuts</span> <span className="text-muted-foreground">{supercuts.length}</span></div>
        <Button size="sm" onClick={generate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Find More
        </Button>
      </div>
      {supercuts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <Loader2 className="h-5 w-5 mx-auto mb-2 text-muted-foreground animate-spin" />
          <div className="text-sm text-muted-foreground">Your video has hidden gems…</div>
          <div className="text-xs text-muted-foreground mt-1">Click <b>Find More</b> to have AI stitch your top moments.</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {supercuts.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              {s.storage_url_mp4 && (
                <video src={s.storage_url_mp4} controls controlsList="nodownload" disablePictureInPicture className="w-full aspect-[9/16] object-cover bg-black" />
              )}
              <div className="p-3">
                <div className="text-sm font-semibold line-clamp-2">{s.title || 'Supercut'}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.status || 'ready'} · {s.duration ? fmtDuration(s.duration) : '—'}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
