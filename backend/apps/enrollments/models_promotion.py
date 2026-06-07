from django.db import models
from apps.schools.models import School
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class AcademicYear(models.Model):
    """
    Defines academic years with start/end dates and status.
    Only one year can be ACTIVE per school at a time.
    """
    STATUS_CHOICES = [
        ('UPCOMING', 'Upcoming'),
        ('ACTIVE', 'Active'),
        ('CLOSING', 'Closing (In Progress)'),
        ('CLOSED', 'Closed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='academic_years')
    
    year_code = models.CharField(max_length=9, help_text="e.g., 2025-2026")
    start_date = models.DateField()
    end_date = models.DateField()
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='UPCOMING')
    
    # Closure metadata
    closed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_years')
    closed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['school', 'year_code']
        ordering = ['-start_date']
    
    def __str__(self):
        return f"{self.school.name} - {self.year_code} ({self.status})"


class PromotionRule(models.Model):
    """
    Defines promotion rules for automatic grade advancement.
    """
    PROMOTION_TYPE = [
        ('AUTO', 'Automatic (Pass All)'),
        ('MARKS_BASED', 'Marks Based'),
        ('MANUAL', 'Manual Review'),
    ]
    
    ACTION_TYPE = [
        ('PROMOTE', 'Promote to Next Grade'),
        ('RETAIN', 'Retain in Same Grade'),
        ('GRADUATE', 'Convert to Alumni'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='promotion_rules')
    
    from_grade = models.CharField(max_length=10, help_text="e.g., 9")
    to_grade = models.CharField(max_length=10, help_text="e.g., 10 or ALUMNI")
    
    promotion_type = models.CharField(max_length=15, choices=PROMOTION_TYPE, default='AUTO')
    action = models.CharField(max_length=10, choices=ACTION_TYPE, default='PROMOTE')
    
    # Marks criteria (if MARKS_BASED)
    min_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Minimum % to promote")
    
    # Section management
    auto_assign_section = models.BooleanField(default=True, help_text="Automatically assign sections after promotion")
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['school', 'from_grade']
        ordering = ['from_grade']
    
    def __str__(self):
        return f"{self.school.name} - Grade {self.from_grade} → {self.to_grade}"


class PromotionBatch(models.Model):
    """
    Tracks bulk promotion operations.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft (Preview)'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('ROLLED_BACK', 'Rolled Back'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='promotion_batches')
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='promotion_batches')
    
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='DRAFT')
    
    total_students = models.IntegerField(default=0)
    promoted_count = models.IntegerField(default=0)
    retained_count = models.IntegerField(default=0)
    graduated_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    
    error_log = models.TextField(blank=True, help_text="Errors encountered during processing")
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Promotion Batch {self.academic_year.year_code} - {self.status}"


class PromotionRecord(models.Model):
    """
    Individual student promotion record.
    Immutable after completion.
    """
    ACTION_CHOICES = [
        ('PROMOTED', 'Promoted'),
        ('RETAINED', 'Retained'),
        ('GRADUATED', 'Graduated (Alumni)'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(PromotionBatch, on_delete=models.CASCADE, related_name='records')
    
    # Student info (denormalized for history)
    enrollment_id = models.UUIDField(help_text="Reference to original enrollment")
    student_name = models.CharField(max_length=255)
    student_suid = models.CharField(max_length=50)
    
    from_grade = models.CharField(max_length=10)
    from_section = models.CharField(max_length=5)
    to_grade = models.CharField(max_length=10, blank=True)
    to_section = models.CharField(max_length=5, blank=True)
    
    action = models.CharField(max_length=15, choices=ACTION_CHOICES)
    reason = models.TextField(blank=True, help_text="Why promoted/retained/graduated")
    
    # Marks summary (if marks-based)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    
    # Immutability
    is_locked = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['student_name']
    
    def __str__(self):
        return f"{self.student_name} - {self.action}"


class DataCarryForward(models.Model):
    """
    Defines what data gets carried forward to next year.
    """
    DATA_TYPE_CHOICES = [
        ('HEALTH_PROFILE', 'Health Profile'),
        ('DISCIPLINE_HISTORY', 'Discipline History'),
        ('ACHIEVEMENTS', 'Achievements'),
        ('GATE_PASS_HISTORY', 'Gate Pass History'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='carryforward_rules')
    
    data_type = models.CharField(max_length=25, choices=DATA_TYPE_CHOICES)
    carry_forward = models.BooleanField(default=True, help_text="Should this data carry forward?")
    archive_instead = models.BooleanField(default=False, help_text="Archive old data instead of deleting")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['school', 'data_type']
    
    def __str__(self):
        return f"{self.school.name} - {self.data_type} ({'Carry Forward' if self.carry_forward else 'Archive'})"
