from django.core.management.base import BaseCommand
from apps.schools.models import School
from apps.academics.models import Grade

class Command(BaseCommand):
    help = 'Quick setup: Creates demo school and seeds grades 1-12'

    def handle(self, *args, **kwargs):
        # Step 1: Create demo school if none exists
        if not School.objects.exists():
            school = School.objects.create(
                name="Demo High School",
                code="DHS-001",
                board="CBSE",
                address="123 Education Street",
                contact_email="admin@demoschool.edu"
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Created school: {school.name} (ID: {school.id})'))
        else:
            school = School.objects.first()
            self.stdout.write(f'Using existing school: {school.name}')
        
        # Step 2: Seed grades 1-12
        created_count = 0
        for grade_num in range(1, 13):
            grade, created = Grade.objects.get_or_create(
                school=school,
                grade_number=grade_num,
                defaults={
                    'grade_name': f'Class {grade_num}',
                    'is_active': True
                }
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created: {grade.grade_name}'))
        
        if created_count == 0:
            self.stdout.write('All grades already exist')
        else:
            self.stdout.write(self.style.SUCCESS(f'\n✓ Setup complete! Created {created_count} grades for {school.name}'))
            self.stdout.write('\nYou can now refresh your browser and select classes 1-12 in the dropdown.')
