import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounts.models import User
from apps.schools.models import School
from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from apps.schools.models_programs import GradeConfiguration
from apps.academics.models import Section
from apps.academics.serializers import SectionListSerializer

# Find school, grade, and section
school = School.objects.first()
grade_obj = GradeConfiguration.objects.filter(program__school=school).first()
section_obj = Section.objects.filter(school=school, grade_config=grade_obj).first()

print(f"School: {school.display_name}")
print(f"Grade: {grade_obj.grade_name}, Section: {section_obj.section_letter}")

# Get initial counts
initial_student_count = section_obj.student_count
print(f"Initial student_count property: {initial_student_count}")

# 1. Create a TEMPORARY student
temp_user = User.objects.create(
    first_name="TempStrength",
    last_name="Student",
    email="tempstrength@school-os.edu",
    user_type="STUDENT"
)
temp_student = Student.objects.create(
    suid="S-GWD--TEMP-STRENGTH-1",
    user=temp_user,
    school=school,
    status="TEMPORARY",
    grade_config=grade_obj,
    current_section=section_obj
)
temp_enrollment = StudentEnrollment.objects.create(
    student=temp_student,
    school=school,
    grade=grade_obj.grade_name,
    section=section_obj.section_letter,
    status="TEMPORARY",
    academic_year="2025-2026"
)

# 2. Check updated counts
section_obj.refresh_from_db()
updated_student_count = section_obj.student_count
print(f"Updated student_count property: {updated_student_count}")

# Check SectionListSerializer
serializer = SectionListSerializer(section_obj)
serialized_student_count = serializer.data.get('student_count')
print(f"Serialized student_count: {serialized_student_count}")

# Cleanup
temp_enrollment.delete()
temp_student.delete()
temp_user.delete()

assert updated_student_count == initial_student_count + 1, f"Expected student count to increase by 1, got {updated_student_count} (initial was {initial_student_count})"
assert serialized_student_count == initial_student_count + 1, f"Expected serialized student count to increase by 1, got {serialized_student_count}"

print("SUCCESS: Class strength correctly tracks temporary students!")
