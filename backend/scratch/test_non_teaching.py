import os
import sys
import django
from django.core.files.uploadedfile import SimpleUploadedFile

# Add backend directory to sys.path
sys.path.append(r'C:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.accounts.models import User
from apps.teachers.views import TeacherViewSet
from apps.teachers.models import Teacher, TeacherSchoolAssociation

def test_non_teaching_onboard():
    print("=== STARTING NON-TEACHING ONBOARD TEST ===")
    
    # 1. Fetch user for authentication
    admin_user = User.objects.filter(user_type='PLATFORM_ADMIN').first()
    if not admin_user:
        admin_user = User.objects.first()
        
    print(f"Using Auth User: {admin_user.email}")
    
    # 2. Setup request factory
    factory = APIRequestFactory()
    
    # Onboard data
    data = {
        'email': 'non_teaching_test@school.com',
        'full_name': 'Test NonTeaching Staff',
        'phone': '9876543210',
        'date_of_birth': '1995-05-15',
        'gender': 'F',
        'salary': '45000',
        'date_of_joining': '2026-06-01',
        'qualifications': 'BA Admin',
        'teacher_type': 'NON_TEACHING'
    }
    
    # Make request
    request = factory.post('/api/v1/teachers/profiles/onboard/', data, format='multipart')
    force_authenticate(request, user=admin_user)
    
    view = TeacherViewSet.as_view({'post': 'onboard'})
    response = view(request)
    
    print(f"Response Status Code: {response.status_code}")
    print(f"Response Data: {response.data}")
    
    # Verify DB state
    try:
        teacher = Teacher.objects.get(user__email='non_teaching_test@school.com')
        print(f"Teacher created in DB: id={teacher.id}, teacher_type={teacher.teacher_type} (Expected: NON_TEACHING)")
        assert teacher.teacher_type == 'NON_TEACHING', "teacher_type should be NON_TEACHING!"
        
        # Cleanup
        TeacherSchoolAssociation.objects.filter(teacher=teacher).delete()
        teacher.delete()
        User.objects.filter(email='non_teaching_test@school.com').delete()
        print("Cleanup completed.")
        print("=== TEST COMPLETED SUCCESSFULLY ===")
    except Teacher.DoesNotExist:
        print("FAIL: Teacher profile not found in DB.")
        assert False, "Teacher profile not found!"

if __name__ == '__main__':
    test_non_teaching_onboard()
