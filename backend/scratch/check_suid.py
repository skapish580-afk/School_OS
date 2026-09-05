import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student

suid = 'S-GWD--2026-9050E7-6'
students = Student.objects.filter(suid=suid)
print(f"Total students for SUID {suid}: {students.count()}")
for s in students:
    print(f"ID={s.id}, Name={s.user.get_full_name()}, Status={s.status}, School={s.school.name if s.school else 'No School'}")
