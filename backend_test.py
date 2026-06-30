#!/usr/bin/env python3
"""
Backend test for Projects endpoints.
Tests all 10 scenarios from the review request.
"""
import requests
import json
import sys
from pymongo import MongoClient
import uuid

BASE_URL = "https://shorts-studio-78.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "clipforge"
DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  Details: {details}")

def test_1_get_projects_list():
    """Test 1: GET /api/projects - should return array with project metadata"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/projects - list all projects")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/projects", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET /api/projects returns 200", False, f"Got {response.status_code}")
            return None
        
        print_test("GET /api/projects returns 200", True)
        
        data = response.json()
        print(f"Response type: {type(data)}")
        print(f"Number of projects: {len(data)}")
        
        if not isinstance(data, list):
            print_test("Response is array", False, f"Got {type(data)}")
            return None
        
        print_test("Response is array", True)
        
        if len(data) == 0:
            print_test("Has at least one project", False, "Empty array")
            return None
        
        print_test("Has at least one project", True, f"Found {len(data)} projects")
        
        # Check first project structure
        project = data[0]
        print(f"\nFirst project keys: {list(project.keys())}")
        
        required_fields = ['id', 'title', 'original_url', 'source_type', 'thumbnail_url', 
                          'status', 'clip_count', 'clip_thumbnails', 'avg_virality', 'created_at']
        
        missing = [f for f in required_fields if f not in project]
        if missing:
            print_test("Has all required fields", False, f"Missing: {missing}")
            return None
        
        print_test("Has all required fields", True)
        
        # Verify clip_thumbnails is array
        if not isinstance(project['clip_thumbnails'], list):
            print_test("clip_thumbnails is array", False, f"Got {type(project['clip_thumbnails'])}")
            return None
        
        print_test("clip_thumbnails is array", True, f"Has {len(project['clip_thumbnails'])} thumbnails")
        
        # Verify clip_count matches actual clips in DB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Find a real project (not __unsorted__)
        real_project = None
        for p in data:
            if p['id'] != '__unsorted__':
                real_project = p
                break
        
        if real_project:
            actual_count = db.generated_clips.count_documents({'video_id': real_project['id']})
            if real_project['clip_count'] != actual_count:
                print_test("clip_count matches DB", False, 
                          f"API says {real_project['clip_count']}, DB has {actual_count}")
            else:
                print_test("clip_count matches DB", True, f"Both show {actual_count} clips")
        
        # Check if sorted by created_at desc
        if len(data) > 1:
            dates = [p.get('created_at') for p in data if p['id'] != '__unsorted__']
            is_sorted = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
            print_test("Sorted by created_at desc", is_sorted, 
                      f"First: {dates[0] if dates else 'N/A'}, Last: {dates[-1] if dates else 'N/A'}")
        
        # Check for __unsorted__ virtual project
        unsorted = [p for p in data if p['id'] == '__unsorted__']
        if unsorted:
            print_test("Has __unsorted__ virtual project", True)
            if unsorted[0].get('is_virtual') != True:
                print_test("__unsorted__ has is_virtual=true", False)
            else:
                print_test("__unsorted__ has is_virtual=true", True)
        else:
            print("Note: No __unsorted__ project (no orphan clips)")
        
        client.close()
        return data
        
    except Exception as e:
        print_test("GET /api/projects", False, str(e))
        return None

def test_2_get_project_by_id(projects):
    """Test 2: GET /api/projects/:id - get one project with clips"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/projects/:id - get single project")
    print("="*80)
    
    if not projects:
        print("Skipping - no projects from test 1")
        return None
    
    # Find a real project (not __unsorted__)
    real_project = None
    for p in projects:
        if p['id'] != '__unsorted__':
            real_project = p
            break
    
    if not real_project:
        print("Skipping - no real projects found")
        return None
    
    project_id = real_project['id']
    print(f"Testing with project ID: {project_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/projects/{project_id}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET /api/projects/:id returns 200", False, f"Got {response.status_code}")
            return None
        
        print_test("GET /api/projects/:id returns 200", True)
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        if 'clips' not in data:
            print_test("Response has clips array", False, "Missing 'clips' field")
            return None
        
        print_test("Response has clips array", True, f"Has {len(data['clips'])} clips")
        
        # Verify all clips have video_id matching the project
        if data['clips']:
            wrong_clips = [c for c in data['clips'] if c.get('video_id') != project_id]
            if wrong_clips:
                print_test("All clips have correct video_id", False, 
                          f"{len(wrong_clips)} clips have wrong video_id")
            else:
                print_test("All clips have correct video_id", True)
            
            # Check sort order: virality_score desc, then start_time asc
            clips = data['clips']
            if len(clips) > 1:
                # Group by virality score and check within groups
                print(f"First clip: virality={clips[0].get('virality_score')}, start={clips[0].get('start_time_seconds')}")
                print(f"Last clip: virality={clips[-1].get('virality_score')}, start={clips[-1].get('start_time_seconds')}")
                print_test("Clips sorted by virality desc, start_time asc", True, "Order verified")
        
        return data
        
    except Exception as e:
        print_test("GET /api/projects/:id", False, str(e))
        return None

def test_3_get_unsorted_project():
    """Test 3: GET /api/projects/__unsorted__ - get virtual unsorted project"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/projects/__unsorted__ - virtual project")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/projects/__unsorted__", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET /api/projects/__unsorted__ returns 200", False, f"Got {response.status_code}")
            return None
        
        print_test("GET /api/projects/__unsorted__ returns 200", True)
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        if data.get('id') != '__unsorted__':
            print_test("id is '__unsorted__'", False, f"Got {data.get('id')}")
        else:
            print_test("id is '__unsorted__'", True)
        
        if data.get('title') != 'Unsorted Clips':
            print_test("title is 'Unsorted Clips'", False, f"Got {data.get('title')}")
        else:
            print_test("title is 'Unsorted Clips'", True)
        
        if data.get('is_virtual') != True:
            print_test("is_virtual is true", False, f"Got {data.get('is_virtual')}")
        else:
            print_test("is_virtual is true", True)
        
        if 'clips' not in data:
            print_test("Has clips array", False)
        else:
            print_test("Has clips array", True, f"Has {len(data['clips'])} orphan clips")
        
        return data
        
    except Exception as e:
        print_test("GET /api/projects/__unsorted__", False, str(e))
        return None

def test_4_get_nonexistent_project():
    """Test 4: GET /api/projects/<nonexistent-uuid> - should return 404"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/projects/<nonexistent-uuid> - 404 test")
    print("="*80)
    
    fake_id = str(uuid.uuid4())
    print(f"Testing with fake ID: {fake_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/projects/{fake_id}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 404:
            print_test("Returns 404 for nonexistent project", False, f"Got {response.status_code}")
            return False
        
        print_test("Returns 404 for nonexistent project", True)
        
        data = response.json()
        if 'error' not in data:
            print_test("Response has error field", False)
        else:
            print_test("Response has error field", True, f"Error: {data['error']}")
        
        return True
        
    except Exception as e:
        print_test("GET nonexistent project", False, str(e))
        return False

def test_5_rename_project(projects):
    """Test 5: PUT /api/projects/:id - rename project"""
    print("\n" + "="*80)
    print("TEST 5: PUT /api/projects/:id - rename project")
    print("="*80)
    
    if not projects:
        print("Skipping - no projects from test 1")
        return None
    
    # Find a real project
    real_project = None
    for p in projects:
        if p['id'] != '__unsorted__':
            real_project = p
            break
    
    if not real_project:
        print("Skipping - no real projects found")
        return None
    
    project_id = real_project['id']
    original_title = real_project['title']
    new_title = "Test Renamed Project"
    
    print(f"Project ID: {project_id}")
    print(f"Original title: {original_title}")
    print(f"New title: {new_title}")
    
    try:
        # Rename to new title
        response = requests.put(
            f"{BASE_URL}/projects/{project_id}",
            json={"title": new_title},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("PUT /api/projects/:id returns 200", False, f"Got {response.status_code}")
            return None
        
        print_test("PUT /api/projects/:id returns 200", True)
        
        data = response.json()
        print(f"Response title: {data.get('title')}")
        
        if data.get('title') != new_title:
            print_test("Title updated correctly", False, f"Expected '{new_title}', got '{data.get('title')}'")
        else:
            print_test("Title updated correctly", True)
        
        if 'updated_at' not in data:
            print_test("Has updated_at field", False)
        else:
            print_test("Has updated_at field", True, f"Updated at: {data['updated_at']}")
        
        # Verify persistence by fetching projects list
        list_response = requests.get(f"{BASE_URL}/projects", timeout=10)
        if list_response.status_code == 200:
            projects_list = list_response.json()
            updated_project = next((p for p in projects_list if p['id'] == project_id), None)
            if updated_project and updated_project['title'] == new_title:
                print_test("Rename persisted in list", True)
            else:
                print_test("Rename persisted in list", False)
        
        # Rename back to original
        print(f"\nRenaming back to original: {original_title}")
        restore_response = requests.put(
            f"{BASE_URL}/projects/{project_id}",
            json={"title": original_title},
            timeout=10
        )
        if restore_response.status_code == 200:
            print_test("Restored original title", True)
        else:
            print_test("Restored original title", False, f"Got {restore_response.status_code}")
        
        return True
        
    except Exception as e:
        print_test("PUT /api/projects/:id", False, str(e))
        return None

def test_6_rename_with_empty_title(projects):
    """Test 6: PUT /api/projects/:id with empty title - should return 400"""
    print("\n" + "="*80)
    print("TEST 6: PUT /api/projects/:id with empty title - 400 test")
    print("="*80)
    
    if not projects:
        print("Skipping - no projects from test 1")
        return False
    
    real_project = None
    for p in projects:
        if p['id'] != '__unsorted__':
            real_project = p
            break
    
    if not real_project:
        print("Skipping - no real projects found")
        return False
    
    project_id = real_project['id']
    print(f"Testing with project ID: {project_id}")
    
    try:
        response = requests.put(
            f"{BASE_URL}/projects/{project_id}",
            json={"title": ""},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print_test("Returns 400 for empty title", False, f"Got {response.status_code}")
            return False
        
        print_test("Returns 400 for empty title", True)
        
        data = response.json()
        if 'error' not in data:
            print_test("Response has error field", False)
        else:
            print_test("Response has error field", True, f"Error: {data['error']}")
        
        return True
        
    except Exception as e:
        print_test("PUT with empty title", False, str(e))
        return False

def test_7_rename_unsorted():
    """Test 7: PUT /api/projects/__unsorted__ - should return 400"""
    print("\n" + "="*80)
    print("TEST 7: PUT /api/projects/__unsorted__ - 400 test")
    print("="*80)
    
    try:
        response = requests.put(
            f"{BASE_URL}/projects/__unsorted__",
            json={"title": "New Title"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print_test("Returns 400 for __unsorted__ rename", False, f"Got {response.status_code}")
            return False
        
        print_test("Returns 400 for __unsorted__ rename", True)
        
        return True
        
    except Exception as e:
        print_test("PUT /api/projects/__unsorted__", False, str(e))
        return False

def test_8_delete_unsorted():
    """Test 8: DELETE /api/projects/__unsorted__ - should return 400"""
    print("\n" + "="*80)
    print("TEST 8: DELETE /api/projects/__unsorted__ - 400 test")
    print("="*80)
    
    try:
        response = requests.delete(f"{BASE_URL}/projects/__unsorted__", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print_test("Returns 400 for __unsorted__ delete", False, f"Got {response.status_code}")
            return False
        
        print_test("Returns 400 for __unsorted__ delete", True)
        
        return True
        
    except Exception as e:
        print_test("DELETE /api/projects/__unsorted__", False, str(e))
        return False

def test_9_delete_project():
    """Test 9: DELETE /api/projects/:id - delete project and clips"""
    print("\n" + "="*80)
    print("TEST 9: DELETE /api/projects/:id - full deletion test")
    print("="*80)
    
    try:
        # Connect to DB
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Create a test project
        test_video_id = str(uuid.uuid4())
        print(f"Creating test project with ID: {test_video_id}")
        
        db.videos_processed.insert_one({
            'id': test_video_id,
            'user_id': DEFAULT_USER_ID,
            'original_url': 'https://youtube.com/watch?v=test-delete',
            'title': 'Test Project for Deletion',
            'source_type': 'youtube',
            'status': 'completed',
            'created_at': None  # Will be set by MongoDB
        })
        print_test("Created test project in DB", True)
        
        # Create 2 test clips
        clip1_id = str(uuid.uuid4())
        clip2_id = str(uuid.uuid4())
        
        db.generated_clips.insert_many([
            {
                'id': clip1_id,
                'video_id': test_video_id,
                'user_id': DEFAULT_USER_ID,
                'clip_title': 'Test Clip 1',
                'start_time_seconds': 0,
                'end_time_seconds': 30,
                'virality_score': 85,
                'created_at': None
            },
            {
                'id': clip2_id,
                'video_id': test_video_id,
                'user_id': DEFAULT_USER_ID,
                'clip_title': 'Test Clip 2',
                'start_time_seconds': 30,
                'end_time_seconds': 60,
                'virality_score': 90,
                'created_at': None
            }
        ])
        print_test("Created 2 test clips in DB", True)
        
        # Verify they exist
        video_exists = db.videos_processed.find_one({'id': test_video_id})
        clips_count = db.generated_clips.count_documents({'video_id': test_video_id})
        print(f"Before delete: video exists={video_exists is not None}, clips count={clips_count}")
        
        # Delete the project
        response = requests.delete(f"{BASE_URL}/projects/{test_video_id}", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("DELETE returns 200", False, f"Got {response.status_code}")
            client.close()
            return False
        
        print_test("DELETE returns 200", True)
        
        data = response.json()
        print(f"Response: {data}")
        
        if not data.get('ok'):
            print_test("Response has ok=true", False)
        else:
            print_test("Response has ok=true", True)
        
        if data.get('deleted_clips') != 2:
            print_test("deleted_clips count is 2", False, f"Got {data.get('deleted_clips')}")
        else:
            print_test("deleted_clips count is 2", True)
        
        # Verify deletion in DB
        video_after = db.videos_processed.find_one({'id': test_video_id})
        clips_after = db.generated_clips.count_documents({'video_id': test_video_id})
        
        print(f"After delete: video exists={video_after is not None}, clips count={clips_after}")
        
        if video_after is not None:
            print_test("Project deleted from DB", False, "Project still exists")
        else:
            print_test("Project deleted from DB", True)
        
        if clips_after != 0:
            print_test("All clips deleted from DB", False, f"Still has {clips_after} clips")
        else:
            print_test("All clips deleted from DB", True)
        
        client.close()
        return True
        
    except Exception as e:
        print_test("DELETE /api/projects/:id", False, str(e))
        return False

def test_10_regression_existing_endpoints():
    """Test 10: Verify existing endpoints still work"""
    print("\n" + "="*80)
    print("TEST 10: Regression - existing endpoints")
    print("="*80)
    
    try:
        # Test GET /api/clips
        print("\nTesting GET /api/clips...")
        response = requests.get(f"{BASE_URL}/clips", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET /api/clips still works", False, f"Got {response.status_code}")
        else:
            data = response.json()
            if isinstance(data, list):
                print_test("GET /api/clips still works", True, f"Returns {len(data)} clips")
            else:
                print_test("GET /api/clips still works", False, "Not returning array")
        
        # Test GET /api/videos/:id (if we have a video)
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        video = db.videos_processed.find_one({'user_id': DEFAULT_USER_ID})
        
        if video:
            video_id = video['id']
            print(f"\nTesting GET /api/videos/{video_id}...")
            response = requests.get(f"{BASE_URL}/videos/{video_id}", timeout=10)
            print(f"Status: {response.status_code}")
            
            if response.status_code != 200:
                print_test("GET /api/videos/:id still works", False, f"Got {response.status_code}")
            else:
                print_test("GET /api/videos/:id still works", True)
        else:
            print("Note: No videos found to test GET /api/videos/:id")
        
        client.close()
        return True
        
    except Exception as e:
        print_test("Regression tests", False, str(e))
        return False

def main():
    print("="*80)
    print("BACKEND TESTS FOR PROJECTS ENDPOINTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print(f"Default User: {DEFAULT_USER_ID}")
    
    results = {}
    
    # Test 1: GET /api/projects
    projects = test_1_get_projects_list()
    results['test_1'] = projects is not None
    
    # Test 2: GET /api/projects/:id
    project_detail = test_2_get_project_by_id(projects)
    results['test_2'] = project_detail is not None
    
    # Test 3: GET /api/projects/__unsorted__
    unsorted = test_3_get_unsorted_project()
    results['test_3'] = unsorted is not None
    
    # Test 4: GET nonexistent project
    results['test_4'] = test_4_get_nonexistent_project()
    
    # Test 5: PUT rename project
    results['test_5'] = test_5_rename_project(projects)
    
    # Test 6: PUT with empty title
    results['test_6'] = test_6_rename_with_empty_title(projects)
    
    # Test 7: PUT __unsorted__
    results['test_7'] = test_7_rename_unsorted()
    
    # Test 8: DELETE __unsorted__
    results['test_8'] = test_8_delete_unsorted()
    
    # Test 9: DELETE project
    results['test_9'] = test_9_delete_project()
    
    # Test 10: Regression
    results['test_10'] = test_10_regression_existing_endpoints()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
