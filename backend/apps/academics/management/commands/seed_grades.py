from django.core.management.base import BaseCommand
from apps.schools.models import School
from apps.schools.models_programs import Campus, AcademicProgram, GradeConfiguration

class Command(BaseCommand):
    help = 'Seeds grade levels 1-12 for all schools using the new Program-based architecture'

    def handle(self, *args, **kwargs):
        schools = School.objects.all()
        
        if not schools.exists():
            self.stdout.write(self.style.WARNING('No schools found. Please create a school first.'))
            return
        
        for school in schools:
            self.stdout.write(self.style.MIGRATE_HEADING(f'Seeding for: {school.display_name}'))
            
            # 1. Ensure a Campus exists
            campus, created = Campus.objects.get_or_create(
                school=school,
                is_primary=True,
                defaults={
                    'name': 'Main Campus',
                    'code': 'MAIN',
                    'address': school.address or 'School Address'
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  [OK] Created Campus: {campus.name}'))
            
            # 2. Ensure an Academic Program exists
            program, created = AcademicProgram.objects.get_or_create(
                school=school,
                code='GEN',
                defaults={
                    'name': 'General Academic Program',
                    'campus': campus,
                    'board': 'CBSE',
                    'education_level': 'SECONDARY',
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  [OK] Created Program: {program.name}'))
            
            # 3. Seed Grades 1-12
            created_count = 0
            for grade_num in range(1, 13):
                grade_name = str(grade_num)
                grade, created = GradeConfiguration.objects.get_or_create(
                    program=program,
                    grade_name=grade_name,
                    defaults={
                        'grade_order': grade_num,
                        'max_sections': 5,
                        'section_capacity': 50,
                        'is_active': True
                    }
                )
                if created:
                    created_count += 1
            
            if created_count > 0:
                self.stdout.write(self.style.SUCCESS(f'  [OK] Created {created_count} grades (1-12)'))
            else:
                self.stdout.write('  - Grades 1-12 already exist')
        
        self.stdout.write(self.style.SUCCESS('\n[DONE] Grade seeding complete!'))
