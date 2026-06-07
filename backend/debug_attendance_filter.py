import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student
from apps.enrollments.models import StudentEnrollment

def debug_filter(grade, section):
    print(f"Filtering for Grade: {grade}, Section: {section}")
    
    # 1. Check all enrollments for this grade/section
    enrollments = StudentEnrollment.objects.filter(grade=grade, section=section, status='ACTIVE')
    print(f"Total ACTIVE enrollments found: {enrollments.count()}")
    for e in enrollments:
        print(f"  - Enrollment: {e.student.user.full_name} (ID: {e.student_id}, Grade: {e.grade}, Section: {e.section})")
        
    # 2. Check the student query used in attendance
    students = Student.objects.filter(
        enrollments__grade=grade,
        enrollments__section=section,
        enrollments__status='ACTIVE'
    ).distinct()
    
    print(f"\nStudents returned by query: {students.count()}")
    for s in students:
        print(f"  - Student: {s.user.full_name} (ID: {s.id})")

if __name__ == "__main__":
    debug_filter("12", "A")
