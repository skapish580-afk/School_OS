import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.features.models import SchoolFeatureConfig
from apps.schools.models import School

school = School.objects.first()
if school:
    print(f"School: {school.id}")
    configs = SchoolFeatureConfig.objects.filter(school=school)
    for c in configs:
        print(f"Feature: {c.feature.code}, Enabled: {c.enabled}, Config: {c.config_json}")
else:
    print("No school found")
