#!/usr/bin/env python3
"""
Backend test suite for ClipForge AI video upload + processing + Whisper transcription pipeline.
Tests all 5 test cases from the review request.
"""
import os
import sys
import time
import json
import requests
import subprocess
from pathlib import Path

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://shorts-studio-78.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
SAMPLE_VIDEO_PATH = "/tmp/sample.mp4"
EMPTY_FILE_PATH = "/tmp/empty.mp4"

# Test results tracking
test_results = {
    "test_1_healthy_upload": {"status": "NOT_RUN", "details": "", "timing": 0},
    "test_2_transcription_source": {"status": "NOT_RUN", "details": "", "timing": 0},
    "test_3_error_empty_file": {"status": "NOT_RUN", "details": "", "timing": 0},
    "test_4_json_sanity": {"status": "NOT_RUN", "details": "", "timing": 0},
    "test_5_url_ingestion": {"status": "NOT_RUN", "details": "", "timing": 0},
}

def log(msg):
    """Print with timestamp"""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def generate_sample_video():
    """Generate a 90-second test video using ffmpeg"""
    log("Generating 90-second sample video...")
    try:
        cmd = [
            '/usr/bin/ffmpeg', '-y',
            '-f', 'lavfi', '-i', 'testsrc=duration=90:size=640x480:rate=30',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=90',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '64k', '-t', '90',
            SAMPLE_VIDEO_PATH
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            raise Exception(f"ffmpeg failed: {result.stderr.decode()[:200]}")
        
        size = os.path.getsize(SAMPLE_VIDEO_PATH)
        log(f"✓ Generated sample video: {size} bytes")
        return True
    except Exception as e:
        log(f"✗ Failed to generate video: {e}")
        return False

def create_empty_file():
    """Create a 0-byte file for error testing"""
    Path(EMPTY_FILE_PATH).touch()
    log(f"✓ Created empty file at {EMPTY_FILE_PATH}")

def test_1_healthy_upload_pipeline():
    """
    TEST 1: Healthy upload + full pipeline
    - Upload 90s mp4
    - Poll until completed
    - Verify clips with all required fields
    - Test clip file streaming (GET + HEAD)
    """
    log("\n" + "="*80)
    log("TEST 1: Healthy upload + full pipeline")
    log("="*80)
    
    start_time = time.time()
    
    try:
        # Step 1: Upload video
        log("Step 1: Uploading video...")
        with open(SAMPLE_VIDEO_PATH, 'rb') as f:
            files = {'file': ('sample.mp4', f, 'video/mp4')}
            data = {'kind': 'workspace_video'}
            response = requests.post(f"{API_URL}/upload", files=files, data=data, timeout=30)
        
        if response.status_code != 200:
            raise Exception(f"Upload failed: HTTP {response.status_code}, body: {response.text[:500]}")
        
        # Verify response is valid JSON
        try:
            upload_data = response.json()
        except json.JSONDecodeError as e:
            raise Exception(f"Upload response is not valid JSON: {response.text[:500]}")
        
        # Verify required fields
        required_fields = ['video_id', 'status', 'title', 'size']
        missing = [f for f in required_fields if f not in upload_data]
        if missing:
            raise Exception(f"Upload response missing fields: {missing}. Got: {upload_data}")
        
        video_id = upload_data['video_id']
        log(f"✓ Upload successful: video_id={video_id}, status={upload_data['status']}, size={upload_data['size']}")
        
        # Step 2: Poll until completed
        log("Step 2: Polling for completion (max 90s)...")
        poll_start = time.time()
        max_poll_time = 90
        poll_interval = 3
        last_status = None
        last_progress = 0
        
        while time.time() - poll_start < max_poll_time:
            response = requests.get(f"{API_URL}/videos/{video_id}", timeout=10)
            
            if response.status_code != 200:
                raise Exception(f"Poll failed: HTTP {response.status_code}, body: {response.text[:500]}")
            
            # Verify valid JSON
            try:
                video_data = response.json()
            except json.JSONDecodeError:
                raise Exception(f"Poll response is not valid JSON: {response.text[:500]}")
            
            # Verify required fields in poll response
            poll_required = ['id', 'status', 'progress']
            missing = [f for f in poll_required if f not in video_data]
            if missing:
                raise Exception(f"Poll response missing fields: {missing}. Got: {list(video_data.keys())}")
            
            status = video_data['status']
            progress = video_data.get('progress', 0)
            
            if status != last_status or progress != last_progress:
                log(f"  Status: {status}, Progress: {progress}%")
                last_status = status
                last_progress = progress
            
            if status == 'completed':
                log(f"✓ Processing completed in {time.time() - poll_start:.1f}s")
                break
            elif status == 'failed':
                error_msg = video_data.get('error_message', 'Unknown error')
                raise Exception(f"Processing failed: {error_msg}")
            
            time.sleep(poll_interval)
        else:
            raise Exception(f"Polling timeout after {max_poll_time}s. Last status: {last_status}")
        
        # Step 3: Verify completed video data
        log("Step 3: Verifying completed video data...")
        
        if 'clip_count' not in video_data or video_data['clip_count'] < 1:
            raise Exception(f"Expected clip_count >= 1, got: {video_data.get('clip_count')}")
        
        if 'clips' not in video_data or not isinstance(video_data['clips'], list) or len(video_data['clips']) == 0:
            raise Exception(f"Expected non-empty clips array, got: {video_data.get('clips')}")
        
        log(f"✓ Video has {video_data['clip_count']} clips")
        
        # Step 4: Verify each clip
        log("Step 4: Verifying clip data...")
        for i, clip in enumerate(video_data['clips']):
            clip_id = clip.get('id', f'clip_{i}')
            
            # Check required fields
            required_clip_fields = [
                'storage_url_mp4', 'transcript_segment', 'virality_score',
                'start_time_seconds', 'end_time_seconds'
            ]
            missing = [f for f in required_clip_fields if f not in clip]
            if missing:
                raise Exception(f"Clip {clip_id} missing fields: {missing}")
            
            # Verify storage_url_mp4 starts with /api/files/clips/
            if not clip['storage_url_mp4'].startswith('/api/files/clips/'):
                raise Exception(f"Clip {clip_id} storage_url_mp4 doesn't start with /api/files/clips/: {clip['storage_url_mp4']}")
            
            # Verify transcript_segment is a string
            if not isinstance(clip['transcript_segment'], str):
                raise Exception(f"Clip {clip_id} transcript_segment is not a string: {type(clip['transcript_segment'])}")
            
            # Verify virality_score is 50-99
            score = clip['virality_score']
            if not (50 <= score <= 99):
                raise Exception(f"Clip {clip_id} virality_score {score} not in range 50-99")
            
            # Verify time range
            start = clip['start_time_seconds']
            end = clip['end_time_seconds']
            if start >= end:
                raise Exception(f"Clip {clip_id} start_time {start} >= end_time {end}")
            
            duration = end - start
            if not (15 <= duration <= 60):
                raise Exception(f"Clip {clip_id} duration {duration}s not in range 15-60s")
            
            log(f"  ✓ Clip {i+1}: {clip.get('clip_title', 'Untitled')[:40]}, {duration}s, score={score}")
        
        # Step 5: Test clip file streaming (GET)
        log("Step 5: Testing clip file streaming (GET)...")
        first_clip = video_data['clips'][0]
        clip_url = f"{BASE_URL}{first_clip['storage_url_mp4']}"
        
        response = requests.get(clip_url, timeout=30)
        if response.status_code != 200:
            raise Exception(f"GET clip failed: HTTP {response.status_code}")
        
        content_type = response.headers.get('content-type', '')
        if 'video/mp4' not in content_type:
            raise Exception(f"GET clip wrong content-type: {content_type}")
        
        content_length = int(response.headers.get('content-length', 0))
        if content_length < 100000:
            raise Exception(f"GET clip content-length too small: {content_length}")
        
        log(f"✓ GET clip successful: {content_length} bytes, content-type={content_type}")
        
        # Step 6: Test clip file streaming (HEAD)
        log("Step 6: Testing clip file streaming (HEAD)...")
        response = requests.head(clip_url, timeout=10)
        if response.status_code != 200:
            raise Exception(f"HEAD clip failed: HTTP {response.status_code}")
        
        content_type = response.headers.get('content-type', '')
        if 'video/mp4' not in content_type:
            raise Exception(f"HEAD clip wrong content-type: {content_type}")
        
        content_length = response.headers.get('content-length')
        if not content_length:
            raise Exception("HEAD clip missing content-length header")
        
        if len(response.content) > 0:
            raise Exception(f"HEAD clip returned body (should be empty): {len(response.content)} bytes")
        
        log(f"✓ HEAD clip successful: content-length={content_length}, no body")
        
        # Success
        elapsed = time.time() - start_time
        test_results["test_1_healthy_upload"]["status"] = "PASS"
        test_results["test_1_healthy_upload"]["details"] = f"Uploaded, processed, verified {video_data['clip_count']} clips, tested streaming"
        test_results["test_1_healthy_upload"]["timing"] = elapsed
        log(f"\n✓ TEST 1 PASSED in {elapsed:.1f}s")
        
        return video_data
        
    except Exception as e:
        elapsed = time.time() - start_time
        test_results["test_1_healthy_upload"]["status"] = "FAIL"
        test_results["test_1_healthy_upload"]["details"] = str(e)
        test_results["test_1_healthy_upload"]["timing"] = elapsed
        log(f"\n✗ TEST 1 FAILED: {e}")
        return None

def test_2_transcription_source(video_data):
    """
    TEST 2: Transcription source verification
    - Check transcription_source field in completed video
    - If 'none', verify no OpenAI key in integrations
    - If OpenAI key present, expect 'whisper'
    """
    log("\n" + "="*80)
    log("TEST 2: Transcription source verification")
    log("="*80)
    
    start_time = time.time()
    
    try:
        if not video_data:
            raise Exception("No video data from test 1 (test 1 must pass first)")
        
        # Check transcription_source in video data
        transcription_source = video_data.get('transcription_source', 'none')
        log(f"Video transcription_source: {transcription_source}")
        
        if transcription_source not in ['whisper', 'youtube-auto', 'none']:
            raise Exception(f"Invalid transcription_source: {transcription_source}")
        
        # Check integrations for OpenAI key
        log("Checking admin integrations for OpenAI key...")
        response = requests.get(f"{API_URL}/admin/integrations?admin=true", timeout=10)
        
        if response.status_code != 200:
            raise Exception(f"Failed to get integrations: HTTP {response.status_code}")
        
        try:
            integrations = response.json()
        except json.JSONDecodeError:
            raise Exception(f"Integrations response is not valid JSON: {response.text[:500]}")
        
        # Look for OpenAI integration
        openai_integration = None
        for integ in integrations:
            if integ.get('provider') == 'openai':
                openai_integration = integ
                break
        
        has_openai_key = False
        if openai_integration:
            has_creds = openai_integration.get('has_credentials', False)
            creds = openai_integration.get('credentials', {})
            api_key = creds.get('api_key', '')
            # Check if key exists and is not empty/masked placeholder
            if api_key and api_key not in ['', '****'] and not api_key.startswith('••••'):
                has_openai_key = True
        
        log(f"OpenAI key present: {has_openai_key}")
        
        # Verify logic
        if transcription_source == 'none' and has_openai_key:
            log("⚠ Warning: OpenAI key is present but transcription_source is 'none' (may be expected if Whisper failed)")
        elif transcription_source == 'whisper' and not has_openai_key:
            raise Exception("transcription_source is 'whisper' but no OpenAI key found in integrations")
        
        # Success
        elapsed = time.time() - start_time
        test_results["test_2_transcription_source"]["status"] = "PASS"
        test_results["test_2_transcription_source"]["details"] = f"transcription_source={transcription_source}, has_openai_key={has_openai_key}"
        test_results["test_2_transcription_source"]["timing"] = elapsed
        log(f"\n✓ TEST 2 PASSED in {elapsed:.1f}s")
        
    except Exception as e:
        elapsed = time.time() - start_time
        test_results["test_2_transcription_source"]["status"] = "FAIL"
        test_results["test_2_transcription_source"]["details"] = str(e)
        test_results["test_2_transcription_source"]["timing"] = elapsed
        log(f"\n✗ TEST 2 FAILED: {e}")

def test_3_error_empty_file():
    """
    TEST 3: Error path - empty file
    - Upload 0-byte file
    - Verify response is still valid JSON
    - Poll until status='failed'
    - Verify error_message is non-empty
    """
    log("\n" + "="*80)
    log("TEST 3: Error path - empty file")
    log("="*80)
    
    start_time = time.time()
    
    try:
        # Upload empty file
        log("Uploading 0-byte file...")
        with open(EMPTY_FILE_PATH, 'rb') as f:
            files = {'file': ('empty.mp4', f, 'video/mp4')}
            data = {'kind': 'workspace_video'}
            response = requests.post(f"{API_URL}/upload", files=files, data=data, timeout=30)
        
        # Verify response is valid JSON (not HTML)
        try:
            upload_data = response.json()
        except json.JSONDecodeError:
            raise Exception(f"Upload response is not valid JSON: {response.text[:500]}")
        
        if '<html' in response.text.lower() or '<!doctype' in response.text.lower():
            raise Exception(f"Upload response contains HTML: {response.text[:500]}")
        
        log(f"✓ Upload response is valid JSON: {upload_data}")
        
        # Get video_id
        video_id = upload_data.get('video_id')
        if not video_id:
            raise Exception(f"No video_id in response: {upload_data}")
        
        # Poll until failed
        log("Polling until status='failed' (max 60s)...")
        poll_start = time.time()
        max_poll_time = 60
        poll_interval = 3
        
        while time.time() - poll_start < max_poll_time:
            response = requests.get(f"{API_URL}/videos/{video_id}", timeout=10)
            
            # Verify valid JSON
            try:
                video_data = response.json()
            except json.JSONDecodeError:
                raise Exception(f"Poll response is not valid JSON: {response.text[:500]}")
            
            status = video_data.get('status')
            log(f"  Status: {status}")
            
            if status == 'failed':
                error_message = video_data.get('error_message', '')
                if not error_message or not isinstance(error_message, str):
                    raise Exception(f"error_message is empty or not a string: {error_message}")
                
                log(f"✓ Processing failed as expected with error: {error_message[:100]}")
                break
            
            time.sleep(poll_interval)
        else:
            raise Exception(f"Polling timeout after {max_poll_time}s. Expected status='failed'")
        
        # Success
        elapsed = time.time() - start_time
        test_results["test_3_error_empty_file"]["status"] = "PASS"
        test_results["test_3_error_empty_file"]["details"] = f"Empty file correctly failed with error: {error_message[:100]}"
        test_results["test_3_error_empty_file"]["timing"] = elapsed
        log(f"\n✓ TEST 3 PASSED in {elapsed:.1f}s")
        
    except Exception as e:
        elapsed = time.time() - start_time
        test_results["test_3_error_empty_file"]["status"] = "FAIL"
        test_results["test_3_error_empty_file"]["details"] = str(e)
        test_results["test_3_error_empty_file"]["timing"] = elapsed
        log(f"\n✗ TEST 3 FAILED: {e}")

def test_4_json_sanity():
    """
    TEST 4: JSON sanity sweep
    - Hit multiple GET endpoints
    - Verify all return valid JSON (no HTML, no NaN, no corruption)
    """
    log("\n" + "="*80)
    log("TEST 4: JSON sanity sweep")
    log("="*80)
    
    start_time = time.time()
    
    endpoints = [
        '/clips',
        '/pricing-packages',
        '/auth/me',
        '/geo',
        '/memes',
        '/admin/integrations?admin=true',
        '/admin/analytics?admin=true',
    ]
    
    try:
        for endpoint in endpoints:
            url = f"{API_URL}{endpoint}"
            log(f"Testing {endpoint}...")
            
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                raise Exception(f"{endpoint} returned HTTP {response.status_code}")
            
            # Check for HTML
            if '<html' in response.text.lower() or '<!doctype' in response.text.lower():
                raise Exception(f"{endpoint} returned HTML: {response.text[:500]}")
            
            # Check for common corruption patterns
            if 'null{' in response.text or 'null[' in response.text:
                raise Exception(f"{endpoint} has null corruption: {response.text[:500]}")
            
            if 'NaN' in response.text:
                raise Exception(f"{endpoint} contains NaN token: {response.text[:500]}")
            
            # Parse JSON
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                raise Exception(f"{endpoint} is not valid JSON: {e}, body: {response.text[:500]}")
            
            log(f"  ✓ {endpoint} returned valid JSON ({len(response.text)} bytes)")
        
        # Success
        elapsed = time.time() - start_time
        test_results["test_4_json_sanity"]["status"] = "PASS"
        test_results["test_4_json_sanity"]["details"] = f"All {len(endpoints)} endpoints returned valid JSON"
        test_results["test_4_json_sanity"]["timing"] = elapsed
        log(f"\n✓ TEST 4 PASSED in {elapsed:.1f}s")
        
    except Exception as e:
        elapsed = time.time() - start_time
        test_results["test_4_json_sanity"]["status"] = "FAIL"
        test_results["test_4_json_sanity"]["details"] = str(e)
        test_results["test_4_json_sanity"]["timing"] = elapsed
        log(f"\n✗ TEST 4 FAILED: {e}")

def test_5_url_ingestion():
    """
    TEST 5: Backward compatibility - URL ingestion
    - POST /api/ai/analyze with YouTube URL
    - Verify response is valid JSON
    - Poll until completed or failed
    - If failed, verify error_message is set and response is still valid JSON
    """
    log("\n" + "="*80)
    log("TEST 5: Backward compatibility - URL ingestion")
    log("="*80)
    
    start_time = time.time()
    
    try:
        # POST URL
        log("Posting YouTube URL to /api/ai/analyze...")
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        response = requests.post(f"{API_URL}/ai/analyze", json={"url": url}, timeout=30)
        
        if response.status_code != 200:
            raise Exception(f"POST /api/ai/analyze failed: HTTP {response.status_code}, body: {response.text[:500]}")
        
        # Verify valid JSON
        try:
            analyze_data = response.json()
        except json.JSONDecodeError:
            raise Exception(f"POST response is not valid JSON: {response.text[:500]}")
        
        # Verify required fields
        if 'video_id' not in analyze_data or 'status' not in analyze_data:
            raise Exception(f"POST response missing video_id or status: {analyze_data}")
        
        video_id = analyze_data['video_id']
        log(f"✓ POST successful: video_id={video_id}, status={analyze_data['status']}")
        
        # Poll until completed or failed
        log("Polling for completion or failure (max 90s)...")
        poll_start = time.time()
        max_poll_time = 90
        poll_interval = 3
        
        while time.time() - poll_start < max_poll_time:
            response = requests.get(f"{API_URL}/videos/{video_id}", timeout=10)
            
            # Verify valid JSON
            try:
                video_data = response.json()
            except json.JSONDecodeError:
                raise Exception(f"Poll response is not valid JSON: {response.text[:500]}")
            
            status = video_data.get('status')
            log(f"  Status: {status}")
            
            if status == 'completed':
                log(f"✓ Processing completed successfully")
                break
            elif status == 'failed':
                error_message = video_data.get('error_message', '')
                if not error_message:
                    raise Exception("status='failed' but error_message is empty")
                
                # Check if error mentions YouTube/download (expected)
                if 'youtube' in error_message.lower() or 'download' in error_message.lower():
                    log(f"✓ Processing failed as expected (YouTube blocked): {error_message[:100]}")
                else:
                    log(f"⚠ Processing failed with unexpected error: {error_message[:100]}")
                break
            
            time.sleep(poll_interval)
        else:
            raise Exception(f"Polling timeout after {max_poll_time}s")
        
        # Success
        elapsed = time.time() - start_time
        test_results["test_5_url_ingestion"]["status"] = "PASS"
        test_results["test_5_url_ingestion"]["details"] = f"URL ingestion works, final status={status}"
        test_results["test_5_url_ingestion"]["timing"] = elapsed
        log(f"\n✓ TEST 5 PASSED in {elapsed:.1f}s")
        
    except Exception as e:
        elapsed = time.time() - start_time
        test_results["test_5_url_ingestion"]["status"] = "FAIL"
        test_results["test_5_url_ingestion"]["details"] = str(e)
        test_results["test_5_url_ingestion"]["timing"] = elapsed
        log(f"\n✗ TEST 5 FAILED: {e}")

def print_summary():
    """Print test summary"""
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    for test_name, result in test_results.items():
        status_icon = "✓" if result["status"] == "PASS" else "✗" if result["status"] == "FAIL" else "○"
        log(f"{status_icon} {test_name}: {result['status']} ({result['timing']:.1f}s)")
        if result["details"]:
            log(f"  Details: {result['details'][:200]}")
    
    # Overall result
    passed = sum(1 for r in test_results.values() if r["status"] == "PASS")
    failed = sum(1 for r in test_results.values() if r["status"] == "FAIL")
    total = len(test_results)
    
    log("\n" + "="*80)
    log(f"OVERALL: {passed}/{total} tests passed, {failed}/{total} tests failed")
    log("="*80)
    
    return failed == 0

def main():
    """Main test runner"""
    log("="*80)
    log("ClipForge AI Backend Test Suite")
    log(f"Base URL: {BASE_URL}")
    log(f"API URL: {API_URL}")
    log("="*80)
    
    # Setup
    if not generate_sample_video():
        log("✗ Failed to generate sample video. Aborting.")
        sys.exit(1)
    
    create_empty_file()
    
    # Run tests
    video_data = test_1_healthy_upload_pipeline()
    test_2_transcription_source(video_data)
    test_3_error_empty_file()
    test_4_json_sanity()
    test_5_url_ingestion()
    
    # Summary
    success = print_summary()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
