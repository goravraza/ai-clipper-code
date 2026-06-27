#!/usr/bin/env python3
"""
ClipForge AI YouTube Ingestion Pipeline Test Suite
Tests scenarios A-E from the refactored yt-dlp + ffmpeg segment-fetch architecture
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
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://shorts-studio-78.preview.emergentagent.com") + "/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111"
FFMPEG = "/usr/bin/ffmpeg"
SAMPLE_VIDEO = "/tmp/sample.mp4"

# Test results
results = {
    "A_json_sanity": {"status": "PENDING", "details": [], "timing": 0},
    "B_proxy_creds": {"status": "PENDING", "details": [], "timing": 0},
    "C_local_upload": {"status": "PENDING", "details": [], "timing": 0},
    "D_youtube_fastfail": {"status": "PENDING", "details": [], "timing": 0},
    "E_package_purchase": {"status": "PENDING", "details": [], "timing": 0},
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


def generate_sample_video():
    """Generate a 90-second test video with audio"""
    if Path(SAMPLE_VIDEO).exists():
        log("SETUP", f"Sample video already exists at {SAMPLE_VIDEO}")
        return True
    
    log("SETUP", f"Generating 90s sample video at {SAMPLE_VIDEO}...")
    cmd = [
        FFMPEG, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=90:size=640x480:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=90",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "64k",
        "-t", "90",
        SAMPLE_VIDEO
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode == 0 and Path(SAMPLE_VIDEO).exists():
            size = Path(SAMPLE_VIDEO).stat().st_size
            log("SETUP", f"✅ Sample video generated: {size} bytes")
            return True
        else:
            log("SETUP", f"❌ FFmpeg failed: {result.stderr.decode()[:500]}")
            return False
    except Exception as e:
        log("SETUP", f"❌ Exception generating video: {e}")
        return False


async def test_scenario_a():
    """A) JSON sanity sweep — for each GET, assert HTTP 200 + parseable JSON"""
    scenario = "A_json_sanity"
    start_time = time.time()
    log(scenario, "Starting JSON sanity sweep...")
    
    endpoints = [
        "/admin/integrations?admin=true",
        "/clips",
        "/pricing-packages",
        "/auth/me",
        "/transactions",
        "/geo",
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            for endpoint in endpoints:
                url = f"{BASE_URL}{endpoint}"
                log(scenario, f"Testing GET {endpoint}...")
                
                resp = await client.get(url)
                
                # Assert HTTP 200
                if resp.status_code != 200:
                    fail_scenario(scenario, f"{endpoint} returned {resp.status_code}, expected 200. Body: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Check content-type is JSON
                content_type = resp.headers.get("content-type", "")
                if "json" not in content_type.lower():
                    fail_scenario(scenario, f"{endpoint} returned non-JSON content-type: {content_type}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Try to parse JSON
                try:
                    data = resp.json()
                except Exception as e:
                    fail_scenario(scenario, f"{endpoint} returned invalid JSON: {e}. Body: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Check for HTML/stderr leaks
                body_text = resp.text
                if "<html" in body_text.lower() or "<!doctype" in body_text.lower():
                    fail_scenario(scenario, f"{endpoint} returned HTML: {body_text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                if "traceback" in body_text.lower() or "stack trace" in body_text.lower():
                    fail_scenario(scenario, f"{endpoint} leaked stack trace: {body_text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                log(scenario, f"  ✓ {endpoint}: HTTP 200, valid JSON, no leaks")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"All {len(endpoints)} endpoints returned clean JSON ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_b():
    """B) Save HTTP proxy creds + read back"""
    scenario = "B_proxy_creds"
    start_time = time.time()
    log(scenario, "Starting HTTP proxy credentials test...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Step 1: POST proxy credentials
            log(scenario, "Step 1: POST /api/admin/integrations with http_proxy credentials")
            proxy_data = {
                "provider": "http_proxy",
                "credentials": {
                    "proxy_url": "http://testuser:testpass@example.com:8080",
                    "notes": "smoke-test"
                },
                "is_active": True
            }
            
            resp = await client.post(
                f"{BASE_URL}/admin/integrations",
                json=proxy_data,
                headers={"content-type": "application/json"}
            )
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /admin/integrations returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Check response is valid JSON
            try:
                post_data = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"POST response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify provider field
            if post_data.get("provider") != "http_proxy":
                fail_scenario(scenario, f"Expected provider='http_proxy', got {post_data.get('provider')}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ POST successful: provider={post_data.get('provider')}, has_credentials={post_data.get('has_credentials')}")
            
            # Step 2: GET integrations and verify http_proxy exists
            log(scenario, "Step 2: GET /api/admin/integrations?admin=true and verify http_proxy entry")
            resp = await client.get(f"{BASE_URL}/admin/integrations?admin=true")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /admin/integrations returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                integrations = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"GET response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if not isinstance(integrations, list):
                fail_scenario(scenario, f"Expected list of integrations, got {type(integrations)}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Find http_proxy entry
            http_proxy_entry = None
            for integ in integrations:
                if integ.get("provider") == "http_proxy":
                    http_proxy_entry = integ
                    break
            
            if not http_proxy_entry:
                fail_scenario(scenario, f"http_proxy entry not found in integrations list. Found: {[i.get('provider') for i in integrations]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ http_proxy entry found: has_credentials={http_proxy_entry.get('has_credentials')}, is_active={http_proxy_entry.get('is_active')}")
            
            # Verify credentials are masked (security check)
            creds = http_proxy_entry.get("credentials", {})
            proxy_url = creds.get("proxy_url", "")
            if "testpass" in proxy_url:
                log(scenario, f"  ⚠️  WARNING: Credentials not masked in response (security issue)")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"HTTP proxy credentials saved and retrieved successfully ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_c():
    """C) Local file upload regression — must still produce real clips end-to-end"""
    scenario = "C_local_upload"
    start_time = time.time()
    log(scenario, "Starting local file upload regression test...")
    
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            # Step 1: Upload sample.mp4
            log(scenario, "Step 1: POST /api/upload with sample.mp4 (clip_min=10, clip_max=30, add_captions=true)")
            
            with open(SAMPLE_VIDEO, "rb") as f:
                files = {"file": ("sample.mp4", f, "video/mp4")}
                data = {
                    "kind": "workspace_video",
                    "clip_min": "10",
                    "clip_max": "30",
                    "add_captions": "true"
                }
                resp = await client.post(f"{BASE_URL}/upload", files=files, data=data)
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /upload returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                upload_data = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Upload response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            video_id = upload_data.get("video_id")
            if not video_id:
                fail_scenario(scenario, f"No video_id in upload response: {upload_data}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ Upload successful: video_id={video_id}, status={upload_data.get('status')}")
            
            # Step 2: Poll GET /api/videos/{video_id} every 3s for up to 90s
            log(scenario, f"Step 2: Polling GET /api/videos/{video_id} every 3s (up to 90s)...")
            
            poll_start = time.time()
            final_status = None
            video_doc = None
            
            while time.time() - poll_start < 90:
                resp = await client.get(f"{BASE_URL}/videos/{video_id}")
                
                if resp.status_code != 200:
                    fail_scenario(scenario, f"GET /videos/{video_id} returned {resp.status_code}: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                try:
                    video_doc = resp.json()
                except Exception as e:
                    fail_scenario(scenario, f"Poll response not valid JSON: {e}. Body: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                status = video_doc.get("status")
                log(scenario, f"  Poll: status={status}, progress={video_doc.get('progress', 0)}")
                
                if status == "completed":
                    final_status = "completed"
                    break
                elif status == "failed":
                    fail_scenario(scenario, f"Video processing failed: {video_doc.get('error_message', 'unknown error')}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                await asyncio.sleep(3)
            
            if final_status != "completed":
                fail_scenario(scenario, f"Video did not complete within 90s. Last status: {video_doc.get('status') if video_doc else 'unknown'}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            poll_time = time.time() - poll_start
            log(scenario, f"  ✓ Video completed in {poll_time:.1f}s")
            
            # Step 3: Assert final state
            log(scenario, "Step 3: Verifying final video state...")
            
            # Assert status='completed'
            if video_doc.get("status") != "completed":
                fail_scenario(scenario, f"Expected status='completed', got '{video_doc.get('status')}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Assert clip_count >= 1
            clips = video_doc.get("clips", [])
            if len(clips) < 1:
                fail_scenario(scenario, f"Expected clip_count >= 1, got {len(clips)}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ clip_count={len(clips)}")
            
            # Assert credits_charged >= 1
            credits_charged = video_doc.get("credits_charged", 0)
            if credits_charged < 1:
                fail_scenario(scenario, f"Expected credits_charged >= 1, got {credits_charged}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ credits_charged={credits_charged}")
            
            # Assert transcription_source ∈ {whisper, youtube-auto, none}
            transcription_source = video_doc.get("transcription_source")
            valid_sources = ["whisper", "youtube-auto", "none"]
            if transcription_source not in valid_sources:
                fail_scenario(scenario, f"Expected transcription_source in {valid_sources}, got '{transcription_source}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ transcription_source={transcription_source}")
            
            # Step 4: Verify each clip's storage_url_mp4
            log(scenario, "Step 4: Verifying clip MP4 files...")
            
            for i, clip in enumerate(clips):
                storage_url = clip.get("storage_url_mp4")
                if not storage_url:
                    fail_scenario(scenario, f"Clip {i+1} missing storage_url_mp4")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Construct full URL
                full_url = BASE_URL.replace("/api", "") + storage_url
                
                # HEAD request to check file
                head_resp = await client.head(full_url, follow_redirects=True)
                
                if head_resp.status_code != 200:
                    fail_scenario(scenario, f"Clip {i+1} MP4 not accessible: {full_url} returned {head_resp.status_code}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                content_type = head_resp.headers.get("content-type", "")
                if "video/mp4" not in content_type:
                    fail_scenario(scenario, f"Clip {i+1} wrong content-type: expected video/mp4, got {content_type}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                content_length = int(head_resp.headers.get("content-length", 0))
                if content_length < 50000:
                    fail_scenario(scenario, f"Clip {i+1} content-length too small: {content_length} bytes (expected > 50000)")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                log(scenario, f"  ✓ Clip {i+1}: {storage_url} → {content_length} bytes, {content_type}")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Local upload produced {len(clips)} valid clips end-to-end ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_d():
    """D) YouTube fast-fail (no proxy configured)"""
    scenario = "D_youtube_fastfail"
    start_time = time.time()
    log(scenario, "Starting YouTube fast-fail test (no proxy)...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            # Step 0: Delete http_proxy integration if it exists
            log(scenario, "Step 0: Deleting http_proxy integration to ensure no proxy is configured")
            resp = await client.delete(f"{BASE_URL}/admin/integrations/http_proxy")
            log(scenario, f"  DELETE /admin/integrations/http_proxy: {resp.status_code}")
            
            # Step 1: POST /api/ai/analyze with YouTube URL
            log(scenario, "Step 1: POST /api/ai/analyze with YouTube URL")
            analyze_data = {
                "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"
            }
            
            resp = await client.post(f"{BASE_URL}/ai/analyze", json=analyze_data)
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /ai/analyze returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                analyze_resp = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Analyze response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            video_id = analyze_resp.get("video_id")
            if not video_id:
                fail_scenario(scenario, f"No video_id in analyze response: {analyze_resp}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify response fields
            if analyze_resp.get("status") != "queued":
                fail_scenario(scenario, f"Expected status='queued', got '{analyze_resp.get('status')}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if analyze_resp.get("title") != "Me at the zoo":
                log(scenario, f"  ⚠️  Expected title='Me at the zoo', got '{analyze_resp.get('title')}' (may be OK if metadata fetch failed)")
            
            log(scenario, f"  ✓ Analyze successful: video_id={video_id}, status={analyze_resp.get('status')}, title={analyze_resp.get('title')}")
            
            # Step 2: Poll /api/videos/{video_id} every 2s for up to 25s
            log(scenario, f"Step 2: Polling GET /api/videos/{video_id} every 2s (up to 25s)...")
            
            poll_start = time.time()
            final_status = None
            video_doc = None
            failed_within_15s = False
            
            while time.time() - poll_start < 25:
                resp = await client.get(f"{BASE_URL}/videos/{video_id}")
                
                if resp.status_code != 200:
                    fail_scenario(scenario, f"GET /videos/{video_id} returned {resp.status_code}: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Assert response is always valid JSON (never HTML)
                try:
                    video_doc = resp.json()
                except Exception as e:
                    fail_scenario(scenario, f"Poll response not valid JSON: {e}. Body: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                # Check for HTML leak
                if "<html" in resp.text.lower() or "<!doctype" in resp.text.lower():
                    fail_scenario(scenario, f"Poll response contains HTML: {resp.text[:500]}")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                status = video_doc.get("status")
                elapsed = time.time() - poll_start
                log(scenario, f"  Poll at {elapsed:.1f}s: status={status}")
                
                if status == "failed":
                    final_status = "failed"
                    if elapsed <= 15:
                        failed_within_15s = True
                    break
                elif status == "completed":
                    fail_scenario(scenario, f"Expected video to fail (no proxy), but it completed successfully")
                    results[scenario]["timing"] = time.time() - start_time
                    return
                
                await asyncio.sleep(2)
            
            # Step 3: Assert status transitioned to 'failed' within 15s
            if final_status != "failed":
                fail_scenario(scenario, f"Expected status='failed', got '{video_doc.get('status') if video_doc else 'unknown'}' after 25s")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if not failed_within_15s:
                fail_scenario(scenario, f"Video failed but took longer than 15s (fast-fail probe should catch 403 within seconds)")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            fail_time = time.time() - poll_start
            log(scenario, f"  ✓ Video failed within {fail_time:.1f}s (fast-fail working)")
            
            # Step 4: Assert error_message contains expected keywords
            error_message = video_doc.get("error_message", "")
            if not error_message:
                fail_scenario(scenario, f"error_message is empty")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            expected_keywords = ["HTTP Proxy", "Configure", "403", "blocked", "refuses"]
            found_keyword = any(kw.lower() in error_message.lower() for kw in expected_keywords)
            
            if not found_keyword:
                fail_scenario(scenario, f"error_message does not contain expected keywords {expected_keywords}. Got: {error_message}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ error_message contains expected keyword: '{error_message[:100]}'")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"YouTube fast-fail working correctly (failed in {fail_time:.1f}s, {results[scenario]['timing']:.1f}s total)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_e():
    """E) Package purchase regression"""
    scenario = "E_package_purchase"
    start_time = time.time()
    log(scenario, "Starting package purchase regression test...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Step 1: GET /api/pricing-packages → grab Starter Pack id
            log(scenario, "Step 1: GET /api/pricing-packages")
            resp = await client.get(f"{BASE_URL}/pricing-packages")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /pricing-packages returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                packages = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Packages response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if not isinstance(packages, list) or not packages:
                fail_scenario(scenario, f"Expected non-empty list of packages, got {type(packages)}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Find Starter Pack
            starter = None
            for pkg in packages:
                if "Starter" in pkg.get("name", ""):
                    starter = pkg
                    break
            
            if not starter:
                fail_scenario(scenario, f"Starter Pack not found. Available: {[p.get('name') for p in packages]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            starter_id = starter.get("id")
            starter_credits = starter.get("credit_amount_minutes", 300)
            log(scenario, f"  ✓ Found Starter Pack: id={starter_id}, credits={starter_credits}")
            
            # Step 2: GET /api/auth/me → capture B1 = credit_balance_minutes
            log(scenario, "Step 2: GET /api/auth/me (capture initial balance)")
            resp = await client.get(f"{BASE_URL}/auth/me")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                me_data = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Auth/me response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            b1 = me_data.get("user", {}).get("credit_balance_minutes", 0)
            log(scenario, f"  ✓ Initial balance B1={b1}")
            
            # Step 3: POST /api/packages/purchase
            log(scenario, "Step 3: POST /api/packages/purchase")
            purchase_data = {
                "package_id": starter_id,
                "billing_cycle": "month"
            }
            
            resp = await client.post(f"{BASE_URL}/packages/purchase", json=purchase_data)
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /packages/purchase returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                purchase_resp = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Purchase response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            # Verify response fields
            if not purchase_resp.get("ok"):
                fail_scenario(scenario, f"Purchase not ok: {purchase_resp}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if purchase_resp.get("credits_added") != starter_credits:
                fail_scenario(scenario, f"Expected credits_added={starter_credits}, got {purchase_resp.get('credits_added')}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            expected_new_balance = b1 + starter_credits
            if purchase_resp.get("new_balance_minutes") != expected_new_balance:
                fail_scenario(scenario, f"Expected new_balance_minutes={expected_new_balance}, got {purchase_resp.get('new_balance_minutes')}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            if purchase_resp.get("payment_status") != "completed_simulated":
                fail_scenario(scenario, f"Expected payment_status='completed_simulated', got '{purchase_resp.get('payment_status')}'")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ Purchase successful: credits_added={purchase_resp.get('credits_added')}, new_balance={purchase_resp.get('new_balance_minutes')}, payment_status={purchase_resp.get('payment_status')}")
            
            # Step 4: GET /api/auth/me → verify balance equals new_balance_minutes
            log(scenario, "Step 4: GET /api/auth/me (verify new balance)")
            resp = await client.get(f"{BASE_URL}/auth/me")
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me (2) returned {resp.status_code}: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            try:
                me_data_2 = resp.json()
            except Exception as e:
                fail_scenario(scenario, f"Auth/me (2) response not valid JSON: {e}. Body: {resp.text[:500]}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            b2 = me_data_2.get("user", {}).get("credit_balance_minutes", 0)
            
            if b2 != expected_new_balance:
                fail_scenario(scenario, f"Balance mismatch: expected {expected_new_balance}, got {b2}")
                results[scenario]["timing"] = time.time() - start_time
                return
            
            log(scenario, f"  ✓ Balance verified: B2={b2} (B1 + {starter_credits})")
            
            results[scenario]["timing"] = time.time() - start_time
            pass_scenario(scenario, f"Package purchase working correctly ({results[scenario]['timing']:.1f}s)")
            
        except Exception as e:
            results[scenario]["timing"] = time.time() - start_time
            fail_scenario(scenario, f"Exception: {e}")


async def main():
    """Run all test scenarios"""
    print("=" * 80)
    print("ClipForge AI YouTube Ingestion Pipeline Test Suite")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print(f"Default User: {DEFAULT_USER_ID}")
    print("=" * 80)
    
    # Setup: Generate sample video
    if not generate_sample_video():
        print("❌ Failed to generate sample video. Aborting tests.")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("Running Test Scenarios")
    print("=" * 80 + "\n")
    
    # Run scenarios in order
    await test_scenario_a()
    print()
    
    await test_scenario_b()
    print()
    
    await test_scenario_c()
    print()
    
    await test_scenario_d()
    print()
    
    await test_scenario_e()
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
