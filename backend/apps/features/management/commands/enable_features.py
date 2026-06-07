from django.core.management.base import BaseCommand
from apps.schools.models import School
from apps.features.models import Feature, SchoolFeatureConfig

class Command(BaseCommand):
    help = 'Enable all features for all schools'

    def handle(self, *args, **kwargs):
        schools = School.objects.all()
        
        feature_codes = [
            'TIMETABLE',
            'MARKS_ENTRY',
            'ATTENDANCE_TRACKING',
            'LEAVE_MANAGEMENT',
            'DISCIPLINE_MANAGEMENT',
            'HEALTH_RECORDS',
            'TRANSFERS'
        ]
        
        for school in schools:
            for feature_code in feature_codes:
                # Get or create the feature
                feature, _ = Feature.objects.get_or_create(
                    code=feature_code,
                    defaults={
                        'name': feature_code.replace('_', ' '),
                        'category': 'STANDARD',
                        'default_enabled': True
                    }
                )
                
                # Get or create the school feature config
                config, created = SchoolFeatureConfig.objects.get_or_create(
                    school=school,
                    feature=feature,
                    defaults={'enabled': True}
                )
                
                if not config.enabled:
                    config.enabled = True
                    config.save()
                    self.stdout.write(self.style.SUCCESS(f'✓ Enabled {feature_code} for {school.name}'))
                elif created:
                    self.stdout.write(self.style.SUCCESS(f'✓ Created and enabled {feature_code} for {school.name}'))
                else:
                    self.stdout.write(f'✓ {feature_code} already enabled for {school.name}')
        
        self.stdout.write(self.style.SUCCESS('All features enabled successfully!'))
