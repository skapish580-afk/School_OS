from django.db import models
import uuid


class Holiday(models.Model):
    """School holidays - days when school is closed"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='school_holidays')
    name = models.CharField(max_length=255, help_text="Holiday name (e.g., Republic Day)")
    date = models.DateField()
    description = models.TextField(blank=True)
    is_recurring = models.BooleanField(default=False, help_text="If true, repeats every year")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']
        unique_together = ['school', 'date', 'name']

    def __str__(self):
        return f"{self.name} - {self.date}"


class SchoolEvent(models.Model):
    """School events like sports day, annual function etc."""
    EVENT_TYPES = [
        ('ACADEMIC', 'Academic'),
        ('SPORTS', 'Sports'),
        ('CULTURAL', 'Cultural'),
        ('MEETING', 'Meeting'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=255)
    event_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='OTHER')
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    is_all_day = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['event_date', 'start_time']

    def __str__(self):
        return f"{self.title} - {self.event_date}"
