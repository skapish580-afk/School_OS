import os
import django
import sys

# Set up Django environment
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student

students = Student.objects.all()
print(f"Total students in live directory: {students.count()}")
for idx, s in enumerate(students):
    name = s.user.get_full_name() if (s.user and hasattr(s.user, 'get_full_name')) else (s.user.username if s.user else 'No User')
    school_name = s.school.name if s.school else 'No School'
    print(f"{idx + 1}: ID={s.id}, SUID={s.suid}, Name={name}, Status={s.status}, School={school_name}")
