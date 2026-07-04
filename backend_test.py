#!/usr/bin/env python3
"""
Backend test suite for Phase 1: Feature Gating & Pricing Engine
Tests all 14 critical behaviors listed in the review request.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Constants
BASE_URL = "https://shorts-studio-78.preview.emergentagent.com/api"
DEMO_USER_ID = "11111111-1111-1111-1111-111111111111"
ADMIN_USER_ID = "22222222-2222-2222-2222-222222222222"

# Expected feature keys
FEATURE_KEYS = [
    'respool', 'animated_captions', 'custom_logo', 'scroll_stopper',
    'hd_export', 'custom_fonts', 'custom_colors', 'intro_outro'
]

# Expected default tiers
DEFAULT_TIER_KEYS = ['free', 'pro', 'business']

# Test state tracking
test_results = []
studio_tier_id = None
free_tier_id = None


def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })


def test_1_get_user_features_free():
    """Test 1: GET /api/user/features (no auth) — free user, all features=false"""
    print("\n=== Test 1: GET /api/user/features (free user) ===")
    try:
        response = requests.get(f"{BASE_URL}/user/features", timeout=10)
        
        if response.status_code != 200:
            log_test("Test 1", False, f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        # Verify structure
        required_keys = ['plan_key', 'plan_name', 'features', 'tier', 'catalog', 'tiers', 'matrix']
        missing_keys = [k for k in required_keys if k not in data]
        if missing_keys:
            log_test("Test 1", False, f"Missing keys: {missing_keys}")
            return
        
        # Verify plan_key is 'free'
        if data['plan_key'] != 'free':
            log_test("Test 1", False, f"Expected plan_key='free', got '{data['plan_key']}'")
            return
        
        # Verify all features are false for free tier
        features = data['features']
        enabled_features = [k for k, v in features.items() if v is True]
        if enabled_features:
            log_test("Test 1", False, f"Expected all features=false, but found enabled: {enabled_features}")
            return
        
        # Verify catalog has 8 features
        if len(data['catalog']) != 8:
            log_test("Test 1", False, f"Expected 8 features in catalog, got {len(data['catalog'])}")
            return
        
        # Verify tiers has 3 items
        if len(data['tiers']) != 3:
            log_test("Test 1", False, f"Expected 3 tiers, got {len(data['tiers'])}")
            return
        
        # Verify matrix structure
        if not isinstance(data['matrix'], dict):
            log_test("Test 1", False, "Matrix should be a dict")
            return
        
        log_test("Test 1", True, f"Free user has plan_key='free', all features=false, catalog={len(data['catalog'])}, tiers={len(data['tiers'])}")
        
    except Exception as e:
        log_test("Test 1", False, f"Exception: {str(e)}")


def test_2_get_user_features_admin():
    """Test 2: GET /api/user/features?admin=true — admin user, all features=true"""
    print("\n=== Test 2: GET /api/user/features?admin=true (admin user) ===")
    try:
        response = requests.get(f"{BASE_URL}/user/features?admin=true", timeout=10)
        
        if response.status_code != 200:
            log_test("Test 2", False, f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        # Verify plan_key is 'business' (admin user is seeded with business plan)
        if data['plan_key'] != 'business':
            log_test("Test 2", False, f"Expected plan_key='business', got '{data['plan_key']}'")
            return
        
        # Verify all features are true (isAdminProfile short-circuit)
        features = data['features']
        disabled_features = [k for k, v in features.items() if v is False]
        if disabled_features:
            log_test("Test 2", False, f"Expected all features=true for admin, but found disabled: {disabled_features}")
            return
        
        log_test("Test 2", True, f"Admin user has plan_key='business', all features=true (isAdminProfile override)")
        
    except Exception as e:
        log_test("Test 2", False, f"Exception: {str(e)}")


def test_3_get_pricing_tiers_no_admin():
    """Test 3: GET /api/admin/pricing-tiers (no admin=true) → 403"""
    print("\n=== Test 3: GET /api/admin/pricing-tiers (no admin param) ===")
    try:
        response = requests.get(f"{BASE_URL}/admin/pricing-tiers", timeout=10)
        
        if response.status_code != 403:
            log_test("Test 3", False, f"Expected 403, got {response.status_code}")
            return
        
        log_test("Test 3", True, "Non-admin access correctly blocked with 403")
        
    except Exception as e:
        log_test("Test 3", False, f"Exception: {str(e)}")


def test_4_get_pricing_tiers_admin():
    """Test 4: GET /api/admin/pricing-tiers?admin=true → 3 tiers sorted by order"""
    print("\n=== Test 4: GET /api/admin/pricing-tiers?admin=true ===")
    global free_tier_id
    try:
        response = requests.get(f"{BASE_URL}/admin/pricing-tiers?admin=true", timeout=10)
        
        if response.status_code != 200:
            log_test("Test 4", False, f"Expected 200, got {response.status_code}")
            return
        
        tiers = response.json()
        
        if not isinstance(tiers, list):
            log_test("Test 4", False, "Expected array of tiers")
            return
        
        if len(tiers) != 3:
            log_test("Test 4", False, f"Expected 3 tiers, got {len(tiers)}")
            return
        
        # Verify sorted by order
        orders = [t.get('order', 0) for t in tiers]
        if orders != sorted(orders):
            log_test("Test 4", False, f"Tiers not sorted by order: {orders}")
            return
        
        # Verify tier keys
        tier_keys = [t['key'] for t in tiers]
        if set(tier_keys) != set(DEFAULT_TIER_KEYS):
            log_test("Test 4", False, f"Expected tier keys {DEFAULT_TIER_KEYS}, got {tier_keys}")
            return
        
        # Store free tier ID for later tests
        free_tier = next((t for t in tiers if t['key'] == 'free'), None)
        if free_tier:
            free_tier_id = free_tier['id']
        
        log_test("Test 4", True, f"Got 3 tiers sorted by order: {tier_keys}")
        
    except Exception as e:
        log_test("Test 4", False, f"Exception: {str(e)}")


def test_5_create_studio_tier():
    """Test 5: POST /api/admin/pricing-tiers?admin=true — create 'studio' tier"""
    print("\n=== Test 5: POST /api/admin/pricing-tiers?admin=true (create studio) ===")
    global studio_tier_id
    try:
        payload = {
            "name": "Studio",
            "price_usd": 29,
            "price_inr": 2499
        }
        response = requests.post(
            f"{BASE_URL}/admin/pricing-tiers?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Test 5", False, f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        tier = response.json()
        
        # Verify tier structure
        if tier.get('key') != 'studio':
            log_test("Test 5", False, f"Expected key='studio', got '{tier.get('key')}'")
            return
        
        if tier.get('name') != 'Studio':
            log_test("Test 5", False, f"Expected name='Studio', got '{tier.get('name')}'")
            return
        
        if tier.get('price_usd') != 29:
            log_test("Test 5", False, f"Expected price_usd=29, got {tier.get('price_usd')}")
            return
        
        studio_tier_id = tier['id']
        
        # Verify 8 feature rows were created (all off)
        features_response = requests.get(f"{BASE_URL}/admin/pricing-features?admin=true", timeout=10)
        if features_response.status_code == 200:
            features_data = features_response.json()
            studio_features = features_data['matrix'].get('studio', {})
            
            if len(studio_features) != 8:
                log_test("Test 5", False, f"Expected 8 feature rows for studio, got {len(studio_features)}")
                return
            
            # Verify all features are off
            enabled = [k for k, v in studio_features.items() if v is True]
            if enabled:
                log_test("Test 5", False, f"Expected all features off, but found enabled: {enabled}")
                return
        
        log_test("Test 5", True, f"Created studio tier (id={studio_tier_id}) with 8 features all off")
        
    except Exception as e:
        log_test("Test 5", False, f"Exception: {str(e)}")


def test_6_create_duplicate_tier():
    """Test 6: POST /api/admin/pricing-tiers?admin=true with duplicate key → 409"""
    print("\n=== Test 6: POST /api/admin/pricing-tiers?admin=true (duplicate) ===")
    try:
        payload = {
            "name": "Studio",
            "price_usd": 39
        }
        response = requests.post(
            f"{BASE_URL}/admin/pricing-tiers?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 409:
            log_test("Test 6", False, f"Expected 409, got {response.status_code}")
            return
        
        log_test("Test 6", True, "Duplicate tier creation correctly rejected with 409")
        
    except Exception as e:
        log_test("Test 6", False, f"Exception: {str(e)}")


def test_7_update_studio_tier():
    """Test 7: PUT /api/admin/pricing-tiers/{studio_id}?admin=true — update tier"""
    print("\n=== Test 7: PUT /api/admin/pricing-tiers/{studio_id}?admin=true ===")
    global studio_tier_id
    
    if not studio_tier_id:
        log_test("Test 7", False, "studio_tier_id not set (Test 5 may have failed)")
        return
    
    try:
        payload = {
            "name": "Studio Plus",
            "price_usd": 35
        }
        response = requests.put(
            f"{BASE_URL}/admin/pricing-tiers/{studio_tier_id}?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Test 7", False, f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        tier = response.json()
        
        if tier.get('name') != 'Studio Plus':
            log_test("Test 7", False, f"Expected name='Studio Plus', got '{tier.get('name')}'")
            return
        
        if tier.get('price_usd') != 35:
            log_test("Test 7", False, f"Expected price_usd=35, got {tier.get('price_usd')}")
            return
        
        if 'updated_at' not in tier:
            log_test("Test 7", False, "updated_at field not set")
            return
        
        log_test("Test 7", True, f"Updated studio tier to name='Studio Plus', price_usd=35")
        
    except Exception as e:
        log_test("Test 7", False, f"Exception: {str(e)}")


def test_8_get_pricing_features():
    """Test 8: GET /api/admin/pricing-features?admin=true → { catalog, tiers, matrix }"""
    print("\n=== Test 8: GET /api/admin/pricing-features?admin=true ===")
    try:
        response = requests.get(f"{BASE_URL}/admin/pricing-features?admin=true", timeout=10)
        
        if response.status_code != 200:
            log_test("Test 8", False, f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        
        # Verify structure
        required_keys = ['catalog', 'tiers', 'matrix']
        missing_keys = [k for k in required_keys if k not in data]
        if missing_keys:
            log_test("Test 8", False, f"Missing keys: {missing_keys}")
            return
        
        # Verify catalog
        if not isinstance(data['catalog'], list) or len(data['catalog']) != 8:
            log_test("Test 8", False, f"Expected catalog with 8 features, got {len(data.get('catalog', []))}")
            return
        
        # Verify tiers (should now have 4: free, pro, business, studio)
        if not isinstance(data['tiers'], list) or len(data['tiers']) != 4:
            log_test("Test 8", False, f"Expected 4 tiers, got {len(data.get('tiers', []))}")
            return
        
        # Verify matrix structure
        matrix = data['matrix']
        if not isinstance(matrix, dict):
            log_test("Test 8", False, "Matrix should be a dict")
            return
        
        # Verify each tier has 8 features
        for tier_key in ['free', 'pro', 'business', 'studio']:
            if tier_key not in matrix:
                log_test("Test 8", False, f"Tier '{tier_key}' not in matrix")
                return
            if len(matrix[tier_key]) != 8:
                log_test("Test 8", False, f"Tier '{tier_key}' should have 8 features, got {len(matrix[tier_key])}")
                return
        
        log_test("Test 8", True, f"Got correct structure: catalog={len(data['catalog'])}, tiers={len(data['tiers'])}, matrix with 4 tiers × 8 features")
        
    except Exception as e:
        log_test("Test 8", False, f"Exception: {str(e)}")


def test_9_update_free_tier_custom_colors():
    """Test 9: PUT /api/admin/pricing-features?admin=true — enable custom_colors for free tier"""
    print("\n=== Test 9: PUT /api/admin/pricing-features?admin=true (enable custom_colors) ===")
    try:
        # Enable custom_colors for free tier
        payload = {
            "updates": [
                {
                    "tier_key": "free",
                    "feature_key": "custom_colors",
                    "is_enabled": True
                }
            ]
        }
        response = requests.put(
            f"{BASE_URL}/admin/pricing-features?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Test 9", False, f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        # Verify the change by getting user features (as free user)
        features_response = requests.get(f"{BASE_URL}/user/features", timeout=10)
        if features_response.status_code != 200:
            log_test("Test 9", False, f"Failed to verify: {features_response.status_code}")
            return
        
        features_data = features_response.json()
        if features_data['features'].get('custom_colors') is not True:
            log_test("Test 9", False, f"custom_colors should be true, got {features_data['features'].get('custom_colors')}")
            return
        
        log_test("Test 9", True, "Enabled custom_colors for free tier, verified via GET /api/user/features")
        
    except Exception as e:
        log_test("Test 9", False, f"Exception: {str(e)}")


def test_10_update_user_plan_to_pro():
    """Test 10: PUT /api/admin/users/{demo_user_id}?admin=true { plan_key:"pro" }"""
    print("\n=== Test 10: PUT /api/admin/users/{demo_user_id}?admin=true (set plan_key=pro) ===")
    try:
        payload = {
            "plan_key": "pro"
        }
        response = requests.put(
            f"{BASE_URL}/admin/users/{DEMO_USER_ID}?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Test 10", False, f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        user = response.json()
        if user.get('plan_key') != 'pro':
            log_test("Test 10", False, f"Expected plan_key='pro', got '{user.get('plan_key')}'")
            return
        
        # Verify features (should now have pro features, but custom_colors from step 9 should be reverted)
        features_response = requests.get(f"{BASE_URL}/user/features", timeout=10)
        if features_response.status_code != 200:
            log_test("Test 10", False, f"Failed to verify features: {features_response.status_code}")
            return
        
        features_data = features_response.json()
        if features_data['plan_key'] != 'pro':
            log_test("Test 10", False, f"User features should show plan_key='pro', got '{features_data['plan_key']}'")
            return
        
        # Pro tier should have most features enabled (except scroll_stopper)
        expected_enabled = ['respool', 'animated_captions', 'custom_logo', 'hd_export', 'custom_fonts', 'custom_colors', 'intro_outro']
        for feature in expected_enabled:
            if features_data['features'].get(feature) is not True:
                log_test("Test 10", False, f"Pro tier should have {feature}=true, got {features_data['features'].get(feature)}")
                return
        
        if features_data['features'].get('scroll_stopper') is not False:
            log_test("Test 10", False, f"Pro tier should have scroll_stopper=false, got {features_data['features'].get('scroll_stopper')}")
            return
        
        log_test("Test 10", True, f"Updated demo user to plan_key='pro', verified pro features")
        
    except Exception as e:
        log_test("Test 10", False, f"Exception: {str(e)}")


def test_11_update_user_plan_invalid():
    """Test 11: PUT /api/admin/users/{demo_user_id}?admin=true { plan_key:"nonexistent" } → 400"""
    print("\n=== Test 11: PUT /api/admin/users/{demo_user_id}?admin=true (invalid plan_key) ===")
    try:
        payload = {
            "plan_key": "nonexistent"
        }
        response = requests.put(
            f"{BASE_URL}/admin/users/{DEMO_USER_ID}?admin=true",
            json=payload,
            timeout=10
        )
        
        if response.status_code != 400:
            log_test("Test 11", False, f"Expected 400, got {response.status_code}")
            return
        
        error_data = response.json()
        if 'error' not in error_data:
            log_test("Test 11", False, "Expected error message in response")
            return
        
        log_test("Test 11", True, f"Invalid plan_key correctly rejected with 400: {error_data.get('error')}")
        
    except Exception as e:
        log_test("Test 11", False, f"Exception: {str(e)}")


def test_12_delete_free_tier():
    """Test 12: DELETE /api/admin/pricing-tiers/{free_tier_id}?admin=true → 400"""
    print("\n=== Test 12: DELETE /api/admin/pricing-tiers/{free_tier_id}?admin=true (cannot delete default) ===")
    global free_tier_id
    
    if not free_tier_id:
        log_test("Test 12", False, "free_tier_id not set (Test 4 may have failed)")
        return
    
    try:
        response = requests.delete(
            f"{BASE_URL}/admin/pricing-tiers/{free_tier_id}?admin=true",
            timeout=10
        )
        
        if response.status_code != 400:
            log_test("Test 12", False, f"Expected 400, got {response.status_code}")
            return
        
        error_data = response.json()
        if 'error' not in error_data:
            log_test("Test 12", False, "Expected error message in response")
            return
        
        log_test("Test 12", True, f"Cannot delete default/free tier: {error_data.get('error')}")
        
    except Exception as e:
        log_test("Test 12", False, f"Exception: {str(e)}")


def test_13_delete_studio_tier():
    """Test 13: DELETE /api/admin/pricing-tiers/{studio_id}?admin=true → cascades"""
    print("\n=== Test 13: DELETE /api/admin/pricing-tiers/{studio_id}?admin=true (cascade) ===")
    global studio_tier_id
    
    if not studio_tier_id:
        log_test("Test 13", False, "studio_tier_id not set (Test 5 may have failed)")
        return
    
    try:
        response = requests.delete(
            f"{BASE_URL}/admin/pricing-tiers/{studio_tier_id}?admin=true",
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Test 13", False, f"Expected 200, got {response.status_code}: {response.text}")
            return
        
        # Verify tier is deleted
        tiers_response = requests.get(f"{BASE_URL}/admin/pricing-tiers?admin=true", timeout=10)
        if tiers_response.status_code == 200:
            tiers = tiers_response.json()
            studio_exists = any(t['id'] == studio_tier_id for t in tiers)
            if studio_exists:
                log_test("Test 13", False, "Studio tier still exists after deletion")
                return
        
        # Verify feature rows are deleted
        features_response = requests.get(f"{BASE_URL}/admin/pricing-features?admin=true", timeout=10)
        if features_response.status_code == 200:
            features_data = features_response.json()
            if 'studio' in features_data['matrix']:
                log_test("Test 13", False, "Studio feature rows still exist after tier deletion")
                return
        
        log_test("Test 13", True, "Deleted studio tier, cascaded feature rows")
        
    except Exception as e:
        log_test("Test 13", False, f"Exception: {str(e)}")


def test_14_user_cascade_on_tier_delete():
    """Test 14: Create new tier, assign user to it, delete tier, verify user moved to 'free'"""
    print("\n=== Test 14: User cascade on tier deletion ===")
    try:
        # Create a new test tier
        payload = {
            "name": "Test Tier",
            "price_usd": 99
        }
        create_response = requests.post(
            f"{BASE_URL}/admin/pricing-tiers?admin=true",
            json=payload,
            timeout=10
        )
        
        if create_response.status_code != 200:
            log_test("Test 14", False, f"Failed to create test tier: {create_response.status_code}")
            return
        
        test_tier = create_response.json()
        test_tier_id = test_tier['id']
        test_tier_key = test_tier['key']
        
        # Assign demo user to this tier
        assign_response = requests.put(
            f"{BASE_URL}/admin/users/{DEMO_USER_ID}?admin=true",
            json={"plan_key": test_tier_key},
            timeout=10
        )
        
        if assign_response.status_code != 200:
            log_test("Test 14", False, f"Failed to assign user to test tier: {assign_response.status_code}")
            return
        
        # Verify user is on test tier
        user = assign_response.json()
        if user.get('plan_key') != test_tier_key:
            log_test("Test 14", False, f"User not assigned to test tier: {user.get('plan_key')}")
            return
        
        # Delete the test tier
        delete_response = requests.delete(
            f"{BASE_URL}/admin/pricing-tiers/{test_tier_id}?admin=true",
            timeout=10
        )
        
        if delete_response.status_code != 200:
            log_test("Test 14", False, f"Failed to delete test tier: {delete_response.status_code}")
            return
        
        # Verify user was moved to 'free'
        user_response = requests.get(f"{BASE_URL}/user/features", timeout=10)
        if user_response.status_code != 200:
            log_test("Test 14", False, f"Failed to get user features: {user_response.status_code}")
            return
        
        user_features = user_response.json()
        if user_features['plan_key'] != 'free':
            log_test("Test 14", False, f"User should be moved to 'free', got '{user_features['plan_key']}'")
            return
        
        log_test("Test 14", True, f"Created test tier, assigned user, deleted tier → user moved to 'free'")
        
    except Exception as e:
        log_test("Test 14", False, f"Exception: {str(e)}")


def cleanup():
    """MANDATORY CLEANUP: Restore state to original"""
    print("\n=== CLEANUP: Restoring original state ===")
    
    try:
        # 1. Restore free tier's custom_colors to false
        print("1. Restoring free tier's custom_colors to false...")
        payload = {
            "updates": [
                {
                    "tier_key": "free",
                    "feature_key": "custom_colors",
                    "is_enabled": False
                }
            ]
        }
        response = requests.put(
            f"{BASE_URL}/admin/pricing-features?admin=true",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            print("   ✅ Restored free tier's custom_colors to false")
        else:
            print(f"   ⚠️  Failed to restore custom_colors: {response.status_code}")
        
        # 2. Restore demo user to plan_key='free', role='user', is_admin=false
        print("2. Restoring demo user to plan_key='free', role='user'...")
        payload = {
            "plan_key": "free",
            "role": "user",
            "is_admin": False
        }
        response = requests.put(
            f"{BASE_URL}/admin/users/{DEMO_USER_ID}?admin=true",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            print("   ✅ Restored demo user to plan_key='free', role='user'")
        else:
            print(f"   ⚠️  Failed to restore demo user: {response.status_code}")
        
        # 3. Delete any test tiers (studio, test_tier, etc.)
        print("3. Deleting test tiers...")
        tiers_response = requests.get(f"{BASE_URL}/admin/pricing-tiers?admin=true", timeout=10)
        if tiers_response.status_code == 200:
            tiers = tiers_response.json()
            for tier in tiers:
                if tier['key'] not in DEFAULT_TIER_KEYS:
                    delete_response = requests.delete(
                        f"{BASE_URL}/admin/pricing-tiers/{tier['id']}?admin=true",
                        timeout=10
                    )
                    if delete_response.status_code == 200:
                        print(f"   ✅ Deleted test tier: {tier['key']}")
                    else:
                        print(f"   ⚠️  Failed to delete tier {tier['key']}: {delete_response.status_code}")
        
        # 4. Verify 3 default tiers still exist
        print("4. Verifying 3 default tiers exist...")
        tiers_response = requests.get(f"{BASE_URL}/admin/pricing-tiers?admin=true", timeout=10)
        if tiers_response.status_code == 200:
            tiers = tiers_response.json()
            tier_keys = [t['key'] for t in tiers]
            if set(tier_keys) == set(DEFAULT_TIER_KEYS):
                print(f"   ✅ 3 default tiers exist: {tier_keys}")
            else:
                print(f"   ⚠️  Unexpected tiers: {tier_keys}")
        
        print("\n✅ CLEANUP COMPLETE")
        
    except Exception as e:
        print(f"\n❌ CLEANUP FAILED: {str(e)}")


def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in test_results if r['passed'])
    total = len(test_results)
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    for result in test_results:
        status = "✅" if result['passed'] else "❌"
        print(f"{status} {result['test']}")
    
    print("\n" + "="*60)
    
    return passed == total


def main():
    """Run all tests"""
    print("="*60)
    print("PHASE 1: Feature Gating & Pricing Engine - Backend Tests")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Demo User ID: {DEMO_USER_ID}")
    print(f"Admin User ID: {ADMIN_USER_ID}")
    
    # Run all tests in order
    test_1_get_user_features_free()
    test_2_get_user_features_admin()
    test_3_get_pricing_tiers_no_admin()
    test_4_get_pricing_tiers_admin()
    test_5_create_studio_tier()
    test_6_create_duplicate_tier()
    test_7_update_studio_tier()
    test_8_get_pricing_features()
    test_9_update_free_tier_custom_colors()
    test_10_update_user_plan_to_pro()
    test_11_update_user_plan_invalid()
    test_12_delete_free_tier()
    test_13_delete_studio_tier()
    test_14_user_cascade_on_tier_delete()
    
    # Cleanup
    cleanup()
    
    # Print summary
    all_passed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
