#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# Communication Protocol — Format follows yaml; Main agent updates BEFORE invoking testing agent.
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: "User feedback after editor v1: (1) captions weren't generated on the latest ingestion; (2) logo should be draggable on the preview and size-adjustable, with the preview matching final render exactly; (3) speed change should be reflected in the preview video playback."

backend:
  - task: "yt-dlp-based audio extraction (replaces fragile ffmpeg+stream URL via proxy)"
    implemented: true
    working: "NA"
    file: "lib/video-processor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "ROOT CAUSE for missing captions: ffmpeg-via-http_proxy was throwing 'unexpected TLS packet' errors on Thordata exit-nodes when fetching the audio-only stream URL → Whisper never got audio → no SRT → captions missing. NEW: yt-dlp with --extract-audio --audio-format mp3 (5 retries, 30s socket timeout, ffmpeg-location pinned) downloads audio directly via the proxy (yt-dlp handles proxy redirects much better than ffmpeg). Falls back to the old ffmpeg+stream path if yt-dlp also fails."

  - task: "Audio duration probe + properly-scaled synthetic segments for gpt-4o-transcribe"
    implemented: true
    working: "NA"
    file: "lib/video-processor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Previously: gpt-4o-transcribe returned plain text without timestamps; synthetic segments were created with start=0,1,2... — totally misaligned with the source video's timeline, so buildClipSrt filtered them all out (clipStart=51 etc.) → empty SRT → no captions burned. NOW: probe audio duration with ffprobe, then distribute words evenly across [0, audioDuration] in ~6-word cues. Cues now line up with the actual audio timeline, so clip-local SRT extraction works."

  - task: "POST /api/clips/:id/render — accept logo_x_percent/y_percent/scale_percent for drag-positioned logos"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Backward-compatible: if logo_x_percent + logo_y_percent supplied, ffmpeg uses overlay=(W*x/100)-(w/2):(H*y/100)-(h/2) (x/y is logo CENTER as % of frame). Else uses the 4-corner preset. logo_scale_percent (5–50) controls logo width as % of frame width. Persisted to DB so re-opening the editor shows the same position. Verified via curl with center-50/50 + scale 20%, returns 200 and DB has new fields."

frontend:
  - task: "Editor preview — playbackRate matches selected speed"
    implemented: true
    working: true
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "videoRef.current.playbackRate is set whenever state.speed or the video src changes. A prominent '1.50×' badge in top-left of the preview confirms the active speed. Verified via screenshot — Speed tab + preset buttons work, badge appears, footer shows 'playback speed 1.50×'."

  - task: "Editor preview — draggable logo with live percent-coords + size slider"
    implemented: true
    working: "NA"
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Logo on preview is positioned with state.logo_x_percent / logo_y_percent (CSS left/top %). Pointer events (pointerdown/move/up + setPointerCapture) let the user drag anywhere on the preview frame; coords clamp to 0–100% and update in real time. logo_scale_percent slider in the Logo tab (5–40%) resizes the logo. 4-corner quick presets remain as shortcuts. Logo tab also shows a hint banner + live coord readout. Hooks declared above the early return to fix Rules-of-Hooks violation."

  - task: "Editor preview — speed/title/caption/logo overlays accurate to final render"
    implemented: true
    working: "NA"
    file: "app/_components/ClipEditor.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Preview container uses CSS aspect-ratio matching state.crop_aspect, with object-cover on the video — this gives the same center-crop ffmpeg will do. Title text overlay positioned top-4 or bottom-4 (matches ffmpeg drawtext y expression). Logo positioned at (x%, y%) of the preview box, which corresponds 1:1 to the rendered overlay coordinate after ffmpeg overlay=(W*x/100)-(w/2):(H*y/100)-(h/2). Caption position guide line shows 'Sample caption preview' at the configured percent-from-top. Speed badge + playbackRate. Now: 'what you see is what you get'."

metadata:
  created_by: "main_agent"
  version: "7.1"
  test_sequence: 7
  run_ui: false

test_plan:
  current_focus:
    - "Re-ingest a Hindi YouTube URL — verify captions are generated this time (transcription_source should be 'whisper' or 'gpt-4o-transcribe-synth', segments > 5, captions_burned: true on each clip)"
    - "Verify yt-dlp audio extraction succeeds via Thordata proxy (look for 'audio.mp3' file created and Whisper call succeeding)"
    - "POST /api/clips/:id/render with logo_x_percent + logo_y_percent + logo_scale_percent — verify the logo appears at the requested coords in the output MP4 (visual inspection via ffmpeg-extracted frame)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Three fixes shipped to address user feedback:

      1) CAPTIONS NOT GENERATED — Two root causes fixed:
         (a) ffmpeg-via-proxy was failing TLS on audio-stream URL. Switched to yt-dlp --extract-audio (proxy-tolerant).
         (b) gpt-4o-transcribe synthetic segments had timestamps 0,1,2... that didn't align with the source timeline. Now we probe audio duration and distribute cues evenly across it.

      2) LOGO INTERACTIVE — User can drag the logo on the preview to any (x, y). Backend accepts logo_x_percent / logo_y_percent / logo_scale_percent. 4-corner presets remain as quick shortcuts. The Logo tab shows live coord readout + size slider.

      3) PREVIEW MATCHES FINAL — Preview video playbackRate is set from state.speed. Speed badge visible. Caption position guide shown. Title position matches ffmpeg drawtext. Logo position is 1:1 between preview CSS and ffmpeg overlay coords.

      VERIFIED:
      - /render with logo_x=50, logo_y=50, scale=20 → 200, DB persists fields.
      - Speed badge shows in preview, footer says "playback speed 1.50×".

      NEEDS FRESH INGESTION TEST:
      - Submit a Hindi YouTube URL → verify captions burn into clips this time.
      - Drag-render a logo → verify output MP4 has logo at requested position.
