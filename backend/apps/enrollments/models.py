from django.db import models
from apps.students.models import Student
from apps.schools.models import School
from django.utils import timezone
import uuid

# Import promotion models
from .models_promotion import (
    AcademicYear, PromotionRule, PromotionBatch, 
    PromotionRecord, DataCarryForward
)


class StudentEnrollment(models.Model):
    """
    Links a Student to a specific Class (Grade/Section) in a School for a specific Year.
    
    CRITICAL CHANGE: Enrollments are now IMMUTABLE.
    - Never update status from GRADUATED back to ACTIVE
    - Always create NEW enrollment for re-enrollment
    - Maintains complete academic history
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='enrollments')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='enrollments')
    
    # Class Details - Stored as strings for flexibility
    grade = models.CharField(max_length=10)   # e.g., "10"
    section = models.CharField(max_length=5)  # e.g., "A"
    
    # The Missing Field!
    roll_number = models.CharField(max_length=10, blank=True, null=True) 
    
    # Timeframe
    academic_year = models.CharField(max_length=20, default="2025-2026")
    enrollment_date = models.DateField(auto_now_add=True)
    
    # Status
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('TRANSFERRED', 'Transferred Out'),
        ('GRADUATED', 'Graduated'),  # Changed from ALUMNI to GRADUATED
        ('COMPLETED', 'Completed (End of enrollment period)'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # IMMUTABILITY FLAGS
    is_closed = models.BooleanField(
        default=False,
        help_text="Once closed, this enrollment cannot be modified"
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='enrollments_closed'
    )
    
    # Re-enrollment tracking
    is_reenrollment = models.BooleanField(
        default=False,
        help_text="Is this a re-enrollment after graduation/gap?"
    )
    previous_enrollment = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reenrollments',
        help_text="Link to previous enrollment if re-enrolled"
    )
    reenrollment_reason = models.TextField(
        blank=True,
        help_text="Why student re-enrolled (gap year, grade repetition, etc.)"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # REMOVED unique_together to allow multiple enrollments per student
        # This enables proper history tracking
        verbose_name = "Class Enrollment"
        ordering = ['-academic_year', '-created_at']
        indexes = [
            models.Index(fields=['student', 'academic_year', 'status']),
            models.Index(fields=['school', 'status']),
        ]

    def __str__(self):
        return f"{self.student} - Grade {self.grade} Section {self.section} ({self.academic_year}) - {self.status}"
    
    def close_enrollment(self, user, reason="Academic year completed"):
        """Close enrollment - makes it immutable"""
        if not self.is_closed:
            self.is_closed = True
            self.closed_at = timezone.now()
            self.closed_by = user
            if self.status == 'ACTIVE':
                self.status = 'COMPLETED'
            self.save()
    
    @classmethod
    def create_reenrollment(cls, previous_enrollment, new_grade, new_section, new_academic_year, reason=""):
        """
        Proper re-enrollment: Create NEW enrollment, don't modify old one.
        """
        # Close previous enrollment if not already closed
        if not previous_enrollment.is_closed:
            previous_enrollment.close_enrollment(
                user=None,  # System action
                reason="Student re-enrolled"
            )
        
        # Create new enrollment
        new_enrollment = cls.objects.create(
            student=previous_enrollment.student,
            school=previous_enrollment.school,
            grade=new_grade,
            section=new_section,
            academic_year=new_academic_year,
            status='ACTIVE',
            is_reenrollment=True,
            previous_enrollment=previous_enrollment,
            reenrollment_reason=reason
        )
        
        return new_enrollment