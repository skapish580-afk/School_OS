from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.schools.models import School
from apps.students.models import Student
from apps.teachers.models import Teacher, TeacherAssignment
from apps.enrollments.models import StudentEnrollment
from apps.academics.models import Grade, Section, Subject, SubjectMapping
import uuid

User = get_user_model()

class Command(BaseCommand):
    help = 'Populates database with comprehensive sample data for testing'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Starting database population...'))
        
        # 1. CREATE SCHOOL
        school, created = School.objects.get_or_create(
            code="DHS-001",
            defaults={
                'name': "Demo High School",
                'board': "CBSE",
                'address': "123 Education Street, Mumbai",
                'contact_email': "admin@demoschool.edu"
            }
        )
        self.stdout.write(self.style.SUCCESS(f'✓ School: {school.name}'))
        
        # 2. CREATE GRADES (1-12)
        grades = []
        for num in range(1, 13):
            grade, _ = Grade.objects.get_or_create(
                school=school,
                grade_number=num,
                defaults={'grade_name': f'Class {num}', 'is_active': True}
            )
            grades.append(grade)
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(grades)} grades (Class 1-12)'))
        
        # 3. CREATE TEACHERS
        teachers = []
        teacher_data = [
            {'first_name': 'Rajesh', 'last_name': 'Kumar', 'email': 'rajesh.kumar@demo.edu'},
            {'first_name': 'Priya', 'last_name': 'Sharma', 'email': 'priya.sharma@demo.edu'},
            {'first_name': 'Amit', 'last_name': 'Patel', 'email': 'amit.patel@demo.edu'},
            {'first_name': 'Neha', 'last_name': 'Singh', 'email': 'neha.singh@demo.edu'},
            {'first_name': 'Suresh', 'last_name': 'Reddy', 'email': 'suresh.reddy@demo.edu'},
        ]
        
        for td in teacher_data:
            user, _ = User.objects.get_or_create(
                email=td['email'],
                defaults={
                    'first_name': td['first_name'],
                    'last_name': td['last_name'],
                    'user_type': 'TEACHER',
                    'is_active': True
                }
            )
            if not user.has_usable_password():
                user.set_password('teacher123')
                user.save()
            
            teacher, _ = Teacher.objects.get_or_create(
                user=user,
                defaults={'qualifications': 'M.Sc., B.Ed.', 'experience_years': 5}
            )
            teachers.append(teacher)
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(teachers)} teachers'))
        
        # 4. CREATE SECTIONS (Class 10, 11, 12 with sections A, B)
        sections = []
        for grade in grades[9:12]:  # Class 10, 11, 12
            for letter in ['A', 'B']:
                section, _ = Section.objects.get_or_create(
                    school=school,
                    grade=grade,
                    section_letter=letter,
                    defaults={
                        'capacity': 40,
                        'room_number': f'{grade.grade_number}-{letter}',
                        'class_teacher': teachers[sections.__len__() % len(teachers)],
                        'is_active': True
                    }
                )
                sections.append(section)
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(sections)} sections'))
        
        # 5. CREATE STUDENTS AND ENROLLMENTS
        students = []
        student_data = [
            ('Aarav', 'Kumar'), ('Vivaan', 'Singh'), ('Aditya', 'Sharma'), ('Vihaan', 'Patel'),
            ('Arjun', 'Reddy'), ('Sai', 'Prasad'), ('Reyansh', 'Gupta'), ('Ayaan', 'Khan'),
            ('Krishna', 'Rao'), ('Ishaan', 'Nair'), ('Advika', 'Sharma'), ('Aadhya', 'Singh'),
            ('Ananya', 'Patel'), ('Diya', 'Kumar'), ('Ira', 'Reddy'), ('Kiara', 'Gupta'),
            ('Navya', 'Nair'), ('Saanvi', 'Rao'), ('Sara', 'Khan'), ('Myra', 'Prasad')
        ]
        
        for i, (first, last) in enumerate(student_data):
            user, _ = User.objects.get_or_create(
                email=f'student{i+1}@demo.edu',
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'user_type': 'STUDENT',
                    'is_active': True
                }
            )
            if not user.has_usable_password():
                user.set_password('student123')
                user.save()
            
            student, _ = Student.objects.get_or_create(
                user=user,
                defaults={
                    'date_of_birth': '2008-01-01',
                    'gender': 'MALE' if i % 2 == 0 else 'FEMALE'
                }
            )
            students.append(student)
            
            # Enroll student in a section (distribute evenly across sections)
            section = sections[i % len(sections)]
            StudentEnrollment.objects.get_or_create(
                student=student,
                school=school,
                academic_year='2025-2026',
                defaults={
                    'grade': section.grade.grade_name,
                    'section': section.section_letter,
                    'roll_number': f'{i+1:02d}',
                    'status': 'ACTIVE'
                }
            )
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(students)} students with enrollments'))
        
        # 6. CREATE SUBJECTS
        subjects = []
        subject_data = [
            {'name': 'Mathematics', 'code': 'MATH', 'type': 'CORE'},
            {'name': 'Science', 'code': 'SCI', 'type': 'CORE'},
            {'name': 'English', 'code': 'ENG', 'type': 'CORE'},
            {'name': 'Hindi', 'code': 'HIN', 'type': 'CORE'},
            {'name': 'Social Studies', 'code': 'SST', 'type': 'CORE'},
            {'name': 'Computer Science', 'code': 'CS', 'type': 'ELECTIVE'},
            {'name': 'Physical Education', 'code': 'PE', 'type': 'ACTIVITY'},
        ]
        
        for sd in subject_data:
            subject, _ = Subject.objects.get_or_create(
                school=school,
                code=sd['code'],
                defaults={
                    'name': sd['name'],
                    'subject_type': sd['type'],
                    'passing_marks': 40,
                    'is_core': sd['type'] == 'CORE',
                    'is_active': True
                }
            )
            subjects.append(subject)
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created {len(subjects)} subjects'))
        
        # 7. CREATE SUBJECT MAPPINGS
        mappings = 0
        for section in sections:
            for i, subject in enumerate(subjects[:5]):  # Core subjects for all sections
                SubjectMapping.objects.get_or_create(
                    school=school,
                    subject=subject,
                    section=section,
                    defaults={
                        'teacher': teachers[i % len(teachers)],
                        'periods_per_week': 5,
                        'max_marks': 100,
                        'is_active': True
                    }
                )
                mappings += 1
        
        self.stdout.write(self.style.SUCCESS(f'✓ Created {mappings} subject mappings'))
        
        # SUMMARY
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('DATABASE POPULATED SUCCESSFULLY!'))
        self.stdout.write('='*60)
        self.stdout.write(f'School:   {school.name} ({school.code})')
        self.stdout.write(f'Grades:   Class 1-12')
        self.stdout.write(f'Sections: {len(sections)} (Class 10A, 10B, 11A, 11B, 12A, 12B)')
        self.stdout.write(f'Teachers: {len(teachers)}')
        self.stdout.write(f'Students: {len(students)}')
        self.stdout.write(f'Subjects: {len(subjects)}')
        self.stdout.write('\nLOGIN CREDENTIALS:')
        self.stdout.write('  Teachers: teacher1@demo.edu / teacher123')
        self.stdout.write('  Students: student1@demo.edu / student123')
        self.stdout.write('\nREFRESH YOUR BROWSER AND TRY CREATING:')
        self.stdout.write('  - New sections in other classes')
        self.stdout.write('  - Timetables')
        self.stdout.write('  - Exams')
        self.stdout.write('  - Results')
