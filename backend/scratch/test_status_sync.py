import os
import django
import sys

sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounts.models import User
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from apps.schools.models import School
from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section

school = School.objects.first()
admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN'], school=school).first()
if not admin_user:
    admin_user = User.objects.filter(user_type__in=['SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN']).first()

grade_obj = GradeConfiguration.objects.filter(program__school=school).first()
section_obj = Section.objects.filter(school=school, grade_config=grade_obj).first()

print(f"School: {school.display_name}")

# Clean up any potential leftover user/student
User.objects.filter(email="sync_test_user@school-os.edu").delete()
Student.objects.filter(suid="S-GWD--SYNC-TEST-9").delete()

# 1. Create a Student (which creates a User)
user = User.objects.create(
    email="sync_test_user@school-os.edu",
    first_name="SyncTest",
    last_name="Student",
    user_type="STUDENT"
)

student = Student.objects.create(
    suid="S-GWD--SYNC-TEST-9",
    user=user,
    school=school,
    date_of_birth="2010-01-01",
    status="ACTIVE"
)

# 2. Create an Enrollment
enrollment = StudentEnrollment.objects.create(
    student=student,
    school=school,
    grade=grade_obj.grade_name,
    section=section_obj.section_letter,
    status="ACTIVE",
    academic_year="2025-2026"
)

print(f"Initial states: Student Status = {student.status}, Enrollment Status = {enrollment.status}")
assert student.status == 'ACTIVE'
assert enrollment.status == 'ACTIVE'

# 3. Test: Update Student status -> updates latest Enrollment status
print("\n--- Test: Student status -> Enrollment status ---")
student.status = 'TEMPORARY'
student.save()

enrollment.refresh_from_db()
print(f"After Student status = TEMPORARY: Student Status = {student.status}, Enrollment Status = {enrollment.status}")
assert enrollment.status == 'TEMPORARY', f"Expected enrollment status to be TEMPORARY, got {enrollment.status}"

# 4. Test: Update Student status to WITHDRAWN -> updates active Enrollment status
print("\n--- Test: Student status to WITHDRAWN -> Enrollment status ---")
student.status = 'WITHDRAWN'
student.save()

enrollment.refresh_from_db()
print(f"After Student status = WITHDRAWN: Student Status = {student.status}, Enrollment Status = {enrollment.status}")
assert enrollment.status == 'WITHDRAWN', f"Expected enrollment status to be WITHDRAWN, got {enrollment.status}"

# 5. Test: Update Enrollment status -> updates Student status
print("\n--- Test: Enrollment status -> Student status ---")
enrollment.status = 'ACTIVE'
enrollment.save()

student.refresh_from_db()
print(f"After Enrollment status = ACTIVE: Student Status = {student.status}, Enrollment Status = {enrollment.status}")
assert student.status == 'ACTIVE', f"Expected student status to be ACTIVE, got {student.status}"

# Cleanup
user.delete()
student.delete()
print("\nSUCCESS: Two-way status synchronization successfully verified!")
