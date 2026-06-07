import os
import django
from datetime import date, timedelta
import random

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.schools.models import School
from apps.transport.models import Route, Stop, Vehicle
from apps.library.models import Book
from apps.assets.models import Asset

from apps.community.models import ForumPost
from apps.students.models import Student

def seed():
    school = School.objects.first()
    if not school:
        print("No school found. Register a school first.")
        return

    print(f"Seeding demo data for school: {school.name}")

    # 1. Transport
    if not Route.objects.filter(school=school).exists():
        route = Route.objects.create(school=school, name="Route 1 - North Side", origin="School Main Gate", destination="North Park")
        Stop.objects.create(route=route, name="Main Gate", order=1, pickup_time="07:00", drop_time="15:00")
        Stop.objects.create(route=route, name="Central Mall", order=2, pickup_time="07:15", drop_time="14:45")
        
        Vehicle.objects.create(
            school=school, 
            registration_number=f"MH-01-AB-{random.randint(1000, 9999)}",
            vehicle_type="Bus",
            capacity=40,
            driver_name="John Doe",
            driver_phone="9876543210",
            current_latitude=19.0760,
            current_longitude=72.8777
        )
        print("Created Transport demo data.")

    # 2. Library
    if not Book.objects.filter(school=school).exists():
        books = [
            ("The Great Gatsby", "F. Scott Fitzgerald", "FIC-001", "Fiction"),
            ("A Brief History of Time", "Stephen Hawking", "SCI-001", "Science"),
            ("Advanced Mathematics", "R.S. Aggarwal", "ACAD-001", "Academics"),
            ("Python Programming", "Guido van Rossum", "IT-001", "IT"),
        ]
        for title, author, acc, cat in books:
            Book.objects.create(
                school=school, title=title, author=author, 
                accession_number=acc, category=cat, 
                total_copies=5, available_copies=random.randint(1, 5)
            )
        print("Created Library demo data.")

    # 3. Assets
    if not Asset.objects.filter(school=school).exists():
        assets = [
            ("Projector - Lab 1", "AST-001", "IT", 45000),
            ("Microscope", "AST-002", "Lab", 12000),
            ("Football Set", "AST-003", "Sports", 5000),
            ("Teacher Laptop", "AST-004", "IT", 65000),
        ]
        for name, code, cat, cost in assets:
            Asset.objects.create(
                school=school, name=name, asset_code=code, 
                category=cat, cost=cost, status='AVAILABLE'
            )
        print("Created Assets demo data.")

    # 4. Community
    if not ForumPost.objects.filter(school=school).exists():
        from apps.accounts.models import User
        admin = User.objects.filter(school=school, user_type='SCHOOL_ADMIN').first()
        if admin:
            ForumPost.objects.create(
                school=school,
                author=admin,
                title="Welcome to our new School Portal!",
                content="We are excited to launch the new School OS community hub. Feel free to share your thoughts and connect with other members.",
                is_global=False
            )
            ForumPost.objects.create(
                school=None, # Global
                author=admin,
                title="Platform Update: Multi-tenancy Live",
                content="Our global network now supports over 500 schools. Networking features are now available to all admins.",
                is_global=True
            )
            print("Created Community demo data.")

    # 5. Alumni (Mark existing students as graduated)
    graduating_students = Student.objects.filter(school=school)[:5]
    for student in graduating_students:
        student.status = 'GRADUATED'
        student.alumni_directory_consent = True
        student.save()
    print(f"Marked {graduating_students.count()} students as Alumni.")

if __name__ == "__main__":
    seed()
