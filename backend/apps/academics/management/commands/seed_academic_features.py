"""
Django management command to seed academic features.
Run: python manage.py seed_academic_features
"""

from django.core.management.base import BaseCommand
from apps.features.models import Feature


class Command(BaseCommand):
    help = 'Seed academic features for the system'

    def handle(self, *args, **options):
        features_data = [
            # MODULE 1: CLASSES & SECTIONS
            {
                'code': 'MODULE_CLASSES_SECTIONS',
                'name': 'Classes & Sections Management',
                'category': 'CORE',
                'description': 'Basic class and section creation, capacity management',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_CO_CLASS_TEACHER',
                'name': 'Co-Class Teacher Support',
                'category': 'STANDARD',
                'description': 'Assign co-class teacher for support',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_SECTION_CAPACITY_LOCK',
                'name': 'Section Capacity Lock',
                'category': 'STANDARD',
                'description': 'Lock section capacity to prevent enrollment changes',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_BULK_STUDENT_PROMOTION',
                'name': 'Bulk Student Promotion',
                'category': 'STANDARD',
                'description': 'Promote students in bulk at year-end',
                'default_enabled': True,
            },
            
            # MODULE 2: SUBJECTS
            {
                'code': 'MODULE_SUBJECTS',
                'name': 'Subject Management',
                'category': 'CORE',
                'description': 'Define subjects and map to grades/sections',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_SUBJECT_ELECTIVES',
                'name': 'Elective Subjects Support',
                'category': 'STANDARD',
                'description': 'Support for elective and optional subjects',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_CO_TEACHER_ASSIGNMENT',
                'name': 'Co-Teacher Assignment',
                'category': 'STANDARD',
                'description': 'Assign co-teacher for labs/activities',
                'default_enabled': True,
            },
            
            # MODULE 3: TIMETABLE
            {
                'code': 'MODULE_TIMETABLE',
                'name': 'Timetable Management',
                'category': 'CORE',
                'description': 'Create and manage class timetables',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_TIMETABLE_LOCK',
                'name': 'Timetable Locking',
                'category': 'STANDARD',
                'description': 'Lock timetable to prevent changes',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_TEMPORARY_SUBSTITUTIONS',
                'name': 'Temporary Teacher Substitutions',
                'category': 'STANDARD',
                'description': 'Manage temporary teacher substitutions',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_TIMETABLE_CLASH_DETECTION',
                'name': 'Timetable Clash Detection',
                'category': 'ADVANCED',
                'description': 'Detect teacher and room clashes',
                'default_enabled': False,
            },
            
            # MODULE 4: SYLLABUS
            {
                'code': 'MODULE_SYLLABUS',
                'name': 'Syllabus Tracking',
                'category': 'CORE',
                'description': 'Track syllabus planning and execution',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_SYLLABUS_LAG_ALERTS',
                'name': 'Syllabus Lag Alerts',
                'category': 'STANDARD',
                'description': 'Alert when syllabus is behind schedule',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_TEACHER_PACING_COMPARISON',
                'name': 'Teacher Pacing Comparison',
                'category': 'ADVANCED',
                'description': 'Compare progress across teachers',
                'default_enabled': False,
            },
            
            # MODULE 5: EXAMS
            {
                'code': 'MODULE_EXAMS',
                'name': 'Exam Management',
                'category': 'CORE',
                'description': 'Schedule exams and manage exam discipline',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_EXAM_INVIGILATORS',
                'name': 'Exam Invigilator Assignment',
                'category': 'STANDARD',
                'description': 'Assign invigilators to exams',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_GRACE_MARKS',
                'name': 'Grace Marks (Admin Only)',
                'category': 'STANDARD',
                'description': 'Allow admin to award grace marks',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_MALPRACTICE_LOGGING',
                'name': 'Malpractice Incident Logging',
                'category': 'STANDARD',
                'description': 'Log and track exam malpractice incidents',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_REEXAM_MANAGEMENT',
                'name': 'Re-Exam Management',
                'category': 'ADVANCED',
                'description': 'Schedule and manage re-exams',
                'default_enabled': False,
            },
            
            # MODULE 6: RESULTS
            {
                'code': 'MODULE_RESULTS',
                'name': 'Results & Report Cards',
                'category': 'CORE',
                'description': 'Marks entry, moderation, report cards',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_RESULT_MODERATION',
                'name': 'Result Moderation Workflow',
                'category': 'STANDARD',
                'description': 'HOD/Admin review and approval of results',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_RESULT_LOCKING',
                'name': 'Result Locking',
                'category': 'STANDARD',
                'description': 'Lock results to prevent changes after finalization',
                'default_enabled': True,
            },
            {
                'code': 'FEATURE_SMART_RANKING',
                'name': 'Smart Ranking System',
                'category': 'ADVANCED',
                'description': 'Automatic ranking and percentile calculation',
                'default_enabled': False,
            },
            {
                'code': 'FEATURE_ALUMNI_ACCESS',
                'name': 'Alumni Result Access',
                'category': 'ADVANCED',
                'description': 'Allow alumni to access historical results',
                'default_enabled': False,
            },
        ]
        
        created = 0
        for data in features_data:
            feature, is_new = Feature.objects.get_or_create(
                code=data['code'],
                defaults={
                    'name': data['name'],
                    'category': data['category'],
                    'description': data['description'],
                    'default_enabled': data['default_enabled'],
                }
            )
            if is_new:
                self.stdout.write(self.style.SUCCESS(f'✓ Created feature: {feature.name}'))
                created += 1
            else:
                self.stdout.write(self.style.WARNING(f'∾ Already exists: {feature.name}'))
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ {created} new features created!'))
