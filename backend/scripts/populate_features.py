import os
import sys
import django

# Ensure backend root directory is in Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.features.models import Feature

FEATURES = [
    ('STUDENTS', 'Student Management', 'CORE'),
    ('ATTENDANCE', 'Attendance System', 'CORE'),
    ('ACADEMICS', 'Academic Management', 'CORE'),
    ('TEACHERS', 'Teacher Management', 'CORE'),
    ('RESULTS', 'Results Management', 'CORE'),
    ('FINANCE', 'Finance & Fees', 'STANDARD'),
    ('HEALTH', 'Health & Infirmary', 'STANDARD'),
    ('GATE_PASS', 'Secure Gate Pass', 'STANDARD'),
    ('LIBRARY', 'Library Management', 'STANDARD'),
    ('TRANSPORT', 'Transport & GPS', 'STANDARD'),
    ('ASSETS', 'Asset Management', 'STANDARD'),
    ('COMMUNITY', 'Community & Alumni', 'STANDARD'),
    ('AI_ANALYTICS', 'AI Analytics', 'ADVANCED'),
    ('REPORTS', 'Reports & Export', 'STANDARD'),
]

def populate():
    print("Populating system features...")
    for code, name, category in FEATURES:
        feature, created = Feature.objects.get_or_create(
            code=code,
            defaults={'name': name, 'category': category, 'default_enabled': True}
        )
        if created:
            print(f"Created feature: {name} ({code})")
        else:
            print(f"Feature already exists: {code}")

if __name__ == "__main__":
    populate()
