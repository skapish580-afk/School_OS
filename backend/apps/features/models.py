import json
from django.db import models
from apps.schools.models import School 

class Feature(models.Model):
    CATEGORY_CHOICES = [
        ('CORE', 'Core (Cannot be disabled)'),
        ('STANDARD', 'Standard'),
        ('ADVANCED', 'Advanced/Add-on'),
    ]

    code = models.CharField(max_length=50, unique=True, help_text="e.g., ATTENDANCE_SYSTEM")
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='STANDARD')
    description = models.TextField(blank=True)
    default_enabled = models.BooleanField(default=False)
    
    # FIX: Use TextField instead of JSONField for SQLite compatibility
    dependencies = models.TextField(default='[]', blank=True, help_text="List of feature codes this depends on")

    def __str__(self):
        return f"{self.name} ({self.code})"
        
    # Helper to get dependencies as a real Python list
    @property
    def dependency_list(self):
        try:
            return json.loads(self.dependencies)
        except:
            return []

class SchoolFeatureConfig(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='feature_configs')
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)
    enabled = models.BooleanField(default=True)
    
    # FIX: Use TextField instead of JSONField
    config_json = models.TextField(default='{}', blank=True, help_text="School-specific settings (DNA)")

    class Meta:
        unique_together = ('school', 'feature')

    def __str__(self):
        status = "ON" if self.enabled else "OFF"
        return f"{self.school.name} - {self.feature.name} [{status}]"

    # Helper to get config as a real Python dict
    @property
    def config(self):
        try:
            return json.loads(self.config_json)
        except:
            return {}