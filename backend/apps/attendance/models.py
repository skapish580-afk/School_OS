from django.db import models
from apps.students.models import Student
from django.conf import settings # To link to the User (Teacher/Admin)

class AttendanceSession(models.Model):
    """
    Represents a single "Roll Call" event.
    e.g., "Grade 10-A, Period 1, 20th Jan 2026"
    """
    SESSION_TYPES = [
        ('DAILY', 'Full Day (Daily)'),
        ('MORNING', 'Morning Assembly'),
        ('PERIOD', 'Subject Period'),
    ]

    grade = models.CharField(max_length=10, help_text="e.g., '10'")
    section = models.CharField(max_length=5, help_text="e.g., 'A'")
    date = models.DateField()
    session_type = models.CharField(max_length=20, choices=SESSION_TYPES, default='DAILY')
    
    # Audit: Who took this attendance?
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Locking mechanism (Admins can lock attendance after X hours)
    is_locked = models.BooleanField(default=False)
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_sessions')
    locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('grade', 'section', 'date', 'session_type')
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.grade}-{self.section} : {self.date} ({self.get_session_type_display()})"

class StudentAttendance(models.Model):
    """
    The status of a single student in a session.
    Includes SUID linking and integration with gate pass and health modules.
    """
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('OUT', 'Out (Gate Pass)'),
        ('EXCUSED', 'Excused / Leave'),
        ('MEDICAL', 'Medical Leave'),
    ]

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    
    # CRITICAL: SUID Linking for data integrity
    student_suid = models.CharField(max_length=50, editable=False, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ABSENT')
    
    # Remarks for specific cases (e.g., "Medical Leave" or "Sent to Principal")
    remarks = models.CharField(max_length=255, blank=True, null=True)
    
    # If they arrived late, when did they arrive?
    time_in = models.TimeField(null=True, blank=True)
    
    # Integration with Gate Pass Module
    gate_pass_id = models.CharField(max_length=50, blank=True, null=True, help_text="Link to GatePass ID if student is OUT")
    
    # Integration with Health Module (Infirmary Visits)
    health_visit_id = models.CharField(max_length=50, blank=True, null=True, help_text="Link to Health Visit ID if marked as MEDICAL")
    
    # Audit Trail
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='attendance_marked')
    marked_at = models.DateTimeField(auto_now_add=True)
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_edited')
    edited_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('session', 'student')
        ordering = ['student__user__first_name']

    def save(self, *args, **kwargs):
        # Auto-link SUID when saving
        if not self.student_suid:
            self.student_suid = self.student.suid
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.user.full_name} ({self.student.suid}) - {self.status}"