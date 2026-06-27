#!/usr/bin/env python3
"""
ClipForge AI Backend Test Suite
Tests scenarios A-E: clip length presets, caption burn-in, credit deduction, package purchase, JSON sanity
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
BASE_URL = "https://shorts-studio-78.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111"
FFMPEG = "/usr/bin/ffmpeg"
SAMPLE_VIDEO = "/tmp/sample.mp4"

# Test results
results = {
    "A_clip_length_presets": {"status": "PENDING", "details": []},
    "B_caption_burn_in": {"status": "PENDING", "details": []},
    "C_credit_deduction": {"status": "PENDING", "details": []},
    "D_package_purchase": {"status": "PENDING", "details": []},
    "E_json_sanity": {"status": "PENDING", "details": []},
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
            log("SETUP", f"✅ Sample video generated: {Path(SAMPLE_VIDEO).stat().st_size} bytes")
            return True
        else:
            log("SETUP", f"❌ FFmpeg failed: {result.stderr.decode()[:500]}")
            return False
    except Exception as e:
        log("SETUP", f"❌ Exception generating video: {e}")
        return False


async def poll_video_completion(client: httpx.AsyncClient, video_id: str, timeout: int = 90) -> dict:
    """Poll GET /api/videos/:id until status='completed' or timeout"""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = await client.get(f"{BASE_URL}/videos/{video_id}")
            if resp.status_code != 200:
                return {"error": f"GET /videos/{video_id} returned {resp.status_code}: {resp.text[:500]}"}
            data = resp.json()
            status = data.get("status")
            if status == "completed":
                return data
            elif status == "failed":
                return {"error": f"Video processing failed: {data.get('error_message', 'unknown')}"}
            await asyncio.sleep(3)
        except Exception as e:
            return {"error": f"Poll exception: {e}"}
    return {"error": f"Timeout after {timeout}s waiting for completion"}


async def test_scenario_a():
    """A) Clip length presets: 10-30s and 60-90s"""
    scenario = "A_clip_length_presets"
    log(scenario, "Starting clip length preset tests...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Test 1: 10-30s range
        log(scenario, "Test 1: Uploading with clip_min=10, clip_max=30, add_captions=true")
        try:
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
                fail_scenario(scenario, f"Upload returned {resp.status_code}: {resp.text[:500]}")
                return
            
            upload_data = resp.json()
            video_id_1 = upload_data.get("video_id")
            log(scenario, f"Upload successful: video_id={video_id_1}, status={upload_data.get('status')}")
            
            # Verify response fields
            if upload_data.get("clip_length_range", {}).get("min") != 10:
                fail_scenario(scenario, f"Expected clip_min=10, got {upload_data.get('clip_length_range')}")
                return
            if upload_data.get("clip_length_range", {}).get("max") != 30:
                fail_scenario(scenario, f"Expected clip_max=30, got {upload_data.get('clip_length_range')}")
                return
            if upload_data.get("add_captions") != True:
                fail_scenario(scenario, f"Expected add_captions=true, got {upload_data.get('add_captions')}")
                return
            
            # Poll for completion
            log(scenario, f"Polling video {video_id_1} for completion (up to 90s)...")
            video_doc_1 = await poll_video_completion(client, video_id_1, timeout=90)
            
            if "error" in video_doc_1:
                fail_scenario(scenario, f"Polling failed: {video_doc_1['error']}")
                return
            
            log(scenario, f"Video completed: {len(video_doc_1.get('clips', []))} clips generated")
            
            # Verify clip_length_range in video doc
            if video_doc_1.get("clip_length_range", {}).get("min") != 10:
                fail_scenario(scenario, f"Video doc clip_min != 10: {video_doc_1.get('clip_length_range')}")
                return
            if video_doc_1.get("clip_length_range", {}).get("max") != 30:
                fail_scenario(scenario, f"Video doc clip_max != 30: {video_doc_1.get('clip_length_range')}")
                return
            
            # Verify each clip duration is in [10, 30]
            clips_1 = video_doc_1.get("clips", [])
            if not clips_1:
                fail_scenario(scenario, "No clips generated for 10-30s range")
                return
            
            for clip in clips_1:
                start = clip.get("start_time_seconds", 0)
                end = clip.get("end_time_seconds", 0)
                duration = end - start
                if not (10 <= duration <= 30):
                    fail_scenario(scenario, f"Clip {clip.get('id')} duration {duration}s not in [10,30]: start={start}, end={end}")
                    return
                log(scenario, f"  Clip {clip.get('clip_title')[:30]}: {duration}s ✓")
            
            log(scenario, f"✓ All {len(clips_1)} clips are within [10,30]s range")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception in 10-30s test: {e}")
            return
        
        # Test 2: 60-90s range
        log(scenario, "Test 2: Uploading with clip_min=60, clip_max=90")
        try:
            with open(SAMPLE_VIDEO, "rb") as f:
                files = {"file": ("sample.mp4", f, "video/mp4")}
                data = {
                    "kind": "workspace_video",
                    "clip_min": "60",
                    "clip_max": "90",
                    "add_captions": "true"
                }
                resp = await client.post(f"{BASE_URL}/upload", files=files, data=data)
            
            if resp.status_code != 200:
                fail_scenario(scenario, f"Upload 2 returned {resp.status_code}: {resp.text[:500]}")
                return
            
            upload_data_2 = resp.json()
            video_id_2 = upload_data_2.get("video_id")
            log(scenario, f"Upload 2 successful: video_id={video_id_2}")
            
            # Poll for completion
            log(scenario, f"Polling video {video_id_2} for completion...")
            video_doc_2 = await poll_video_completion(client, video_id_2, timeout=90)
            
            if "error" in video_doc_2:
                fail_scenario(scenario, f"Polling 2 failed: {video_doc_2['error']}")
                return
            
            clips_2 = video_doc_2.get("clips", [])
            if not clips_2:
                fail_scenario(scenario, "No clips generated for 60-90s range")
                return
            
            # For a 90s source, clips should be 60-90s (or capped at source duration)
            for clip in clips_2:
                start = clip.get("start_time_seconds", 0)
                end = clip.get("end_time_seconds", 0)
                duration = end - start
                # Allow clips to be capped at video duration (90s)
                if not (60 <= duration <= 90):
                    fail_scenario(scenario, f"Clip {clip.get('id')} duration {duration}s not in [60,90]: start={start}, end={end}")
                    return
                log(scenario, f"  Clip {clip.get('clip_title')[:30]}: {duration}s ✓")
            
            log(scenario, f"✓ All {len(clips_2)} clips are within [60,90]s range")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception in 60-90s test: {e}")
            return
    
    pass_scenario(scenario, "Clip length presets working correctly")


async def test_scenario_b():
    """B) Caption burn-in verification"""
    scenario = "B_caption_burn_in"
    log(scenario, "Starting caption burn-in tests...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Upload with add_captions=true
            log(scenario, "Uploading sample video with add_captions=true")
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
                fail_scenario(scenario, f"Upload returned {resp.status_code}: {resp.text[:500]}")
                return
            
            video_id = resp.json().get("video_id")
            log(scenario, f"Polling video {video_id} for completion...")
            video_doc = await poll_video_completion(client, video_id, timeout=90)
            
            if "error" in video_doc:
                fail_scenario(scenario, f"Polling failed: {video_doc['error']}")
                return
            
            # Check video doc fields
            if "captions_burned" not in video_doc:
                fail_scenario(scenario, "Video doc missing 'captions_burned' field")
                return
            
            if "transcription_source" not in video_doc:
                fail_scenario(scenario, "Video doc missing 'transcription_source' field")
                return
            
            log(scenario, f"Video doc: captions_burned={video_doc.get('captions_burned')}, transcription_source={video_doc.get('transcription_source')}")
            
            # For a silent test signal, captions_burned may be false (no speech detected)
            # This is acceptable per the review request
            transcription_source = video_doc.get("transcription_source")
            if transcription_source == "none":
                log(scenario, "⚠️  No speech detected in test video (expected for silent tone) - captions_burned=false is acceptable")
            
            # Verify clips have the fields
            clips = video_doc.get("clips", [])
            if not clips:
                fail_scenario(scenario, "No clips generated")
                return
            
            for clip in clips:
                if "captions_burned" not in clip:
                    fail_scenario(scenario, f"Clip {clip.get('id')} missing 'captions_burned' field")
                    return
                if "transcription_source" not in clip:
                    fail_scenario(scenario, f"Clip {clip.get('id')} missing 'transcription_source' field")
                    return
                
                # Verify MP4 file is accessible
                storage_url = clip.get("storage_url_mp4")
                if storage_url:
                    full_url = BASE_URL.replace("/api", "") + storage_url
                    head_resp = await client.head(full_url, follow_redirects=True)
                    if head_resp.status_code != 200:
                        fail_scenario(scenario, f"Clip MP4 not accessible: {full_url} returned {head_resp.status_code}")
                        return
                    content_type = head_resp.headers.get("content-type", "")
                    if "video" not in content_type:
                        fail_scenario(scenario, f"Clip MP4 wrong content-type: {content_type}")
                        return
                    log(scenario, f"  Clip {clip.get('clip_title')[:30]}: MP4 accessible, captions_burned={clip.get('captions_burned')} ✓")
            
            pass_scenario(scenario, f"Caption burn-in verified ({len(clips)} clips)")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_c():
    """C) Credit deduction by video minutes"""
    scenario = "C_credit_deduction"
    log(scenario, "Starting credit deduction tests...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            # Step 1: Get initial balance
            resp = await client.get(f"{BASE_URL}/auth/me")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me returned {resp.status_code}")
                return
            
            me_data = resp.json()
            b1 = me_data.get("user", {}).get("credit_balance_minutes", 0)
            log(scenario, f"Initial balance: {b1} minutes")
            
            # Step 2: Upload 90s video
            log(scenario, "Uploading 90s video...")
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
                fail_scenario(scenario, f"Upload returned {resp.status_code}: {resp.text[:500]}")
                return
            
            video_id = resp.json().get("video_id")
            log(scenario, f"Polling video {video_id} for completion...")
            video_doc = await poll_video_completion(client, video_id, timeout=90)
            
            if "error" in video_doc:
                fail_scenario(scenario, f"Polling failed: {video_doc['error']}")
                return
            
            # Step 3: Check new balance
            resp = await client.get(f"{BASE_URL}/auth/me")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me (2) returned {resp.status_code}")
                return
            
            b2 = resp.json().get("user", {}).get("credit_balance_minutes", 0)
            log(scenario, f"New balance: {b2} minutes")
            
            # Expected deduction: ceil(90/60) = 2
            expected_deduction = 2
            actual_deduction = b1 - b2
            if actual_deduction != expected_deduction:
                fail_scenario(scenario, f"Expected deduction of {expected_deduction} minutes, got {actual_deduction}")
                return
            
            log(scenario, f"✓ Correct deduction: {actual_deduction} minutes")
            
            # Step 4: Verify credits_charged in video doc
            if "credits_charged" not in video_doc:
                fail_scenario(scenario, "Video doc missing 'credits_charged' field")
                return
            
            credits_charged = video_doc.get("credits_charged")
            if credits_charged != expected_deduction:
                fail_scenario(scenario, f"credits_charged={credits_charged}, expected {expected_deduction}")
                return
            
            log(scenario, f"✓ credits_charged field correct: {credits_charged}")
            
            # Step 5: Verify transaction record
            resp = await client.get(f"{BASE_URL}/transactions")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /transactions returned {resp.status_code}")
                return
            
            transactions = resp.json()
            if not isinstance(transactions, list):
                fail_scenario(scenario, f"GET /transactions returned non-list: {type(transactions)}")
                return
            
            # Find the video_processing transaction
            video_txn = None
            for txn in transactions:
                if txn.get("reason") == "video_processing" and txn.get("video_id") == video_id:
                    video_txn = txn
                    break
            
            if not video_txn:
                fail_scenario(scenario, f"No transaction found for video_id={video_id} with reason='video_processing'")
                return
            
            log(scenario, f"✓ Transaction record found: amount={video_txn.get('amount')}, reason={video_txn.get('reason')}")
            
            # Step 6: Test insufficient credits
            log(scenario, "Testing insufficient credits scenario...")
            # Set balance to 0 via MongoDB
            mongo_client = MongoClient(MONGO_URL)
            db = mongo_client[DB_NAME]
            db.profiles.update_one(
                {"id": DEFAULT_USER_ID},
                {"$set": {"credit_balance_minutes": 0}}
            )
            log(scenario, "Set balance to 0 via MongoDB")
            
            # Try to upload
            with open(SAMPLE_VIDEO, "rb") as f:
                files = {"file": ("sample.mp4", f, "video/mp4")}
                data = {
                    "kind": "workspace_video",
                    "clip_min": "10",
                    "clip_max": "30",
                    "add_captions": "true"
                }
                resp = await client.post(f"{BASE_URL}/upload", files=files, data=data)
            
            if resp.status_code != 402:
                fail_scenario(scenario, f"Expected 402 for insufficient credits, got {resp.status_code}: {resp.text[:500]}")
                # Restore balance
                db.profiles.update_one({"id": DEFAULT_USER_ID}, {"$set": {"credit_balance_minutes": 1000}})
                return
            
            error_data = resp.json()
            if "error" not in error_data or "Insufficient credits" not in error_data.get("error", ""):
                fail_scenario(scenario, f"Expected 'Insufficient credits' error, got: {error_data}")
                # Restore balance
                db.profiles.update_one({"id": DEFAULT_USER_ID}, {"$set": {"credit_balance_minutes": 1000}})
                return
            
            log(scenario, f"✓ Insufficient credits error: {error_data.get('error')[:100]}")
            
            # Restore balance
            db.profiles.update_one({"id": DEFAULT_USER_ID}, {"$set": {"credit_balance_minutes": 1000}})
            log(scenario, "Restored balance to 1000 minutes")
            
            pass_scenario(scenario, "Credit deduction working correctly")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception: {e}")
            # Try to restore balance
            try:
                mongo_client = MongoClient(MONGO_URL)
                db = mongo_client[DB_NAME]
                db.profiles.update_one({"id": DEFAULT_USER_ID}, {"$set": {"credit_balance_minutes": 1000}})
            except:
                pass


async def test_scenario_d():
    """D) Package purchase (simulated)"""
    scenario = "D_package_purchase"
    log(scenario, "Starting package purchase tests...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Step 1: Get pricing packages
            resp = await client.get(f"{BASE_URL}/pricing-packages")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /pricing-packages returned {resp.status_code}")
                return
            
            packages = resp.json()
            if not isinstance(packages, list) or not packages:
                fail_scenario(scenario, f"No packages found: {packages}")
                return
            
            # Find Starter Pack
            starter = None
            for pkg in packages:
                if "Starter" in pkg.get("name", ""):
                    starter = pkg
                    break
            
            if not starter:
                fail_scenario(scenario, "Starter Pack not found in pricing packages")
                return
            
            log(scenario, f"Found Starter Pack: {starter.get('name')}, price_usd={starter.get('price_usd')}, credits={starter.get('credit_amount_minutes')}")
            
            # Step 2: Get initial balance
            resp = await client.get(f"{BASE_URL}/auth/me")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me returned {resp.status_code}")
                return
            
            b1 = resp.json().get("user", {}).get("credit_balance_minutes", 0)
            log(scenario, f"Initial balance: {b1} minutes")
            
            # Step 3: Purchase monthly
            log(scenario, "Test 1: Monthly purchase")
            purchase_data = {
                "package_id": starter.get("id"),
                "billing_cycle": "month"
            }
            resp = await client.post(f"{BASE_URL}/packages/purchase", json=purchase_data)
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /packages/purchase returned {resp.status_code}: {resp.text[:500]}")
                return
            
            purchase_resp = resp.json()
            log(scenario, f"Purchase response: {json.dumps(purchase_resp, indent=2)}")
            
            # Verify response fields
            if not purchase_resp.get("ok"):
                fail_scenario(scenario, f"Purchase not ok: {purchase_resp}")
                return
            
            expected_credits = starter.get("credit_amount_minutes", 300)
            if purchase_resp.get("credits_added") != expected_credits:
                fail_scenario(scenario, f"Expected credits_added={expected_credits}, got {purchase_resp.get('credits_added')}")
                return
            
            expected_balance = b1 + expected_credits
            if purchase_resp.get("new_balance_minutes") != expected_balance:
                fail_scenario(scenario, f"Expected new_balance={expected_balance}, got {purchase_resp.get('new_balance_minutes')}")
                return
            
            expected_amount = starter.get("price_usd", 6.99)
            if abs(purchase_resp.get("amount_paid", 0) - expected_amount) > 0.01:
                fail_scenario(scenario, f"Expected amount_paid={expected_amount}, got {purchase_resp.get('amount_paid')}")
                return
            
            if purchase_resp.get("currency") != "USD":
                fail_scenario(scenario, f"Expected currency=USD, got {purchase_resp.get('currency')}")
                return
            
            if purchase_resp.get("payment_status") != "completed_simulated":
                fail_scenario(scenario, f"Expected payment_status=completed_simulated, got {purchase_resp.get('payment_status')}")
                return
            
            if not purchase_resp.get("transaction_id"):
                fail_scenario(scenario, "Missing transaction_id")
                return
            
            log(scenario, f"✓ Monthly purchase successful: +{expected_credits} credits, paid ${expected_amount}")
            
            # Step 4: Verify balance updated
            resp = await client.get(f"{BASE_URL}/auth/me")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /auth/me (2) returned {resp.status_code}")
                return
            
            b2 = resp.json().get("user", {}).get("credit_balance_minutes", 0)
            if b2 != expected_balance:
                fail_scenario(scenario, f"Balance mismatch: expected {expected_balance}, got {b2}")
                return
            
            log(scenario, f"✓ Balance verified: {b2} minutes")
            
            # Step 5: Verify transaction record
            resp = await client.get(f"{BASE_URL}/transactions")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /transactions returned {resp.status_code}")
                return
            
            transactions = resp.json()
            if not isinstance(transactions, list):
                fail_scenario(scenario, f"GET /transactions returned non-list")
                return
            
            # Find the package_purchase transaction
            pkg_txn = None
            for txn in transactions:
                if txn.get("reason") == "package_purchase" and txn.get("package_name") == starter.get("name"):
                    pkg_txn = txn
                    break
            
            if not pkg_txn:
                fail_scenario(scenario, f"No transaction found with reason='package_purchase'")
                return
            
            log(scenario, f"✓ Transaction record found: amount={pkg_txn.get('amount')}, package={pkg_txn.get('package_name')}")
            
            # Step 6: Test yearly purchase
            log(scenario, "Test 2: Yearly purchase")
            b_before_yearly = b2
            purchase_data = {
                "package_id": starter.get("id"),
                "billing_cycle": "year"
            }
            resp = await client.post(f"{BASE_URL}/packages/purchase", json=purchase_data)
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /packages/purchase (yearly) returned {resp.status_code}: {resp.text[:500]}")
                return
            
            yearly_resp = resp.json()
            expected_yearly_credits = expected_credits * 12
            if yearly_resp.get("credits_added") != expected_yearly_credits:
                fail_scenario(scenario, f"Expected yearly credits_added={expected_yearly_credits}, got {yearly_resp.get('credits_added')}")
                return
            
            # Yearly discount: 12 * price * 0.8
            expected_yearly_amount = round(starter.get("price_usd", 6.99) * 12 * 0.8, 2)
            actual_yearly_amount = yearly_resp.get("amount_paid", 0)
            if abs(actual_yearly_amount - expected_yearly_amount) > 0.1:
                fail_scenario(scenario, f"Expected yearly amount≈{expected_yearly_amount}, got {actual_yearly_amount}")
                return
            
            log(scenario, f"✓ Yearly purchase successful: +{expected_yearly_credits} credits, paid ${actual_yearly_amount}")
            
            # Step 7: Test coupon
            log(scenario, "Test 3: Coupon code LAUNCH25")
            b_before_coupon = yearly_resp.get("new_balance_minutes", 0)
            
            # Get coupon redemptions before
            resp = await client.get(f"{BASE_URL}/admin/coupons?admin=true")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /admin/coupons returned {resp.status_code}")
                return
            
            coupons = resp.json()
            launch25 = None
            for c in coupons:
                if c.get("code") == "LAUNCH25":
                    launch25 = c
                    break
            
            if not launch25:
                fail_scenario(scenario, "LAUNCH25 coupon not found")
                return
            
            redemptions_before = launch25.get("current_redemptions", 0)
            log(scenario, f"LAUNCH25 redemptions before: {redemptions_before}")
            
            purchase_data = {
                "package_id": starter.get("id"),
                "billing_cycle": "month",
                "coupon_code": "LAUNCH25"
            }
            resp = await client.post(f"{BASE_URL}/packages/purchase", json=purchase_data)
            if resp.status_code != 200:
                fail_scenario(scenario, f"POST /packages/purchase (coupon) returned {resp.status_code}: {resp.text[:500]}")
                return
            
            coupon_resp = resp.json()
            
            # Verify coupon applied
            if coupon_resp.get("coupon_applied") != "LAUNCH25":
                fail_scenario(scenario, f"Expected coupon_applied=LAUNCH25, got {coupon_resp.get('coupon_applied')}")
                return
            
            # 25% discount
            expected_coupon_amount = round(starter.get("price_usd", 6.99) * 0.75, 2)
            actual_coupon_amount = coupon_resp.get("amount_paid", 0)
            if abs(actual_coupon_amount - expected_coupon_amount) > 0.1:
                fail_scenario(scenario, f"Expected coupon amount≈{expected_coupon_amount}, got {actual_coupon_amount}")
                return
            
            log(scenario, f"✓ Coupon purchase successful: paid ${actual_coupon_amount} (25% off)")
            
            # Verify redemptions incremented
            resp = await client.get(f"{BASE_URL}/admin/coupons?admin=true")
            if resp.status_code != 200:
                fail_scenario(scenario, f"GET /admin/coupons (2) returned {resp.status_code}")
                return
            
            coupons = resp.json()
            launch25_after = None
            for c in coupons:
                if c.get("code") == "LAUNCH25":
                    launch25_after = c
                    break
            
            redemptions_after = launch25_after.get("current_redemptions", 0)
            if redemptions_after != redemptions_before + 1:
                fail_scenario(scenario, f"Expected redemptions={redemptions_before + 1}, got {redemptions_after}")
                return
            
            log(scenario, f"✓ Coupon redemptions incremented: {redemptions_before} → {redemptions_after}")
            
            # Step 8: Test bad package
            log(scenario, "Test 4: Bad package ID")
            purchase_data = {
                "package_id": "nonexistent-package-id",
                "billing_cycle": "month"
            }
            resp = await client.post(f"{BASE_URL}/packages/purchase", json=purchase_data)
            if resp.status_code != 404:
                fail_scenario(scenario, f"Expected 404 for bad package, got {resp.status_code}")
                return
            
            error_data = resp.json()
            if "error" not in error_data or "not found" not in error_data.get("error", "").lower():
                fail_scenario(scenario, f"Expected 'not found' error, got: {error_data}")
                return
            
            log(scenario, f"✓ Bad package error: {error_data.get('error')}")
            
            pass_scenario(scenario, "Package purchase working correctly")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception: {e}")


async def test_scenario_e():
    """E) JSON sanity sweep"""
    scenario = "E_json_sanity"
    log(scenario, "Starting JSON sanity sweep...")
    
    endpoints = [
        "/clips",
        "/pricing-packages",
        "/auth/me",
        "/geo",
        "/memes",
        "/admin/integrations?admin=true",
        "/admin/analytics?admin=true",
        "/transactions",
        "/coupons/validate?code=LAUNCH25",
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            for endpoint in endpoints:
                url = f"{BASE_URL}{endpoint}"
                log(scenario, f"Testing {endpoint}...")
                
                resp = await client.get(url)
                
                # Check status code is 2xx or 4xx (not 5xx)
                if resp.status_code >= 500:
                    fail_scenario(scenario, f"{endpoint} returned {resp.status_code}: {resp.text[:500]}")
                    return
                
                # Check content-type is JSON
                content_type = resp.headers.get("content-type", "")
                if "json" not in content_type.lower():
                    fail_scenario(scenario, f"{endpoint} returned non-JSON content-type: {content_type}")
                    return
                
                # Try to parse JSON
                try:
                    data = resp.json()
                except Exception as e:
                    fail_scenario(scenario, f"{endpoint} returned invalid JSON: {e}. Body: {resp.text[:500]}")
                    return
                
                # Check for HTML/stderr leaks
                body_text = resp.text
                if "<html" in body_text.lower() or "<!doctype" in body_text.lower():
                    fail_scenario(scenario, f"{endpoint} returned HTML: {body_text[:500]}")
                    return
                
                if "traceback" in body_text.lower() or "stderr" in body_text.lower():
                    fail_scenario(scenario, f"{endpoint} leaked stderr/traceback: {body_text[:500]}")
                    return
                
                log(scenario, f"  ✓ {endpoint}: {resp.status_code}, valid JSON")
            
            pass_scenario(scenario, f"All {len(endpoints)} endpoints returned clean JSON")
            
        except Exception as e:
            fail_scenario(scenario, f"Exception: {e}")


async def main():
    """Run all test scenarios"""
    print("=" * 80)
    print("ClipForge AI Backend Test Suite")
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
    
    # Run scenarios
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
        emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏸️"
        print(f"{emoji} {scenario}: {status}")
    
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
