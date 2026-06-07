
from django.db import models
from django.conf import settings


class PromotionBatch(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('REVIEW', 'Review'),
        ('COMMITTED', 'Committed'),
        ('CANCELLED', 'Cancelled'),
    ]

    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, null=True, blank=True)
    year_from = models.CharField(max_length=20)
    year_to = models.CharField(max_length=20)
    initiated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='DRAFT')
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Promotion {self.school or ''} {self.year_from} → {self.year_to} ({self.status})"


class PromotionAssignment(models.Model):
    STATUS = [
        ('PENDING', 'Pending'),
        ('SUGGESTED', 'Suggested'),
        ('APPROVED', 'Approved'),
        ('PROMOTED', 'Promoted'),
        ('RETAINED', 'Retained'),
        ('FAILED', 'Failed'),
    ]

    batch = models.ForeignKey(PromotionBatch, on_delete=models.CASCADE, related_name='assignments')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    current_class = models.CharField(max_length=50, blank=True)
    current_section = models.CharField(max_length=10, blank=True)
    promoted_to_class = models.CharField(max_length=50, null=True, blank=True)
    promoted_to_division = models.CharField(max_length=10, null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default='PENDING')
    rank = models.IntegerField(null=True, blank=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('batch', 'student')

    def __str__(self):
        return f"{self.student} -> {self.promoted_to_class or 'TBD'} ({self.status})"


class PromotionAudit(models.Model):
    batch = models.ForeignKey(PromotionBatch, on_delete=models.CASCADE, related_name='audits')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} @ {self.timestamp}"


class AcademicHistory(models.Model):
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='academic_history')
    academic_year = models.CharField(max_length=32)
    class_name = models.CharField(max_length=50)
    section = models.CharField(max_length=16, blank=True)
    marks = models.JSONField(null=True, blank=True)
    grades = models.JSONField(null=True, blank=True)
    awards = models.JSONField(null=True, blank=True)
    summary = models.TextField(blank=True)
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-archived_at']

    def __str__(self):
        return f"{self.student} - {self.academic_year} ({self.class_name})"



