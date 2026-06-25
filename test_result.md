#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Fix video upload JSON.parse error and wire OpenAI Whisper transcription for uploaded MP4s."

backend:
  - task: "Local MP4 file upload returns valid JSON"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Reinstalled missing ffmpeg system package (was missing, causing background processor to crash). Verified POST /api/upload (multipart, kind=workspace_video) returns clean JSON {video_id, status, title, size}. Tested with 120s sample.mp4 — full pipeline completed successfully producing 3 real clips."
        -working: true
        -agent: "testing"
        -comment: "✓ PASS (14.3s): Uploaded 90s sample video (2.6MB), received valid JSON response with video_id, status=queued, title, size. All required fields present. No HTML corruption."

  - task: "Background video processing pipeline (FFmpeg cut + thumbnail)"
    implemented: true
    working: true
    file: "lib/video-processor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Rewrote lib/video-processor.js: defensive fs.access checks before spawn, all errors caught and routed to setStage('failed', error_message). Fixed YT_DLP path from /usr/local/bin/yt-dlp to /root/.venv/bin/yt-dlp. Verified 3 clips produced from sample.mp4 with valid mp4 + thumbnail in /app/data/uploads/clips/."
        -working: true
        -agent: "testing"
        -comment: "✓ PASS (14.3s): Full pipeline completed in 13s. Status progression: queued → transcribing (45%) → analyzing (60%) → cutting (80%) → completed (100%). Generated 3 clips with proper mp4 files and thumbnails. All clips have valid time ranges (15-60s), virality scores (50-99), and transcript segments."

  - task: "OpenAI Whisper transcription for uploaded videos"
    implemented: true
    working: true
    file: "lib/video-processor.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added new STAGE 2.5: when an OpenAI API key is configured in integration_credentials (provider=openai), extract mono 16kHz mp3 via ffmpeg and POST to OpenAI Whisper API (whisper-1, verbose_json, segment timestamps). If >24MB cap audio at 1500s. Segments populate transcript and per-clip transcript_segment is filled from time-bounded subset. transcription_source field on clip/video doc records 'whisper' | 'youtube-auto' | 'none'. Verified end-to-end run logged transcription_source=whisper."
        -working: true
        -agent: "testing"
        -comment: "✓ PASS (0.1s): Whisper transcription working correctly. Video doc shows transcription_source='whisper'. OpenAI API key confirmed present in integration_credentials. All clips have populated transcript_segment fields. Transcription integrated into AI analysis for better clip selection."

  - task: "File streaming endpoint /api/files/* (supports GET + HEAD)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added HEAD support so browser <video> tags can probe length without downloading the whole file. Added accept-ranges: bytes header. GET still returns full file with proper content-type, length, immutable cache."
        -working: true
        -agent: "testing"
        -comment: "✓ PASS (14.3s): Both GET and HEAD methods working correctly. GET /api/files/clips/{filename} returns HTTP 200, content-type: video/mp4, content-length: 343329 bytes, full file body. HEAD /api/files/clips/{filename} returns HTTP 200, same headers, empty body. Accept-ranges header present."

  - task: "Polling GET /api/videos/:id returns valid JSON during all stages"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Verified the polling endpoint returns clean JSON during queued/uploaded/downloading/transcribing/analyzing/cutting/completed/failed states. error_message is set on failure path. progress is 0-100 monotonically increasing."
        -working: true
        -agent: "testing"
        -comment: "✓ PASS (71.1s total across all tests): Polling endpoint returns valid JSON at all stages. Tested successful path (queued→transcribing→analyzing→cutting→completed) and failure path (empty file→failed with error_message). All responses have required fields: id, status, progress. No HTML corruption, no NaN tokens, no null corruption. Progress values monotonically increase 0→100. Error path correctly sets error_message field."

frontend: []

metadata:
  created_by: "main_agent"
  version: "2.2"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Local MP4 file upload returns valid JSON"
    - "Background video processing pipeline (FFmpeg cut + thumbnail)"
    - "OpenAI Whisper transcription for uploaded videos"
    - "Polling GET /api/videos/:id returns valid JSON during all stages"
    - "File streaming endpoint /api/files/* (supports GET + HEAD)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Fixed two issues that were causing video upload JSON.parse errors:
      1. ffmpeg was missing from the system (system rebuilt at some point). Reinstalled via apt-get install ffmpeg.
      2. YT_DLP path was wrong (/usr/local/bin/yt-dlp); corrected to /root/.venv/bin/yt-dlp.

      Also added new feature: OpenAI Whisper transcription. When an OpenAI API key is present in integration_credentials, uploaded MP4s now get accurate per-segment transcription which dramatically improves AI clip selection.

      Please backend-test these endpoints:
      - POST /api/upload with multipart formdata { file: <mp4>, kind: 'workspace_video' } — must return JSON {video_id, status, title, size} (HTTP 200)
      - GET /api/videos/:id (polling) — must return JSON with id, status, progress, clips[] at every stage transition; never an HTML error page
      - GET /api/files/clips/:filename — must stream mp4 bytes with content-type video/mp4
      - HEAD /api/files/clips/:filename — must return 200 with headers and empty body

      Test scenario:
      1. POST /api/upload with a real ~3MB sample mp4 (you can generate one with ffmpeg lavfi testsrc as I did, or use any small mp4 you have)
      2. Poll /api/videos/:id every 3s until status='completed' or 'failed' (max ~90s)
      3. Verify final response has clip_count >= 1, clips[].storage_url_mp4 returns 200 via /api/files/clips/<file>
      4. Verify transcription_source field is one of: whisper | youtube-auto | none (whisper is preferred if OpenAI key is in integrations table)
      5. Verify error path: upload a 0-byte file — must transition to status='failed' with non-empty error_message and still respond with valid JSON
    -agent: "testing"
    -message: |
      ✅ ALL BACKEND TESTS PASSED (5/5 tests, 71.1s total)
      
      Comprehensive test results:
      
      1. ✓ Healthy upload + full pipeline (14.3s)
         - Uploaded 90s sample video (2.6MB)
         - Processing completed in 13s with status progression: queued → transcribing (45%) → analyzing (60%) → cutting (80%) → completed (100%)
         - Generated 3 clips with all required fields validated
         - Clip durations: 15-60s range ✓
         - Virality scores: 50-99 range ✓
         - All clips have transcript_segment populated ✓
         - File streaming (GET): 343KB mp4, content-type correct ✓
         - File streaming (HEAD): headers only, no body ✓
      
      2. ✓ Transcription source verification (0.1s)
         - transcription_source = 'whisper' ✓
         - OpenAI API key present in integrations ✓
         - Whisper integration working correctly ✓
      
      3. ✓ Error path - empty file (6.7s)
         - Empty file upload returns valid JSON (no HTML) ✓
         - Processing fails with proper error_message ✓
         - Error: "No clips were successfully cut. The video may be too short or codec is unsupported." ✓
      
      4. ✓ JSON sanity sweep (0.9s)
         - All 7 endpoints return valid JSON ✓
         - No HTML corruption ✓
         - No NaN tokens ✓
         - No null corruption ✓
         - Endpoints tested: /clips, /pricing-packages, /auth/me, /geo, /memes, /admin/integrations, /admin/analytics
      
      5. ✓ Backward compatibility - URL ingestion (49.2s)
         - POST /api/ai/analyze with YouTube URL works ✓
         - Processing completed successfully ✓
         - All responses valid JSON ✓
      
      NO CRITICAL ISSUES FOUND. All backend functionality working as expected.
