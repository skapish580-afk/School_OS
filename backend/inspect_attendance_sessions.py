import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.attendance.models import AttendanceSession, StudentAttendance

def inspect_sessions(grade, section):
    sessions = AttendanceSession.objects.filter(grade=grade, section=section)
    print(f"Sessions for {grade}-{section}: {sessions.count()}")
    for sess in sessions:
        print(f"\nSession ID: {sess.id}, Date: {sess.date}")
        records = sess.records.all()
        print(f"Total records in session: {records.count()}")
        for r in records:
            print(f"  - Record: {r.student.user.full_name} (Student ID: {r.student_id}, Status: {r.status})")

if __name__ == "__main__":
    inspect_sessions("12", "A")
