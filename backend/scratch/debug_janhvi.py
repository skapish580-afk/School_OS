import os
import django
import sys

sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment
from apps.timeline.models import StudentEnrollmentArchive

print("--- Searching for Janhvi Parmar ---")

# 1. Search in Student table
students = Student.objects.filter(user__first_name__icontains="Janhvi") | Student.objects.filter(user__last_name__icontains="Parmar")
print(f"Found {students.count()} records in Student table:")
for s in students:
    print(f"  Student SUID: {s.suid}, Status: {s.status}, School: {s.school.name if s.school else None}, Name: {s.user.first_name} {s.user.last_name}")

# 2. Search in StudentEnrollment table
enrollments = StudentEnrollment.objects.filter(student__user__first_name__icontains="Janhvi") | StudentEnrollment.objects.filter(student__user__last_name__icontains="Parmar")
print(f"\nFound {enrollments.count()} records in StudentEnrollment table:")
for e in enrollments:
    print(f"  Enrollment ID: {e.id}, Student SUID: {e.student.suid}, Status: {e.status}, School: {e.school.name if e.school else None}, Grade: {e.grade}, Section: {e.section}")

# 3. Search in StudentEnrollmentArchive table
archives = StudentEnrollmentArchive.objects.filter(admission_details__first_name__icontains="Janhvi") | StudentEnrollmentArchive.objects.filter(admission_details__last_name__icontains="Parmar")
print(f"\nFound {archives.count()} records in StudentEnrollmentArchive table:")
for a in archives:
    print(f"  Archive ID: {a.id}, SUID: {a.student_global_id}, Status: {a.status}, School: {a.school_name}")
