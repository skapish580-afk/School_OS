"""
Management command to sync features between models.
"""
from django.core.management.base import BaseCommand
from apps.schools.models import School
from apps.features.models import Feature
from apps.owner.models import FeatureToggle


class Command(BaseCommand):
    help = 'Initialize FeatureToggle records for all schools and features'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🔄 Syncing features across all schools...'))
        
        schools = School.objects.all()
        features = Feature.objects.all()
        
        total_created = 0
        
        for school in schools:
            for feature in features:
                # Create FeatureToggle based on SchoolFeatureConfig state if it exists
                from apps.features.models import SchoolFeatureConfig
                
                try:
                    school_config = SchoolFeatureConfig.objects.get(
                        school=school,
                        feature=feature
                    )
                    enabled = school_config.enabled
                except SchoolFeatureConfig.DoesNotExist:
                    enabled = feature.default_enabled
                
                toggle, created = FeatureToggle.objects.get_or_create(
                    school=school,
                    feature=feature.code,
                    defaults={'is_enabled': enabled}
                )
                
                if created:
                    total_created += 1
                    self.stdout.write(
                        f"  ✓ {school.display_name}: {feature.code} {'(enabled)' if enabled else '(disabled)'}"
                    )
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✅ Created {total_created} FeatureToggle records')
        )
