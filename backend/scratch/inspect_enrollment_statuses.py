import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.enrollments.models import StudentEnrollment
from django.db.models import Count

statuses = StudentEnrollment.objects.values('status').annotate(count=Count('id'))
print("StudentEnrollment Statuses:")
for s in statuses:
    print(f"  - Status: {s['status']}, Count: {s['count']}")

from apps.students.models import Student
student_statuses = Student.objects.values('status').annotate(count=Count('id'))
print("\nStudent Statuses:")
for s in student_statuses:
    print(f"  - Status: {s['status']}, Count: {s['count']}")
