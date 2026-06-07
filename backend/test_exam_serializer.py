import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.academics.models import Section, SubjectMapping, Exam
from apps.schools.models import School

section = Section.objects.first()
mapping = SubjectMapping.objects.filter(section=section).first()

if section and mapping:
    print(f"Testing Exam creation for Section: {section.full_name}, Subject: {mapping.subject.name}")
    # We use internal call or just test the serializer
    from apps.academics.serializers import ExamSerializer
    
    data = {
        'name': 'Test Exam',
        'exam_type': 'UNIT_TEST',
        'section_id': str(section.id),
        'subject_mapping_id': str(mapping.id),
        'exam_date': '2026-05-30',
        'max_marks': 100,
        'passing_marks': 33,
        'academic_year': '2025-2026',
        'duration_minutes': 60,
        'min_attendance_percentage': 75
    }
    
    serializer = ExamSerializer(data=data)
    if serializer.is_valid():
        print("Serializer is valid!")
        # exam = serializer.save()
        # print(f"Exam created: {exam.id}")
    else:
        print(f"Serializer ERRORS: {serializer.errors}")
else:
    print("No section or mapping found to test")
