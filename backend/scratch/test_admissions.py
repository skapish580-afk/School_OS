import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.accounts.models import User
from apps.schools.models import School
from apps.timeline.models import StudentEnrollmentArchive
from apps.timeline.views import StudentEnrollmentArchiveViewSet
from apps.students.views import StudentViewSet
from apps.students.models import Student, StudentDocument

# Get archive and admin user
archive = StudentEnrollmentArchive.objects.first()
if not archive:
    print("No archive found!")
    sys.exit(1)

# Find corresponding school
school = School.objects.filter(display_name=archive.school_name).first() or School.objects.first()
admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN'], school=school).first()

if not admin_user:
    admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']).first()
    
print(f"Using archive SUID: {archive.student_global_id}")
print(f"Using admin user: {admin_user.email} (School: {admin_user.school})")

# Find grade and section
from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section

grade_obj = GradeConfiguration.objects.filter(program__school=admin_user.school).first()
section_obj = Section.objects.filter(school=admin_user.school, grade_config=grade_obj).first()

if not grade_obj or not section_obj:
    print(f"No grade/section found in school {admin_user.school}!")
    sys.exit(1)

# Call admit to create the temporary student
factory = APIRequestFactory()
view = StudentEnrollmentArchiveViewSet.as_view({'post': 'admit'})
request = factory.post(f'/api/v1/timeline/archive/{archive.id}/admit/', {
    'grade': grade_obj.grade_name,
    'section': section_obj.section_letter
}, format='json')
force_authenticate(request, user=admin_user)
response = view(request, pk=archive.id)

print(f"Admit Response status: {response.status_code}")

if response.status_code == 200:
    student_id = response.data.get('student_id')
    student = Student.objects.get(id=student_id)
    print(f"Student created. Status: {student.status}")
    
    # Delete one required document to force it to fail
    deleted_count, _ = StudentDocument.objects.filter(student=student, document_type='MARK_SHEET').delete()
    print(f"Deleted {deleted_count} MARK_SHEET documents from student profile.")
    
    # Try confirm admission (should fail because MARK_SHEET is missing)
    view_student = StudentViewSet.as_view({'post': 'confirm_admission'})
    request_confirm = factory.post(f'/api/v1/students/{student.id}/confirm_admission/', {}, format='json')
    force_authenticate(request_confirm, user=admin_user)
    response_confirm = view_student(request_confirm, pk=student.id)
    print(f"Confirm Admission (with missing docs) Response status: {response_confirm.status_code}")
    print(f"Confirm Admission (with missing docs) Response data: {response_confirm.data}")
    
    # Restore the document
    StudentDocument.objects.create(
        student=student,
        document_type='MARK_SHEET',
        title='Restored Mark Sheet',
        file='test.pdf'
    )
    print("Restored the missing MARK_SHEET document.")
    
    # Fill in any missing details so confirmation passes details check too!
    student.date_of_birth = student.date_of_birth or "2010-01-01"
    student.address = student.address or "123 Main St"
    student.latitude = student.latitude or 19.0
    student.longitude = student.longitude or 72.0
    if not student.user.first_name:
        student.user.first_name = "First"
        student.user.save()
    student.save()
    
    # Confirm again (should succeed)
    response_confirm_ok = view_student(request_confirm, pk=student.id)
    print(f"Confirm Admission (with all docs) Response status: {response_confirm_ok.status_code}")
    print(f"Confirm Admission (with all docs) Response data: {response_confirm_ok.data}")
    
    # Verify student status is now ACTIVE
    student.refresh_from_db()
    print(f"Final Student status: {student.status}")
    
    # Let's clean up
    student.delete()
    print("Cleaned up temporary student.")
