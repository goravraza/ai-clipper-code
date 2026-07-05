#!/usr/bin/env python3
"""
Phase 2 Backend Testing: Site Settings, CMS Pages, Pricing Tiers (monthly/yearly + credits)
Tests all Phase 2 endpoints with comprehensive coverage including edge cases.
"""
import requests
import json
import io
from PIL import Image

BASE_URL = "https://shorts-studio-78.preview.emergentagent.com/api"

# Store original values for cleanup
original_site_settings = {}
created_page_ids = []
original_pro_tier = {}

def create_test_png(size_kb=1):
    """Create a small test PNG image"""
    img = Image.new('RGB', (10, 10), color='red')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def test_1_get_site_settings_public():
    """Test 1: GET /api/site-settings (public, no auth)"""
    print("\n=== Test 1: GET /api/site-settings (public) ===")
    try:
        r = requests.get(f"{BASE_URL}/site-settings")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify all required fields are present
        required_fields = [
            'site_name', 'site_tagline', 'logo_url', 'favicon_url', 'primary_color', 
            'accent_color', 'meta_title', 'meta_description', 'announcement_enabled',
            'announcement_text', 'announcement_link', 'announcement_bg', 'header_code',
            'footer_code', 'credit_price_per_minute_usd', 'credit_price_per_minute_inr',
            'features_scheduling_enabled', 'social_twitter', 'social_instagram',
            'social_youtube', 'social_linkedin'
        ]
        
        missing = [f for f in required_fields if f not in data]
        assert not missing, f"Missing fields: {missing}"
        
        # Store original values for cleanup
        global original_site_settings
        original_site_settings = {
            'site_name': data.get('site_name'),
            'primary_color': data.get('primary_color'),
            'announcement_text': data.get('announcement_text'),
            'features_scheduling_enabled': data.get('features_scheduling_enabled', False)
        }
        
        print(f"✅ Test 1 PASSED - All required fields present")
        print(f"   site_name: {data.get('site_name')}")
        print(f"   primary_color: {data.get('primary_color')}")
        return True
    except Exception as e:
        print(f"❌ Test 1 FAILED: {e}")
        return False

def test_2_get_admin_site_settings_no_auth():
    """Test 2: GET /api/admin/site-settings without admin=true → 403"""
    print("\n=== Test 2: GET /api/admin/site-settings (no admin) ===")
    try:
        r = requests.get(f"{BASE_URL}/admin/site-settings")
        print(f"Status: {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print(f"✅ Test 2 PASSED - 403 forbidden without admin=true")
        return True
    except Exception as e:
        print(f"❌ Test 2 FAILED: {e}")
        return False

def test_3_get_admin_site_settings_with_auth():
    """Test 3: GET /api/admin/site-settings with admin=true → returns doc"""
    print("\n=== Test 3: GET /api/admin/site-settings (with admin=true) ===")
    try:
        r = requests.get(f"{BASE_URL}/admin/site-settings?admin=true")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert 'site_name' in data, "Missing site_name"
        print(f"✅ Test 3 PASSED - Admin can access settings")
        print(f"   site_name: {data.get('site_name')}")
        return True
    except Exception as e:
        print(f"❌ Test 3 FAILED: {e}")
        return False

def test_4_put_admin_site_settings():
    """Test 4: PUT /api/admin/site-settings - update fields"""
    print("\n=== Test 4: PUT /api/admin/site-settings ===")
    try:
        payload = {
            "site_name": "TestApp",
            "primary_color": "#00ff00",
            "announcement_text": "Test announcement"
        }
        r = requests.put(f"{BASE_URL}/admin/site-settings?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('site_name') == "TestApp", f"site_name not updated: {data.get('site_name')}"
        assert data.get('primary_color') == "#00ff00", f"primary_color not updated: {data.get('primary_color')}"
        assert data.get('announcement_text') == "Test announcement", f"announcement_text not updated"
        
        # Verify via GET
        r2 = requests.get(f"{BASE_URL}/site-settings")
        data2 = r2.json()
        assert data2.get('site_name') == "TestApp", "Changes not persisted"
        
        print(f"✅ Test 4 PASSED - Settings updated successfully")
        return True
    except Exception as e:
        print(f"❌ Test 4 FAILED: {e}")
        return False

def test_5_upload_logo():
    """Test 5: POST /api/admin/site-settings/upload (logo)"""
    print("\n=== Test 5: POST /api/admin/site-settings/upload (logo) ===")
    try:
        png_buf = create_test_png(1)
        files = {'file': ('test_logo.png', png_buf, 'image/png')}
        data = {'kind': 'logo'}
        
        r = requests.post(f"{BASE_URL}/admin/site-settings/upload?admin=true", files=files, data=data)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        result = r.json()
        assert result.get('ok') == True, "Upload not successful"
        assert 'url' in result, "No URL returned"
        assert result.get('field') == 'logo_url', f"Wrong field: {result.get('field')}"
        
        print(f"✅ Test 5 PASSED - Logo uploaded")
        print(f"   URL: {result.get('url')}")
        return True
    except Exception as e:
        print(f"❌ Test 5 FAILED: {e}")
        return False

def test_6_upload_favicon():
    """Test 6: POST /api/admin/site-settings/upload (favicon)"""
    print("\n=== Test 6: POST /api/admin/site-settings/upload (favicon) ===")
    try:
        png_buf = create_test_png(1)
        files = {'file': ('test_favicon.png', png_buf, 'image/png')}
        data = {'kind': 'favicon'}
        
        r = requests.post(f"{BASE_URL}/admin/site-settings/upload?admin=true", files=files, data=data)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        result = r.json()
        assert result.get('field') == 'favicon_url', f"Wrong field: {result.get('field')}"
        
        print(f"✅ Test 6 PASSED - Favicon uploaded")
        return True
    except Exception as e:
        print(f"❌ Test 6 FAILED: {e}")
        return False

def test_7_upload_oversize_logo():
    """Test 7: Upload file > 50KB → 400 error"""
    print("\n=== Test 7: Upload oversize logo (>50KB) ===")
    try:
        # Create a larger image
        img = Image.new('RGB', (500, 500), color='blue')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        
        files = {'file': ('large_logo.png', buf, 'image/png')}
        data = {'kind': 'logo'}
        
        r = requests.post(f"{BASE_URL}/admin/site-settings/upload?admin=true", files=files, data=data)
        print(f"Status: {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        
        print(f"✅ Test 7 PASSED - Oversize file rejected")
        return True
    except Exception as e:
        print(f"❌ Test 7 FAILED: {e}")
        return False

def test_8_upload_wrong_extension():
    """Test 8: Upload .txt file → 400 error"""
    print("\n=== Test 8: Upload wrong file type (.txt) ===")
    try:
        files = {'file': ('test.txt', io.BytesIO(b'hello'), 'text/plain')}
        data = {'kind': 'logo'}
        
        r = requests.post(f"{BASE_URL}/admin/site-settings/upload?admin=true", files=files, data=data)
        print(f"Status: {r.status_code}")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        
        print(f"✅ Test 8 PASSED - Wrong file type rejected")
        return True
    except Exception as e:
        print(f"❌ Test 8 FAILED: {e}")
        return False

def test_9_upload_without_admin():
    """Test 9: Upload without admin=true → 403"""
    print("\n=== Test 9: Upload without admin=true ===")
    try:
        png_buf = create_test_png(1)
        files = {'file': ('test.png', png_buf, 'image/png')}
        data = {'kind': 'logo'}
        
        r = requests.post(f"{BASE_URL}/admin/site-settings/upload", files=files, data=data)
        print(f"Status: {r.status_code}")
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        
        print(f"✅ Test 9 PASSED - Upload requires admin")
        return True
    except Exception as e:
        print(f"❌ Test 9 FAILED: {e}")
        return False

def test_10_create_cms_page():
    """Test 10: POST /api/admin/pages - create page"""
    print("\n=== Test 10: POST /api/admin/pages (create) ===")
    try:
        payload = {
            "title": "Test Terms",
            "content_html": "<h1>Terms</h1><p>Test content</p>"
        }
        r = requests.post(f"{BASE_URL}/admin/pages?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('slug') == 'test-terms', f"Wrong slug: {data.get('slug')}"
        assert data.get('title') == 'Test Terms', "Title not set"
        assert 'id' in data, "No ID returned"
        
        created_page_ids.append(data['id'])
        
        print(f"✅ Test 10 PASSED - Page created")
        print(f"   ID: {data['id']}, Slug: {data['slug']}")
        return True
    except Exception as e:
        print(f"❌ Test 10 FAILED: {e}")
        return False

def test_11_get_admin_pages():
    """Test 11: GET /api/admin/pages - list all pages"""
    print("\n=== Test 11: GET /api/admin/pages ===")
    try:
        r = requests.get(f"{BASE_URL}/admin/pages?admin=true")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert isinstance(data, list), "Expected array"
        
        # Find our created page
        found = any(p.get('slug') == 'test-terms' for p in data)
        assert found, "Created page not in list"
        
        print(f"✅ Test 11 PASSED - Admin can list pages ({len(data)} pages)")
        return True
    except Exception as e:
        print(f"❌ Test 11 FAILED: {e}")
        return False

def test_12_get_public_pages():
    """Test 12: GET /api/pages - public list"""
    print("\n=== Test 12: GET /api/pages (public) ===")
    try:
        r = requests.get(f"{BASE_URL}/pages")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert isinstance(data, list), "Expected array"
        
        # Should include our public page
        found = any(p.get('slug') == 'test-terms' for p in data)
        assert found, "Public page not visible"
        
        print(f"✅ Test 12 PASSED - Public pages visible")
        return True
    except Exception as e:
        print(f"❌ Test 12 FAILED: {e}")
        return False

def test_13_get_page_by_slug():
    """Test 13: GET /api/pages/test-terms - get single page"""
    print("\n=== Test 13: GET /api/pages/test-terms ===")
    try:
        r = requests.get(f"{BASE_URL}/pages/test-terms")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('slug') == 'test-terms', "Wrong page"
        assert 'content_html' in data, "No content"
        
        print(f"✅ Test 13 PASSED - Page retrieved by slug")
        return True
    except Exception as e:
        print(f"❌ Test 13 FAILED: {e}")
        return False

def test_14_update_page_to_private():
    """Test 14: PUT /api/admin/pages/:id - set visibility to private"""
    print("\n=== Test 14: PUT /api/admin/pages/:id (set private) ===")
    try:
        page_id = created_page_ids[0]
        payload = {"visibility": "private"}
        
        r = requests.put(f"{BASE_URL}/admin/pages/{page_id}?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('visibility') == 'private', "Visibility not updated"
        
        print(f"✅ Test 14 PASSED - Page set to private")
        return True
    except Exception as e:
        print(f"❌ Test 14 FAILED: {e}")
        return False

def test_15_get_private_page_no_admin():
    """Test 15: GET /api/pages/test-terms (private, no admin) → 404"""
    print("\n=== Test 15: GET /api/pages/test-terms (private, no admin) ===")
    try:
        r = requests.get(f"{BASE_URL}/pages/test-terms")
        print(f"Status: {r.status_code}")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"
        
        print(f"✅ Test 15 PASSED - Private page hidden from public")
        return True
    except Exception as e:
        print(f"❌ Test 15 FAILED: {e}")
        return False

def test_16_get_private_page_with_admin():
    """Test 16: GET /api/pages/test-terms?admin=true - admin can see private"""
    print("\n=== Test 16: GET /api/pages/test-terms (with admin=true) ===")
    try:
        r = requests.get(f"{BASE_URL}/pages/test-terms?admin=true")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('visibility') == 'private', "Not private"
        
        print(f"✅ Test 16 PASSED - Admin can see private page")
        return True
    except Exception as e:
        print(f"❌ Test 16 FAILED: {e}")
        return False

def test_17_create_duplicate_page():
    """Test 17: POST /api/admin/pages with duplicate title → 409"""
    print("\n=== Test 17: POST /api/admin/pages (duplicate) ===")
    try:
        payload = {
            "title": "Test Terms",
            "content_html": "<p>Duplicate</p>"
        }
        r = requests.post(f"{BASE_URL}/admin/pages?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 409, f"Expected 409, got {r.status_code}"
        
        print(f"✅ Test 17 PASSED - Duplicate slug rejected")
        return True
    except Exception as e:
        print(f"❌ Test 17 FAILED: {e}")
        return False

def test_18_get_pricing_tiers():
    """Test 18: GET /api/admin/pricing-tiers - verify monthly/yearly fields"""
    print("\n=== Test 18: GET /api/admin/pricing-tiers ===")
    try:
        r = requests.get(f"{BASE_URL}/admin/pricing-tiers?admin=true")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert isinstance(data, list), "Expected array"
        assert len(data) >= 3, f"Expected at least 3 tiers, got {len(data)}"
        
        # Find Pro tier and store original values
        pro_tier = next((t for t in data if t.get('key') == 'pro'), None)
        assert pro_tier, "Pro tier not found"
        
        global original_pro_tier
        original_pro_tier = {
            'id': pro_tier['id'],
            'price_usd_monthly': pro_tier.get('price_usd_monthly'),
            'price_inr_monthly': pro_tier.get('price_inr_monthly'),
            'price_usd_yearly': pro_tier.get('price_usd_yearly'),
            'price_inr_yearly': pro_tier.get('price_inr_yearly'),
            'credits_included_monthly': pro_tier.get('credits_included_monthly')
        }
        
        # Verify all tiers have new fields
        for tier in data:
            assert 'price_usd_monthly' in tier, f"Missing price_usd_monthly in {tier.get('key')}"
            assert 'price_inr_monthly' in tier, f"Missing price_inr_monthly in {tier.get('key')}"
            assert 'price_usd_yearly' in tier, f"Missing price_usd_yearly in {tier.get('key')}"
            assert 'price_inr_yearly' in tier, f"Missing price_inr_yearly in {tier.get('key')}"
            assert 'credits_included_monthly' in tier, f"Missing credits_included_monthly in {tier.get('key')}"
        
        print(f"✅ Test 18 PASSED - All tiers have monthly/yearly pricing")
        print(f"   Pro tier: ${pro_tier.get('price_usd_monthly')}/mo, ${pro_tier.get('price_usd_yearly')}/yr")
        print(f"   Credits: {pro_tier.get('credits_included_monthly')}/month")
        return True
    except Exception as e:
        print(f"❌ Test 18 FAILED: {e}")
        return False

def test_19_update_pricing_tier():
    """Test 19: PUT /api/admin/pricing-tiers/:id - update yearly price and credits"""
    print("\n=== Test 19: PUT /api/admin/pricing-tiers/:id ===")
    try:
        pro_id = original_pro_tier['id']
        payload = {
            "price_usd_yearly": 200,
            "credits_included_monthly": 700
        }
        
        r = requests.put(f"{BASE_URL}/admin/pricing-tiers/{pro_id}?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('price_usd_yearly') == 200, f"Yearly price not updated: {data.get('price_usd_yearly')}"
        assert data.get('credits_included_monthly') == 700, f"Credits not updated: {data.get('credits_included_monthly')}"
        
        print(f"✅ Test 19 PASSED - Tier updated successfully")
        return True
    except Exception as e:
        print(f"❌ Test 19 FAILED: {e}")
        return False

def test_20_legacy_price_sync():
    """Test 20: PUT with legacy price_usd → should update price_usd_monthly"""
    print("\n=== Test 20: PUT /api/admin/pricing-tiers/:id (legacy sync) ===")
    try:
        pro_id = original_pro_tier['id']
        payload = {"price_usd": 25}
        
        r = requests.put(f"{BASE_URL}/admin/pricing-tiers/{pro_id}?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert data.get('price_usd_monthly') == 25, f"Legacy sync failed: {data.get('price_usd_monthly')}"
        
        print(f"✅ Test 20 PASSED - Legacy price_usd synced to price_usd_monthly")
        return True
    except Exception as e:
        print(f"❌ Test 20 FAILED: {e}")
        return False

def test_21_get_user_features():
    """Test 21: GET /api/user/features - verify new pricing fields in tiers"""
    print("\n=== Test 21: GET /api/user/features ===")
    try:
        r = requests.get(f"{BASE_URL}/user/features")
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        data = r.json()
        assert 'tiers' in data, "Missing tiers"
        assert 'matrix' in data, "Missing matrix"
        assert 'catalog' in data, "Missing catalog"
        
        tiers = data['tiers']
        assert len(tiers) >= 3, f"Expected at least 3 tiers, got {len(tiers)}"
        
        # Verify each tier has new pricing fields
        for tier in tiers:
            assert 'price_usd_monthly' in tier, f"Missing price_usd_monthly in {tier.get('key')}"
            assert 'price_usd_yearly' in tier, f"Missing price_usd_yearly in {tier.get('key')}"
            assert 'credits_included_monthly' in tier, f"Missing credits_included_monthly in {tier.get('key')}"
        
        # Verify catalog has 8 features
        assert len(data['catalog']) == 8, f"Expected 8 features, got {len(data['catalog'])}"
        
        print(f"✅ Test 21 PASSED - User features includes new pricing fields")
        print(f"   Tiers: {len(tiers)}, Features: {len(data['catalog'])}")
        return True
    except Exception as e:
        print(f"❌ Test 21 FAILED: {e}")
        return False

def test_22_feature_flag_enable():
    """Test 22: PUT /api/admin/site-settings - enable scheduling feature"""
    print("\n=== Test 22: PUT /api/admin/site-settings (enable scheduling) ===")
    try:
        payload = {"features_scheduling_enabled": True}
        
        r = requests.put(f"{BASE_URL}/admin/site-settings?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        
        # Verify via GET
        r2 = requests.get(f"{BASE_URL}/site-settings")
        data = r2.json()
        assert data.get('features_scheduling_enabled') == True, "Feature flag not enabled"
        
        print(f"✅ Test 22 PASSED - Feature flag enabled")
        return True
    except Exception as e:
        print(f"❌ Test 22 FAILED: {e}")
        return False

def test_23_invalid_json_body():
    """Test 23: PUT /api/admin/site-settings with invalid JSON → 400"""
    print("\n=== Test 23: PUT /api/admin/site-settings (invalid JSON) ===")
    try:
        r = requests.put(
            f"{BASE_URL}/admin/site-settings?admin=true",
            data="not json",
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {r.status_code}")
        # Should fail to parse JSON
        assert r.status_code in [400, 500], f"Expected 400/500, got {r.status_code}"
        
        print(f"✅ Test 23 PASSED - Invalid JSON rejected")
        return True
    except Exception as e:
        print(f"❌ Test 23 FAILED: {e}")
        return False

def test_24_missing_required_fields():
    """Test 24: POST /api/admin/pages without title → 400"""
    print("\n=== Test 24: POST /api/admin/pages (missing title) ===")
    try:
        payload = {"content_html": "<p>No title</p>"}
        
        r = requests.post(f"{BASE_URL}/admin/pages?admin=true", json=payload)
        print(f"Status: {r.status_code}")
        # Should fail validation
        assert r.status_code in [400, 500], f"Expected 400, got {r.status_code}"
        
        print(f"✅ Test 24 PASSED - Missing required field rejected")
        return True
    except Exception as e:
        print(f"❌ Test 24 FAILED: {e}")
        return False

def cleanup():
    """Cleanup: Delete test pages and restore original values"""
    print("\n=== CLEANUP ===")
    
    # Delete test pages
    for page_id in created_page_ids:
        try:
            r = requests.delete(f"{BASE_URL}/admin/pages/{page_id}?admin=true")
            print(f"Deleted page {page_id}: {r.status_code}")
        except Exception as e:
            print(f"Failed to delete page {page_id}: {e}")
    
    # Restore Pro tier
    if original_pro_tier:
        try:
            pro_id = original_pro_tier['id']
            payload = {
                "price_usd_monthly": 19,
                "price_inr_monthly": 1499,
                "price_usd_yearly": 190,
                "price_inr_yearly": 14990,
                "credits_included_monthly": 600
            }
            r = requests.put(f"{BASE_URL}/admin/pricing-tiers/{pro_id}?admin=true", json=payload)
            print(f"Restored Pro tier: {r.status_code}")
        except Exception as e:
            print(f"Failed to restore Pro tier: {e}")
    
    # Restore site settings
    if original_site_settings:
        try:
            payload = {
                "site_name": original_site_settings.get('site_name', 'ClipForge AI'),
                "primary_color": original_site_settings.get('primary_color', '#a855f7'),
                "announcement_text": original_site_settings.get('announcement_text', '🎉 New: Animated word-by-word captions + custom intros are live!'),
                "features_scheduling_enabled": False
            }
            r = requests.put(f"{BASE_URL}/admin/site-settings?admin=true", json=payload)
            print(f"Restored site settings: {r.status_code}")
        except Exception as e:
            print(f"Failed to restore site settings: {e}")

def main():
    print("=" * 80)
    print("PHASE 2 BACKEND TESTING - Site Settings, CMS Pages, Pricing Tiers")
    print("=" * 80)
    
    results = []
    
    # Site Settings Tests
    results.append(("Test 1: GET /api/site-settings (public)", test_1_get_site_settings_public()))
    results.append(("Test 2: GET /api/admin/site-settings (no auth)", test_2_get_admin_site_settings_no_auth()))
    results.append(("Test 3: GET /api/admin/site-settings (with auth)", test_3_get_admin_site_settings_with_auth()))
    results.append(("Test 4: PUT /api/admin/site-settings", test_4_put_admin_site_settings()))
    results.append(("Test 5: Upload logo", test_5_upload_logo()))
    results.append(("Test 6: Upload favicon", test_6_upload_favicon()))
    results.append(("Test 7: Upload oversize file", test_7_upload_oversize_logo()))
    results.append(("Test 8: Upload wrong file type", test_8_upload_wrong_extension()))
    results.append(("Test 9: Upload without admin", test_9_upload_without_admin()))
    
    # CMS Pages Tests
    results.append(("Test 10: Create CMS page", test_10_create_cms_page()))
    results.append(("Test 11: GET /api/admin/pages", test_11_get_admin_pages()))
    results.append(("Test 12: GET /api/pages (public)", test_12_get_public_pages()))
    results.append(("Test 13: GET /api/pages/:slug", test_13_get_page_by_slug()))
    results.append(("Test 14: Update page to private", test_14_update_page_to_private()))
    results.append(("Test 15: GET private page (no admin)", test_15_get_private_page_no_admin()))
    results.append(("Test 16: GET private page (with admin)", test_16_get_private_page_with_admin()))
    results.append(("Test 17: Create duplicate page", test_17_create_duplicate_page()))
    
    # Pricing Tiers Tests
    results.append(("Test 18: GET pricing tiers", test_18_get_pricing_tiers()))
    results.append(("Test 19: Update pricing tier", test_19_update_pricing_tier()))
    results.append(("Test 20: Legacy price sync", test_20_legacy_price_sync()))
    results.append(("Test 21: GET /api/user/features", test_21_get_user_features()))
    
    # Feature Flags Tests
    results.append(("Test 22: Enable feature flag", test_22_feature_flag_enable()))
    
    # Edge Cases
    results.append(("Test 23: Invalid JSON body", test_23_invalid_json_body()))
    results.append(("Test 24: Missing required fields", test_24_missing_required_fields()))
    
    # Cleanup
    cleanup()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print("\n" + "=" * 80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
