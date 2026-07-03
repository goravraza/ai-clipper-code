#!/usr/bin/env python3
"""
Verify the supercuts that were created (despite the 502 timeout)
"""

import subprocess
import json
from pymongo import MongoClient

# Configuration
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
USER_ID = "11111111-1111-1111-1111-111111111111"
VIDEO_ID = "9a98ac5e-3b5f-439b-9e5c-77592d326016"

# MongoDB client
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print("\n" + "="*80)
print("VERIFYING SUPERCUTS CREATED FOR VIDEO:", VIDEO_ID)
print("="*80)

# Find all supercuts for this video
supercuts = list(db.generated_clips.find({
    "video_id": VIDEO_ID,
    "user_id": USER_ID,
    "is_supercut": True
}).sort("created_at", -1).limit(5))

print(f"\nFound {len(supercuts)} supercut(s)")

if len(supercuts) == 0:
    print("❌ FAIL: No supercuts found")
    exit(1)

all_passed = True

for i, sc in enumerate(supercuts):
    print(f"\n{'='*80}")
    print(f"Supercut {i+1}: {sc.get('clip_title', 'Untitled')}")
    print(f"{'='*80}")
    print(f"ID: {sc.get('id')}")
    print(f"Created: {sc.get('created_at')}")
    
    # Check required fields
    checks = []
    
    # 1. is_supercut
    if sc.get("is_supercut") == True:
        checks.append(("✅", "is_supercut: true"))
    else:
        checks.append(("❌", f"is_supercut: {sc.get('is_supercut')}"))
        all_passed = False
    
    # 2. storage_url_mp4
    storage_url = sc.get("storage_url_mp4", "")
    if storage_url.startswith("/api/files/clips/supercut_"):
        checks.append(("✅", f"storage_url_mp4: {storage_url}"))
    else:
        checks.append(("❌", f"storage_url_mp4 doesn't match pattern: {storage_url}"))
        all_passed = False
    
    # 3. caption_segments
    caption_segs = sc.get("caption_segments", [])
    if len(caption_segs) > 0:
        checks.append(("✅", f"caption_segments: {len(caption_segs)} segments"))
    else:
        checks.append(("❌", "caption_segments is empty"))
        all_passed = False
    
    # 4. supercut_source_segments
    source_segs = sc.get("supercut_source_segments", [])
    if len(source_segs) >= 2:
        checks.append(("✅", f"supercut_source_segments: {len(source_segs)} entries"))
    else:
        checks.append(("❌", f"supercut_source_segments has {len(source_segs)} entries, need ≥2"))
        all_passed = False
    
    # 5. credits_charged
    credits = sc.get("credits_charged", 0)
    if credits > 0:
        checks.append(("✅", f"credits_charged: {credits}"))
    else:
        checks.append(("❌", f"credits_charged: {credits}"))
        all_passed = False
    
    # 6. thumbnail_url
    if sc.get("thumbnail_url"):
        checks.append(("✅", f"thumbnail_url: {sc.get('thumbnail_url')}"))
    else:
        checks.append(("❌", "thumbnail_url is missing"))
        all_passed = False
    
    # 7. hook_text
    if sc.get("hook_text"):
        checks.append(("✅", f"hook_text: {sc.get('hook_text')[:50]}..."))
    else:
        checks.append(("⚠️", "hook_text is empty (optional)"))
    
    # Print all checks
    for status, msg in checks:
        print(f"{status} {msg}")
    
    # 8. Verify MP4 file exists
    mp4_path = storage_url.replace("/api/files/", "/app/data/uploads/")
    try:
        result = subprocess.run(
            ["test", "-f", mp4_path],
            capture_output=True
        )
        if result.returncode == 0:
            print(f"✅ MP4 file exists: {mp4_path}")
            
            # Get file size
            result = subprocess.run(
                ["ls", "-lh", mp4_path],
                capture_output=True,
                text=True
            )
            size = result.stdout.split()[4] if result.returncode == 0 else "unknown"
            print(f"   File size: {size}")
        else:
            print(f"❌ MP4 file not found: {mp4_path}")
            all_passed = False
            continue
    except Exception as e:
        print(f"❌ Error checking MP4 file: {e}")
        all_passed = False
        continue
    
    # 9. Verify MP4 properties with ffprobe
    try:
        result = subprocess.run(
            ["/usr/bin/ffprobe", "-v", "error", "-show_streams", "-of", "json", mp4_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            print(f"❌ ffprobe failed: {result.stderr}")
            all_passed = False
            continue
        
        probe_data = json.loads(result.stdout)
        streams = probe_data.get("streams", [])
        
        # Find video and audio streams
        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
        
        if not video_stream:
            print(f"❌ No video stream found")
            all_passed = False
            continue
        
        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        fps = video_stream.get("r_frame_rate", "0/1")
        duration = float(video_stream.get("duration", 0))
        
        # Check dimensions
        if width == 1080 and height == 1920:
            print(f"✅ Video dimensions: {width}x{height} (9:16)")
        else:
            print(f"⚠️  Video dimensions: {width}x{height} (expected 1080x1920)")
        
        # Check FPS
        if fps.startswith("30"):
            print(f"✅ Frame rate: {fps} fps")
        else:
            print(f"⚠️  Frame rate: {fps} (expected 30fps)")
        
        # Check duration
        print(f"✅ Duration: {duration:.1f}s")
        if duration < 5:
            print(f"⚠️  Duration is very short ({duration:.1f}s)")
        
        # Check audio
        if audio_stream:
            codec = audio_stream.get("codec_name", "")
            sample_rate = audio_stream.get("sample_rate", "")
            channels = audio_stream.get("channels", 0)
            
            if codec == "aac" and int(sample_rate) == 44100 and channels == 2:
                print(f"✅ Audio: {codec} @ {sample_rate}Hz, {channels} channels")
            else:
                print(f"⚠️  Audio: {codec} @ {sample_rate}Hz, {channels} channels (expected aac @ 44100Hz, 2 channels)")
        else:
            print(f"❌ No audio stream found")
            all_passed = False
        
    except Exception as e:
        print(f"❌ Error running ffprobe: {e}")
        all_passed = False

print("\n" + "="*80)
if all_passed:
    print("✅ ALL SUPERCUTS VERIFIED SUCCESSFULLY")
else:
    print("⚠️  SOME CHECKS FAILED (see above)")
print("="*80)

exit(0 if all_passed else 1)
