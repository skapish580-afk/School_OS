"""
Integration test using a real JWT token (matches production behavior).
Run: python scratch/test_reports.py  (from backend/ with PYTHONPATH=.)
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
admin = (User.objects.filter(user_type='SCHOOL_ADMIN').first()
         or User.objects.filter(is_superuser=True).first()
         or User.objects.first())

if not admin:
    print("ERROR: No users in database")
    exit(1)

# Get a real JWT token — exactly what the frontend sends
refresh = RefreshToken.for_user(admin)
access_token = str(refresh.access_token)
print(f"User: {admin.email} ({admin.user_type}), school={getattr(admin, 'school', None)}")
print(f"JWT token obtained: {access_token[:40]}...")

client = APIClient()
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

endpoints = [
    ('/api/v1/reports/students/',     'Students'),
    ('/api/v1/reports/attendance/',   'Attendance'),
    ('/api/v1/reports/finance/',      'Finance'),
    ('/api/v1/reports/achievements/', 'Achievements'),
]
params = '?format=csv&start_date=2020-01-01&end_date=2026-12-31'

print()
for url, name in endpoints:
    resp = client.get(url + params)
    ct = resp.get('Content-Type', '')
    body_preview = resp.content[:120] if resp.status_code != 200 else b'(csv data)'
    print(f"  [{name}] {resp.status_code}  {ct}  |  {body_preview}")
