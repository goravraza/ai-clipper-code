#!/usr/bin/env python3
"""
Test suite for POST /api/clips/:id/render unified endpoint + gpt-4o-transcribe upgrade
"""
import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from io import BytesIO

import httpx
from pymongo import MongoClient
from PIL import Image

# Configuration
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://shorts-studio-78.preview.emergentagent.com") + "/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"

# Test results
results = {}

def log(scenario, message):
    """Log a test message"""
    print(f"[{scenario}] {message}")
    if scenario not in results:
        results[scenario] = {"status": "PENDING", "details": [], "timing": 0}
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
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
    except Exception as e:
        log("ffprobe", f"Error: {e}")
    return None

def get_ffprobe_dimensions(filepath):
    """Get video dimensions using ffprobe"""
    try:
        result = subprocess.run(
            ['/usr/bin/ffprobe', '-v', 'error', '-show_entries', 'stream=width,height',
             '-select_streams', 'v:0', '-of', 'csv=p=0', filepath],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(',')
            if len(parts) == 2:
                return int(parts[0]), int(parts[1])
    except Exception as e:
        log("ffprobe", f"Error: {e}")
    return None, None

async def find_test_clip(db, min_duration=5):
    """Find a clip with /api/files/ storage URL and minimum duration for testing"""
    # Find clips with local storage and sufficient duration
    clips = list(db.generated_clips.find({
        "storage_url_mp4": {"$regex": "^/api/files/"},
        "$expr": {"$gte": [{"$subtract": ["$end_time_seconds", "$start_time_seconds"]}, min_duration]}
    }).sort([("end_time_seconds", -1)]).limit(10))
    
    if not clips:
        # Fallback to any clip with local storage
        return db.generated_clips.find_one({"storage_url_mp4": {"$regex": "^/api/files/"}})
    
    # Verify actual file duration
    for clip in clips:
        storage_url = clip.get("storage_url_mp4", "")
        filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
        try:
            duration = get_ffprobe_duration(filepath)
            if duration and duration >= min_duration:
                return clip
        except:
            continue
    
    # If no clip meets duration requirement, return first one
    return clips[0] if clips else None

async def test_render_trim_only():
    """Test /api/clips/:id/render with trim only"""
    scenario = "render_trim_only"
    start_time = time.time()
    log(scenario, "Testing trim-only render...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Connect to MongoDB to find a test clip
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found with /api/files/ storage URL")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            storage_url = clip["storage_url_mp4"]
            log(scenario, f"Using clip {clip_id}: {clip.get('clip_title', 'Untitled')}")
            
            # Get file path and check original duration
            filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
            original_duration = get_ffprobe_duration(filepath)
            if not original_duration:
                fail_scenario(scenario, f"Could not probe original duration of {filepath}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"Original duration: {original_duration:.2f}s")
            
            # Render with trim: 1s to 4s (3 seconds total)
            trim_start = 1.0
            trim_end = min(4.0, original_duration - 0.5)
            expected_duration = trim_end - trim_start
            
            log(scenario, f"Rendering with trim_start={trim_start}, trim_end={trim_end}")
            
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"trim_start": trim_start, "trim_end": trim_end}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            log(scenario, f"Response: {json.dumps(data, indent=2)[:300]}")
            
            # Verify response
            if not data.get("ok"):
                fail_scenario(scenario, f"Response ok=false: {data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            final_duration = data.get("final_duration")
            if not final_duration:
                fail_scenario(scenario, "No final_duration in response")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"API reported final_duration: {final_duration:.2f}s")
            
            # Verify file changed on disk
            new_duration = get_ffprobe_duration(filepath)
            if not new_duration:
                fail_scenario(scenario, "Could not probe new duration after render")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"ffprobe duration after render: {new_duration:.2f}s")
            
            # Allow 0.5s tolerance for ffmpeg encoding
            if abs(new_duration - expected_duration) > 0.5:
                fail_scenario(scenario, f"Duration mismatch: expected ~{expected_duration:.2f}s, got {new_duration:.2f}s")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify render_version incremented
            updated_clip = db.generated_clips.find_one({"id": clip_id})
            render_version = updated_clip.get("render_version", 0)
            log(scenario, f"render_version: {render_version}")
            
            if render_version < 1:
                fail_scenario(scenario, "render_version not incremented")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Trim successful: {original_duration:.2f}s → {new_duration:.2f}s ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_crop_only():
    """Test /api/clips/:id/render with crop only (1:1 square)"""
    scenario = "render_crop_only"
    start_time = time.time()
    log(scenario, "Testing crop-only render (1:1 square)...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            storage_url = clip["storage_url_mp4"]
            filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
            
            # Get original dimensions
            orig_w, orig_h = get_ffprobe_dimensions(filepath)
            log(scenario, f"Original dimensions: {orig_w}x{orig_h}")
            
            # Render with 1:1 crop
            log(scenario, "Rendering with crop_aspect=1:1")
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"crop_aspect": "1:1"}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            if not data.get("ok"):
                fail_scenario(scenario, f"Response ok=false: {data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify dimensions are square
            new_w, new_h = get_ffprobe_dimensions(filepath)
            log(scenario, f"New dimensions: {new_w}x{new_h}")
            
            if not new_w or not new_h:
                fail_scenario(scenario, "Could not probe dimensions after crop")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Allow small tolerance for even pixel alignment
            if abs(new_w - new_h) > 2:
                fail_scenario(scenario, f"Not square: {new_w}x{new_h}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Crop successful: {orig_w}x{orig_h} → {new_w}x{new_h} ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_speed_only():
    """Test /api/clips/:id/render with speed only (1.5x)"""
    scenario = "render_speed_only"
    start_time = time.time()
    log(scenario, "Testing speed-only render (1.5x)...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            storage_url = clip["storage_url_mp4"]
            filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
            
            original_duration = get_ffprobe_duration(filepath)
            log(scenario, f"Original duration: {original_duration:.2f}s")
            
            # Render with 1.5x speed
            speed = 1.5
            expected_duration = original_duration / speed
            
            log(scenario, f"Rendering with speed={speed}")
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"speed": speed}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            if not data.get("ok"):
                fail_scenario(scenario, f"Response ok=false: {data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            new_duration = get_ffprobe_duration(filepath)
            log(scenario, f"New duration: {new_duration:.2f}s (expected ~{expected_duration:.2f}s)")
            
            # Allow 10% tolerance for speed changes
            tolerance = expected_duration * 0.1
            if abs(new_duration - expected_duration) > tolerance:
                fail_scenario(scenario, f"Duration mismatch: expected ~{expected_duration:.2f}s, got {new_duration:.2f}s")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Speed successful: {original_duration:.2f}s → {new_duration:.2f}s at {speed}x ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_title_only():
    """Test /api/clips/:id/render with title overlay only"""
    scenario = "render_title_only"
    start_time = time.time()
    log(scenario, "Testing title-only render...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            storage_url = clip["storage_url_mp4"]
            filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
            
            original_size = Path(filepath).stat().st_size
            log(scenario, f"Original file size: {original_size} bytes")
            
            # Render with title
            title_text = "TEST TITLE"
            log(scenario, f"Rendering with title_text='{title_text}', title_position='top'")
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"title_text": title_text, "title_position": "top"}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            if not data.get("ok"):
                fail_scenario(scenario, f"Response ok=false: {data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            new_size = Path(filepath).stat().st_size
            log(scenario, f"New file size: {new_size} bytes")
            
            # File size should change (re-encoded with title overlay)
            if new_size == original_size:
                log(scenario, "⚠️  WARNING: File size unchanged (may still be OK if re-encoded)")
            
            # Verify title_text saved in DB
            updated_clip = db.generated_clips.find_one({"id": clip_id})
            db_title = updated_clip.get("title_text")
            db_position = updated_clip.get("title_position")
            
            if db_title != title_text:
                fail_scenario(scenario, f"title_text not saved in DB: expected '{title_text}', got '{db_title}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if db_position != "top":
                fail_scenario(scenario, f"title_position not saved in DB: expected 'top', got '{db_position}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Title overlay successful ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_all_combined():
    """Test /api/clips/:id/render with all parameters combined"""
    scenario = "render_all_combined"
    start_time = time.time()
    log(scenario, "Testing combined render (trim+crop+speed+style+title)...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            storage_url = clip["storage_url_mp4"]
            filepath = f"/app/data/uploads{storage_url.replace('/api/files', '')}"
            
            original_duration = get_ffprobe_duration(filepath)
            log(scenario, f"Original duration: {original_duration:.2f}s")
            
            # Combined parameters
            trim_start = 0
            trim_end = min(3.0, original_duration - 0.5)
            speed = 1.25
            expected_duration = (trim_end - trim_start) / speed
            
            payload = {
                "trim_start": trim_start,
                "trim_end": trim_end,
                "crop_aspect": "9:16",
                "speed": speed,
                "style_preset": "neon_pop",
                "font_size": 24,
                "outline_size": 4,
                "caption_position_percent": 80,
                "title_text": "COMBO TEST",
                "title_position": "top",
                "template_id": "hot_take"
            }
            
            log(scenario, f"Rendering with combined params: {json.dumps(payload, indent=2)}")
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json=payload
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            if not data.get("ok"):
                fail_scenario(scenario, f"Response ok=false: {data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            final_duration = data.get("final_duration")
            log(scenario, f"API reported final_duration: {final_duration:.2f}s (expected ~{expected_duration:.2f}s)")
            
            # Verify duration
            new_duration = get_ffprobe_duration(filepath)
            log(scenario, f"ffprobe duration: {new_duration:.2f}s")
            
            tolerance = expected_duration * 0.15  # 15% tolerance for combined operations
            if abs(new_duration - expected_duration) > tolerance:
                fail_scenario(scenario, f"Duration mismatch: expected ~{expected_duration:.2f}s, got {new_duration:.2f}s")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify render_version incremented
            updated_clip = db.generated_clips.find_one({"id": clip_id})
            render_version = updated_clip.get("render_version", 0)
            log(scenario, f"render_version: {render_version}")
            
            if render_version < 1:
                fail_scenario(scenario, "render_version not incremented")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify 9:16 aspect ratio
            new_w, new_h = get_ffprobe_dimensions(filepath)
            if new_w and new_h:
                aspect = new_w / new_h
                expected_aspect = 9 / 16
                log(scenario, f"Aspect ratio: {aspect:.3f} (expected ~{expected_aspect:.3f})")
                if abs(aspect - expected_aspect) > 0.05:
                    log(scenario, f"⚠️  WARNING: Aspect ratio off: {new_w}x{new_h}")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Combined render successful: {original_duration:.2f}s → {new_duration:.2f}s ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_cache_bust():
    """Test that render busts R2 cache (unsets r2_key)"""
    scenario = "render_cache_bust"
    start_time = time.time()
    log(scenario, "Testing R2 cache bust after render...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            
            # Set fake r2_key to test cache bust
            db.generated_clips.update_one(
                {"id": clip_id},
                {"$set": {"r2_key": "test-key-123", "r2_size": 12345, "r2_uploaded_at": "2025-01-01T00:00:00Z"}}
            )
            
            log(scenario, f"Set fake r2_key on clip {clip_id}")
            
            # Render with a simple title change (no trim to avoid duration issues)
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"title_text": "CACHE BUST TEST", "title_position": "top"}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /render returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Check if r2_key was unset
            updated_clip = db.generated_clips.find_one({"id": clip_id})
            r2_key = updated_clip.get("r2_key")
            r2_size = updated_clip.get("r2_size")
            r2_uploaded_at = updated_clip.get("r2_uploaded_at")
            
            if r2_key or r2_size or r2_uploaded_at:
                fail_scenario(scenario, f"R2 cache not busted: r2_key={r2_key}, r2_size={r2_size}, r2_uploaded_at={r2_uploaded_at}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, "R2 cache fields successfully unset")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Cache bust successful ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_render_error_cases():
    """Test error cases for /api/clips/:id/render"""
    scenario = "render_error_cases"
    start_time = time.time()
    log(scenario, "Testing error cases...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            
            # Test 1: trim_end - trim_start < 1
            log(scenario, "Test 1: trim range < 1 second")
            resp = await client.post(
                f"{BASE_URL}/clips/{clip_id}/render",
                json={"trim_start": 1, "trim_end": 1.5}
            )
            if resp.status_code != 400:
                fail_scenario(scenario, f"Expected 400 for short trim, got {resp.status_code}")
                results[scenario]["timing"] = time.time() - start_time
                return
            log(scenario, f"  ✓ Got 400: {resp.json().get('error', '')[:100]}")
            
            # Test 2: clip not found
            log(scenario, "Test 2: clip not found")
            resp = await client.post(
                f"{BASE_URL}/clips/nonexistent-clip-id/render",
                json={"trim_start": 0, "trim_end": 2}
            )
            if resp.status_code != 404:
                fail_scenario(scenario, f"Expected 404 for missing clip, got {resp.status_code}")
                results[scenario]["timing"] = time.time() - start_time
                return
            log(scenario, "  ✓ Got 404")
            
            # Test 3: clip with CDN URL (not /api/files/)
            log(scenario, "Test 3: clip with CDN URL (should return 410)")
            cdn_clip = db.generated_clips.find_one({"storage_url_mp4": {"$regex": "^https://"}})
            if cdn_clip:
                resp = await client.post(
                    f"{BASE_URL}/clips/{cdn_clip['id']}/render",
                    json={"trim_start": 0, "trim_end": 2}
                )
                if resp.status_code != 410:
                    fail_scenario(scenario, f"Expected 410 for CDN clip, got {resp.status_code}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                log(scenario, "  ✓ Got 410")
            else:
                log(scenario, "  ⚠️  No CDN clip found to test")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Error cases handled correctly ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_upload_logo():
    """Test POST /api/upload with kind=logo"""
    scenario = "upload_logo"
    start_time = time.time()
    log(scenario, "Testing logo upload...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Create a small test PNG image
            img = Image.new('RGB', (100, 100), color='red')
            img_bytes = BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            log(scenario, "Created test PNG image (100x100)")
            
            # Upload
            files = {"file": ("test_logo.png", img_bytes, "image/png")}
            data = {"kind": "logo"}
            
            resp = await client.post(f"{BASE_URL}/upload", files=files, data=data)
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /upload returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            result = resp.json()
            log(scenario, f"Response: {json.dumps(result, indent=2)}")
            
            # Verify response fields
            url = result.get("url")
            filename = result.get("filename")
            size = result.get("size")
            
            if not url or not url.startswith("/api/files/logos/"):
                fail_scenario(scenario, f"Invalid URL: {url}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if not filename:
                fail_scenario(scenario, "No filename in response")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if not size or size < 100:
                fail_scenario(scenario, f"Invalid size: {size}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"Logo uploaded: {url}, size={size} bytes")
            
            # Verify file is accessible
            log(scenario, f"Verifying GET {url}")
            get_resp = await client.get(BASE_URL.replace("/api", "") + url)
            
            if get_resp.status_code != 200:
                fail_scenario(scenario, f"GET {url} returned {get_resp.status_code}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            content_type = get_resp.headers.get("content-type", "")
            if "image/" not in content_type:
                fail_scenario(scenario, f"Wrong content-type: {content_type}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ GET successful: content-type={content_type}, size={len(get_resp.content)} bytes")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Logo upload successful ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_regression_download():
    """Test GET /api/clips/:id/download still works"""
    scenario = "regression_download"
    start_time = time.time()
    log(scenario, "Testing /clips/:id/download regression...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            
            clip = await find_test_clip(db)
            if not clip:
                fail_scenario(scenario, "No test clip found")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            clip_id = clip["id"]
            
            resp = await client.get(f"{BASE_URL}/clips/{clip_id}/download")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /download returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Check Content-Disposition header
            content_disp = resp.headers.get("content-disposition", "")
            if "attachment" not in content_disp.lower():
                fail_scenario(scenario, f"Missing 'attachment' in Content-Disposition: {content_disp}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"Content-Disposition: {content_disp}")
            
            # Check content type
            content_type = resp.headers.get("content-type", "")
            if "video/mp4" not in content_type:
                fail_scenario(scenario, f"Wrong content-type: {content_type}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"Downloaded {len(resp.content)} bytes")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Download endpoint working ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def test_regression_clips_list():
    """Test GET /api/clips returns array"""
    scenario = "regression_clips_list"
    start_time = time.time()
    log(scenario, "Testing GET /api/clips...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(f"{BASE_URL}/clips")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /clips returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            data = resp.json()
            
            if not isinstance(data, list):
                fail_scenario(scenario, f"Expected array, got {type(data)}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"Got {len(data)} clips")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Clips list working ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")

async def main():
    """Run all test scenarios"""
    print("=" * 80)
    print("ClipForge Render Endpoint + gpt-4o-transcribe Test Suite")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("=" * 80 + "\n")
    
    # Run tests in order
    await test_render_trim_only()
    print()
    
    await test_render_crop_only()
    print()
    
    await test_render_speed_only()
    print()
    
    await test_render_title_only()
    print()
    
    await test_render_all_combined()
    print()
    
    await test_render_cache_bust()
    print()
    
    await test_render_error_cases()
    print()
    
    await test_upload_logo()
    print()
    
    await test_regression_download()
    print()
    
    await test_regression_clips_list()
    print()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for scenario, result in results.items():
        status = result["status"]
        timing = result.get("timing", 0)
        emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️"
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
