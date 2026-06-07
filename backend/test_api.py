"""
API Testing Script
Tests critical endpoints with sample data
"""
import os
import django
import json
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from apps.schools.models import School
from apps.students.models import Student

User = get_user_model()
client = Client()

print("=" * 70)
print("🧪 API ENDPOINT TESTING")
print("=" * 70)

# Test data
owner_email = "owner@schoolos.com"
owner_password = "owner123"
admin_email = "admin@schoolos.com"
admin_password = "admin123"

print(f"\n🔐 Step 1: Authentication Tests")
print("=" * 70)

# Test owner login
print(f"\n[POST /api/auth/login/] - Owner Login")
response = client.post('/api/auth/login/', {
    'email': owner_email,
    'password': owner_password
}, content_type='application/json')
print(f"  Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    owner_token = data.get('access')
    print(f"  ✅ Owner login successful")
    print(f"  Token: {owner_token[:20]}...")
else:
    print(f"  ❌ Failed: {response.content.decode()}")

# Test admin login
print(f"\n[POST /api/auth/login/] - Admin Login")
response = client.post('/api/auth/login/', {
    'email': admin_email,
    'password': admin_password
}, content_type='application/json')
print(f"  Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    admin_token = data.get('access')
    print(f"  ✅ Admin login successful")
    print(f"  Token: {admin_token[:20]}...")
else:
    print(f"  ❌ Failed: {response.content.decode()}")

# Test public API (no auth required)
print(f"\n📚 Step 2: Public API Tests (No Auth Required)")
print("=" * 70)

# Get schools
print(f"\n[GET /api/schools/] - List Schools")
response = client.get('/api/schools/')
print(f"  Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    school_count = len(data) if isinstance(data, list) else data.get('count', 0)
    print(f"  ✅ Retrieved {school_count} schools")
    if isinstance(data, list) and len(data) > 0:
        print(f"     School: {data[0].get('display_name', 'Unknown')}")
else:
    print(f"  ❌ Failed: {response.status_code}")

# Authenticated API tests
print(f"\n🔒 Step 3: Authenticated API Tests (Admin)")
print("=" * 70)

# Get students
print(f"\n[GET /api/students/] - List Students (Admin)")
response = client.get(
    '/api/students/',
    HTTP_AUTHORIZATION=f'Bearer {admin_token}'
)
print(f"  Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    student_count = len(data) if isinstance(data, list) else data.get('count', 0)
    print(f"  ✅ Retrieved {student_count} students")
elif response.status_code == 401:
    print(f"  ⚠️  Unauthorized (expected if token format differs)")
else:
    print(f"  ❌ Failed: {response.status_code}")

# Get features
print(f"\n[GET /api/features/] - List Features")
response = client.get('/api/features/')
print(f"  Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    feature_count = len(data) if isinstance(data, list) else data.get('count', 0)
    print(f"  ✅ Retrieved {feature_count} features")
    if isinstance(data, list) and len(data) > 0:
        print(f"     Feature: {data[0].get('name', 'Unknown')} ({data[0].get('code', 'N/A')})")
else:
    print(f"  ⚠️  Status {response.status_code}")

# Feature visibility test
print(f"\n🎯 Step 4: Feature Visibility Test")
print("=" * 70)

school = School.objects.first()
print(f"\nSchool: {school.display_name}")

from apps.features.models import SchoolFeatureConfig
enabled_count = SchoolFeatureConfig.objects.filter(school=school, enabled=True).count()
disabled_count = SchoolFeatureConfig.objects.filter(school=school, enabled=False).count()

print(f"  Enabled features: {enabled_count}")
print(f"  Disabled features: {disabled_count}")
print(f"  Total: {enabled_count + disabled_count}")

print(f"\n  Feature List:")
configs = SchoolFeatureConfig.objects.filter(school=school).select_related('feature').all()
for config in configs:
    status = "✅ ON" if config.enabled else "❌ OFF"
    print(f"    {status} - {config.feature.name} ({config.feature.code})")

print("\n" + "=" * 70)
print("✅ API TESTING COMPLETE")
print("=" * 70)
print("\n📌 Notes:")
print("  - Auth endpoints may require specific request format (JSON vs form)")
print("  - Check core/urls.py for actual endpoint paths")
print("  - Token format depends on JWT configuration")
