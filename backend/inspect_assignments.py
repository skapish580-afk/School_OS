import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.academics.models import SubjectMapping, Syllabus
from apps.teachers.models import TeacherAssignment

print("--- Subject Mappings ---")
for sm in SubjectMapping.objects.all():
    print(f"ID: {sm.id}, Subject: {sm.subject.name}, Section: {sm.section.full_name}, School: {sm.school.id}")

print("\n--- Teacher Assignments ---")
for ta in TeacherAssignment.objects.all():
    print(f"ID: {ta.id}, Teacher: {ta.teacher.user.full_name}, Grade: {ta.grade}, Section: {ta.section}, Subject: {ta.subject}, Year: {ta.academic_year}, School: {ta.school.id}")

print("\n--- Syllabuses ---")
for s in Syllabus.objects.all():
    print(f"ID: {s.id}, Subject: {s.subject_mapping.subject.name}, Section: {s.subject_mapping.section.full_name}, Year: {s.academic_year}, School: {s.school.id}")
