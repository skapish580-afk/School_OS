"""
Exam Scheme Models - Industry-standard exam blueprint system
CBSE/ICSE-aligned approach

Hierarchy:
Academic Year → Grade → ExamScheme (Blueprint)
                          ├── Exam (UT1, Term1, etc.)
                          └── ExamSubject (which subjects take which exams)
                               └── ExamInstance (auto-generated per section)
                                    └── StudentResult (teacher marks entry)
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Q


class ExamScheme(models.Model):
    """
    Exam Scheme / Assessment Plan
    
    Defines the blueprint for a grade's examinations for an academic year.
    Admin sets up once per year per grade.
    
    Example:
    - Grade 10, AY 2025-26 will have:
      ├── Unit Test 1 (20)
      ├── Unit Test 2 (20)
      ├── Term 1 (80)
      └── Term 2 (80)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='exam_schemes'
    )
    grade_config = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='exam_schemes',
        help_text="Grade level for this scheme"
    )
    academic_year = models.CharField(
        max_length=9,
        help_text='Academic year (e.g., 2025-2026)'
    )
    board = models.CharField(
        max_length=50,
        default='CUSTOM',
        help_text='Board/System (CBSE, ICSE, CUSTOM, etc.)'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        help_text='Is this scheme currently active?'
    )
    is_published = models.BooleanField(
        default=False,
        help_text='Is this scheme published? (cannot edit after publish)'
    )
    
    # Metadata
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_exam_schemes'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('school', 'grade_config', 'academic_year')
        ordering = ['-academic_year', 'grade_config']
        verbose_name = 'Exam Scheme'
    
    def __str__(self):
        return f"{self.grade_config.grade_name} - {self.academic_year} ({self.school.name})"
    
    def get_total_marks(self):
        """Get total marks across all exams in this scheme"""
        return sum(exam.max_marks for exam in self.exams.all())


class SchemeExam(models.Model):
    """
    Individual Exam in a Scheme
    
    Examples: UT1, UT2, Term1, Term2, Final, etc.
    
    Key: These are GENERIC exam types within the scheme.
    They're NOT subject or section specific yet.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme = models.ForeignKey(
        ExamScheme,
        on_delete=models.CASCADE,
        related_name='exams'
    )
    
    name = models.CharField(
        max_length=100,
        help_text='Exam name (e.g., Unit Test 1, Term 1, Final)'
    )
    code = models.CharField(
        max_length=20,
        help_text='Code (e.g., UT1, T1, FIN)'
    )
    description = models.TextField(
        blank=True,
        help_text='Description of this exam'
    )
    
    # Marks structure
    max_marks = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text='Maximum marks for this exam'
    )
    passing_marks_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=33,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Passing percentage for this exam'
    )
    
    # Weightage in final calculation
    weightage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Weight in final grade calculation'
    )
    
    # Type
    EXAM_TYPES = [
        ('UNIT_TEST', 'Unit Test'),
        ('PERIODIC', 'Periodic Assessment'),
        ('TERM', 'Term Exam'),
        ('MID_TERM', 'Mid Term'),
        ('FINAL', 'Final'),
        ('PRACTICAL', 'Practical'),
    ]
    exam_type = models.CharField(
        max_length=20,
        choices=EXAM_TYPES,
        default='UNIT_TEST'
    )
    
    # Is this counted in final score?
    is_final = models.BooleanField(
        default=False,
        help_text='Include in final result calculation'
    )
    
    # Sequence
    sequence = models.PositiveIntegerField(
        default=0,
        help_text='Order in which to display exams'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('DRAFT', 'Draft'),
            ('ACTIVE', 'Active'),
            ('ARCHIVED', 'Archived'),
        ],
        default='DRAFT'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sequence', 'name']
        unique_together = ('scheme', 'code')
    
    def __str__(self):
        return f"{self.name} ({self.code}) - {self.scheme.grade.grade_name}"
    
    def get_passing_marks(self):
        """Calculate passing marks from percentage"""
        return int(self.max_marks * self.passing_marks_percent / 100)


class ExamSubject(models.Model):
    """
    Subject Mapping for an Exam
    
    Defines:
    - Which subjects take this exam
    - Passing marks for each subject
    - Whether it's mandatory for the subject
    
    Example:
    - Exam: "Term 1"
    - Subject: "Science" → passing_marks=26, mandatory=True
    - Subject: "PE" → passing_marks=20, mandatory=False
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(
        SchemeExam,
        on_delete=models.CASCADE,
        related_name='subject_mappings'
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='exam_mappings'
    )
    
    # Subject-specific settings
    passing_marks = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text='Passing marks for this subject (leave empty to use exam default)'
    )
    is_mandatory = models.BooleanField(
        default=True,
        help_text='Is this exam mandatory for this subject?'
    )
    
    # Display settings
    sequence = models.PositiveIntegerField(
        default=0,
        help_text='Order to display this subject'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('exam', 'subject')
        ordering = ['sequence', 'subject__name']
    
    def __str__(self):
        return f"{self.exam.name} → {self.subject.name}"
    
    def get_passing_marks(self):
        """Return subject-specific or exam default passing marks"""
        if self.passing_marks is not None:
            return self.passing_marks
        return self.exam.get_passing_marks()


class ExamInstance(models.Model):
    """
    AUTO-GENERATED Instance of an Exam
    
    System auto-creates one for each:
    - Exam (e.g., Term 1)
    - Subject (e.g., Science)
    - Section (e.g., 10A, 10B)
    
    Key: Teachers do NOT interact with ExamScheme/Exam.
    They only interact with ExamInstance to enter marks.
    
    Example instances:
    - Term 1 → Science → 10A
    - Term 1 → Science → 10B
    - Term 1 → English → 10A
    etc.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(
        SchemeExam,
        on_delete=models.CASCADE,
        related_name='instances'
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='exam_instances'
    )
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        related_name='exam_instances'
    )
    
    # Derived info for quick access
    grade = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='exam_instances',
        null=True,
        blank=True
    )
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='exam_instances'
    )
    
    # Status tracking
    STATUS_CHOICES = [
        ('DRAFT', 'Draft - Not Started'),
        ('ACTIVE', 'Active - Marks being entered'),
        ('SUBMITTED', 'Submitted for Review'),
        ('APPROVED', 'Approved by Admin'),
        ('PUBLISHED', 'Published - Final'),
        ('ARCHIVED', 'Archived'),
    ]
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='DRAFT'
    )
    
    # Scheduling
    exam_date = models.DateField(
        blank=True,
        null=True,
        help_text='Date of exam (optional)'
    )
    duration_minutes = models.PositiveIntegerField(
        default=60,
        help_text='Duration in minutes'
    )
    
    # Published info
    published_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text='When was this exam published?'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('exam', 'subject', 'section')
        ordering = ['exam__sequence', 'subject__name']
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['section', 'status']),
        ]
    
    def __str__(self):
        return f"{self.exam.name} - {self.subject.name} {self.section.name}"
    
    def get_teacher_for_subject(self):
        """Get teacher assigned to this subject in this section"""
        from apps.academics.models import SubjectMapping
        try:
            mapping = SubjectMapping.objects.get(
                section=self.section,
                subject=self.subject
            )
            return mapping.teacher
        except SubjectMapping.DoesNotExist:
            return None


class StudentResult(models.Model):
    """
    Student's marks for an exam instance
    
    Teachers enter marks here.
    One record per student per exam instance.
    
    IMPORTANT: This is the ONLY place teachers touch exam data.
    They cannot:
    - Change exam structure
    - Change max marks
    - See other sections
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam_instance = models.ForeignKey(
        ExamInstance,
        on_delete=models.CASCADE,
        related_name='student_results'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='scheme_exam_results'  # Changed to avoid clash with existing Result model
    )
    
    # Marks
    marks_obtained = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        help_text='Marks obtained by student'
    )
    
    # Status
    STATUS_CHOICES = [
        ('ABSENT', 'Absent'),
        ('PRESENT', 'Present'),
        ('WITHHELD', 'Withheld'),
    ]
    attendance_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PRESENT'
    )
    
    # Derived
    is_pass = models.BooleanField(
        default=False,
        help_text='Did student pass this exam?'
    )
    
    # Grace marks (admin only)
    grace_marks = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0,
        help_text='Grace marks awarded by admin'
    )
    
    # Remarks
    remarks = models.TextField(
        blank=True,
        help_text='Teacher remarks'
    )
    
    # Re-exam tracking
    ATTEMPT_CHOICES = [
        (1, 'First Attempt'),
        (2, 'Second Attempt (Re-exam)'),
        (3, 'Third Attempt'),
    ]
    attempt_number = models.PositiveIntegerField(
        default=1,
        choices=ATTEMPT_CHOICES,
        help_text='Attempt number (1=first, 2+=re-exam)'
    )
    
    # Compartment tracking
    is_compartment = models.BooleanField(
        default=False,
        help_text='Is this a compartment exam?'
    )
    
    # Moderation
    MODERATION_STATUS = [
        ('DRAFT', 'Draft - Teacher entering marks'),
        ('SUBMITTED', 'Submitted - Awaiting review'),
        ('APPROVED', 'Approved - Can be published'),
        ('PUBLISHED', 'Published - Final & locked'),
    ]
    moderation_status = models.CharField(
        max_length=20,
        choices=MODERATION_STATUS,
        default='DRAFT'
    )
    
    locked_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text='When was this result locked?'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('exam_instance', 'student', 'attempt_number')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['exam_instance', 'moderation_status']),
            models.Index(fields=['student', 'attempt_number']),
        ]
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.exam_instance}"
    
    def calculate_final_marks(self):
        """Calculate final marks with grace marks"""
        if self.marks_obtained is None:
            return None
        return min(
            self.marks_obtained + self.grace_marks,
            self.exam_instance.exam.max_marks
        )
    
    def check_pass(self):
        """Check if student passed"""
        if self.attendance_status == 'ABSENT':
            self.is_pass = False
            return
        
        final_marks = self.calculate_final_marks()
        if final_marks is None:
            self.is_pass = False
            return
        
        passing_marks = self.exam_instance.exam.get_passing_marks()
        self.is_pass = final_marks >= passing_marks
    
    def save(self, *args, **kwargs):
        """Auto-calculate pass status on save"""
        self.check_pass()
        super().save(*args, **kwargs)
