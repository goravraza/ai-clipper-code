#!/usr/bin/env python3
"""
ClipForge AI Bug Fixes Test Suite
Tests the 4 user-reported bug fixes:
1. GET /api/clips/:id/download - force-download with Content-Disposition
2. POST /api/clips/:id/apply-trim - actually re-render MP4
3. POST /api/clips/:id/upload-to-r2 - verify still works
4. POST /api/ai/analyze - verify full-video fallback for YouTube
5. Regression tests
"""
import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
from pymongo import MongoClient

# Configuration
BASE_URL = "http://localhost:3000/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111"

# Test results
results = {
    "1_download_endpoint": {"status": "PENDING", "details": [], "timing": 0},
    "2_apply_trim": {"status": "PENDING", "details": [], "timing": 0},
    "3_upload_to_r2": {"status": "PENDING", "details": [], "timing": 0},
    "4_youtube_fallback": {"status": "PENDING", "details": [], "timing": 0},
    "5_regression_tests": {"status": "PENDING", "details": [], "timing": 0},
}


def log(scenario, message):
    """Log a test message"""
    print(f"[{scenario}] {message}")
    if scenario in results:
        results[scenario]["details"].append(message)


def fail_scenario(scenario, reason):
    """Mark a scenario as failed"""
    results[scenario]["status"] = "FAIL"
    log(scenario, f"❌ FAIL: {reason}")


def pass_scenario(scenario, message=""):
    """Mark a scenario as passed"""
    results[scenario]["status"] = "PASS"
    log(scenario, f"✅ PASS{': ' + message if message else ''}")


def get_ffprobe_duration(filepath):
    """Get video duration using ffprobe"""
    try:
        result = subprocess.run(
            ['/usr/bin/ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1', filepath],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
        return None
    except Exception as e:
        log("UTIL", f"ffprobe error: {e}")
        return None


def check_mp4_valid(filepath):
    """Check if file is a valid MP4 by reading first 12 bytes"""
    try:
        with open(filepath, 'rb') as f:
            header = f.read(12)
            # MP4 files have 'ftyp' at offset 4
            if len(header) >= 8 and b'ftyp' in header[4:8]:
                return True
        return False
    except Exception:
        return False


async def find_or_create_test_clip(client):
    """Find an existing clip with /api/files/ MP4, or create one"""
    log("SETUP", "Looking for existing clip with /api/files/ MP4...")
    
    # Connect to MongoDB
    mongo_client = MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    
    # Find a clip with storage_url_mp4 starting with /api/files/
    clip = db.generated_clips.find_one({
        "storage_url_mp4": {"$regex": "^/api/files/"}
    })
    
    if clip:
        clip_id = clip['id']
        log("SETUP", f"✓ Found existing clip: {clip_id}")
        log("SETUP", f"  storage_url_mp4: {clip.get('storage_url_mp4')}")
        log("SETUP", f"  clip_title: {clip.get('clip_title')}")
        return clip_id
    
    log("SETUP", "No existing clip found with /api/files/ MP4")
    log("SETUP", "Need to create one by uploading a video...")
    
    # Generate a small test video
    test_video = "/tmp/test_clip_video.mp4"
    log("SETUP", f"Generating test video at {test_video}...")
    
    cmd = [
        '/usr/bin/ffmpeg', '-y',
        '-f', 'lavfi', '-i', 'testsrc=duration=10:size=640x480:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '64k',
        '-t', '10',
        test_video
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode != 0:
            log("SETUP", f"❌ FFmpeg failed: {result.stderr.decode()[:500]}")
            return None
    except Exception as e:
        log("SETUP", f"❌ Exception generating video: {e}")
        return None
    
    # Upload the video
    log("SETUP", "Uploading test video...")
    try:
        with open(test_video, "rb") as f:
            files = {"file": ("test.mp4", f, "video/mp4")}
            data = {
                "kind": "workspace_video",
                "clip_min": "5",
                "clip_max": "8",
                "add_captions": "false"
            }
            resp = await client.post(f"{BASE_URL}/upload", files=files, data=data)
        
        if resp.status_code != 200:
            log("SETUP", f"❌ Upload failed: {resp.status_code} - {resp.text[:500]}")
            return None
        
        upload_data = resp.json()
        video_id = upload_data.get("video_id")
        log("SETUP", f"✓ Upload successful: video_id={video_id}")
        
        # Poll for completion
        log("SETUP", "Waiting for video processing to complete...")
        for i in range(30):  # 30 * 3s = 90s max
            await asyncio.sleep(3)
            resp = await client.get(f"{BASE_URL}/videos/{video_id}")
            if resp.status_code == 200:
                video_doc = resp.json()
                status = video_doc.get("status")
                log("SETUP", f"  Poll {i+1}: status={status}")
                
                if status == "completed":
                    clips = video_doc.get("clips", [])
                    if clips:
                        clip_id = clips[0]['id']
                        log("SETUP", f"✓ Video completed, clip created: {clip_id}")
                        return clip_id
                elif status == "failed":
                    log("SETUP", f"❌ Video processing failed: {video_doc.get('error_message')}")
                    return None
        
        log("SETUP", "❌ Video processing timed out")
        return None
        
    except Exception as e:
        log("SETUP", f"❌ Exception during upload: {e}")
        return None


async def test_1_download_endpoint(client, clip_id):
    """Test 1: GET /api/clips/:id/download"""
    scenario = "1_download_endpoint"
    start_time = time.time()
    log(scenario, f"Testing GET /api/clips/{clip_id}/download...")
    
    try:
        # Test with a known good clip ID
        url = f"{BASE_URL}/clips/{clip_id}/download"
        log(scenario, f"GET {url}")
        
        resp = await client.get(url)
        
        # a. Response 200
        if resp.status_code != 200:
            fail_scenario(scenario, f"Expected 200, got {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ Response 200")
        
        # b. Content-Type: video/mp4
        content_type = resp.headers.get("content-type", "")
        if "video/mp4" not in content_type:
            fail_scenario(scenario, f"Expected Content-Type: video/mp4, got {content_type}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Content-Type: {content_type}")
        
        # c. Content-Disposition: attachment; filename="..."
        content_disposition = resp.headers.get("content-disposition", "")
        if "attachment;" not in content_disposition:
            fail_scenario(scenario, f"Expected 'attachment;' in Content-Disposition, got: {content_disposition}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Content-Disposition: {content_disposition}")
        
        # d. Content-Length > 0 and valid MP4
        content_length = int(resp.headers.get("content-length", 0))
        if content_length <= 0:
            fail_scenario(scenario, f"Content-Length is {content_length}, expected > 0")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Content-Length: {content_length} bytes")
        
        # Check first bytes for MP4 signature
        body = resp.content
        if len(body) < 12:
            fail_scenario(scenario, f"Body too small: {len(body)} bytes")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        # MP4 files have 'ftyp' at offset 4
        if b'ftyp' not in body[4:12]:
            fail_scenario(scenario, f"Invalid MP4 signature. First 12 bytes: {body[:12].hex()}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ Valid MP4 signature (ftyp found)")
        
        # Test 404 when clip not found
        log(scenario, "Testing 404 for non-existent clip...")
        resp = await client.get(f"{BASE_URL}/clips/00000000-0000-0000-0000-000000000000/download")
        if resp.status_code != 404:
            fail_scenario(scenario, f"Expected 404 for non-existent clip, got {resp.status_code}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ 404 for non-existent clip")
        
        # Test 410 for legacy clip (find one with cdn.clipforge.ai URL)
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        legacy_clip = db.generated_clips.find_one({
            "storage_url_mp4": {"$regex": "^https://cdn.clipforge.ai"}
        })
        
        if legacy_clip:
            log(scenario, f"Testing 410 for legacy clip {legacy_clip['id']}...")
            resp = await client.get(f"{BASE_URL}/clips/{legacy_clip['id']}/download")
            if resp.status_code != 410:
                fail_scenario(scenario, f"Expected 410 for legacy clip, got {resp.status_code}")
                results[scenario]["timing"] = time.time() - start_time
                return
            log(scenario, "  ✓ 410 for legacy clip")
        else:
            log(scenario, "  ⚠️  No legacy clip found to test 410")
        
        results[scenario]["timing"] = time.time() - start_time
        pass_scenario(scenario, f"Download endpoint working correctly ({results[scenario]['timing']:.1f}s)")
        
    except Exception as e:
        results[scenario]["timing"] = time.time() - start_time
        fail_scenario(scenario, f"Exception: {e}")


async def test_2_apply_trim(client, clip_id):
    """Test 2: POST /api/clips/:id/apply-trim"""
    scenario = "2_apply_trim"
    start_time = time.time()
    log(scenario, f"Testing POST /api/clips/{clip_id}/apply-trim...")
    
    try:
        # Get original clip info
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        clip = db.generated_clips.find_one({"id": clip_id})
        
        if not clip:
            fail_scenario(scenario, f"Clip {clip_id} not found in DB")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        storage_url = clip.get("storage_url_mp4", "")
        if not storage_url.startswith("/api/files/"):
            fail_scenario(scenario, f"Clip has no /api/files/ MP4: {storage_url}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        # Get original file info
        local_path = f"/app/data/uploads/{storage_url.replace('/api/files/', '')}"
        if not os.path.exists(local_path):
            fail_scenario(scenario, f"MP4 file not found: {local_path}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        original_size = os.path.getsize(local_path)
        original_duration = get_ffprobe_duration(local_path)
        
        log(scenario, f"  Original file: {original_size} bytes, {original_duration:.2f}s duration")
        
        # Apply trim: trim 1-3 seconds (2s total)
        log(scenario, "Applying trim: trim_start=1, trim_end=3, crop_aspect=9:16...")
        
        resp = await client.post(
            f"{BASE_URL}/clips/{clip_id}/apply-trim",
            json={"trim_start": 1, "trim_end": 3, "crop_aspect": "9:16"}
        )
        
        # a. Response 200
        if resp.status_code != 200:
            fail_scenario(scenario, f"Expected 200, got {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ Response 200")
        
        try:
            data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"Response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        # b. Response contains ok: true, clip, final_duration: 2
        if not data.get("ok"):
            fail_scenario(scenario, f"Expected ok: true, got {data.get('ok')}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if "clip" not in data:
            fail_scenario(scenario, f"Response missing 'clip' field")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        final_duration = data.get("final_duration")
        if final_duration != 2:
            fail_scenario(scenario, f"Expected final_duration=2, got {final_duration}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Response: ok=true, final_duration={final_duration}")
        
        # Wait a moment for file to be written
        await asyncio.sleep(2)
        
        # Check the MP4 file has actually changed
        new_size = os.path.getsize(local_path)
        new_duration = get_ffprobe_duration(local_path)
        
        log(scenario, f"  New file: {new_size} bytes, {new_duration:.2f}s duration")
        
        if new_size == original_size:
            fail_scenario(scenario, f"File size unchanged: {new_size} bytes (expected different)")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ File size changed: {original_size} → {new_size} bytes")
        
        # Check duration is approximately 2 seconds (allow ±0.5s tolerance)
        if new_duration is None:
            fail_scenario(scenario, f"Could not get new duration with ffprobe")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not (1.5 <= new_duration <= 2.5):
            fail_scenario(scenario, f"New duration {new_duration:.2f}s not in expected range [1.5, 2.5]")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Duration changed: {original_duration:.2f}s → {new_duration:.2f}s")
        
        # Check MP4 is still valid
        if not check_mp4_valid(local_path):
            fail_scenario(scenario, f"Trimmed file is not a valid MP4")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ Trimmed file is valid MP4")
        
        # c. Check DB doc has trim_start, trim_end, crop_aspect, trim_applied_at
        clip = db.generated_clips.find_one({"id": clip_id})
        
        if clip.get("trim_start") != 1:
            fail_scenario(scenario, f"DB trim_start={clip.get('trim_start')}, expected 1")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if clip.get("trim_end") != 3:
            fail_scenario(scenario, f"DB trim_end={clip.get('trim_end')}, expected 3")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if clip.get("crop_aspect") != "9:16":
            fail_scenario(scenario, f"DB crop_aspect={clip.get('crop_aspect')}, expected 9:16")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not clip.get("trim_applied_at"):
            fail_scenario(scenario, f"DB trim_applied_at not set")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ DB updated: trim_start=1, trim_end=3, crop_aspect=9:16, trim_applied_at set")
        
        # d. If clip had r2_key, it should be unset
        if "r2_key" in clip and clip["r2_key"]:
            fail_scenario(scenario, f"DB r2_key not cleared (cache not busted)")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ R2 cache busted (r2_key cleared)")
        
        # Test error cases
        log(scenario, "Testing error case: trim_end - trim_start < 1...")
        resp = await client.post(
            f"{BASE_URL}/clips/{clip_id}/apply-trim",
            json={"trim_start": 1, "trim_end": 1.5}
        )
        if resp.status_code != 400:
            fail_scenario(scenario, f"Expected 400 for invalid trim range, got {resp.status_code}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ 400 for invalid trim range")
        
        # Test 404 for non-existent clip
        log(scenario, "Testing 404 for non-existent clip...")
        resp = await client.post(
            f"{BASE_URL}/clips/00000000-0000-0000-0000-000000000000/apply-trim",
            json={"trim_start": 1, "trim_end": 3}
        )
        if resp.status_code != 404:
            fail_scenario(scenario, f"Expected 404 for non-existent clip, got {resp.status_code}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ 404 for non-existent clip")
        
        results[scenario]["timing"] = time.time() - start_time
        pass_scenario(scenario, f"Apply-trim working correctly ({results[scenario]['timing']:.1f}s)")
        
    except Exception as e:
        results[scenario]["timing"] = time.time() - start_time
        fail_scenario(scenario, f"Exception: {e}")


async def test_3_upload_to_r2(client, clip_id):
    """Test 3: POST /api/clips/:id/upload-to-r2"""
    scenario = "3_upload_to_r2"
    start_time = time.time()
    log(scenario, f"Testing POST /api/clips/{clip_id}/upload-to-r2...")
    
    try:
        # Check if R2 credentials are configured
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        r2_creds = db.integration_credentials.find_one({"provider": "cloudflare_r2", "is_active": True})
        
        if not r2_creds:
            log(scenario, "⚠️  R2 credentials not configured, skipping test")
            results[scenario]["status"] = "SKIP"
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ R2 credentials found in DB")
        
        # Upload to R2
        resp = await client.post(f"{BASE_URL}/clips/{clip_id}/upload-to-r2")
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"Expected 200, got {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, "  ✓ Response 200")
        
        try:
            data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"Response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        # Check response fields
        if not data.get("ok"):
            fail_scenario(scenario, f"Expected ok: true, got {data.get('ok')}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not data.get("signed_url"):
            fail_scenario(scenario, f"Response missing signed_url")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not data.get("size"):
            fail_scenario(scenario, f"Response missing size")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Upload successful: size={data.get('size')} bytes")
        log(scenario, f"  ✓ Signed URL: {data.get('signed_url')[:80]}...")
        
        # Test GET /api/clips/:id/signed-url
        log(scenario, "Testing GET /api/clips/:id/signed-url...")
        resp = await client.get(f"{BASE_URL}/clips/{clip_id}/signed-url")
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"GET signed-url returned {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        try:
            signed_data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"Signed-url response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not signed_data.get("signed_url"):
            fail_scenario(scenario, f"Signed-url response missing signed_url")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Fresh signed URL retrieved")
        
        results[scenario]["timing"] = time.time() - start_time
        pass_scenario(scenario, f"Upload-to-R2 working correctly ({results[scenario]['timing']:.1f}s)")
        
    except Exception as e:
        results[scenario]["timing"] = time.time() - start_time
        fail_scenario(scenario, f"Exception: {e}")


async def test_4_youtube_fallback(client):
    """Test 4: POST /api/ai/analyze with YouTube URL - verify full-video fallback"""
    scenario = "4_youtube_fallback"
    start_time = time.time()
    log(scenario, "Testing POST /api/ai/analyze with YouTube URL...")
    
    try:
        # Use "Me at the zoo" - 19s video
        youtube_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        
        log(scenario, f"Submitting YouTube URL: {youtube_url}")
        resp = await client.post(
            f"{BASE_URL}/ai/analyze",
            json={
                "url": youtube_url,
                "clip_min": 5,
                "clip_max": 10,
                "add_captions": False
            }
        )
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"Expected 200, got {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        try:
            data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"Response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        video_id = data.get("video_id")
        if not video_id:
            fail_scenario(scenario, f"Response missing video_id")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if data.get("status") != "queued":
            fail_scenario(scenario, f"Expected status=queued, got {data.get('status')}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Video queued: video_id={video_id}")
        
        # Poll for completion (up to 8 minutes = 480 seconds)
        log(scenario, "Polling for completion (up to 8 minutes)...")
        poll_start = time.time()
        max_poll_time = 480  # 8 minutes
        poll_interval = 5  # 5 seconds
        
        final_status = None
        video_doc = None
        
        while time.time() - poll_start < max_poll_time:
            await asyncio.sleep(poll_interval)
            
            resp = await client.get(f"{BASE_URL}/videos/{video_id}")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /videos/{video_id} returned {resp.status_code}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                video_doc = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Poll response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            status = video_doc.get("status")
            elapsed = time.time() - poll_start
            log(scenario, f"  Poll at {elapsed:.0f}s: status={status}, progress={video_doc.get('progress', 0)}")
            
            if status == "completed":
                final_status = "completed"
                break
            elif status == "failed":
                final_status = "failed"
                break
        
        poll_time = time.time() - poll_start
        
        if final_status == "failed":
            error_message = video_doc.get("error_message", "unknown error")
            log(scenario, f"  ❌ Video processing failed after {poll_time:.1f}s: {error_message}")
            
            # Capture backend logs
            log(scenario, "Capturing backend logs...")
            try:
                result = subprocess.run(
                    ["tail", "-n", "200", "/var/log/supervisor/nextjs.out.log"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                logs = result.stdout
                
                # Look for fallback indicators
                fallback_lines = [line for line in logs.split('\n') 
                                if 'ytseg' in line.lower() or 'full-dl' in line.lower() 
                                or 'fallback' in line.lower() or 'error' in line.lower()]
                
                if fallback_lines:
                    log(scenario, "  Relevant log lines:")
                    for line in fallback_lines[-20:]:  # Last 20 relevant lines
                        log(scenario, f"    {line}")
            except Exception as e:
                log(scenario, f"  Could not capture logs: {e}")
            
            fail_scenario(scenario, f"Video processing failed: {error_message}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if final_status != "completed":
            fail_scenario(scenario, f"Video did not complete within {max_poll_time}s. Last status: {video_doc.get('status') if video_doc else 'unknown'}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ Video completed in {poll_time:.1f}s")
        
        # Check clip_count >= 1
        clips = video_doc.get("clips", [])
        if len(clips) < 1:
            fail_scenario(scenario, f"Expected clip_count >= 1, got {len(clips)}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ clip_count={len(clips)}")
        
        # Verify clips have storage_url_mp4 like /api/files/clips/<uuid>.mp4
        for i, clip in enumerate(clips):
            storage_url = clip.get("storage_url_mp4", "")
            if not storage_url.startswith("/api/files/clips/"):
                fail_scenario(scenario, f"Clip {i+1} storage_url_mp4 does not start with /api/files/clips/: {storage_url}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Check file exists
            local_path = f"/app/data/uploads/{storage_url.replace('/api/files/', '')}"
            if not os.path.exists(local_path):
                fail_scenario(scenario, f"Clip {i+1} file not found: {local_path}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Check it's a valid MP4
            if not check_mp4_valid(local_path):
                fail_scenario(scenario, f"Clip {i+1} is not a valid MP4: {local_path}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            file_size = os.path.getsize(local_path)
            log(scenario, f"  ✓ Clip {i+1}: {storage_url} → {file_size} bytes, valid MP4")
        
        # Check if fallback was triggered (look for logs)
        log(scenario, "Checking if fallback path was triggered...")
        try:
            result = subprocess.run(
                ["tail", "-n", "500", "/var/log/supervisor/nextjs.out.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            logs = result.stdout
            
            if '[fallback]' in logs or '[full-dl attempt' in logs:
                log(scenario, "  ✓ Fallback path was triggered (found [fallback] or [full-dl attempt] in logs)")
            else:
                log(scenario, "  ⚠️  Could not confirm fallback path was triggered (no [fallback] or [full-dl attempt] in logs)")
                log(scenario, "     This may be OK if segment fetches succeeded on first try")
        except Exception as e:
            log(scenario, f"  Could not check logs: {e}")
        
        results[scenario]["timing"] = time.time() - start_time
        pass_scenario(scenario, f"YouTube ingestion completed successfully ({results[scenario]['timing']:.1f}s)")
        
    except Exception as e:
        results[scenario]["timing"] = time.time() - start_time
        fail_scenario(scenario, f"Exception: {e}")


async def test_5_regression_tests(client, clip_id):
    """Test 5: Regression tests on previously-working flows"""
    scenario = "5_regression_tests"
    start_time = time.time()
    log(scenario, "Running regression tests...")
    
    try:
        # Test GET /api/clips
        log(scenario, "Testing GET /api/clips...")
        resp = await client.get(f"{BASE_URL}/clips")
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"GET /clips returned {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        try:
            clips = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"GET /clips response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not isinstance(clips, list):
            fail_scenario(scenario, f"Expected list, got {type(clips)}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ GET /clips returned {len(clips)} clips")
        
        # Test GET /api/auth/me
        log(scenario, "Testing GET /api/auth/me...")
        resp = await client.get(f"{BASE_URL}/auth/me")
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"GET /auth/me returned {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        try:
            me_data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"GET /auth/me response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if "user" not in me_data:
            fail_scenario(scenario, f"Response missing 'user' field")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ GET /auth/me returned user: {me_data.get('user', {}).get('email')}")
        
        # Test POST /api/clips/:id/restyle
        log(scenario, f"Testing POST /api/clips/{clip_id}/restyle...")
        resp = await client.post(
            f"{BASE_URL}/clips/{clip_id}/restyle",
            json={"style_preset": "bold", "font_size": 20}
        )
        
        if resp.status_code != 200:
            fail_scenario(scenario, f"POST /clips/{clip_id}/restyle returned {resp.status_code}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        try:
            restyle_data = resp.json()
        except Exception as e:
            fail_scenario(scenario, f"Restyle response not valid JSON: {e}. Body: {resp.text[:500]}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        if not restyle_data.get("ok"):
            fail_scenario(scenario, f"Restyle not ok: {restyle_data}")
            results[scenario]["timing"] = time.time() - start_time
            return
        
        log(scenario, f"  ✓ POST /clips/{clip_id}/restyle successful")
        
        results[scenario]["timing"] = time.time() - start_time
        pass_scenario(scenario, f"All regression tests passed ({results[scenario]['timing']:.1f}s)")
        
    except Exception as e:
        results[scenario]["timing"] = time.time() - start_time
        fail_scenario(scenario, f"Exception: {e}")


async def main():
    """Run all test scenarios"""
    print("=" * 80)
    print("ClipForge AI Bug Fixes Test Suite")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=600.0) as client:
        # Setup: Find or create a test clip
        clip_id = await find_or_create_test_clip(client)
        
        if not clip_id:
            print("\n❌ Failed to find or create test clip. Aborting tests.")
            sys.exit(1)
        
        print(f"\n✓ Using test clip: {clip_id}")
        print("\n" + "=" * 80)
        print("Running Test Scenarios")
        print("=" * 80 + "\n")
        
        # Run tests
        await test_1_download_endpoint(client, clip_id)
        print()
        
        await test_2_apply_trim(client, clip_id)
        print()
        
        await test_3_upload_to_r2(client, clip_id)
        print()
        
        await test_4_youtube_fallback(client)
        print()
        
        await test_5_regression_tests(client, clip_id)
        print()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for scenario, result in results.items():
        status = result["status"]
        timing = result.get("timing", 0)
        emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️" if status == "SKIP" else "⏸️"
        print(f"{emoji} {scenario}: {status} ({timing:.1f}s)")
    
    print("=" * 80)
    
    # Exit code
    failed = [s for s, r in results.items() if r["status"] == "FAIL"]
    if failed:
        print(f"\n❌ {len(failed)} scenario(s) FAILED")
        sys.exit(1)
    else:
        print("\n✅ All scenarios PASSED")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
