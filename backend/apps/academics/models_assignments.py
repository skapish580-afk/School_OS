"""
Assignment Tracking System
Teachers create assignments, track submissions, and admin can view all.
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Assignment(models.Model):
    """
    Assignment created by a teacher for a specific grade/section/subject.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    
    # Assignment details
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True, help_text='Detailed instructions for students')
    
    # Target audience
    grade = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='assignments',
        null=True,
        blank=True
    )
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        related_name='assignments',
        null=True,
        blank=True,
        help_text='Leave empty to assign to all sections of the grade'
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    
    # Created by
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_assignments'
    )
    
    # Dates
    assigned_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    
    # Scoring
    max_marks = models.PositiveIntegerField(default=10)
    
    # Assignment type
    TYPE_CHOICES = [
        ('HOMEWORK', 'Homework'),
        ('CLASSWORK', 'Classwork'),
        ('PROJECT', 'Project'),
        ('QUIZ', 'Quiz'),
        ('PRACTICE', 'Practice'),
        ('LAB', 'Lab Work'),
        ('RESEARCH', 'Research'),
        ('OTHER', 'Other'),
    ]
    assignment_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='HOMEWORK')
    
    # Status
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PUBLISHED', 'Published'),
        ('CLOSED', 'Closed'),
        ('GRADED', 'Graded'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    # Include in final grade calculation
    include_in_grade = models.BooleanField(
        default=False,
        help_text='Include this assignment score in final grade calculation'
    )
    
    # Attachments (file paths stored as JSON)
    attachments = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-assigned_date', '-created_at']
        indexes = [
            models.Index(fields=['school', 'grade', 'subject']),
            models.Index(fields=['school', 'status']),
            models.Index(fields=['created_by', 'status']),
        ]
    
    def __str__(self):
        section_str = f" ({self.section.section_letter})" if self.section else ""
        return f"{self.title} - {self.grade.grade_name}{section_str} - {self.subject.name}"
    
    @property
    def is_overdue(self):
        return timezone.now().date() > self.due_date and self.status == 'PUBLISHED'
    
    @property
    def submission_count(self):
        return self.submissions.count()
    
    @property
    def graded_count(self):
        return self.submissions.filter(is_graded=True).count()


class AssignmentSubmission(models.Model):
    """
    Student submission for an assignment.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='assignment_submissions'
    )
    
    # Submission details
    submission_text = models.TextField(blank=True, help_text='Text/answer submission')
    attachments = models.JSONField(default=list, blank=True, help_text='Submitted file paths')
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Grading
    is_graded = models.BooleanField(default=False)
    marks_obtained = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    feedback = models.TextField(blank=True, help_text='Teacher feedback')
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='graded_submissions'
    )
    graded_at = models.DateTimeField(null=True, blank=True)
    
    # Late submission
    is_late = models.BooleanField(default=False)
    late_penalty_applied = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Marks deducted for late submission'
    )
    
    class Meta:
        unique_together = ('assignment', 'student')
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.student} - {self.assignment.title}"
    
    @property
    def final_marks(self):
        if self.marks_obtained is not None:
            return max(0, float(self.marks_obtained) - float(self.late_penalty_applied))
        return None
    
    def save(self, *args, **kwargs):
        # Auto-detect late submission
        if self.submitted_at and self.assignment.due_date:
            self.is_late = self.submitted_at.date() > self.assignment.due_date
        super().save(*args, **kwargs)
