import os, django, sys
sys.path.insert(0, 'C:/Users/kapis/OneDrive/Documents/GitHub/SCHOO--main/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.students.models import Student
from apps.gatepass.models import GatePass
from apps.library.models import Book, LibraryPolicy
from apps.transport.models import Vehicle, Route, Stop
from apps.assets.models import Asset
from apps.achievements.models import Achievement
from apps.enrollments.models import StudentEnrollment
from apps.attendance.models import AttendanceSession, StudentAttendance
from django.contrib.auth import get_user_model
from django.utils import timezone
import datetime
import uuid

User = get_user_model()
school = School.objects.get(display_name='NHPS')
students = list(Student.objects.filter(school=school))

if not students:
    print("No students in NHPS to seed data for.")
    sys.exit(1)

print(f"Seeding data for school: {school.display_name} ({school.id})")

# 1. Library Books
if Book.objects.filter(school=school).count() == 0:
    books = [
        {"title": "Introduction to Algorithms", "author": "Thomas H. Cormen", "isbn": "9780262033848", "category": "COMPUTER_SCIENCE"},
        {"title": "Clean Code", "author": "Robert C. Martin", "isbn": "9780132350884", "category": "COMPUTER_SCIENCE"},
        {"title": "A Brief History of Time", "author": "Stephen Hawking", "isbn": "9780553380163", "category": "SCIENCE"},
        {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "isbn": "9780743273565", "category": "FICTION"},
    ]
    for b in books:
        Book.objects.create(
            school=school,
            title=b["title"],
            author=b["author"],
            isbn=b["isbn"],
            category=b["category"],
            total_copies=5,
            available_copies=5,
            accession_number=f"ACC-{uuid.uuid4().hex[:8].upper()}"
        )
    print(f"Seeded {len(books)} books.")

# 2. Library Policy
if not LibraryPolicy.objects.filter(school=school).exists():
    LibraryPolicy.objects.create(
        school=school,
        max_books_student=3,
        max_duration_student=14,
        max_books_teacher=5,
        max_duration_teacher=30,
        per_day_late_fee=5.0
    )
    print("Seeded library policy.")

# 3. Transport Route & Stops & Vehicles
if Route.objects.filter(school=school).count() == 0:
    route = Route.objects.create(
        school=school,
        name="NHPS North Route",
        origin="NHPS Campus",
        destination="North Suburbs"
    )
    Stop.objects.create(route=route, name="Stop A - Sector 12", order=1, pickup_time=datetime.time(7, 30), drop_time=datetime.time(14, 30))
    Stop.objects.create(route=route, name="Stop B - Sector 15", order=2, pickup_time=datetime.time(7, 45), drop_time=datetime.time(14, 45))
    
    Vehicle.objects.create(
        school=school,
        registration_number="MH-12-NH-1234",
        vehicle_type="BUS",
        capacity=40,
        route=route
    )
    Vehicle.objects.create(
        school=school,
        registration_number="MH-12-NH-5678",
        vehicle_type="VAN",
        capacity=15,
        route=route
    )
    print("Seeded transport route, stops, and vehicles.")

# 4. Assets
if Asset.objects.filter(school=school).count() == 0:
    assets = [
        {"name": "Dell Inspiron Laptop", "category": "ELECTRONICS", "cost": 45000.0, "status": "AVAILABLE"},
        {"name": "Classroom Smartboard", "category": "FURNITURE", "cost": 75000.0, "status": "AVAILABLE"},
        {"name": "Lab Microscope", "category": "EQUIPMENT", "cost": 12000.0, "status": "AVAILABLE"},
        {"name": "Library Bookshelf", "category": "FURNITURE", "cost": 8000.0, "status": "AVAILABLE"},
    ]
    for a in assets:
        Asset.objects.create(
            school=school,
            name=a["name"],
            category=a["category"],
            cost=a["cost"],
            status=a["status"],
            purchase_date=timezone.now().date()
        )
    print(f"Seeded {len(assets)} assets.")

# 5. Gate Passes
if GatePass.objects.filter(student__school=school).count() <= 1:
    reasons = ["Medical Emergency", "Dentist Appointment", "Family Event"]
    for i, s in enumerate(students):
        GatePass.objects.create(
            student=s,
            reason=reasons[i % len(reasons)],
            status="ACTIVE",
            valid_until=timezone.now() + datetime.timedelta(hours=2),
            issued_by=User.objects.filter(school=school, user_type='SCHOOL_ADMIN').first() or User.objects.filter(is_superuser=True).first()
        )
    print("Seeded gate passes.")

# 6. Achievements
if Achievement.objects.filter(student__school=school).count() == 0:
    achievements = [
        {"title": "First Place - Science Fair", "desc": "Won first place in the inter-school science fair with a robotics project.", "category": "ACADEMIC"},
        {"title": "Gold Medal - 100m Sprint", "desc": "Won gold medal in the annual sports meet 100m sprint event.", "category": "SPORTS"},
    ]
    for i, ach in enumerate(achievements):
        student = students[i % len(students)]
        enrollment, _ = StudentEnrollment.objects.get_or_create(
            student=student,
            school=school,
            defaults={
                "grade": "10",
                "section": "A",
                "academic_year": "2025-2026",
                "status": "ACTIVE"
            }
        )
        Achievement.objects.create(
            student=enrollment,
            title=ach["title"],
            description=ach["desc"],
            category=ach["category"],
            date_awarded=timezone.now().date()
        )
    print("Seeded achievements.")

# 7. Attendance
if AttendanceSession.objects.filter(created_by__school=school).count() == 0:
    # Get a school admin or teacher to create attendance
    creator = User.objects.filter(school=school).first()
    session = AttendanceSession.objects.create(
        grade="10",
        section="A",
        date=timezone.now().date(),
        created_by=creator
    )
    for s in students:
        StudentAttendance.objects.create(
            session=session,
            student=s,
            status="PRESENT",
            remarks="Present in class"
        )
    print("Seeded attendance sessions and student records.")
