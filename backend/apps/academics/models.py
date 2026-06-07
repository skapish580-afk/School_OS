from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from apps.teachers.models import Teacher
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
import uuid
from decimal import Decimal

# ============================================================
# 1. CLASS & SECTION ARCHITECTURE
# ============================================================

# ============================================================
# DEPRECATED: Old Grade Model
# ============================================================
# The Grade model below has been DEPRECATED and replaced by
# GradeConfiguration from apps.schools.models_programs
#
# OLD SYSTEM: Simple integer grades (1-12)
# NEW SYSTEM: Program-based grades with TEXT names (LKG, UKG, 1-12)
#
# Migration: All references updated to use GradeConfiguration
# - Section.grade → Section.grade_config
# - ResultPromotionRule.grade → ResultPromotionRule.grade_config
# - StudentPromotionDecision.from_grade/to_grade → from_grade_config/to_grade_config
#
# This model is kept temporarily for reference during migration.
# Will be removed after successful migration verification.
# ============================================================

# class Grade(models.Model):
#     """
#     DEPRECATED: Use GradeConfiguration from apps.schools.models_programs instead
#     A Grade level (1-12) in the school.
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='grades')
#     grade_number = models.PositiveIntegerField()  # 1-12
#     grade_name = models.CharField(max_length=50)  # e.g., "Grade 10"
#     
#     is_active = models.BooleanField(default=True)
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     class Meta:
#         unique_together = ('school', 'grade_number')
#         ordering = ['grade_number']
#
#     def __str__(self):
#         return f"{self.grade_name}"


class Section(models.Model):
    """
    A Section/Class (A, B, C) within a Grade.
    Represents the actual class where students are enrolled.
    
    MODULE 1: CLASSES & SECTIONS
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='sections')
    
    # NEW: Link to GradeConfiguration (program-based grade system)
    grade_config = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='sections',
        help_text="Grade configuration from academic program"
    )
    
    section_letter = models.CharField(max_length=5)  # A, B, C, etc.
    capacity = models.PositiveIntegerField(default=50)
    
    # Module 1: Co-teacher support
    class_teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='class_sections')
    co_class_teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='co_class_sections')
    
    # Module 1: Room/Classroom assignment
    room_number = models.CharField(max_length=20, blank=True, null=True)
    
    # Module 1: Capacity lock (admin control)
    capacity_locked = models.BooleanField(default=False, help_text="Lock to prevent enrollment changes")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'grade_config', 'section_letter')
        ordering = ['grade_config__grade_order', 'section_letter']

    def __str__(self):
        return f"{self.grade_config.grade_name} - {self.section_letter}"

    @property
    def full_name(self):
        return f"{self.grade_config.grade_name}-{self.section_letter}"
    
    # Backward compatibility properties
    @property
    def grade_name(self):
        """Backward compatibility: get grade name"""
        return self.grade_config.grade_name
    
    @property
    def grade_order(self):
        """Get numeric order for sorting"""
        return self.grade_config.grade_order
    
    @property
    def program(self):
        """Get associated academic program"""
        return self.grade_config.program
    
    @property
    def student_count(self):
        """Get current student count from enrollments"""
        from apps.enrollments.models import StudentEnrollment
        return StudentEnrollment.objects.filter(
            section=self,
            status='ACTIVE'
        ).count()
    
    @property
    def can_enroll(self):
        """Check if section can accept more students"""
        return not self.capacity_locked and (self.student_count < self.capacity)


# ============================================================
# 2. SUBJECT MANAGEMENT
# ============================================================

class Subject(models.Model):
    """
    A Subject taught in the school (e.g., Mathematics, Science, History).
    
    MODULE 2: SUBJECTS (RULE ENGINE)
    """
    SUBJECT_TYPES = [
        ('CORE', 'Core'),
        ('ELECTIVE', 'Elective'),
        ('ACTIVITY', 'Activity/Skill'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subjects')
    
    name = models.CharField(max_length=100)  # e.g., Mathematics
    code = models.CharField(max_length=20)   # e.g., MATH-10
    description = models.TextField(blank=True, null=True)
    
    # Module 2: Subject classification
    subject_type = models.CharField(max_length=20, choices=SUBJECT_TYPES, default='CORE')
    
    # Module 2: Rules for subject
    passing_marks = models.PositiveIntegerField(default=40, help_text="Minimum marks to pass")
    affects_promotion = models.BooleanField(default=True, help_text="Whether marks affect grade promotion")
    included_in_board_report = models.BooleanField(default=True, help_text="Include in official board report")
    
    is_core = models.BooleanField(default=True)  # Legacy field - kept for compatibility
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class SubjectMapping(models.Model):
    """
    Maps subjects to specific grade-sections and assigns teachers.
    
    MODULE 2: SUBJECTS - Teacher Assignment
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subject_mappings')
    
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='mappings')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='subject_mappings')
    
    # Module 2: Multiple teacher roles
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='subject_assignments')
    co_teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True, related_name='co_subject_assignments')
    
    # Periods per week and allocation
    periods_per_week = models.PositiveIntegerField(default=3)
    max_marks = models.PositiveIntegerField(default=100)
    
    # Module 2: Exam weightage
    exam_weightage = models.DecimalField(max_digits=3, decimal_places=0, default=100, help_text="Percentage of total marks from exams")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('school', 'subject', 'section')
        ordering = ['section', 'subject']

    def __str__(self):
        return f"{self.subject.name} - {self.section.full_name} ({self.teacher})"


# ============================================================
# 3. TIMETABLE MANAGEMENT
# ============================================================

class Timetable(models.Model):
    """
    Master timetable for a section showing daily schedule.
    
    MODULE 3: TIMETABLE (DISCIPLINE ENGINE)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='timetables')
    section = models.OneToOneField(Section, on_delete=models.CASCADE, related_name='timetable')
    
    # Module 3: Timetable lock control
    is_locked = models.BooleanField(default=False, help_text="Lock to prevent changes")
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='locked_timetables')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Timetable - {self.section.full_name}"
    
    def can_modify(self, user):
        """Check if user can modify this timetable"""
        if self.is_locked:
            # Only Principal/SuperAdmin can override
            return user.is_superuser or (hasattr(user, 'school_admin') and user.school_admin)
        return True


class Period(models.Model):
    """
    A single period/slot in the timetable.
    
    MODULE 3: TIMETABLE - Period Management
    """
    DAYS = [
        ('MON', 'Monday'),
        ('TUE', 'Tuesday'),
        ('WED', 'Wednesday'),
        ('THU', 'Thursday'),
        ('FRI', 'Friday'),
        ('SAT', 'Saturday'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timetable = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name='periods')
    
    day = models.CharField(max_length=3, choices=DAYS)
    period_number = models.PositiveIntegerField()  # 1, 2, 3, etc.
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    subject_mapping = models.ForeignKey(SubjectMapping, on_delete=models.SET_NULL, null=True, blank=True, related_name='periods')
    classroom = models.CharField(max_length=50, blank=True)  # Room number
    
    class Meta:
        unique_together = ('timetable', 'day', 'period_number')
        ordering = ['day', 'period_number']

    def __str__(self):
        return f"{self.day} Period {self.period_number} - {self.subject_mapping}"
    
    @property
    def assigned_teacher(self):
        """Get the assigned teacher (or substitute if applicable)"""
        sub = TemporarySubstitution.objects.filter(period=self, is_active=True).first()
        if sub:
            return sub.substitute_teacher
        return self.subject_mapping.teacher if self.subject_mapping else None


class TemporarySubstitution(models.Model):
    """
    Temporary substitution for a teacher in a specific period.
    
    MODULE 3: TIMETABLE - Substitution Management
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period = models.OneToOneField(Period, on_delete=models.CASCADE, related_name='substitution')
    
    original_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='substituted_periods')
    substitute_teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='substitution_assignments')
    
    reason = models.CharField(max_length=255, blank=True)
    date_from = models.DateField()
    date_to = models.DateField()
    
    is_active = models.BooleanField(default=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_substitutions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.original_teacher} -> {self.substitute_teacher} ({self.date_from} to {self.date_to})"


# ============================================================
# 4. SYLLABUS TRACKING
# ============================================================

class Syllabus(models.Model):
    """
    Syllabus document for a subject in a section.
    Tracks chapters and progress.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='syllabuses')
    
    subject_mapping = models.OneToOneField(SubjectMapping, on_delete=models.CASCADE, related_name='syllabus')
    
    total_chapters = models.PositiveIntegerField()
    academic_year = models.CharField(max_length=9)  # e.g., "2025-2026"
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Syllabus - {self.subject_mapping.subject.name} ({self.academic_year})"

    @property
    def progress_percentage(self):
        """Calculate progress as percentage of completed chapters."""
        total = self.chapters.count()
        if total == 0:
            return 0
        completed = self.chapters.filter(status='COMPLETED').count()
        return int((completed / total) * 100)


class Chapter(models.Model):
    """
    A chapter/topic within a subject's syllabus.
    """
    STATUS_CHOICES = [
        ('NOT_STARTED', 'Not Started'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    syllabus = models.ForeignKey(Syllabus, on_delete=models.CASCADE, related_name='chapters')
    
    chapter_number = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NOT_STARTED')
    
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    actual_completion_date = models.DateField(null=True, blank=True)
    
    last_updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    last_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('syllabus', 'chapter_number')
        ordering = ['chapter_number']

    def __str__(self):
        return f"Chapter {self.chapter_number}: {self.title}"


# ============================================================
# 5. EXAM & RESULT MANAGEMENT
# ============================================================

class Exam(models.Model):
    """
    An exam/assessment (e.g., Midterm, Final, Unit Test).
    
    MODULE 5: EXAMS (CONTROL & DISCIPLINE)
    """
    EXAM_TYPES = [
        ('UNIT_TEST', 'Unit Test'),
        ('MIDTERM', 'Midterm'),
        ('FINALS', 'Finals'),
        ('PERIODIC', 'Periodic Assessment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='exams')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='exams')
    subject_mapping = models.ForeignKey(SubjectMapping, on_delete=models.CASCADE, related_name='exams')
    
    name = models.CharField(max_length=100)  # e.g., "Midterm 2025"
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPES)
    
    exam_date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=120)
    max_marks = models.PositiveIntegerField(default=100)
    passing_marks = models.PositiveIntegerField(default=40)
    
    # Module 5: Exam room and invigilator assignment
    exam_room = models.CharField(max_length=50, blank=True, null=True)
    invigilators = models.ManyToManyField(Teacher, blank=True, related_name='invigilated_exams')
    
    # Module 5: Attendance eligibility
    min_attendance_percentage = models.PositiveIntegerField(default=75, help_text="Minimum attendance % to be eligible")
    
    # Module 5: Grace marks (admin only)
    grace_marks = models.PositiveIntegerField(default=0, help_text="Admin-set grace marks")
    
    academic_year = models.CharField(max_length=9)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-exam_date']

    def __str__(self):
        return f"{self.name} - {self.subject_mapping.subject.name}"


class Result(models.Model):
    """
    Student's result/marks for an exam.
    
    MODULE 6: RESULTS (OUTPUT & TRUST)
    """
    MODERATION_STATUS = [
        ('DRAFT', 'Draft - Not Reviewed'),
        ('SUBMITTED', 'Submitted for Review'),
        ('APPROVED', 'Approved by HOD/Admin'),
        ('LOCKED', 'Locked - Final'),
    ]
    
    RESULT_STATUS = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('COMPARTMENT', 'Compartment'),
        ('ABSENT', 'Absent'),
        ('WITHHELD', 'Withheld'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='exam_results')
    
    marks_obtained = models.DecimalField(max_digits=6, decimal_places=2)
    is_absent = models.BooleanField(default=False)
    
    # Promotion & Re-exam tracking
    result_status = models.CharField(max_length=20, choices=RESULT_STATUS, blank=True, help_text="Pass/Fail/Compartment status")
    attempt_number = models.PositiveIntegerField(default=1, help_text="1 for first attempt, 2+ for re-exams")
    is_reexam_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reexam_attempts', help_text="Link to original result if this is a re-exam")
    reexam_eligible = models.BooleanField(default=False, help_text="Is student eligible for re-exam?")
    
    # Module 6: Moderation control
    moderation_status = models.CharField(max_length=20, choices=MODERATION_STATUS, default='DRAFT')
    moderation_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='moderated_results')
    moderation_remarks = models.TextField(blank=True)
    
    # Auto-calculated grade (A+, A, B, etc.)
    grade = models.CharField(max_length=5, blank=True)
    grade_point = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='results_recorded')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('exam', 'student')
        ordering = ['-exam__exam_date']

    def save(self, *args, **kwargs):
        """Auto-calculate grade and result_status based on marks."""
        if not self.is_absent:
            percentage = (self.marks_obtained / self.exam.max_marks) * 100
            
            # Calculate grade
            if percentage >= 90:
                self.grade = 'A+'
                self.grade_point = Decimal('4.0')
            elif percentage >= 80:
                self.grade = 'A'
                self.grade_point = Decimal('3.7')
            elif percentage >= 70:
                self.grade = 'B'
                self.grade_point = Decimal('3.0')
            elif percentage >= 60:
                self.grade = 'C'
                self.grade_point = Decimal('2.0')
            elif percentage >= 50:
                self.grade = 'D'
                self.grade_point = Decimal('1.0')
            else:
                self.grade = 'F'
                self.grade_point = Decimal('0.0')
            
            # Calculate result_status
            if self.marks_obtained >= self.exam.passing_marks:
                self.result_status = 'PASS'
            else:
                # Fail - will be determined as COMPARTMENT by promotion logic if within limits
                self.result_status = 'FAIL'
        else:
            self.grade = 'AB'  # Absent
            self.grade_point = Decimal('0.0')
            self.result_status = 'ABSENT'
            # ABSENT auto-eligible for re-exam (controlled by PromotionRule)
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student.user.full_name} - {self.exam.name}"


class ReportCard(models.Model):
    """
    A frozen summary of performance for a term/year.
    Generates digital report card.
    
    MODULE 6: RESULTS - Report Card Generation & Storage
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='report_cards')
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='report_cards', null=True, blank=True)
    
    term_name = models.CharField(max_length=50)  # e.g., "Midterm 2025"
    academic_year = models.CharField(max_length=9, default='2025-2026')
    
    total_marks_obtained = models.DecimalField(max_digits=7, decimal_places=2, default=0.00)
    total_marks_possible = models.DecimalField(max_digits=7, decimal_places=2, default=0.00)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    grade_awarded = models.CharField(max_length=5, default='P')  # e.g., "A+"
    
    rank = models.PositiveIntegerField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    
    # Module 6: Result locking
    is_locked = models.BooleanField(default=False, help_text="Locked - no further changes allowed")
    locked_at = models.DateTimeField(null=True, blank=True)
    
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    generated_date = models.DateField(auto_now_add=True)
    file_path = models.FileField(upload_to='report_cards/', null=True, blank=True)

    class Meta:
        unique_together = ('student', 'section', 'term_name', 'academic_year')
        ordering = ['-generated_date']

    def __str__(self):
        return f"Report Card - {self.student.user.full_name} ({self.term_name})"


# ============================================================
# ADDITIONAL MODULE 5 & 6 MODELS - DISCIPLINE & MALPRACTICE
# ============================================================

class ExamAbsenteeLog(models.Model):
    """
    Track absences and re-exam eligibility.
    
    MODULE 5: EXAMS - Discipline
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    result = models.OneToOneField(Result, on_delete=models.CASCADE, related_name='absentee_log')
    
    is_eligible_for_reexam = models.BooleanField(default=False)
    re_exam_date = models.DateField(null=True, blank=True)
    re_exam_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Absentee: {self.result.student.user.full_name} - {self.result.exam.name}"


class MalpracticeIncident(models.Model):
    """
    Record of examination malpractice/cheating incidents.
    
    MODULE 5: EXAMS - Discipline & Security
    """
    SEVERITY_LEVELS = [
        ('MINOR', 'Minor (Warning)'),
        ('MAJOR', 'Major (Action Required)'),
        ('SEVERE', 'Severe (Escalation)'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='malpractice_incidents')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='malpractice_records')
    
    description = models.TextField(help_text="Detailed account of the incident")
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS, default='MINOR')
    
    # Witness / Reporter
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='reported_incidents')
    
    # Action taken
    action_taken = models.TextField(blank=True, help_text="Disciplinary action or outcome")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_malpractice_actions')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Malpractice: {self.student.user.full_name} - {self.exam.name} ({self.severity})"


# ============================================================
# PROMOTION & RESULT STATUS MODELS
# ============================================================

class ResultPromotionRule(models.Model):
    """
    Define promotion criteria based on exam results for a grade/board.
    Controls pass/fail thresholds, compartment limits, re-exam rules.
    
    NOW USES: GradeConfiguration (program-based grade system)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='result_promotion_rules')
    
    # NEW: Link to GradeConfiguration
    grade_config = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='promotion_rules',
        help_text="Grade configuration from academic program"
    )
    academic_year = models.CharField(max_length=9, default='2025-2026')
    
    # Overall criteria
    min_overall_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=40.00, help_text="Minimum overall % to be eligible for promotion")
    min_attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=75.00, help_text="Minimum attendance % required")
    
    # Compartment rules
    max_compartments_allowed = models.PositiveIntegerField(default=2, help_text="Maximum subjects student can have in compartment")
    compartment_subjects = models.TextField(blank=True, help_text="Comma-separated subject codes that can be in compartment (leave blank for all)")
    
    # Re-exam rules
    allow_reexam_for_absent = models.BooleanField(default=True, help_text="Allow re-exam for ABSENT students (does not count toward compartment limit)")
    allow_reexam_for_fail = models.BooleanField(default=True, help_text="Allow re-exam for FAIL students within compartment limit")
    reexam_window_days = models.PositiveIntegerField(default=30, help_text="Days within which re-exam must be conducted")
    
    # Subject-specific rules
    mandatory_subjects = models.TextField(blank=True, help_text="Comma-separated subject codes that must be passed (e.g., English, Math)")
    
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('school', 'grade_config', 'academic_year')
        ordering = ['grade_config__grade_order']
    
    def __str__(self):
        return f"Result Promotion Rule - {self.grade_config.grade_name} ({self.academic_year})"


class StudentPromotionDecision(models.Model):
    """
    Final promotion decision for a student in an academic year.
    Generated after all exam results are published.
    
    NOW USES: GradeConfiguration (program-based grade system)
    """
    DECISION_STATUS = [
        ('PROMOTED', 'Promoted to Next Grade'),
        ('DETAINED', 'Detained in Current Grade'),
        ('COMPARTMENT', 'Promoted with Compartment'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='promotion_decisions')
    academic_year = models.CharField(max_length=9)
    
    # NEW: Link to GradeConfiguration
    from_grade_config = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='promotions_from',
        help_text="Grade configuration student is being promoted from"
    )
    to_grade_config = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='promotions_to',
        null=True,
        blank=True,
        help_text="Grade configuration student is being promoted to"
    )
    
    # Decision
    overall_status = models.CharField(max_length=20, choices=DECISION_STATUS)
    overall_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    # Subject details (JSON)
    subject_wise_status = models.JSONField(default=dict, help_text="Subject-wise pass/fail/compartment status")
    compartment_subjects = models.TextField(blank=True, help_text="Comma-separated list of subjects in compartment")
    failed_subjects = models.TextField(blank=True, help_text="Comma-separated list of failed subjects")
    
    # Metadata
    remarks = models.TextField(blank=True)
    is_locked = models.BooleanField(default=False, help_text="Once locked, cannot be changed without correction workflow")
    
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='promotion_decisions_made')
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('student', 'academic_year')
        ordering = ['-academic_year', '-created_at']
    
    def __str__(self):
        return f"{self.student.first_name} {self.student.last_name} - {self.academic_year} - {self.overall_status}"


# Import assignment models
from .models_assignments import Assignment, AssignmentSubmission
from .models_certificates import *
from .models_exam_scheme import *
from .models_result_system import *
from .models_timetable import *