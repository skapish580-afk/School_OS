import os
import django
import sys

# Setup Django environment
sys.path.append(r'c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.academics.models import Exam, Section, SubjectMapping, Result
from apps.students.models import Student
from apps.features.models import SchoolFeatureConfig
import json

def run_verify():
    client = APIClient()
    user = User.objects.get(email='skapish580@gmail.com')
    client.force_authenticate(user=user)
    
    school = user.school
    
    # Get active academic year code
    academic_year = '2025-2026'
    try:
        config = SchoolFeatureConfig.objects.get(school=school, feature__code='ACADEMIC_YEAR')
        config_data = json.loads(config.config_json)
        academic_year = config_data.get('current', '2025-2026')
    except Exception:
        pass
        
    print(f"Active academic year: {academic_year}")
    
    # Get active section, student and subject mapping
    section = Section.objects.filter(school=school).first()
    if not section:
        raise Exception("No section found to run tests")
        
    student = Student.objects.filter(school=school, current_section=section).first()
    if not student:
        raise Exception(f"No active student found in section {section.full_name}")
        
    subject_mapping = SubjectMapping.objects.filter(section=section, is_active=True).first()
    if not subject_mapping:
        raise Exception("No active subject mapping found for section")
        
    print(f"Using section: {section.full_name}, student: {student.user.full_name} (ID: {student.id}), subject mapping: {subject_mapping.id}")
    
    # Get or create an exam
    exam, created = Exam.objects.get_or_create(
        school=school,
        section=section,
        subject_mapping=subject_mapping,
        name='Locking Test Exam',
        defaults={
            'exam_type': 'UNIT_TEST',
            'exam_date': '2026-06-16', # Make sure it's in the past (today >= exam_date)
            'max_marks': 100,
            'passing_marks': 33,
            'duration_minutes': 60,
            'academic_year': academic_year,
            'marks_locked': False
        }
    )
    # Ensure it's not locked for initial test
    exam.marks_locked = False
    exam.exam_date = '2026-06-16' # Ensure in past
    exam.save()
    
    # Clean up previous results for this student and exam
    Result.objects.filter(exam=exam, student=student).delete()
    
    # 1. Try to POST result when marks are not locked (should fail)
    payload = {
        'exam_id': str(exam.id),
        'student_id': student.id,
        'marks_obtained': 85.00,
        'is_absent': False,
        'remarks': 'Good performance'
    }
    
    print("\n[Test 1] Posting result for unlocked exam...")
    response = client.post('/api/v1/academics/results/', payload, format='json')
    print(f"Response status: {response.status_code}, data: {response.data}")
    assert response.status_code == 400
    assert 'exam_id' in response.data or 'non_field_errors' in response.data
    print("Test 1 passed: Blocked result entry for unlocked exam.")
    
    # 2. Lock marks for the exam via POST lock_marks/
    print("\n[Test 2] Locking marks for the exam...")
    response = client.post(f'/api/v1/academics/exams/{exam.id}/lock_marks/')
    print(f"Response status: {response.status_code}, data: {response.data}")
    assert response.status_code == 200
    
    exam.refresh_from_db()
    assert exam.marks_locked is True
    print("Test 2 passed: Exam marks locked successfully.")
    
    # 3. Try to POST result now that marks are locked (should succeed)
    print("\n[Test 3] Posting result for locked exam...")
    response = client.post('/api/v1/academics/results/', payload, format='json')
    print(f"Response status: {response.status_code}")
    if response.status_code != 201:
        print(f"Error detail: {response.data}")
    assert response.status_code == 201
    result_id = response.data['id']
    print(f"Test 3 passed: Result entered successfully for locked exam. Result ID: {result_id}")
    
    # 4. Clean up test data
    Result.objects.filter(id=result_id).delete()
    exam.delete()
    print("\nCleanup completed.")
    print("ALL MARKS LOCKING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_verify()
