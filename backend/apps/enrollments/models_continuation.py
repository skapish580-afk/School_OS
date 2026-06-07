from django.db import models
from apps.schools.models import School
from apps.students.models import Student


class ContinuationException(models.Model):
    """
    Students allowed to continue to 11-12 even if school graduation point is Grade 10
    """
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='continuation_exceptions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='continuation_exceptions')
    
    reason = models.TextField(help_text="Why this student is allowed to continue")
    approved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='approved_continuations'
    )
    approved_date = models.DateTimeField(auto_now_add=True)
    
    # Optional: Set expiry
    valid_until = models.DateField(null=True, blank=True, help_text="Date until exception is valid")
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['school', 'student']
        verbose_name = 'Continuation Exception'
        verbose_name_plural = 'Continuation Exceptions'
    
    def __str__(self):
        return f"{self.student} - Continuation Exception"
