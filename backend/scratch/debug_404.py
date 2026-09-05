import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Users\kapis\OneDrive\Documents\GitHub\SCHOO--main\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.students.models import Student
from apps.timeline.models import StudentEnrollmentArchive

# Get all archives
archives = StudentEnrollmentArchive.objects.all()
print(f"Total archives: {archives.count()}")
for a in archives:
    print(f"Archive: SUID={a.student_global_id}, School={a.school_name}")
    
# Get live students who are active/temporary
live = Student.objects.filter(status__in=['ACTIVE', 'TEMPORARY'])
print(f"Live active/temporary students: {live.count()}")
for s in live:
    print(f"  Live: SUID={s.suid}, Name={s.user.get_full_name()}, Status={s.status}")

# Let's check the viewset queryset filter
live_suids = live.values_list('suid', flat=True)
print(f"Live SUIDs: {list(live_suids)}")

filtered_archives = archives.exclude(student_global_id__in=live_suids)
print(f"Filtered archives: {filtered_archives.count()}")
for a in filtered_archives:
    print(f"  Remaining Archive: SUID={a.student_global_id}")
