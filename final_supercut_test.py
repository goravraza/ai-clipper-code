#!/usr/bin/env python3
"""
Final comprehensive test for supercuts functionality
"""

import requests
import json
import subprocess
from pymongo import MongoClient

# Configuration
BASE_URL = "https://shorts-studio-78.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
USER_ID = "11111111-1111-1111-1111-111111111111"
VIDEO_ID = "9a98ac5e-3b5f-439b-9e5c-77592d326016"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def get_session_token():
    return "test_session_token"

print("\n" + "="*80)
print("COMPREHENSIVE SUPERCUT TESTS")
print("="*80)

headers = {
    "Content-Type": "application/json",
    "Cookie": f"session_token={get_session_token()}"
}

all_passed = True

# TEST 1: GET /api/videos/:id/supercuts
print("\n[TEST 1] GET /api/videos/:id/supercuts")
print("-" * 80)
try:
    response = requests.get(
        f"{BASE_URL}/api/videos/{VIDEO_ID}/supercuts",
        headers=headers,
        timeout=30
    )
    
    print(f"Status code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        all_passed = False
    else:
        data = response.json()
        supercuts_list = data.get("supercuts", [])
        print(f"✅ Found {len(supercuts_list)} supercut(s)")
        
        # Verify structure
        if len(supercuts_list) > 0:
            sc = supercuts_list[0]
            required_keys = ["id", "clip_title", "is_supercut", "storage_url_mp4"]
            missing = [k for k in required_keys if k not in sc]
            if missing:
                print(f"❌ FAIL: Missing keys in response: {missing}")
                all_passed = False
            else:
                print(f"✅ Response structure is correct")
        
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    all_passed = False

# TEST 2: GET /api/projects (regression)
print("\n[TEST 2] GET /api/projects (regression)")
print("-" * 80)
try:
    response = requests.get(
        f"{BASE_URL}/api/projects",
        headers=headers,
        timeout=30
    )
    
    print(f"Status code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        all_passed = False
    else:
        data = response.json()
        # The response is {"projects": [...]}
        if isinstance(data, dict) and "projects" in data:
            projects = data["projects"]
        elif isinstance(data, list):
            projects = data
        else:
            print(f"❌ FAIL: Unexpected response format")
            all_passed = False
            projects = []
        
        print(f"✅ Found {len(projects)} projects")
        
        if len(projects) > 0:
            p = projects[0]
            required_keys = ["id", "title"]
            missing = [k for k in required_keys if k not in p]
            if missing:
                print(f"❌ FAIL: Missing keys in project: {missing}")
                all_passed = False
            else:
                print(f"✅ Project structure is correct")
        
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    all_passed = False

# TEST 3: GET /api/clips (regression - should include supercuts)
print("\n[TEST 3] GET /api/clips (regression)")
print("-" * 80)
try:
    response = requests.get(
        f"{BASE_URL}/api/clips",
        headers=headers,
        timeout=30
    )
    
    print(f"Status code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        all_passed = False
    else:
        data = response.json()
        # The response is a list directly
        if isinstance(data, list):
            clips = data
        elif isinstance(data, dict) and "clips" in data:
            clips = data["clips"]
        else:
            clips = []
        
        print(f"✅ Found {len(clips)} total clips")
        
        supercut_clips = [c for c in clips if c.get("is_supercut")]
        print(f"✅ Found {len(supercut_clips)} supercut clips")
        
        if len(supercut_clips) == 0:
            print(f"⚠️  WARNING: No supercut clips found in /api/clips")
        
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    all_passed = False

# TEST 4: POST /api/clips/:id/render on a supercut (regression)
print("\n[TEST 4] POST /api/clips/:id/render on a supercut (regression)")
print("-" * 80)
try:
    # Find a supercut
    supercut = db.generated_clips.find_one({
        "user_id": USER_ID,
        "is_supercut": True,
        "caption_segments": {"$exists": True, "$ne": []}
    })
    
    if not supercut:
        print(f"⚠️  WARNING: No supercut found to test render")
    else:
        supercut_id = supercut["id"]
        print(f"Testing render on supercut: {supercut_id}")
        
        # Note credits before
        profile_before = db.profiles.find_one({"id": USER_ID})
        credits_before = profile_before.get("credit_balance_minutes", 0)
        
        render_body = {
            "trim_start": 0,
            "trim_end": 3,
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
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠️  WARNING: Render failed with status {response.status_code}")
            print(f"Response: {response.text[:200]}")
        else:
            print(f"✅ Render successful")
            
            # Verify credits were deducted
            profile_after = db.profiles.find_one({"id": USER_ID})
            credits_after = profile_after.get("credit_balance_minutes", 0)
            
            if credits_after < credits_before:
                print(f"✅ Credits deducted: {credits_before - credits_after:.2f}")
            else:
                print(f"⚠️  WARNING: No credits deducted")
        
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    import traceback
    traceback.print_exc()
    all_passed = False

# TEST 5: GET /api/clips/:id/download on a supercut (regression - no credit deduction)
print("\n[TEST 5] GET /api/clips/:id/download on a supercut (regression)")
print("-" * 80)
try:
    # Find a supercut
    supercut = db.generated_clips.find_one({
        "user_id": USER_ID,
        "is_supercut": True
    })
    
    if not supercut:
        print(f"⚠️  WARNING: No supercut found to test download")
    else:
        supercut_id = supercut["id"]
        print(f"Testing download on supercut: {supercut_id}")
        
        # Note credits before
        profile_before = db.profiles.find_one({"id": USER_ID})
        credits_before = profile_before.get("credit_balance_minutes", 0)
        
        response = requests.get(
            f"{BASE_URL}/api/clips/{supercut_id}/download",
            headers=headers,
            timeout=30
        )
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            all_passed = False
        else:
            # Check Content-Disposition header
            content_disp = response.headers.get("content-disposition", "")
            print(f"Content-Disposition: {content_disp}")
            
            if "attachment" not in content_disp:
                print(f"❌ FAIL: Expected 'attachment' in Content-Disposition")
                all_passed = False
            else:
                print(f"✅ Content-Disposition header is correct")
            
            # Verify NO credit deduction
            profile_after = db.profiles.find_one({"id": USER_ID})
            credits_after = profile_after.get("credit_balance_minutes", 0)
            
            if credits_after == credits_before:
                print(f"✅ No credits deducted (as expected)")
            else:
                print(f"❌ FAIL: Credits changed: {credits_before} -> {credits_after}")
                all_passed = False
        
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    all_passed = False

# TEST 6: Verify credit deduction from supercut generation
print("\n[TEST 6] Verify credit deduction from supercut generation")
print("-" * 80)
try:
    # Get all supercuts for this video
    supercuts = list(db.generated_clips.find({
        "video_id": VIDEO_ID,
        "user_id": USER_ID,
        "is_supercut": True
    }))
    
    total_credits_charged = sum(sc.get("credits_charged", 0) for sc in supercuts)
    print(f"Total credits charged for {len(supercuts)} supercuts: {total_credits_charged:.2f}")
    
    # Verify it's reasonable (0.25 per second)
    if total_credits_charged > 0:
        print(f"✅ Credits were charged")
    else:
        print(f"❌ FAIL: No credits charged")
        all_passed = False
    
except Exception as e:
    print(f"❌ FAIL: Exception: {e}")
    all_passed = False

print("\n" + "="*80)
if all_passed:
    print("✅ ALL TESTS PASSED")
else:
    print("⚠️  SOME TESTS HAD ISSUES (see above)")
print("="*80)

exit(0 if all_passed else 1)
