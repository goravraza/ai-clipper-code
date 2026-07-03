#!/usr/bin/env python3
"""
Backend test for animation_style parameter on POST /api/clips/:id/render
Tests three animation modes: static, karaoke, word_bounce
"""

import requests
import json
from pymongo import MongoClient
import os
import time

# Configuration
BASE_URL = "https://shorts-studio-78.preview.emergentagent.com/api"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "clipforge")
USER_ID = "11111111-1111-1111-1111-111111111111"

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def setup_user_credits():
    """Ensure user has enough credits for testing"""
    print("Setting up user credits...")
    result = db.profiles.update_one(
        {"id": USER_ID},
        {"$set": {"credit_balance_minutes": 200}}
    )
    print(f"✓ User credits set to 200 minutes")
    return True

def find_or_create_test_clip():
    """Find a clip with caption_segments and word timings, or create test data"""
    print("\nFinding test clip...")
    
    # Find a clip with word-level timings
    clip = db.generated_clips.find_one({
        "user_id": USER_ID,
        "storage_url_mp4": {"$regex": "^/api/files/clips/"},
        "caption_segments.0.words.0.start": {"$exists": True}
    })
    
    if clip:
        print(f"✓ Found clip with word timings: {clip['id']}")
        return clip['id']
    
    # If no clip found, find any clip with local storage
    clip = db.generated_clips.find_one({
        "user_id": USER_ID,
        "storage_url_mp4": {"$regex": "^/api/files/clips/"}
    })
    
    if clip:
        print(f"✓ Found clip without word timings: {clip['id']}")
        return clip['id']
    
    print("✗ No suitable clip found in database")
    return None

def read_ass_file():
    """Read the /tmp/last_cap.ass file"""
    try:
        with open('/tmp/last_cap.ass', 'r') as f:
            return f.read()
    except Exception as e:
        print(f"✗ Failed to read /tmp/last_cap.ass: {e}")
        return None

def verify_static_ass(ass_content):
    """Verify static animation style ASS output"""
    print("\n  Verifying static ASS output...")
    errors = []
    
    # Should NOT contain color override tags (except in Style row)
    dialogue_lines = [line for line in ass_content.split('\n') if line.startswith('Dialogue:')]
    
    for line in dialogue_lines:
        if '\\c&H' in line or '{\\c' in line:
            errors.append(f"Found color override in Dialogue line (should be plain text): {line[:100]}")
        if '\\fscx' in line or '\\fscy' in line:
            errors.append(f"Found scale tags in Dialogue line (should have none): {line[:100]}")
    
    # Should have fewer Dialogue events (ideally 1-2 for a short cue)
    if len(dialogue_lines) > 3:
        print(f"  ⚠ Warning: {len(dialogue_lines)} Dialogue events (expected 1-2 for static)")
    else:
        print(f"  ✓ {len(dialogue_lines)} Dialogue events (appropriate for static)")
    
    if errors:
        for err in errors[:3]:  # Show first 3 errors
            print(f"  ✗ {err}")
        return False
    
    print("  ✓ No color or scale tags in Dialogue lines")
    print("  ✓ Static style verified")
    return True

def verify_karaoke_ass(ass_content):
    """Verify karaoke animation style ASS output"""
    print("\n  Verifying karaoke ASS output...")
    errors = []
    
    dialogue_lines = [line for line in ass_content.split('\n') if line.startswith('Dialogue:')]
    
    # Should have multiple Dialogue events (one per word)
    if len(dialogue_lines) < 4:
        errors.append(f"Expected ≥4 Dialogue events for karaoke, got {len(dialogue_lines)}")
    else:
        print(f"  ✓ {len(dialogue_lines)} Dialogue events (multiple per-word events)")
    
    # Should contain accent color overrides
    color_override_count = sum(1 for line in dialogue_lines if '{\\c&H' in line or '{\\c' in line)
    if color_override_count == 0:
        errors.append("No color override tags found (expected accent color on active words)")
    else:
        print(f"  ✓ {color_override_count} Dialogue lines with color overrides")
    
    # Should contain reset tags
    reset_count = sum(1 for line in dialogue_lines if '{\\r}' in line)
    if reset_count == 0:
        errors.append("No reset tags {\\r} found (expected after colored words)")
    else:
        print(f"  ✓ {reset_count} reset tags found")
    
    # Should NOT contain scale tags
    scale_lines = [line for line in dialogue_lines if '\\fscx115' in line or '\\fscy115' in line]
    if scale_lines:
        errors.append(f"Found scale tags (should not be in karaoke): {len(scale_lines)} lines")
    else:
        print("  ✓ No scale tags (correct for karaoke)")
    
    if errors:
        for err in errors:
            print(f"  ✗ {err}")
        return False
    
    print("  ✓ Karaoke style verified")
    return True

def verify_word_bounce_ass(ass_content):
    """Verify word_bounce animation style ASS output"""
    print("\n  Verifying word_bounce ASS output...")
    errors = []
    
    dialogue_lines = [line for line in ass_content.split('\n') if line.startswith('Dialogue:')]
    
    # Should have multiple Dialogue events
    if len(dialogue_lines) < 4:
        errors.append(f"Expected ≥4 Dialogue events for word_bounce, got {len(dialogue_lines)}")
    else:
        print(f"  ✓ {len(dialogue_lines)} Dialogue events")
    
    # Should contain scale tags
    scale_lines = [line for line in dialogue_lines if '\\fscx115' in line and '\\fscy115' in line]
    if not scale_lines:
        errors.append("No scale tags (\\fscx115\\fscy115) found")
    else:
        print(f"  ✓ {len(scale_lines)} Dialogue lines with scale tags")
    
    # Should contain transform tags
    transform_lines = [line for line in dialogue_lines if '\\t(0,100,' in line and '\\fscx100\\fscy100' in line]
    if not transform_lines:
        errors.append("No transform tags \\t(0,100,\\fscx100\\fscy100) found")
    else:
        print(f"  ✓ {len(transform_lines)} Dialogue lines with transform tags")
    
    # Should contain accent color
    color_override_count = sum(1 for line in dialogue_lines if '{\\c&H' in line or '\\c&H' in line)
    if color_override_count == 0:
        errors.append("No color override tags found")
    else:
        print(f"  ✓ {color_override_count} Dialogue lines with color overrides")
    
    # Should contain reset tags
    reset_count = sum(1 for line in dialogue_lines if '{\\r}' in line)
    if reset_count == 0:
        errors.append("No reset tags {\\r} found")
    else:
        print(f"  ✓ {reset_count} reset tags found")
    
    if errors:
        for err in errors:
            print(f"  ✗ {err}")
        return False
    
    print("  ✓ Word bounce style verified")
    return True

def test_render_with_animation_style(clip_id, animation_style, expected_style=None):
    """Test rendering with a specific animation style"""
    if expected_style is None:
        expected_style = animation_style
    
    print(f"\n{'='*60}")
    print(f"Testing animation_style: {animation_style}")
    print(f"{'='*60}")
    
    # Prepare render request
    render_data = {
        "trim_start": 0,
        "trim_end": 10,
        "crop_aspect": "9:16",
        "font_size": 20,
        "outline_size": 2,
        "fill_mode": "crop",
        "caption_x_percent": 50,
        "caption_y_percent": 78,
        "animation_style": animation_style,
        "caption_segments": [
            {
                "start": 0,
                "end": 3,
                "text": "hello world from the test agent",
                "words": [
                    {"start": 0, "end": 0.5, "text": "hello"},
                    {"start": 0.5, "end": 1.0, "text": "world"},
                    {"start": 1.0, "end": 1.5, "text": "from"},
                    {"start": 1.5, "end": 2.0, "text": "the"},
                    {"start": 2.0, "end": 2.5, "text": "test"},
                    {"start": 2.5, "end": 3.0, "text": "agent"}
                ]
            }
        ]
    }
    
    try:
        print(f"\nPOST /api/clips/{clip_id}/render")
        response = requests.post(
            f"{BASE_URL}/clips/{clip_id}/render",
            json=render_data,
            timeout=120
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Verify response structure
        if not data.get('ok'):
            print(f"✗ Response ok=false")
            return False
        
        if 'clip' not in data:
            print(f"✗ No clip in response")
            return False
        
        clip = data['clip']
        
        # Verify animation_style was persisted
        if clip.get('animation_style') != expected_style:
            print(f"✗ Expected animation_style={expected_style}, got {clip.get('animation_style')}")
            return False
        
        print(f"✓ Response OK, animation_style={clip.get('animation_style')}")
        
        # Verify credits were charged
        if data.get('credits_charged', 0) <= 0:
            print(f"✗ No credits charged")
            return False
        
        print(f"✓ Credits charged: {data.get('credits_charged')}")
        
        # Read and verify ASS file
        time.sleep(0.5)  # Give filesystem a moment
        ass_content = read_ass_file()
        
        if not ass_content:
            print(f"✗ Could not read ASS file")
            return False
        
        print(f"✓ ASS file read successfully ({len(ass_content)} bytes)")
        
        # Verify ASS content based on expected style
        if expected_style == 'static':
            return verify_static_ass(ass_content)
        elif expected_style == 'karaoke':
            return verify_karaoke_ass(ass_content)
        elif expected_style == 'word_bounce':
            return verify_word_bounce_ass(ass_content)
        
        return True
        
    except Exception as e:
        print(f"✗ Exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_static_without_word_timings(clip_id):
    """Test static style with caption_segments that have no word timings"""
    print(f"\n{'='*60}")
    print(f"Testing static with NO word timings")
    print(f"{'='*60}")
    
    render_data = {
        "trim_start": 0,
        "trim_end": 10,
        "crop_aspect": "9:16",
        "font_size": 20,
        "outline_size": 2,
        "fill_mode": "crop",
        "caption_x_percent": 50,
        "caption_y_percent": 78,
        "animation_style": "static",
        "caption_segments": [
            {
                "start": 0,
                "end": 3,
                "text": "hello world from the test"
                # No words array
            }
        ]
    }
    
    try:
        print(f"\nPOST /api/clips/{clip_id}/render")
        response = requests.post(
            f"{BASE_URL}/clips/{clip_id}/render",
            json=render_data,
            timeout=120
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✗ Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('clip', {}).get('animation_style') != 'static':
            print(f"✗ Expected animation_style=static")
            return False
        
        print(f"✓ Response OK, animation_style=static")
        
        # Read ASS file
        time.sleep(0.5)
        ass_content = read_ass_file()
        
        if not ass_content:
            print(f"✗ Could not read ASS file")
            return False
        
        # Should produce a single Dialogue event with plain text
        dialogue_lines = [line for line in ass_content.split('\n') if line.startswith('Dialogue:')]
        
        if len(dialogue_lines) != 1:
            print(f"  ⚠ Warning: Expected 1 Dialogue line, got {len(dialogue_lines)}")
        
        # Should have no color or scale tags
        has_color = any('{\\c&H' in line or '{\\c' in line for line in dialogue_lines)
        has_scale = any('\\fscx' in line or '\\fscy' in line for line in dialogue_lines)
        
        if has_color or has_scale:
            print(f"✗ Found color or scale tags (should be plain text)")
            return False
        
        print(f"✓ Static without word timings verified (plain text, no tags)")
        return True
        
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

def verify_mp4_output(clip_id):
    """Verify the rendered MP4 file exists and is valid"""
    print(f"\nVerifying MP4 output...")
    
    clip = db.generated_clips.find_one({"id": clip_id})
    if not clip:
        print(f"✗ Clip not found in database")
        return False
    
    storage_url = clip.get('storage_url_mp4', '')
    if not storage_url.startswith('/api/files/clips/'):
        print(f"✗ Invalid storage_url: {storage_url}")
        return False
    
    # Extract filename from URL
    filename = storage_url.split('/')[-1]
    file_path = f"/app/data/uploads/clips/{filename}"
    
    if not os.path.exists(file_path):
        print(f"✗ MP4 file not found: {file_path}")
        return False
    
    print(f"✓ MP4 file exists: {file_path}")
    
    # Verify with ffprobe
    import subprocess
    try:
        result = subprocess.run(
            ['/usr/bin/ffprobe', '-v', 'error', '-show_entries', 
             'stream=codec_name,width,height', '-of', 'json', file_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            print(f"✗ ffprobe failed: {result.stderr}")
            return False
        
        probe_data = json.loads(result.stdout)
        streams = probe_data.get('streams', [])
        
        video_stream = next((s for s in streams if s.get('codec_name') == 'h264'), None)
        audio_stream = next((s for s in streams if s.get('codec_name') == 'aac'), None)
        
        if not video_stream:
            print(f"✗ No h264 video stream found")
            return False
        
        if video_stream.get('width') != 1080 or video_stream.get('height') != 1920:
            print(f"✗ Expected 1080x1920, got {video_stream.get('width')}x{video_stream.get('height')}")
            return False
        
        print(f"✓ Video stream: h264 1080x1920")
        
        if audio_stream:
            print(f"✓ Audio stream: aac")
        
        return True
        
    except Exception as e:
        print(f"✗ ffprobe exception: {e}")
        return False

def main():
    print("="*60)
    print("ANIMATION_STYLE PARAMETER TESTING")
    print("="*60)
    
    results = {}
    
    # Setup
    try:
        setup_user_credits()
        clip_id = find_or_create_test_clip()
        
        if not clip_id:
            print("\n✗ SETUP FAILED: No test clip available")
            return
        
        print(f"\nUsing clip: {clip_id}")
        
    except Exception as e:
        print(f"\n✗ SETUP FAILED: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Test A: static style
    try:
        results['static'] = test_render_with_animation_style(clip_id, 'static')
    except Exception as e:
        print(f"\n✗ Test A (static) failed with exception: {e}")
        results['static'] = False
    
    # Test B: karaoke style
    try:
        results['karaoke'] = test_render_with_animation_style(clip_id, 'karaoke')
    except Exception as e:
        print(f"\n✗ Test B (karaoke) failed with exception: {e}")
        results['karaoke'] = False
    
    # Test C: word_bounce style
    try:
        results['word_bounce'] = test_render_with_animation_style(clip_id, 'word_bounce')
    except Exception as e:
        print(f"\n✗ Test C (word_bounce) failed with exception: {e}")
        results['word_bounce'] = False
    
    # Test D: default (omitted animation_style)
    try:
        # Clear animation_style from clip to test true default
        db.generated_clips.update_one(
            {"id": clip_id},
            {"$unset": {"animation_style": ""}}
        )
        
        print(f"\n{'='*60}")
        print(f"Testing DEFAULT (omitted animation_style)")
        print(f"{'='*60}")
        
        render_data = {
            "trim_start": 0,
            "trim_end": 10,
            "crop_aspect": "9:16",
            "font_size": 20,
            "outline_size": 2,
            "fill_mode": "crop",
            "caption_x_percent": 50,
            "caption_y_percent": 78,
            # No animation_style field
            "caption_segments": [
                {
                    "start": 0,
                    "end": 3,
                    "text": "default test",
                    "words": [
                        {"start": 0, "end": 0.5, "text": "default"},
                        {"start": 0.5, "end": 1.0, "text": "test"}
                    ]
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/clips/{clip_id}/render", json=render_data, timeout=120)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('clip', {}).get('animation_style') == 'karaoke':
                print(f"✓ Default animation_style is 'karaoke'")
                results['default'] = True
            else:
                print(f"✗ Expected default 'karaoke', got {data.get('clip', {}).get('animation_style')}")
                results['default'] = False
        else:
            print(f"✗ Request failed: {response.status_code}")
            results['default'] = False
            
    except Exception as e:
        print(f"\n✗ Test D (default) failed with exception: {e}")
        results['default'] = False
    
    # Test E: invalid value
    try:
        results['invalid'] = test_render_with_animation_style(clip_id, 'banana', expected_style='karaoke')
    except Exception as e:
        print(f"\n✗ Test E (invalid) failed with exception: {e}")
        results['invalid'] = False
    
    # Test F: static without word timings
    try:
        results['static_no_words'] = test_static_without_word_timings(clip_id)
    except Exception as e:
        print(f"\n✗ Test F (static no words) failed with exception: {e}")
        results['static_no_words'] = False
    
    # Regression: Verify MP4 output
    try:
        results['mp4_output'] = verify_mp4_output(clip_id)
    except Exception as e:
        print(f"\n✗ MP4 verification failed with exception: {e}")
        results['mp4_output'] = False
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
