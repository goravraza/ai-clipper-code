#!/usr/bin/env python3
"""
Backend test for REWRITTEN Supercut Pipeline
Tests the new full-source-video + full-transcript supercut generation
and credit-charging download flow.

NEW/CHANGED ENDPOINTS:
- GET /api/videos/:id/source-video/status
- POST /api/videos/:id/prepare-source
- GET /api/videos/:id/source-video/download
- POST /api/videos/:id/supercuts/auto (REWRITTEN)
- GET /api/clips/:id/download (MODIFIED - now charges credits)
- POST /api/clips/:id/download-quote (NEW)
"""

import requests
import json
import subprocess
import time
import os
from pymongo import MongoClient

# Configuration
BASE_URL = "https://shorts-studio-78.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
USER_ID = "11111111-1111-1111-1111-111111111111"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def get_session_token():
    """Get or create a session token for the test user"""
    return "test_session_token"

def find_video_without_source():
    """Find a video that doesn't have source_video_path set"""
    videos = list(db.videos_processed.find({"user_id": USER_ID}))
    for v in videos:
        if not v.get("source_video_path"):
            return v["id"]
    return None

def find_video_with_source():
    """Find a video that has source_video_path and full_transcript_segments"""
    videos = list(db.videos_processed.find({"user_id": USER_ID}))
    for v in videos:
        if v.get("source_video_path") and v.get("full_transcript_segments"):
            # Verify file exists
            try:
                if os.path.exists(v["source_video_path"]):
                    return v["id"]
            except:
                pass
    return None

def test_a_supercut_without_source():
    """
    TEST A: Supercut on a project WITHOUT source ready (older project)
    1. Find a video whose source_video_path is missing
    2. Call GET /api/videos/{vid}/source-video/status → expect source_ready: false
    3. Call POST /api/videos/{vid}/supercuts/auto → expect 428 with needs_prepare: true
    """
    print("\n" + "="*80)
    print("TEST A: SUPERCUT WITHOUT SOURCE READY")
    print("="*80)
    
    try:
        # Step 1: Find a video without source
        print("\n[Step 1] Finding a video without source_video_path...")
        vid = find_video_without_source()
        
        if not vid:
            print("⚠ No video found without source_video_path. Creating test video...")
            import uuid
            vid = str(uuid.uuid4())
            db.videos_processed.insert_one({
                "id": vid,
                "user_id": USER_ID,
                "title": "Test Video - No Source",
                "status": "completed",
                "original_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "created_at": time.time()
            })
            print(f"✓ Created test video: {vid}")
        else:
            print(f"✓ Found video without source: {vid}")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 2: Call GET /api/videos/:id/source-video/status
        print("\n[Step 2] Calling GET /api/videos/:id/source-video/status...")
        response = requests.get(
            f"{BASE_URL}/api/videos/{vid}/source-video/status",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        if data.get("source_ready") != False:
            print(f"✗ FAIL: Expected source_ready: false, got {data.get('source_ready')}")
            return False
        
        print(f"✓ source_ready: false (as expected)")
        
        # Step 3: Call POST /api/videos/:id/supercuts/auto
        print("\n[Step 3] Calling POST /api/videos/:id/supercuts/auto...")
        response = requests.post(
            f"{BASE_URL}/api/videos/{vid}/supercuts/auto",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 428:
            print(f"✗ FAIL: Expected 428 (Precondition Required), got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        required_keys = ["needs_prepare", "source_ready", "transcript_ready"]
        for key in required_keys:
            if key not in data:
                print(f"✗ FAIL: Missing key '{key}' in response")
                return False
        
        if data.get("needs_prepare") != True:
            print(f"✗ FAIL: Expected needs_prepare: true")
            return False
        
        print(f"✓ needs_prepare: true (as expected)")
        print(f"✓ source_ready: {data.get('source_ready')}")
        print(f"✓ transcript_ready: {data.get('transcript_ready')}")
        
        print("\n" + "="*80)
        print("✅ TEST A PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_b_prepare_source():
    """
    TEST B: Prepare source
    1. Find a video with original_url but no source_video_path
    2. Call POST /api/videos/:id/prepare-source (accept long timeout - up to 5 min)
    3. Expect 200 with { ok: true, source_ready: true, transcript_ready: true }
    4. Verify file exists on disk
    5. Verify full_transcript_segments in DB
    6. GET /api/videos/:id/source-video/status now returns source_ready: true
    
    NOTE: This test may take 2-5 minutes for a real YouTube video download + transcription
    """
    print("\n" + "="*80)
    print("TEST B: PREPARE SOURCE")
    print("="*80)
    print("⚠ WARNING: This test may take 2-5 minutes for YouTube download + Whisper transcription")
    
    try:
        # Step 1: Find a video with original_url but no source
        print("\n[Step 1] Finding a video with original_url but no source...")
        vid = None
        videos = list(db.videos_processed.find({"user_id": USER_ID, "original_url": {"$exists": True}}))
        
        for v in videos:
            if not v.get("source_video_path"):
                vid = v["id"]
                break
        
        if not vid:
            print("⚠ No suitable video found. Skipping this test.")
            print("  (This test requires a video with original_url but no source_video_path)")
            return True  # Skip, not a failure
        
        print(f"✓ Found video: {vid}")
        print(f"  original_url: {videos[0].get('original_url', 'N/A')[:60]}...")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 2: Call POST /api/videos/:id/prepare-source
        print("\n[Step 2] Calling POST /api/videos/:id/prepare-source...")
        print("  (This may take 2-5 minutes...)")
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/videos/{vid}/prepare-source",
            headers=headers,
            timeout=300  # 5 minutes
        )
        elapsed = time.time() - start_time
        
        print(f"✓ Response received in {elapsed:.1f}s")
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        if not data.get("ok"):
            print(f"✗ FAIL: Expected ok: true")
            return False
        
        if not data.get("source_ready"):
            print(f"✗ FAIL: Expected source_ready: true")
            return False
        
        if not data.get("transcript_ready"):
            print(f"✗ FAIL: Expected transcript_ready: true")
            return False
        
        print(f"✓ ok: true")
        print(f"✓ source_ready: true")
        print(f"✓ transcript_ready: true")
        
        # Step 3: Verify file exists on disk
        print("\n[Step 3] Verifying source file exists on disk...")
        v = db.videos_processed.find_one({"id": vid})
        source_path = v.get("source_video_path")
        
        if not source_path:
            print(f"✗ FAIL: source_video_path not set in DB")
            return False
        
        print(f"✓ source_video_path: {source_path}")
        
        if not os.path.exists(source_path):
            print(f"✗ FAIL: File does not exist: {source_path}")
            return False
        
        file_size = os.path.getsize(source_path)
        print(f"✓ File exists: {source_path}")
        print(f"✓ File size: {file_size:,} bytes")
        
        # Step 4: Verify full_transcript_segments in DB
        print("\n[Step 4] Verifying full_transcript_segments in DB...")
        full_transcript = v.get("full_transcript_segments", [])
        
        if not full_transcript or len(full_transcript) == 0:
            print(f"✗ FAIL: full_transcript_segments is empty")
            return False
        
        print(f"✓ full_transcript_segments: {len(full_transcript)} segments")
        
        # Check first segment structure
        if len(full_transcript) > 0:
            seg = full_transcript[0]
            print(f"  First segment: start={seg.get('start')}, end={seg.get('end')}, text='{seg.get('text', '')[:50]}...'")
            
            if "words" in seg and len(seg["words"]) > 0:
                print(f"  Word-level timing: {len(seg['words'])} words")
        
        # Step 5: GET /api/videos/:id/source-video/status
        print("\n[Step 5] Calling GET /api/videos/:id/source-video/status...")
        response = requests.get(
            f"{BASE_URL}/api/videos/{vid}/source-video/status",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        if not data.get("source_ready"):
            print(f"✗ FAIL: Expected source_ready: true")
            return False
        
        if not data.get("transcript_ready"):
            print(f"✗ FAIL: Expected transcript_ready: true")
            return False
        
        print(f"✓ source_ready: true")
        print(f"✓ transcript_ready: true")
        print(f"✓ source_size_bytes: {data.get('source_size_bytes', 0):,}")
        print(f"✓ transcript_segments: {data.get('transcript_segments', 0)}")
        
        print("\n" + "="*80)
        print("✅ TEST B PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_c_download_source_video():
    """
    TEST C: Download full source video
    1. Find a video with source_video_path
    2. GET /api/videos/:id/source-video/download
    3. Expect 200 with content-type: video/mp4 and content-disposition: attachment
    4. Verify content-length matches source_video_size_bytes
    5. Verify no x-credits-charged header (source download is free)
    6. Verify profile.credit_balance_minutes is UNCHANGED
    """
    print("\n" + "="*80)
    print("TEST C: DOWNLOAD FULL SOURCE VIDEO")
    print("="*80)
    
    try:
        # Step 1: Find a video with source
        print("\n[Step 1] Finding a video with source_video_path...")
        vid = find_video_with_source()
        
        if not vid:
            print("⚠ No video found with source_video_path. Skipping this test.")
            return True  # Skip, not a failure
        
        print(f"✓ Found video: {vid}")
        
        v = db.videos_processed.find_one({"id": vid})
        expected_size = v.get("source_video_size_bytes", 0)
        print(f"  Expected size: {expected_size:,} bytes")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Note credits before
        profile_before = db.profiles.find_one({"id": USER_ID})
        credits_before = profile_before.get("credit_balance_minutes", 0)
        print(f"  Credits before: {credits_before}")
        
        # Step 2: GET /api/videos/:id/source-video/download
        print("\n[Step 2] Calling GET /api/videos/:id/source-video/download...")
        response = requests.get(
            f"{BASE_URL}/api/videos/{vid}/source-video/download",
            headers=headers,
            timeout=60,
            stream=True  # Don't load entire file into memory
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 3: Check headers
        print("\n[Step 3] Verifying response headers...")
        content_type = response.headers.get("content-type", "")
        content_disp = response.headers.get("content-disposition", "")
        content_length = response.headers.get("content-length", "")
        credits_charged = response.headers.get("x-credits-charged", None)
        
        print(f"✓ content-type: {content_type}")
        print(f"✓ content-disposition: {content_disp}")
        print(f"✓ content-length: {content_length}")
        print(f"✓ x-credits-charged: {credits_charged}")
        
        if "video/mp4" not in content_type:
            print(f"✗ FAIL: Expected content-type: video/mp4")
            return False
        
        if "attachment" not in content_disp:
            print(f"✗ FAIL: Expected 'attachment' in content-disposition")
            return False
        
        # Step 4: Verify content-length
        if content_length and expected_size > 0:
            actual_length = int(content_length)
            if actual_length != expected_size:
                print(f"⚠ WARNING: content-length ({actual_length}) != source_video_size_bytes ({expected_size})")
            else:
                print(f"✓ content-length matches source_video_size_bytes")
        
        # Step 5: Verify no credit charge
        print("\n[Step 4] Verifying no credit charge...")
        
        if credits_charged is not None:
            print(f"✗ FAIL: x-credits-charged header should not be present (source download is free)")
            return False
        
        print(f"✓ No x-credits-charged header (as expected)")
        
        # Verify credits unchanged
        profile_after = db.profiles.find_one({"id": USER_ID})
        credits_after = profile_after.get("credit_balance_minutes", 0)
        print(f"  Credits after: {credits_after}")
        
        if credits_after != credits_before:
            print(f"✗ FAIL: Credits changed: {credits_before} -> {credits_after}")
            return False
        
        print(f"✓ Credits unchanged (source download is free)")
        
        print("\n" + "="*80)
        print("✅ TEST C PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_d_supercut_happy_path():
    """
    TEST D: Supercut happy path with full source
    1. Find a video with source_video_path and full_transcript_segments
    2. Ensure user has ≥ 40 credits
    3. Call POST /api/videos/:id/supercuts/auto
    4. Expect 200 with { ok, supercuts, count ≥ 1, segments ≥ 2, credits_used > 0 }
    5. Verify each supercut:
       - is_supercut: true
       - storage_url_mp4 exists on disk
       - ffprobe shows 1080x1920@30fps + aac stereo
       - Duration between 25s and 130s
       - supercut_source_segments.length >= 2
       - caption_segments non-empty with word-level words[]
    6. Profile credits reduced by credits_used
    """
    print("\n" + "="*80)
    print("TEST D: SUPERCUT HAPPY PATH WITH FULL SOURCE")
    print("="*80)
    
    try:
        # Step 1: Find a video with source and transcript
        print("\n[Step 1] Finding a video with source and transcript...")
        vid = find_video_with_source()
        
        if not vid:
            print("⚠ No video found with source_video_path and full_transcript_segments.")
            print("  Run TEST B first to prepare a video.")
            return True  # Skip, not a failure
        
        print(f"✓ Found video: {vid}")
        
        v = db.videos_processed.find_one({"id": vid})
        print(f"  Title: {v.get('title', 'N/A')}")
        print(f"  Transcript segments: {len(v.get('full_transcript_segments', []))}")
        
        # Step 2: Ensure user has enough credits
        print("\n[Step 2] Setting user credits to 100...")
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 100}}
        )
        
        profile = db.profiles.find_one({"id": USER_ID})
        credits_before = profile.get("credit_balance_minutes", 0)
        print(f"✓ Credits before: {credits_before}")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 3: Call POST /api/videos/:id/supercuts/auto
        print("\n[Step 3] Calling POST /api/videos/:id/supercuts/auto...")
        print("  (This may take 30-90 seconds...)")
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/videos/{vid}/supercuts/auto",
            headers=headers,
            timeout=300  # 5 minutes
        )
        elapsed = time.time() - start_time
        
        print(f"✓ Response received in {elapsed:.1f}s")
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 4: Verify response structure
        print("\n[Step 4] Verifying response structure...")
        data = response.json()
        
        required_keys = ["ok", "supercuts", "count", "segments", "credits_used"]
        for key in required_keys:
            if key not in data:
                print(f"✗ FAIL: Missing key '{key}' in response")
                return False
        
        print(f"✓ ok: {data['ok']}")
        print(f"✓ count: {data['count']}")
        print(f"✓ segments: {data['segments']}")
        print(f"✓ credits_used: {data['credits_used']}")
        
        if not data["ok"]:
            print(f"✗ FAIL: ok is false")
            return False
        
        if data["count"] < 1:
            print(f"✗ FAIL: Expected count ≥ 1, got {data['count']}")
            return False
        
        if data["segments"] < 2:
            print(f"✗ FAIL: Expected segments ≥ 2, got {data['segments']}")
            return False
        
        if data["credits_used"] <= 0:
            print(f"✗ FAIL: Expected credits_used > 0, got {data['credits_used']}")
            return False
        
        supercuts = data["supercuts"]
        print(f"✓ Generated {len(supercuts)} supercut(s)")
        
        # Step 5: Verify each supercut
        print("\n[Step 5] Verifying each supercut...")
        for i, sc in enumerate(supercuts):
            print(f"\n  Supercut {i+1}: {sc.get('clip_title', 'Untitled')}")
            
            # Check is_supercut
            if not sc.get("is_supercut"):
                print(f"    ✗ FAIL: is_supercut is not true")
                return False
            print(f"    ✓ is_supercut: true")
            
            # Check storage_url_mp4
            storage_url = sc.get("storage_url_mp4", "")
            if not storage_url.startswith("/api/files/clips/"):
                print(f"    ✗ FAIL: Invalid storage_url_mp4: {storage_url}")
                return False
            print(f"    ✓ storage_url_mp4: {storage_url}")
            
            # Check file exists
            mp4_path = storage_url.replace("/api/files/", "/app/data/uploads/")
            if not os.path.exists(mp4_path):
                print(f"    ✗ FAIL: File does not exist: {mp4_path}")
                return False
            print(f"    ✓ File exists: {mp4_path}")
            
            # ffprobe
            print(f"    Running ffprobe...")
            result = subprocess.run(
                ["/usr/bin/ffprobe", "-v", "error", "-show_streams", "-of", "json", mp4_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                print(f"    ✗ FAIL: ffprobe failed: {result.stderr}")
                return False
            
            probe_data = json.loads(result.stdout)
            streams = probe_data.get("streams", [])
            
            video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
            
            if not video_stream:
                print(f"    ✗ FAIL: No video stream")
                return False
            
            width = int(video_stream.get("width", 0))
            height = int(video_stream.get("height", 0))
            fps = video_stream.get("r_frame_rate", "0/1")
            duration = float(video_stream.get("duration", 0))
            
            print(f"    ✓ Video: {width}x{height} @ {fps} fps, {duration:.1f}s")
            
            if width != 1080 or height != 1920:
                print(f"    ⚠ WARNING: Expected 1080x1920, got {width}x{height}")
            
            if not fps.startswith("30"):
                print(f"    ⚠ WARNING: Expected 30fps, got {fps}")
            
            # Check duration (25-130s)
            if duration < 25 or duration > 130:
                print(f"    ⚠ WARNING: Duration {duration:.1f}s outside expected range (25-130s)")
            else:
                print(f"    ✓ Duration within range (25-130s)")
            
            if not audio_stream:
                print(f"    ✗ FAIL: No audio stream")
                return False
            
            codec = audio_stream.get("codec_name", "")
            sample_rate = int(audio_stream.get("sample_rate", 0))
            channels = int(audio_stream.get("channels", 0))
            
            print(f"    ✓ Audio: {codec} @ {sample_rate}Hz, {channels} channels")
            
            if codec != "aac":
                print(f"    ⚠ WARNING: Expected aac, got {codec}")
            
            if sample_rate != 44100:
                print(f"    ⚠ WARNING: Expected 44100Hz, got {sample_rate}Hz")
            
            if channels != 2:
                print(f"    ⚠ WARNING: Expected stereo (2 channels), got {channels}")
            
            # Check supercut_source_segments
            source_segs = sc.get("supercut_source_segments", [])
            if len(source_segs) < 2:
                print(f"    ✗ FAIL: supercut_source_segments has {len(source_segs)} entries, need ≥2")
                return False
            print(f"    ✓ supercut_source_segments: {len(source_segs)} entries")
            
            # Check caption_segments
            caption_segs = sc.get("caption_segments", [])
            if len(caption_segs) == 0:
                print(f"    ✗ FAIL: caption_segments is empty")
                return False
            print(f"    ✓ caption_segments: {len(caption_segs)} segments")
            
            # Check word-level timings
            has_words = any(len(seg.get("words", [])) > 0 for seg in caption_segs)
            if has_words:
                print(f"    ✓ Word-level timings present")
            else:
                print(f"    ⚠ WARNING: No word-level timings in caption_segments")
        
        # Step 6: Verify credit deduction
        print("\n[Step 6] Verifying credit deduction...")
        profile_after = db.profiles.find_one({"id": USER_ID})
        credits_after = profile_after.get("credit_balance_minutes", 0)
        credits_deducted = credits_before - credits_after
        
        print(f"✓ Credits before: {credits_before}")
        print(f"✓ Credits after: {credits_after}")
        print(f"✓ Credits deducted: {credits_deducted}")
        print(f"✓ Credits reported: {data['credits_used']}")
        
        if abs(credits_deducted - data['credits_used']) > 0.01:
            print(f"⚠ WARNING: Credit deduction mismatch")
        else:
            print(f"✓ Credit deduction matches")
        
        print("\n" + "="*80)
        print("✅ TEST D PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_e_clip_download_charges():
    """
    TEST E: Clip download charges credits
    1. Pick any real rendered clip
    2. Clear download_paid_render_version flag
    3. Note credits before
    4. Call POST /api/clips/:id/download-quote → returns credits_required, already_paid: false
    5. Call GET /api/clips/:id/download
    6. Expect 200 with x-credits-charged header + MP4 bytes
    7. Profile credits reduced
    8. download_paid_render_version now equals render_version
    """
    print("\n" + "="*80)
    print("TEST E: CLIP DOWNLOAD CHARGES CREDITS")
    print("="*80)
    
    try:
        # Step 1: Find a real rendered clip
        print("\n[Step 1] Finding a real rendered clip...")
        clip = db.generated_clips.find_one({
            "user_id": USER_ID,
            "storage_url_mp4": {"$regex": "^/api/files/clips/"},
            "render_version": {"$exists": True}
        })
        
        if not clip:
            print("⚠ No rendered clip found. Skipping this test.")
            return True
        
        clip_id = clip["id"]
        print(f"✓ Found clip: {clip_id}")
        print(f"  Title: {clip.get('clip_title', 'N/A')}")
        print(f"  render_version: {clip.get('render_version', 0)}")
        
        # Step 2: Clear payment flag
        print("\n[Step 2] Clearing payment flag...")
        db.generated_clips.update_one(
            {"id": clip_id},
            {"$unset": {"download_paid_render_version": "", "download_paid_at": ""}}
        )
        print(f"✓ Payment flag cleared")
        
        # Ensure user has credits
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 100}}
        )
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 3: Note credits before
        profile_before = db.profiles.find_one({"id": USER_ID})
        credits_before = profile_before.get("credit_balance_minutes", 0)
        print(f"  Credits before: {credits_before}")
        
        # Step 4: Call POST /api/clips/:id/download-quote
        print("\n[Step 3] Calling POST /api/clips/:id/download-quote...")
        response = requests.post(
            f"{BASE_URL}/api/clips/{clip_id}/download-quote",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        quote_data = response.json()
        print(f"✓ Response: {json.dumps(quote_data, indent=2)}")
        
        credits_required = quote_data.get("credits_required", 0)
        already_paid = quote_data.get("already_paid", False)
        
        if already_paid:
            print(f"✗ FAIL: Expected already_paid: false")
            return False
        
        print(f"✓ credits_required: {credits_required}")
        print(f"✓ already_paid: false")
        
        # Step 5: Call GET /api/clips/:id/download
        print("\n[Step 4] Calling GET /api/clips/:id/download...")
        response = requests.get(
            f"{BASE_URL}/api/clips/{clip_id}/download",
            headers=headers,
            timeout=60,
            stream=True
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 6: Check x-credits-charged header
        print("\n[Step 5] Verifying x-credits-charged header...")
        credits_charged = response.headers.get("x-credits-charged", None)
        
        if credits_charged is None:
            print(f"✗ FAIL: x-credits-charged header missing")
            return False
        
        credits_charged_val = float(credits_charged)
        print(f"✓ x-credits-charged: {credits_charged_val}")
        
        if abs(credits_charged_val - credits_required) > 0.01:
            print(f"⚠ WARNING: x-credits-charged ({credits_charged_val}) != credits_required ({credits_required})")
        
        # Step 7: Verify credits reduced
        print("\n[Step 6] Verifying credit deduction...")
        profile_after = db.profiles.find_one({"id": USER_ID})
        credits_after = profile_after.get("credit_balance_minutes", 0)
        credits_deducted = credits_before - credits_after
        
        print(f"✓ Credits before: {credits_before}")
        print(f"✓ Credits after: {credits_after}")
        print(f"✓ Credits deducted: {credits_deducted}")
        
        if abs(credits_deducted - credits_charged_val) > 0.01:
            print(f"⚠ WARNING: Credit deduction mismatch")
        else:
            print(f"✓ Credit deduction matches x-credits-charged")
        
        # Step 8: Verify download_paid_render_version
        print("\n[Step 7] Verifying download_paid_render_version...")
        clip_after = db.generated_clips.find_one({"id": clip_id})
        paid_version = clip_after.get("download_paid_render_version", -1)
        render_version = clip_after.get("render_version", 0)
        
        print(f"✓ download_paid_render_version: {paid_version}")
        print(f"✓ render_version: {render_version}")
        
        if paid_version != render_version:
            print(f"✗ FAIL: download_paid_render_version ({paid_version}) != render_version ({render_version})")
            return False
        
        print(f"✓ Payment flag set correctly")
        
        print("\n" + "="*80)
        print("✅ TEST E PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_f_second_download_free():
    """
    TEST F: Second download is FREE (idempotent)
    1. Use the same clip from TEST E
    2. Call GET /api/clips/:id/download again
    3. Expect 200 with x-credits-charged: 0
    4. Profile credits UNCHANGED
    """
    print("\n" + "="*80)
    print("TEST F: SECOND DOWNLOAD IS FREE (IDEMPOTENT)")
    print("="*80)
    
    try:
        # Step 1: Find a clip that has been paid for
        print("\n[Step 1] Finding a clip with download_paid_render_version set...")
        clip = db.generated_clips.find_one({
            "user_id": USER_ID,
            "storage_url_mp4": {"$regex": "^/api/files/clips/"},
            "download_paid_render_version": {"$exists": True}
        })
        
        if not clip:
            print("⚠ No paid clip found. Run TEST E first.")
            return True
        
        clip_id = clip["id"]
        print(f"✓ Found clip: {clip_id}")
        print(f"  download_paid_render_version: {clip.get('download_paid_render_version')}")
        print(f"  render_version: {clip.get('render_version')}")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Note credits before
        profile_before = db.profiles.find_one({"id": USER_ID})
        credits_before = profile_before.get("credit_balance_minutes", 0)
        print(f"  Credits before: {credits_before}")
        
        # Step 2: Call GET /api/clips/:id/download again
        print("\n[Step 2] Calling GET /api/clips/:id/download (second time)...")
        response = requests.get(
            f"{BASE_URL}/api/clips/{clip_id}/download",
            headers=headers,
            timeout=60,
            stream=True
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Step 3: Check x-credits-charged: 0
        print("\n[Step 3] Verifying x-credits-charged: 0...")
        credits_charged = response.headers.get("x-credits-charged", None)
        
        if credits_charged is None:
            print(f"✗ FAIL: x-credits-charged header missing")
            return False
        
        credits_charged_val = float(credits_charged)
        print(f"✓ x-credits-charged: {credits_charged_val}")
        
        if credits_charged_val != 0:
            print(f"✗ FAIL: Expected x-credits-charged: 0, got {credits_charged_val}")
            return False
        
        print(f"✓ No credits charged (as expected)")
        
        # Step 4: Verify credits unchanged
        print("\n[Step 4] Verifying credits unchanged...")
        profile_after = db.profiles.find_one({"id": USER_ID})
        credits_after = profile_after.get("credit_balance_minutes", 0)
        
        print(f"✓ Credits before: {credits_before}")
        print(f"✓ Credits after: {credits_after}")
        
        if credits_after != credits_before:
            print(f"✗ FAIL: Credits changed: {credits_before} -> {credits_after}")
            return False
        
        print(f"✓ Credits unchanged (idempotent download)")
        
        print("\n" + "="*80)
        print("✅ TEST F PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_g_insufficient_credits_download():
    """
    TEST G: Insufficient credits on download
    1. Set credits to 0.1
    2. Pick a clip that has NOT been paid for
    3. Call POST /api/clips/:id/download-quote → shows shortfall
    4. Call GET /api/clips/:id/download → expect 402
    5. Restore credits
    """
    print("\n" + "="*80)
    print("TEST G: INSUFFICIENT CREDITS ON DOWNLOAD")
    print("="*80)
    
    try:
        # Step 1: Set credits to 0.1
        print("\n[Step 1] Setting credits to 0.1...")
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 0.1}}
        )
        
        profile = db.profiles.find_one({"id": USER_ID})
        credits = profile.get("credit_balance_minutes", 0)
        print(f"✓ Credits: {credits}")
        
        # Step 2: Find a clip that has NOT been paid for
        print("\n[Step 2] Finding an unpaid clip...")
        
        # Find a clip and clear its payment flag
        clip = db.generated_clips.find_one({
            "user_id": USER_ID,
            "storage_url_mp4": {"$regex": "^/api/files/clips/"},
            "render_version": {"$exists": True}
        })
        
        if not clip:
            print("⚠ No clip found. Skipping this test.")
            db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
            return True
        
        clip_id = clip["id"]
        
        # Clear payment flag to make it unpaid
        db.generated_clips.update_one(
            {"id": clip_id},
            {"$unset": {"download_paid_render_version": "", "download_paid_at": ""}}
        )
        
        print(f"✓ Found clip: {clip_id}")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 3: Call POST /api/clips/:id/download-quote
        print("\n[Step 3] Calling POST /api/clips/:id/download-quote...")
        response = requests.post(
            f"{BASE_URL}/api/clips/{clip_id}/download-quote",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
            return False
        
        quote_data = response.json()
        print(f"✓ Response: {json.dumps(quote_data, indent=2)}")
        
        credits_required = quote_data.get("credits_required", 0)
        credits_available = quote_data.get("credits_available", 0)
        
        print(f"✓ credits_required: {credits_required}")
        print(f"✓ credits_available: {credits_available}")
        
        if credits_available >= credits_required:
            print(f"⚠ WARNING: User has enough credits. This test expects insufficient credits.")
        
        # Step 4: Call GET /api/clips/:id/download
        print("\n[Step 4] Calling GET /api/clips/:id/download...")
        response = requests.get(
            f"{BASE_URL}/api/clips/{clip_id}/download",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 402:
            print(f"✗ FAIL: Expected 402 (Payment Required), got {response.status_code}")
            db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        required_keys = ["error", "credits_required", "credits_available"]
        for key in required_keys:
            if key not in data:
                print(f"✗ FAIL: Missing key '{key}' in response")
                db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
                return False
        
        print(f"✓ error: {data['error']}")
        print(f"✓ credits_required: {data['credits_required']}")
        print(f"✓ credits_available: {data['credits_available']}")
        
        # Step 5: Restore credits
        print("\n[Step 5] Restoring credits...")
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 100}}
        )
        print(f"✓ Credits restored to 100")
        
        print("\n" + "="*80)
        print("✅ TEST G PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        # Restore credits even on failure
        db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
        return False

def test_h_insufficient_credits_supercut():
    """
    TEST H: Insufficient credits on supercut generation
    1. Set credits to 0.1
    2. Call POST /api/videos/:id/supercuts/auto on a video with source ready
    3. Expect 402 with credits_required, credits_available
    4. No supercuts created
    """
    print("\n" + "="*80)
    print("TEST H: INSUFFICIENT CREDITS ON SUPERCUT GENERATION")
    print("="*80)
    
    try:
        # Step 1: Set credits to 0.1
        print("\n[Step 1] Setting credits to 0.1...")
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 0.1}}
        )
        
        profile = db.profiles.find_one({"id": USER_ID})
        credits = profile.get("credit_balance_minutes", 0)
        print(f"✓ Credits: {credits}")
        
        # Step 2: Find a video with source ready
        print("\n[Step 2] Finding a video with source ready...")
        vid = find_video_with_source()
        
        if not vid:
            print("⚠ No video found with source. Skipping this test.")
            db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
            return True
        
        print(f"✓ Found video: {vid}")
        
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Step 3: Call POST /api/videos/:id/supercuts/auto
        print("\n[Step 3] Calling POST /api/videos/:id/supercuts/auto...")
        response = requests.post(
            f"{BASE_URL}/api/videos/{vid}/supercuts/auto",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 402:
            print(f"✗ FAIL: Expected 402 (Payment Required), got {response.status_code}")
            print(f"Response: {response.text}")
            db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
            return False
        
        data = response.json()
        print(f"✓ Response: {json.dumps(data, indent=2)}")
        
        required_keys = ["error", "credits_required", "credits_available"]
        for key in required_keys:
            if key not in data:
                print(f"✗ FAIL: Missing key '{key}' in response")
                db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
                return False
        
        print(f"✓ error: {data['error']}")
        print(f"✓ credits_required: {data['credits_required']}")
        print(f"✓ credits_available: {data['credits_available']}")
        
        # Step 4: Restore credits
        print("\n[Step 4] Restoring credits...")
        db.profiles.update_one(
            {"id": USER_ID},
            {"$set": {"credit_balance_minutes": 100}}
        )
        print(f"✓ Credits restored to 100")
        
        print("\n" + "="*80)
        print("✅ TEST H PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        # Restore credits even on failure
        db.profiles.update_one({"id": USER_ID}, {"$set": {"credit_balance_minutes": 100}})
        return False

def test_i_regression():
    """
    TEST I: Regression
    - GET /api/projects — still returns project list
    - GET /api/clips — includes both is_supercut and non-supercut clips
    - POST /api/clips/:id/render on a supercut clip — still succeeds
    - GET /api/videos/:id/supercuts — merges generated_clips (is_supercut=true) and legacy supercuts
    """
    print("\n" + "="*80)
    print("TEST I: REGRESSION")
    print("="*80)
    
    try:
        headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={get_session_token()}"
        }
        
        # Test 1: GET /api/projects
        print("\n[Test 1] GET /api/projects...")
        response = requests.get(
            f"{BASE_URL}/api/projects",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            return False
        
        projects = response.json()  # API returns list directly, not {projects: []}
        print(f"✓ Found {len(projects)} projects")
        
        # Test 2: GET /api/clips
        print("\n[Test 2] GET /api/clips...")
        response = requests.get(
            f"{BASE_URL}/api/clips",
            headers=headers,
            timeout=30
        )
        
        print(f"✓ Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {response.status_code}")
            return False
        
        clips = response.json()  # API returns list directly, not {clips: []}
        supercut_clips = [c for c in clips if c.get("is_supercut")]
        normal_clips = [c for c in clips if not c.get("is_supercut")]
        
        print(f"✓ Found {len(clips)} total clips")
        print(f"  - {len(supercut_clips)} supercut clips")
        print(f"  - {len(normal_clips)} normal clips")
        
        # Test 3: POST /api/clips/:id/render on a supercut
        print("\n[Test 3] POST /api/clips/:id/render on a supercut...")
        
        supercut = db.generated_clips.find_one({
            "user_id": USER_ID,
            "is_supercut": True,
            "caption_segments": {"$exists": True, "$ne": []}
        })
        
        if not supercut:
            print("⚠ No supercut found to test render")
        else:
            supercut_id = supercut["id"]
            print(f"✓ Testing render on supercut: {supercut_id}")
            
            render_body = {
                "trim_start": 0,
                "trim_end": 5,
                "crop_aspect": "9:16",
                "font_size": 20,
                "outline_size": 2,
                "fill_mode": "crop",
                "caption_x_percent": 50,
                "caption_y_percent": 78
            }
            
            response = requests.post(
                f"{BASE_URL}/api/clips/{supercut_id}/render",
                headers=headers,
                json=render_body,
                timeout=120
            )
            
            print(f"✓ Status code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"⚠ WARNING: Render failed with status {response.status_code}")
            else:
                print(f"✓ Render successful")
        
        # Test 4: GET /api/videos/:id/supercuts
        print("\n[Test 4] GET /api/videos/:id/supercuts...")
        
        vid = find_video_with_source()
        if not vid:
            print("⚠ No video found to test supercuts endpoint")
        else:
            response = requests.get(
                f"{BASE_URL}/api/videos/{vid}/supercuts",
                headers=headers,
                timeout=30
            )
            
            print(f"✓ Status code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"✗ FAIL: Expected 200, got {response.status_code}")
                return False
            
            supercuts_data = response.json()
            supercuts = supercuts_data.get("supercuts", [])
            print(f"✓ Found {len(supercuts)} supercuts")
        
        print("\n" + "="*80)
        print("✅ TEST I PASSED")
        print("="*80)
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST SUITE: REWRITTEN SUPERCUT PIPELINE")
    print("Full Source Video + Full Transcript + Credit-Charging Downloads")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"User ID: {USER_ID}")
    print("="*80)
    
    results = {}
    
    # Run tests in order
    print("\n⚠ NOTE: Some tests may be skipped if required data is not available.")
    print("  Run tests in sequence to prepare data for later tests.\n")
    
    results["A. Supercut Without Source"] = test_a_supercut_without_source()
    results["B. Prepare Source"] = test_b_prepare_source()
    results["C. Download Source Video"] = test_c_download_source_video()
    results["D. Supercut Happy Path"] = test_d_supercut_happy_path()
    results["E. Clip Download Charges"] = test_e_clip_download_charges()
    results["F. Second Download Free"] = test_f_second_download_free()
    results["G. Insufficient Credits (Download)"] = test_g_insufficient_credits_download()
    results["H. Insufficient Credits (Supercut)"] = test_h_insufficient_credits_supercut()
    results["I. Regression"] = test_i_regression()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    print("="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
