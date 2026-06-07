import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.views import SchoolSettingsViewSet
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.accounts.models import User

def check_settings():
    user = User.objects.filter(user_type='SCHOOL_ADMIN').first()
    if not user:
        print("No SCHOOL_ADMIN user found")
        return
        
    factory = APIRequestFactory()
    view = SchoolSettingsViewSet.as_view({'get': 'my_settings'})
    request = factory.get('/api/v1/schools/settings/my_settings/')
    force_authenticate(request, user=user)
    
    response = view(request)
    print(f"Response status: {response.status_code}")
    print(f"Response data: {json.dumps(response.data, indent=2)}")

if __name__ == "__main__":
    check_settings()
