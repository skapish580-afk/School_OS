import json
from django.core.management.base import BaseCommand
from apps.features.models import Feature

class Command(BaseCommand):
    help = 'Registers the base features of the platform'

    def handle(self, *args, **kwargs):
        features = [
            # --- CORE FEATURES (Cannot be disabled) ---
            {
                'code': 'IDENTITY',
                'name': 'Identity Management',
                'category': 'CORE',
                'default_enabled': True,
                'description': 'SUID/TUID generation and profiles',
                'dependencies': [] 
            },
            {
                'code': 'AUDIT_LOGS',
                'name': 'Audit System',
                'category': 'CORE',
                'default_enabled': True,
                'description': 'Security and action logs',
                'dependencies': []
            },
            
            # --- STANDARD FEATURES (Essential for Schools) ---
            {
                'code': 'ATTENDANCE_SYSTEM',
                'name': 'Smart Attendance',
                'category': 'STANDARD',
                'default_enabled': True,
                'description': 'Daily roll call, proxies, and reporting',
                'dependencies': ['IDENTITY']
            },
            {
                'code': 'MARKS_ENTRY',
                'name': 'Marks & Grading',
                'category': 'STANDARD',
                'default_enabled': True,
                'description': 'Exams, report cards, and grading logic',
                'dependencies': ['IDENTITY']
            },
            {
                'code': 'TIMETABLE',
                'name': 'Timetable Management',
                'category': 'STANDARD',
                'default_enabled': True,
                'description': 'Class scheduling and teacher allocation',
                'dependencies': ['IDENTITY']
            },

            # --- ADVANCED FEATURES (Add-ons / Pro) ---
            {
                'code': 'DISCIPLINE_ENGINE',
                'name': 'Discipline & Behavior',
                'category': 'ADVANCED',
                'default_enabled': False, 
                'description': 'Tracking violations and behavior timeline',
                'dependencies': ['IDENTITY']
            },
            {
                'code': 'PARENT_PORTAL',
                'name': 'Parent Access Control',
                'category': 'ADVANCED',
                'default_enabled': False,
                'description': 'Parent login and view restrictions',
                'dependencies': ['IDENTITY', 'MARKS_ENTRY']
            },

            # --- THE MARKET DOMINATORS (New Unique Features) ---
            {
                'code': 'DISCIPLINE_ENGINE',
                'name': 'Discipline & Behavior',
                'category': 'ADVANCED',
                'default_enabled': False, 
                'description': 'Track violations (Uniform, Late, Homework) and issue warnings.',
                'dependencies': ['IDENTITY']
            },
            {
                'code': 'DIGITAL_GATE_PASS',
                'name': 'Security Gate Pass',
                'category': 'ADVANCED',
                'default_enabled': False,
                'description': 'Generate verifiable QR exit passes for early leave.',
                'dependencies': ['IDENTITY', 'ATTENDANCE_SYSTEM']
            },
            {
                'code': 'HEALTH_RECORD',
                'name': 'Infirmary & Health Log',
                'category': 'ADVANCED',
                'default_enabled': False,
                'description': 'Track allergies, vaccinations, and sick room visits.',
                'dependencies': ['IDENTITY']
            },
            {
                'code': 'HOUSE_POINTS',
                'name': 'Karma / House Points',
                'category': 'ADVANCED',
                'default_enabled': False,
                'description': 'Gamified positive reinforcement system (e.g. +10 Points for Helping).',
                'dependencies': ['IDENTITY']
            },



        ]

        for item in features:
            # FIX: Convert list dependencies to JSON string for SQLite TextField
            if 'dependencies' in item and isinstance(item['dependencies'], list):
                item['dependencies'] = json.dumps(item['dependencies'])

            f, created = Feature.objects.get_or_create(
                code=item['code'],
                defaults=item
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created feature: {item["name"]}'))
            else:
                self.stdout.write(f'Feature already exists: {item["name"]}')