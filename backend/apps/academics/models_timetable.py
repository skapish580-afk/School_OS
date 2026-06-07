"""
CRITICAL MODULE: Timetable Management with Clash Detection
===========================================================
Ground Reality: "Math teacher is absent today. What happens?"

This module handles:
- Timetable creation
- Teacher clash detection (can't be in 2 places at once)
- Room clash detection
- Substitute teacher assignment
- Emergency period swaps
- Holiday overrides
- Real-time availability tracking
"""

from django.db import models
from apps.schools.models import School
from apps.teachers.models import Teacher
from apps.academics.models import Subject, Section
from apps.schools.models_programs import GradeConfiguration
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
import uuid
from datetime import time, date, datetime

User = get_user_model()


class TimeSlot(models.Model):
    """
    Defines time slots for periods.
    Example: Period 1: 8:00-8:40, Period 2: 8:40-9:20
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='timeslots')
    
    slot_name = models.CharField(max_length=50, help_text="e.g., 'Period 1', 'Morning Assembly'")
    slot_number = models.PositiveIntegerField(help_text="Sequence number")
    
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Type
    SLOT_TYPES = [
        ('REGULAR', 'Regular Class'),
        ('BREAK', 'Break/Recess'),
        ('ASSEMBLY', 'Assembly'),
        ('LUNCH', 'Lunch'),
        ('ACTIVITY', 'Activity Period'),
    ]
    slot_type = models.CharField(max_length=20, choices=SLOT_TYPES, default='REGULAR')
    
    # Days applicable (JSON array: [1,2,3,4,5] for Mon-Fri)
    applicable_days = models.JSONField(
        default=list,
        help_text="List of day numbers (1=Monday, 7=Sunday)"
    )
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['slot_number']
        unique_together = ['school', 'slot_number']
    
    def __str__(self):
        return f"{self.slot_name} ({self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')})"
    
    def duration_minutes(self):
        """Calculate duration in minutes"""
        delta = datetime.combine(date.today(), self.end_time) - datetime.combine(date.today(), self.start_time)
        return delta.seconds // 60


class TimetableEntry(models.Model):
    """
    Individual timetable entry linking:
    - Time slot
    - Teacher
    - Subject
    - Class (Grade-Section)
    - Room
    
    With CLASH DETECTION.
    """
    DAYS_OF_WEEK = [
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday'),
        (7, 'Sunday'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='timetable_entries')
    
    # When
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE, related_name='timetable_entries')
    
    # Who & What
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='timetable_entries')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='timetable_entries')
    
    # Where
    grade = models.ForeignKey(GradeConfiguration, on_delete=models.CASCADE, related_name='timetable_entries', null=True, blank=True)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='timetable_entries')
    room_number = models.CharField(max_length=20, blank=True)
    
    # Academic year
    academic_year = models.CharField(max_length=9, default='2025-2026')
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Substitute tracking
    is_substituted = models.BooleanField(default=False)
    substitute_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='substitute_entries',
        help_text="If original teacher is absent"
    )
    substitution_reason = models.TextField(blank=True)
    
    # Cancellation
    is_cancelled = models.BooleanField(default=False)
    cancellation_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['day_of_week', 'time_slot__slot_number']
        indexes = [
            models.Index(fields=['day_of_week', 'time_slot', 'teacher']),
            models.Index(fields=['day_of_week', 'time_slot', 'section']),
            models.Index(fields=['teacher', 'academic_year']),
        ]
    
    def __str__(self):
        return f"{self.get_day_of_week_display()} - {self.time_slot.slot_name} - {self.subject.name} - {self.section.full_name}"
    
    def clean(self):
        """
        CRITICAL: Clash detection before saving.
        """
        if not self.pk:  # Only on creation
            # Check teacher clash
            teacher_clash = TimetableEntry.objects.filter(
                school=self.school,
                day_of_week=self.day_of_week,
                time_slot=self.time_slot,
                teacher=self.teacher,
                is_active=True,
                is_cancelled=False
            ).exists()
            
            if teacher_clash:
                raise ValidationError(
                    f"TEACHER CLASH: {self.teacher.user.full_name} is already assigned to another class "
                    f"on {self.get_day_of_week_display()} during {self.time_slot.slot_name}"
                )
            
            # Check room clash (if room specified)
            if self.room_number:
                room_clash = TimetableEntry.objects.filter(
                    school=self.school,
                    day_of_week=self.day_of_week,
                    time_slot=self.time_slot,
                    room_number=self.room_number,
                    is_active=True,
                    is_cancelled=False
                ).exists()
                
                if room_clash:
                    raise ValidationError(
                        f"ROOM CLASH: Room {self.room_number} is already booked "
                        f"on {self.get_day_of_week_display()} during {self.time_slot.slot_name}"
                    )
            
            # Check section clash (students can't be in 2 classes)
            section_clash = TimetableEntry.objects.filter(
                school=self.school,
                day_of_week=self.day_of_week,
                time_slot=self.time_slot,
                section=self.section,
                is_active=True,
                is_cancelled=False
            ).exists()
            
            if section_clash:
                raise ValidationError(
                    f"SECTION CLASH: {self.section.full_name} already has a class scheduled "
                    f"on {self.get_day_of_week_display()} during {self.time_slot.slot_name}"
                )
    
    def save(self, *args, **kwargs):
        self.full_clean()  # Trigger clash detection
        super().save(*args, **kwargs)


class TeacherAbsence(models.Model):
    """
    Tracks teacher absences.
    Triggers substitute assignment workflow.
    """
    ABSENCE_TYPES = [
        ('SICK', 'Sick Leave'),
        ('CASUAL', 'Casual Leave'),
        ('PLANNED', 'Planned Leave'),
        ('EMERGENCY', 'Emergency'),
        ('TRAINING', 'Training/Workshop'),
        ('OFFICIAL', 'Official Duty'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teacher_absences')
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='absences')
    
    # When
    from_date = models.DateField()
    to_date = models.DateField()
    is_full_day = models.BooleanField(default=True)
    
    # If partial day
    specific_periods = models.JSONField(
        default=list,
        blank=True,
        help_text="List of time slot IDs if partial day"
    )
    
    # Why
    absence_type = models.CharField(max_length=20, choices=ABSENCE_TYPES)
    reason = models.TextField()
    
    # Medical certificate
    medical_certificate = models.FileField(
        upload_to='leaves/certificates/',
        null=True,
        blank=True
    )
    
    # Approval
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leaves_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Substitute handling
    substitutes_assigned = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-from_date']
    
    def __str__(self):
        return f"{self.teacher.user.full_name} - {self.absence_type} ({self.from_date} to {self.to_date})"
    
    def get_affected_periods(self):
        """
        Get all timetable entries affected by this absence.
        """
        affected = []
        current_date = self.from_date
        
        while current_date <= self.to_date:
            day_num = current_date.isoweekday()  # 1=Monday
            
            entries = TimetableEntry.objects.filter(
                school=self.school,
                teacher=self.teacher,
                day_of_week=day_num,
                is_active=True
            )
            
            if not self.is_full_day and self.specific_periods:
                entries = entries.filter(time_slot_id__in=self.specific_periods)
            
            for entry in entries:
                affected.append({
                    'date': current_date,
                    'entry': entry
                })
            
            current_date += timedelta(days=1)
        
        return affected


class SubstituteAssignment(models.Model):
    """
    Assigns substitute teacher to cover absent teacher's class.
    Reality: "Math teacher absent, who covers Period 3?"
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('DECLINED', 'Declined'),
        ('COMPLETED', 'Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='substitute_assignments')
    
    # Original details
    absence = models.ForeignKey(TeacherAbsence, on_delete=models.CASCADE, related_name='substitutes')
    original_entry = models.ForeignKey(TimetableEntry, on_delete=models.CASCADE, related_name='substitutes')
    
    # Substitute teacher
    substitute_teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name='substitute_assignments'
    )
    
    # Date of substitution
    substitution_date = models.DateField()
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Confirmation
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='substitutes_confirmed'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    
    # Completion
    completed = models.BooleanField(default=False)
    completion_notes = models.TextField(blank=True, help_text="What was covered in class")
    
    # Compensation tracking
    compensation_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Extra payment for substitute duty"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['substitution_date', 'original_entry__time_slot__slot_number']
    
    def __str__(self):
        return f"{self.substitute_teacher.user.full_name} covering {self.original_entry.subject.name} on {self.substitution_date}"
    
    def check_substitute_availability(self):
        """
        Check if substitute teacher is free during this period.
        """
        day_num = self.substitution_date.isoweekday()
        
        conflict = TimetableEntry.objects.filter(
            school=self.school,
            teacher=self.substitute_teacher,
            day_of_week=day_num,
            time_slot=self.original_entry.time_slot,
            is_active=True
        ).exclude(pk=self.original_entry.pk).exists()
        
        return not conflict  # True if available


class EmergencyPeriodSwap(models.Model):
    """
    Same-day period swaps between teachers.
    Reality: "Can we swap Period 2 and Period 5 today?"
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('COMPLETED', 'Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='period_swaps')
    
    swap_date = models.DateField()
    
    # Period A (to be swapped)
    period_a = models.ForeignKey(
        TimetableEntry,
        on_delete=models.CASCADE,
        related_name='swaps_as_period_a'
    )
    
    # Period B (to be swapped with)
    period_b = models.ForeignKey(
        TimetableEntry,
        on_delete=models.CASCADE,
        related_name='swaps_as_period_b'
    )
    
    reason = models.TextField()
    
    # Request & Approval
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='period_swaps_requested'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='period_swaps_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    
    # Execution
    completed = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-swap_date', '-requested_at']
    
    def __str__(self):
        return f"Swap Request: {self.period_a.subject.name} ↔ {self.period_b.subject.name} on {self.swap_date}"


class HolidayCalendar(models.Model):
    """
    School holidays and special days.
    Affects timetable execution.
    """
    HOLIDAY_TYPES = [
        ('NATIONAL', 'National Holiday'),
        ('RELIGIOUS', 'Religious Holiday'),
        ('SCHOOL', 'School Holiday'),
        ('EXAM', 'Exam Day'),
        ('EVENT', 'School Event'),
        ('WEEKEND', 'Weekend'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='holidays')
    
    holiday_name = models.CharField(max_length=200)
    holiday_type = models.CharField(max_length=20, choices=HOLIDAY_TYPES)
    
    from_date = models.DateField()
    to_date = models.DateField()
    
    description = models.TextField(blank=True)
    
    # Does this cancel timetable?
    cancels_classes = models.BooleanField(default=True)
    
    # Specific grades affected (if partial)
    affected_grades = models.JSONField(
        default=list,
        blank=True,
        help_text="List of grade numbers if only certain grades affected"
    )
    
    is_recurring = models.BooleanField(default=False, help_text="Repeats yearly?")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['from_date']
    
    def __str__(self):
        return f"{self.holiday_name} ({self.from_date} to {self.to_date})"


class TeacherAvailability(models.Model):
    """
    Real-time teacher availability tracking.
    Helps with substitute assignment.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teacher_availability')
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='availability')
    
    # When
    date = models.DateField()
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    
    # Status
    is_available = models.BooleanField(default=True)
    reason_unavailable = models.CharField(
        max_length=200,
        blank=True,
        choices=[
            ('CLASS', 'Teaching Class'),
            ('MEETING', 'In Meeting'),
            ('ABSENT', 'On Leave'),
            ('DUTY', 'Other Duty'),
        ]
    )
    
    # Auto-generated from timetable or manually set
    is_manual = models.BooleanField(default=False)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['teacher', 'date', 'time_slot']
        indexes = [
            models.Index(fields=['date', 'is_available']),
        ]
    
    def __str__(self):
        status = "Available" if self.is_available else "Unavailable"
        return f"{self.teacher.user.full_name} - {self.date} {self.time_slot.slot_name} - {status}"


# Import timedelta for date arithmetic
from datetime import timedelta
