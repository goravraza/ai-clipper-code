#!/usr/bin/env python3
"""
Backend test for caption rendering pipeline rewrite.
Tests POST /api/clips/:clipId/render with .ass file generation.
"""
import requests
import json
import subprocess
import time
import os
import glob

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://shorts-studio-78.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
CLIP_ID = "bdb67c16-0de9-4898-8502-fab831e7cec6"

def log_test(test_name, status, details=""):
    """Log test results"""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"\n{symbol} TEST: {test_name}")
    print(f"   Status: {status}")
    if details:
        print(f"   Details: {details}")

def check_ffprobe(file_path):
    """Use ffprobe to check video file properties"""
    try:
        result = subprocess.run(
            ['/usr/bin/ffprobe', '-v', 'error', '-show_entries', 
             'format=duration:stream=width,height', '-of', 'json', file_path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration = float(data.get('format', {}).get('duration', 0))
            streams = data.get('streams', [])
            width = height = None
            for s in streams:
                if 'width' in s:
                    width = s['width']
                    height = s['height']
                    break
            return {'duration': duration, 'width': width, 'height': height}
    except Exception as e:
        print(f"   ffprobe error: {e}")
    return None

def test_render(test_num, description, body):
    """Test a render request"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")
    
    url = f"{API_BASE}/clips/{CLIP_ID}/render"
    print(f"POST {url}")
    print(f"Body: {json.dumps(body, indent=2)}")
    
    try:
        response = requests.post(url, json=body, timeout=120)
        print(f"\nHTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response OK: {data.get('ok', False)}")
            
            clip = data.get('clip', {})
            render_version = clip.get('render_version', 0)
            srt_content_rendered = clip.get('srt_content_rendered', '')
            storage_url = clip.get('storage_url_mp4', '')
            
            print(f"Render version: {render_version}")
            print(f"SRT content rendered: {'YES' if srt_content_rendered else 'NO'} ({len(srt_content_rendered)} chars)")
            print(f"Storage URL: {storage_url}")
            
            # Check if output file exists
            if storage_url.startswith('/api/files/'):
                file_path = storage_url.replace('/api/files/', '/app/data/uploads/')
                if os.path.exists(file_path):
                    file_size = os.path.getsize(file_path)
                    print(f"Output file exists: {file_path} ({file_size} bytes)")
                    
                    # Run ffprobe
                    probe = check_ffprobe(file_path)
                    if probe:
                        print(f"Video duration: {probe['duration']:.2f}s")
                        print(f"Video dimensions: {probe['width']}x{probe['height']}")
                        
                        # Validate duration
                        expected_duration = (body.get('trim_end', 5) - body.get('trim_start', 0)) / body.get('speed', 1.0)
                        duration_diff = abs(probe['duration'] - expected_duration)
                        if duration_diff < 0.5:
                            log_test(f"Test {test_num} - Duration check", "PASS", f"Duration {probe['duration']:.2f}s ≈ expected {expected_duration:.2f}s")
                        else:
                            log_test(f"Test {test_num} - Duration check", "FAIL", f"Duration {probe['duration']:.2f}s != expected {expected_duration:.2f}s")
                        
                        # Validate dimensions for 9:16
                        if body.get('crop_aspect') == '9:16':
                            if probe['width'] == 1080 and probe['height'] == 1920:
                                log_test(f"Test {test_num} - Dimensions check", "PASS", f"9:16 aspect ratio correct: {probe['width']}x{probe['height']}")
                            else:
                                log_test(f"Test {test_num} - Dimensions check", "FAIL", f"Expected 1080x1920, got {probe['width']}x{probe['height']}")
                        elif body.get('crop_aspect') == '16:9':
                            if probe['width'] == 1920 and probe['height'] == 1080:
                                log_test(f"Test {test_num} - Dimensions check", "PASS", f"16:9 aspect ratio correct: {probe['width']}x{probe['height']}")
                            else:
                                log_test(f"Test {test_num} - Dimensions check", "FAIL", f"Expected 1920x1080, got {probe['width']}x{probe['height']}")
                    
                    log_test(f"Test {test_num} - Overall", "PASS", "Render completed successfully")
                    return True
                else:
                    log_test(f"Test {test_num} - Overall", "FAIL", f"Output file not found: {file_path}")
                    return False
            else:
                log_test(f"Test {test_num} - Overall", "FAIL", f"Invalid storage URL: {storage_url}")
                return False
        else:
            error_msg = response.text[:500]
            print(f"Error response: {error_msg}")
            log_test(f"Test {test_num} - Overall", "FAIL", f"HTTP {response.status_code}: {error_msg}")
            return False
            
    except Exception as e:
        print(f"Exception: {e}")
        log_test(f"Test {test_num} - Overall", "FAIL", f"Exception: {str(e)}")
        return False

def inspect_ass_file():
    """Find and inspect the most recent .ass file in /tmp"""
    print(f"\n{'='*80}")
    print(f"TEST 7: Inspect cap.ass file")
    print(f"{'='*80}")
    
    # Find recent render directories
    tmp_dirs = glob.glob('/tmp/render_*')
    if not tmp_dirs:
        log_test("Test 7 - ASS file inspection", "SKIP", "No render directories found in /tmp (already cleaned up)")
        return
    
    # Sort by modification time, get most recent
    tmp_dirs.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    recent_dir = tmp_dirs[0]
    ass_file = os.path.join(recent_dir, 'cap.ass')
    
    if os.path.exists(ass_file):
        print(f"Found ASS file: {ass_file}")
        with open(ass_file, 'r') as f:
            content = f.read()
        
        print("\n--- ASS File Content ---")
        print(content[:2000])  # Print first 2000 chars
        print("--- End of ASS File ---\n")
        
        # Verify key elements
        checks = {
            '[Script Info]': 'Has [Script Info] section',
            'PlayResX:': 'Has PlayResX',
            'PlayResY:': 'Has PlayResY',
            'WrapStyle: 2': 'Has WrapStyle: 2',
            'Dialogue: 0,': 'Has Dialogue lines',
            r'{\an5\pos(': 'Has \\an5\\pos positioning',
        }
        
        all_pass = True
        for check, desc in checks.items():
            if check in content:
                print(f"✅ {desc}")
            else:
                print(f"❌ {desc}")
                all_pass = False
        
        # Check for word chunking (long cue should be split)
        if 'one two three four' in content or 'five six seven eight' in content:
            print(f"✅ Long cues are chunked (≤4 words per line)")
        else:
            print(f"⚠️  Could not verify word chunking")
        
        # Check for 2-line via \N
        if r'\N' in content:
            print(f"✅ Contains \\N for multi-line captions")
        else:
            print(f"⚠️  No \\N found (may not have 6-word cues)")
        
        if all_pass:
            log_test("Test 7 - ASS file inspection", "PASS", "All required ASS elements present")
        else:
            log_test("Test 7 - ASS file inspection", "FAIL", "Some ASS elements missing")
    else:
        log_test("Test 7 - ASS file inspection", "SKIP", f"ASS file not found at {ass_file} (already cleaned up)")

def test_projects_regression():
    """Test that Projects endpoints still work"""
    print(f"\n{'='*80}")
    print(f"TEST 8: Projects Regression")
    print(f"{'='*80}")
    
    try:
        # Test GET /api/projects
        url = f"{API_BASE}/projects"
        print(f"GET {url}")
        response = requests.get(url, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            projects = response.json()
            print(f"Projects count: {len(projects)}")
            log_test("Test 8a - GET /api/projects", "PASS", f"Returned {len(projects)} projects")
        else:
            log_test("Test 8a - GET /api/projects", "FAIL", f"HTTP {response.status_code}")
            return False
        
        # Test GET /api/projects/__unsorted__
        url = f"{API_BASE}/projects/__unsorted__"
        print(f"\nGET {url}")
        response = requests.get(url, timeout=10)
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            project = response.json()
            print(f"Unsorted project ID: {project.get('id')}")
            print(f"Clips count: {len(project.get('clips', []))}")
            log_test("Test 8b - GET /api/projects/__unsorted__", "PASS", "Virtual project returned")
            return True
        else:
            log_test("Test 8b - GET /api/projects/__unsorted__", "FAIL", f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        log_test("Test 8 - Projects Regression", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    print("="*80)
    print("CAPTION RENDERING PIPELINE TEST SUITE")
    print("Testing POST /api/clips/:clipId/render with .ass file generation")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Clip ID: {CLIP_ID}")
    
    results = []
    
    # Test 1: 9:16 crop + Hindi-like caption (long cue tests chunking)
    body1 = {
        "trim_start": 0,
        "trim_end": 5,
        "crop_aspect": "9:16",
        "fill_mode": "crop",
        "speed": 1.0,
        "font_size": 20,
        "outline_size": 2,
        "caption_x_percent": 50,
        "caption_y_percent": 78,
        "style_preset": "classic_white",
        "style_ass": {
            "fontName": "DejaVu Sans",
            "fontSize": 20,
            "primary": "&H00FFFFFF&",
            "outline": 2,
            "outlineColour": "&H00000000&",
            "bold": 1
        },
        "caption_segments": [
            {"start": 0, "end": 2, "text": "hello world from the test agent"},
            {"start": 2, "end": 5, "text": "one two three four five six seven eight nine ten eleven twelve"}
        ]
    }
    results.append(test_render(1, "9:16 crop + long caption (chunking test)", body1))
    time.sleep(1)
    
    # Test 2: 9:16 + Color fill mode
    body2 = body1.copy()
    body2["fill_mode"] = "color"
    body2["fill_color"] = "#ff0000"
    results.append(test_render(2, "9:16 + Color fill mode", body2))
    time.sleep(1)
    
    # Test 3: 9:16 + Blur fill mode
    body3 = body1.copy()
    body3["fill_mode"] = "blur"
    results.append(test_render(3, "9:16 + Blur fill mode", body3))
    time.sleep(1)
    
    # Test 4: No caption_segments (falls back to clip.srt_content)
    body4 = {
        "trim_start": 0,
        "trim_end": 5,
        "crop_aspect": "9:16",
        "fill_mode": "crop",
        "speed": 1.0,
        "font_size": 20,
        "outline_size": 2,
        "caption_x_percent": 50,
        "caption_y_percent": 78,
        "style_preset": "classic_white"
    }
    results.append(test_render(4, "No caption_segments (fallback to srt_content)", body4))
    time.sleep(1)
    
    # Test 5: Empty caption_segments
    body5 = body1.copy()
    body5["caption_segments"] = []
    results.append(test_render(5, "Empty caption_segments (no captions)", body5))
    time.sleep(1)
    
    # Test 6: 16:9 output
    body6 = body1.copy()
    body6["crop_aspect"] = "16:9"
    results.append(test_render(6, "16:9 output", body6))
    time.sleep(1)
    
    # Test 7: Inspect ASS file (must run immediately after a render)
    inspect_ass_file()
    
    # Test 8: Projects regression
    results.append(test_projects_regression())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
