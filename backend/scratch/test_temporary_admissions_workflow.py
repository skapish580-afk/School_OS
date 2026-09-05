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
from apps.students.models import Student, StudentDocument
from apps.enrollments.models import StudentEnrollment
from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section
from apps.students.views import StudentViewSet

# Setup school, grade, section, and admin user
school = School.objects.first()
admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN'], school=school).first()
if not admin_user:
    admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']).first()

grade_obj = GradeConfiguration.objects.filter(program__school=school).first()
section_obj = Section.objects.filter(school=school, grade_config=grade_obj).first()

print(f"School: {school.display_name}")
print(f"Admin User: {admin_user.email}")
print(f"Grade: {grade_obj.grade_name}, Section: {section_obj.section_letter}")

# Clean up if test records already exist
Student.objects.filter(suid="S-GWD--TEMP-WORKFLOW-7").delete()
User.objects.filter(email="tempworkflow@school-os.edu").delete()

# Get initial class strength
initial_student_count = section_obj.student_count
print(f"Initial class strength (ACTIVE only): {initial_student_count}")

# 1. Simulate "Save Details" to create a TEMPORARY student with missing fields
factory = APIRequestFactory()
view = StudentViewSet.as_view({'post': 'create'})

# Email is provided, but DOB, Address, Coordinates, and documents are missing
payload = {
    'first_name': 'TempWorkflow',
    'last_name': 'Student',
    'user_email': 'tempworkflow@school-os.edu',
    'grade': grade_obj.grade_name,
    'section': section_obj.section_letter,
    'status': 'TEMPORARY'
}

request = factory.post('/api/v1/students/', payload, format='json')
force_authenticate(request, user=admin_user)
response = view(request)

print(f"Save Details response status: {response.status_code}")
assert response.status_code == 201, f"Failed to save details: {response.data}"

student_id = response.data.get('id')
student = Student.objects.get(id=student_id)
print(f"Student created. SUID: {student.suid}, Status: {student.status}")

# 2. Verify class strength did NOT change
section_obj.refresh_from_db()
print(f"Class strength after temporary admission: {section_obj.student_count}")
assert section_obj.student_count == initial_student_count, "Temporary student should not count towards class strength!"

# 3. Try to Confirm Admission (should fail because required details and documents are missing)
view_confirm = StudentViewSet.as_view({'post': 'confirm_admission'})
request_confirm = factory.post(f'/api/v1/students/{student.id}/confirm_admission/', {}, format='json')
force_authenticate(request_confirm, user=admin_user)
response_confirm = view_confirm(request_confirm, pk=student.id)

print(f"Confirm Admission status: {response_confirm.status_code}")
print(f"Confirm Admission response: {response_confirm.data}")
assert response_confirm.status_code == 400
assert "Required details are missing" in response_confirm.data.get('error'), "Expected fields missing validation error"

# 4. Fill in missing details (simulate profile editing)
student.date_of_birth = "2010-08-20"
student.address = "456 Main St"
student.latitude = 19.076
student.longitude = 72.877
student.save()
print("Filled required profile fields (DOB, Address, Latitude, Longitude).")

# 5. Try to Confirm Admission again (should fail because required documents are still missing)
response_confirm_docs = view_confirm(request_confirm, pk=student.id)
print(f"Confirm Admission status after filling fields: {response_confirm_docs.status_code}")
print(f"Confirm Admission response: {response_confirm_docs.data}")
assert response_confirm_docs.status_code == 400
assert "required documents must be uploaded" in response_confirm_docs.data.get('error'), "Expected documents missing validation error"

# 6. Upload required documents
for doc_type in ['BIRTH_CERTIFICATE', 'TRANSFER_CERTIFICATE', 'MARK_SHEET']:
    StudentDocument.objects.create(
        student=student,
        document_type=doc_type,
        title=f"Original {doc_type}",
        file="doc.pdf"
    )
print("Uploaded required documents (Birth Certificate, Transfer Certificate, Mark Sheet).")

# 7. Confirm Admission (should succeed now)
response_confirm_ok = view_confirm(request_confirm, pk=student.id)
print(f"Confirm Admission status after filling all requirements: {response_confirm_ok.status_code}")
assert response_confirm_ok.status_code == 200

# Verify final student status is ACTIVE
student.refresh_from_db()
print(f"Final student status: {student.status}")
assert student.status == 'ACTIVE'

# 8. Verify class strength increased by 1
section_obj.refresh_from_db()
print(f"Final class strength: {section_obj.student_count}")
assert section_obj.student_count == initial_student_count + 1, "Class strength count should increase by 1 after student is ACTIVE!"

# Clean up
student.user.delete()
student.delete()
print("SUCCESS: Admissions and class strength workflow fully verified!")
