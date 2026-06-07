"""
CRITICAL MODULE: Teacher Input Optimization System
==================================================
Ground Reality: Teachers hate typing.

This module provides:
- Preset comments library
- Quick remarks templates
- Voice input support (frontend integration)
- Copy previous remarks
- Auto-suggestions based on patterns
- Bulk comment application

Reduces data entry friction by 80%.
"""

from django.db import models
from apps.schools.models import School
from apps.teachers.models import Teacher
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class PresetComment(models.Model):
    """
    Library of preset comments for quick selection.
    Categories: Attendance, Marks, Discipline, Health, etc.
    """
    CATEGORIES = [
        ('ATTENDANCE', 'Attendance Remarks'),
        ('MARKS', 'Marks/Performance'),
        ('DISCIPLINE', 'Discipline'),
        ('HEALTH', 'Health'),
        ('BEHAVIOR', 'Behavior'),
        ('PARTICIPATION', 'Class Participation'),
        ('HOMEWORK', 'Homework'),
        ('GENERAL', 'General Remarks'),
    ]
    
    TONE_TYPES = [
        ('POSITIVE', 'Positive'),
        ('NEUTRAL', 'Neutral'),
        ('CONCERN', 'Concern/Improvement Needed'),
        ('CRITICAL', 'Critical Issue'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='preset_comments')
    
    category = models.CharField(max_length=20, choices=CATEGORIES)
    tone = models.CharField(max_length=20, choices=TONE_TYPES, default='NEUTRAL')
    
    comment_text = models.TextField(help_text="The preset comment text")
    
    # Tags for quick search
    tags = models.JSONField(
        default=list,
        help_text="Tags like ['improvement', 'excellent', 'late', 'absent']"
    )
    
    # Usage tracking
    usage_count = models.PositiveIntegerField(default=0, help_text="How many times used")
    last_used = models.DateTimeField(null=True, blank=True)
    
    # Scope
    is_system_default = models.BooleanField(
        default=False,
        help_text="System-provided presets (can't be deleted)"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preset_comments_created'
    )
    
    # Custom teacher presets
    is_personal = models.BooleanField(
        default=False,
        help_text="Personal to a specific teacher"
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='personal_presets',
        help_text="If personal preset"
    )
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-usage_count', 'category', 'comment_text']
        indexes = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['teacher', 'is_personal']),
        ]
    
    def __str__(self):
        return f"{self.category} - {self.comment_text[:50]}"
    
    def increment_usage(self):
        """Track usage for popularity sorting"""
        from django.utils import timezone
        self.usage_count += 1
        self.last_used = timezone.now()
        self.save(update_fields=['usage_count', 'last_used'])


class CommentTemplate(models.Model):
    """
    Multi-field comment templates.
    Example: Report card comment with performance + behavior + suggestion
    """
    TEMPLATE_TYPES = [
        ('REPORT_CARD', 'Report Card Comment'),
        ('PROGRESS_REPORT', 'Progress Report'),
        ('PARENT_MEETING', 'Parent Meeting Notes'),
        ('INCIDENT', 'Incident Report'),
        ('ACHIEVEMENT', 'Achievement Recognition'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='comment_templates')
    
    template_name = models.CharField(max_length=200)
    template_type = models.CharField(max_length=30, choices=TEMPLATE_TYPES)
    
    # Template structure (JSON with placeholders)
    template_structure = models.JSONField(
        help_text="Template with placeholders like {student_name}, {performance}, {suggestion}",
        default=dict
    )
    
    """
    Example structure:
    {
        "sections": [
            {
                "label": "Academic Performance",
                "placeholder": "{performance}",
                "presets": ["Excellent progress", "Satisfactory", "Needs improvement"]
            },
            {
                "label": "Behavior",
                "placeholder": "{behavior}",
                "presets": ["Well-behaved", "Generally good", "Requires attention"]
            },
            {
                "label": "Suggestion",
                "placeholder": "{suggestion}",
                "presets": ["Keep up the good work", "Regular practice needed"]
            }
        ],
        "template": "{student_name} has shown {performance} in class. {behavior}. {suggestion}."
    }
    """
    
    # Usage
    usage_count = models.PositiveIntegerField(default=0)
    
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-usage_count', 'template_name']
    
    def __str__(self):
        return f"{self.template_type} - {self.template_name}"


class QuickPhrase(models.Model):
    """
    Short phrases for auto-complete/suggestions.
    Example: User types "stud" → suggests "student is performing well"
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='quick_phrases')
    
    trigger_text = models.CharField(
        max_length=50,
        help_text="Text that triggers this suggestion"
    )
    suggestion_text = models.TextField(help_text="The full phrase to suggest")
    
    category = models.CharField(max_length=50, blank=True)
    
    # Frequency
    usage_count = models.PositiveIntegerField(default=0)
    
    # Personalization
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='quick_phrases',
        help_text="Personal to teacher or school-wide if null"
    )
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-usage_count']
        indexes = [
            models.Index(fields=['trigger_text', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.trigger_text} → {self.suggestion_text[:30]}"


class PreviousRemark(models.Model):
    """
    Stores previous remarks for copy/reuse functionality.
    "Copy from last term" feature.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='previous_remarks')
    
    # Context
    remark_type = models.CharField(
        max_length=50,
        help_text="Type of remark (attendance, marks, discipline)"
    )
    
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='previous_remarks'
    )
    
    # The remark
    remark_text = models.TextField()
    
    # When & where
    academic_year = models.CharField(max_length=9)
    term = models.CharField(max_length=50, blank=True)
    
    # Who wrote it
    created_by = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        related_name='remarks_written'
    )
    
    # Usage tracking
    copied_count = models.PositiveIntegerField(default=0, help_text="Times copied for reuse")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'academic_year']),
            models.Index(fields=['remark_type', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.remark_type} for {self.student.user.full_name} - {self.academic_year}"


class VoiceInputLog(models.Model):
    """
    Logs voice input usage for analytics.
    Tracks adoption of voice input feature.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='voice_input_logs')
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='voice_inputs')
    
    # What was transcribed
    transcribed_text = models.TextField()
    
    # Where used
    context = models.CharField(
        max_length=50,
        help_text="attendance_remark, marks_remark, discipline_note, etc."
    )
    
    # Quality
    was_edited = models.BooleanField(
        default=False,
        help_text="Did teacher edit after transcription?"
    )
    edit_distance = models.PositiveIntegerField(
        default=0,
        help_text="Number of characters changed"
    )
    
    # Metadata
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Length of voice recording"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Voice Input by {self.teacher.user.full_name} - {self.context}"


class BulkCommentApplication(models.Model):
    """
    Apply same comment to multiple students at once.
    Example: "Excellent participation" to 15 students who did well.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='bulk_comments')
    
    # What comment
    comment_text = models.TextField()
    comment_category = models.CharField(max_length=50)
    
    # To whom
    student_ids = models.JSONField(help_text="List of student UUIDs")
    
    # Context
    context_type = models.CharField(
        max_length=50,
        help_text="attendance, marks, discipline, etc."
    )
    context_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="e.g., exam_id, date"
    )
    
    # Execution
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    total_students = models.PositiveIntegerField(default=0)
    processed = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)
    
    # Who
    applied_by = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name='bulk_comments_applied'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    error_log = models.JSONField(default=list, help_text="List of errors if any")
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Bulk Comment: {self.comment_text[:30]} to {self.total_students} students"


# ==============================================================
# DEFAULT PRESET COMMENTS (to be populated on school creation)
# ==============================================================

DEFAULT_PRESETS = {
    'ATTENDANCE': {
        'POSITIVE': [
            "Excellent attendance throughout the term.",
            "Regular and punctual attendance.",
            "Perfect attendance record.",
        ],
        'CONCERN': [
            "Irregular attendance affecting performance.",
            "Multiple absences without valid reasons.",
            "Frequent late arrivals noted.",
            "Parent meeting recommended regarding attendance.",
        ],
    },
    'MARKS': {
        'POSITIVE': [
            "Outstanding performance in all subjects.",
            "Showing consistent improvement.",
            "Excellent grasp of concepts.",
            "Top performer in class.",
        ],
        'NEUTRAL': [
            "Satisfactory performance.",
            "Average performance, can improve with effort.",
            "Meeting basic expectations.",
        ],
        'CONCERN': [
            "Needs additional support in this subject.",
            "Performance below expectations.",
            "Significant improvement required.",
            "Extra practice strongly recommended.",
        ],
    },
    'DISCIPLINE': {
        'POSITIVE': [
            "Well-behaved and respectful.",
            "Sets good example for peers.",
            "Excellent classroom conduct.",
            "Very cooperative and helpful.",
        ],
        'CONCERN': [
            "Occasional disruptions in class.",
            "Needs to improve behavior.",
            "Multiple warnings issued.",
            "Disciplinary action taken.",
        ],
    },
    'HOMEWORK': {
        'POSITIVE': [
            "Always completes homework on time.",
            "Quality homework submissions.",
            "Shows initiative in assignments.",
        ],
        'CONCERN': [
            "Frequent incomplete homework.",
            "Poor quality homework submissions.",
            "Not submitting homework regularly.",
        ],
    },
    'PARTICIPATION': {
        'POSITIVE': [
            "Actively participates in class discussions.",
            "Asks thoughtful questions.",
            "Contributes positively to group activities.",
        ],
        'CONCERN': [
            "Rarely participates in class.",
            "Needs encouragement to speak up.",
            "Hesitant to engage in activities.",
        ],
    },
}
