from django.db import models
from apps.students.models import Student
from django.conf import settings
import uuid

class DisciplineRecord(models.Model):
    SEVERITY_CHOICES = [
        ('LOW', 'Low (Verbal Warning)'),
        ('MEDIUM', 'Medium (Written Warning / Parent Call)'),
        ('CRITICAL', 'Critical (Suspension / Principal Meet)'),
    ]

    CATEGORY_CHOICES = [
        ('UNIFORM', 'Improper Uniform / Haircut'),
        ('LATE', 'Late Arrival'),
        ('HOMEWORK', 'Incomplete Homework'),
        ('BEHAVIOR', 'Classroom Disruption'),
        ('BULLYING', 'Bullying / Fighting'),
        ('DEVICE', 'Confiscated Mobile/Gadget'),
    ]

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='discipline_records')
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='LOW')
    description = models.TextField(help_text="What exactly happened?")
    
    action_taken = models.TextField(blank=True, help_text="e.g. Sent to corridor, Called parents")
    incident_date = models.DateField(auto_now_add=True)
    
    # "Gamification" - Negative points impact their "Karma"
    points_deducted = models.IntegerField(default=0, help_text="Negative impact on House Points")

    def save(self, *args, **kwargs):
        # Auto-assign points based on severity if not set
        if self.points_deducted == 0:
            if self.severity == 'LOW': self.points_deducted = 5
            elif self.severity == 'MEDIUM': self.points_deducted = 15
            elif self.severity == 'CRITICAL': self.points_deducted = 50
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.user.full_name} - {self.category} ({self.severity})"


class KarmaActivity(models.Model):
    """
    Positive reinforcement logs.
    e.g. "Helped a teacher" (+10 points)
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='karma_records')
    awarded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=100, help_text="Reason for reward")
    points = models.IntegerField(default=10, help_text="Points to add")
    date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.user.full_name} : +{self.points} ({self.title})"


class StudentKarma(models.Model):
    """
    Enhanced Karma/Discipline tracking (renameable by admin)
    Consolidates positive and negative behavior tracking
    """
    TYPE_CHOICES = [
        ('POSITIVE', 'Positive'),
        ('NEGATIVE', 'Negative'),
    ]
    
    CATEGORY_CHOICES = [
        # Negative
        ('HAIRCUT', 'Improper Haircut'),
        ('NAILS', 'Long Nails'),
        ('UNIFORM', 'Uniform Violation'),
        ('ID_CARD', 'No ID Card'),
        ('LATE', 'Late to Class'),
        ('HOMEWORK', 'Incomplete Homework'),
        ('BEHAVIOR', 'Misbehavior'),
        ('ATTENDANCE_POOR', 'Poor Attendance'),
        # Positive
        ('HELPING', 'Helping Others'),
        ('CLEANLINESS', 'Maintaining Cleanliness'),
        ('LEADERSHIP', 'Leadership'),
        ('DISCIPLINE', 'Excellent Discipline'),
        ('ACADEMIC', 'Academic Excellence'),
        ('SPORTS', 'Sports Achievement'),
        ('PARTICIPATION', 'Class Participation'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='enhanced_karma'
    )
    
    given_by_teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        related_name='karma_assigned'
    )
    
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='student_karma'
    )
    
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    points = models.IntegerField(default=1)
    
    remark = models.TextField()
    action_taken = models.TextField(blank=True)
    
    academic_year = models.CharField(max_length=9)
    grade = models.CharField(max_length=10)
    section = models.CharField(max_length=5)
    
    visible_to_parent = models.BooleanField(default=True)
    visible_to_student = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Student Karma Record"
        indexes = [
            models.Index(fields=['student', 'academic_year']),
            models.Index(fields=['given_by_teacher', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.type} - {self.student} by {self.given_by_teacher}"


class AttendanceEditLog(models.Model):
    """
    Audit trail for attendance edits by class teachers/admins
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    attendance = models.ForeignKey(
        'attendance.StudentAttendance',
        on_delete=models.CASCADE,
        related_name='edit_logs'
    )
    
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_modifications'
    )
    
    editor_role = models.CharField(
        max_length=20,
        choices=[
            ('CLASS_TEACHER', 'Class Teacher'),
            ('SUBJECT_TEACHER', 'Subject Teacher'),
            ('ADMIN', 'Admin'),
        ]
    )
    
    old_status = models.CharField(max_length=10)
    new_status = models.CharField(max_length=10)
    reason = models.TextField()
    
    edited_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-edited_at']
        verbose_name = "Attendance Edit Log"
    
    def __str__(self):
        return f"{self.attendance} edited by {self.edited_by}"
