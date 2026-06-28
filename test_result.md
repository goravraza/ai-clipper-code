#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# Communication Protocol — Format follows yaml; Main agent updates BEFORE invoking testing agent.
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: "Three integrated fixes: (1) Auto text-wrap for captions inside 9:16 frame (no bleeding), (2) Interactive caption selection & inline editing on preview canvas, (3) Live preset/typography styling applied in real-time without breaking backend render."

backend:
  - task: "buildClipSrt + ffmpegSubtitleFilter — auto-chunk 4 words/line, ASS WrapStyle, 10% horizontal guards"
    implemented: true
    working: true
    file: "lib/video-processor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Hard chunking: max 4 words per cue (long cues split into multiple cues). Cues with 5–8 words use \\n (line break) at the midpoint. ASS filter now passes WrapStyle=0 (smart wrap), MarginL/MarginR=10% of frame width (=80% max caption width — no bleed), MarginV scaled to actual frame height, and original_size=WxH so ASS positions correctly in the real frame. Probes output frame dimensions via ffprobe before building the style string."

  - task: "POST /api/clips/:id/render — accept caption_segments override + word-chunking + frame-aware ASS"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Render endpoint now accepts body.caption_segments (array of {start,end,text} in clip-local seconds). When present, it overrides the cached srt_content. Both paths flow through the same writeSrt() helper that enforces 4-words/line chunking + \\n line breaks. Frame dims probed from srcPath then adjusted for crop_aspect to get exact output WxH (used for marginV/marginH scaling + original_size). Persists final rendered SRT to clip.srt_content_rendered. Verified: trim+crop+custom-segments render returned 200, MP4 duration 5.0s, no ffmpeg crashes."

  - task: "GET /api/clips/:id/transcript — parse SRT into JSON segments for editor"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns {segments:[{start,end,text}], clip_id, has_srt}. Parses both ',' and '.' millisecond separators. Verified: clip 87a5a528 returns 16 cues correctly."

  - task: "PUT /api/clips/:id/transcript — save edited cues back to clip.srt_content"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Accepts {segments:[{start,end,text}]}. Sanitizes (drops control chars, trims, max 500 chars/text), filters invalid cues (end<=start), re-serializes to SRT, writes to DB. Stamps transcript_edited_at. Logged via logActivity."

frontend:
  - task: "Live interactive caption overlay on preview — selectable, double-click editable"
    implemented: true
    working: true
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Replaced the static 'Sample caption preview' line with an interactive overlay bound to activeCaptionTrack. requestAnimationFrame loop polls video.currentTime → findActiveCue → highlights matching cue in CC tab list AND renders that cue's text on the preview. Double-click the rendered text → switches to inline <textarea> (autoFocus); Enter or blur commits. Single click → switches to CC tab for full transcript view. Style mirrors ASS via styleAssToCss helper so preview pixel-matches final render. Empty/ghost state shows 'Sample caption preview' at 40% opacity until real captions exist."

  - task: "CC tab transcript list — seek, edit inline, add, delete, save"
    implemented: true
    working: true
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Transcript list shows {N} cues. Each row: clickable timestamp (seeks video), inline editable text input, delete button (visible on hover). Top toolbar: Add cue at current time (Plus icon), Save without rendering (PUT /transcript). Active cue is highlighted purple. Empty state when no SRT exists."

  - task: "Live preset/typography sync — preset clicks + font/stroke sliders update overlay instantly"
    implemented: true
    working: true
    file: "app/_components/ClipEditor.js, app/_components/captionUtils.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "New captionUtils.js: styleAssToCss() converts ASS color tokens (&HAABBGGRR&), fontName, fontSize, outline, back box into a CSS style object. The preview caption overlay reads state.style_ass, state.font_size, state.outline_size directly — any change to a preset or slider re-renders the overlay synchronously. chunkForLine() mirrors backend word-chunking client-side for preview parity. findActiveCue() does the time-sync."

  - task: "Render flow sends caption_segments + auto-saves transcript"
    implemented: true
    working: true
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "renderClip() PUTs current activeCaptionTrack to /api/clips/:id/transcript (fire-and-forget), then POSTs /render with caption_segments included in the payload. Backend uses the edited segments verbatim — no parameter mismatches or crashes."

metadata:
  created_by: "main_agent"
  version: "8.0"
  test_sequence: 8
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Complete rewrite of the caption editing pipeline shipped:

      BOUNDARIES & WRAPPING:
      - 4 words per cue / line MAX. Long cues split into multiple sequential cues; cues with 5–8 words use \\n line-break at midpoint.
      - ASS filter: WrapStyle=0 (smart), MarginL=MarginR=10% of frame width → captions can never exceed 80% width. MarginV scaled to real frame height. original_size=actual WxH so ASS coords map 1:1.
      - Frame dims auto-probed from source MP4 + adjusted for crop_aspect → exact output dims drive layout.

      INTERACTIVE EDITING:
      - GET /api/clips/:id/transcript returns parsed JSON segments.
      - PUT /api/clips/:id/transcript saves edits back as SRT.
      - Editor opens → fetches transcript → loads into activeCaptionTrack state.
      - Time-sync via rAF loop on the preview video → activeCueIdx auto-updates.
      - Caption text rendered live on preview, styled to match ffmpeg output (color, font, stroke, back box, bold, size).
      - Double-click preview text → inline <textarea> for editing.
      - CC tab transcript list: per-cue timestamp (seek), inline text input, delete, add new cue at currentTime, save.

      LIVE STYLE SYNC:
      - All preset clicks + font/stroke/position sliders immediately update the preview overlay via styleAssToCss().
      - On Render: edited captions are saved + passed to backend in caption_segments — backend uses them directly with the new chunking pipeline.

      VERIFIED:
      - GET /transcript for clip 87a5a528 → 16 cues.
      - POST /render with custom long sentence (16 words) + crop 9:16 → 200 OK, MP4 duration 5.0s, no crash.
      - Editor screenshot shows live caption "problem in this. So we have" on preview + active row highlighted + full transcript list editable.
