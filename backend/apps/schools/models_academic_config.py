"""
School Academic Configuration Models
Allows each school admin to customize:
- Semesters/Terms per grade
- Examination structure & weightages
- Attendance weightage in final score
- Assignment tracking settings
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class SchoolAcademicConfig(models.Model):
    """
    Master academic configuration for a school.
    Defines academic year structure, grading system, etc.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='academic_config'
    )
    
    # Academic Year Structure
    academic_year_start_month = models.PositiveSmallIntegerField(
        default=4,  # April
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text='Month when academic year starts (1=Jan, 4=April, etc.)'
    )
    
    # Grading System
    GRADING_SYSTEM_CHOICES = [
        ('PERCENTAGE', 'Percentage Based'),
        ('CGPA', 'CGPA (10 Point)'),
        ('LETTER', 'Letter Grades (A-F)'),
        ('CUSTOM', 'Custom Grading'),
    ]
    grading_system = models.CharField(
        max_length=20,
        choices=GRADING_SYSTEM_CHOICES,
        default='PERCENTAGE'
    )
    
    # Attendance Configuration
    attendance_weightage_enabled = models.BooleanField(
        default=False,
        help_text='Include attendance percentage in final score calculation'
    )
    attendance_weightage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Percentage weight of attendance in final score (0-100)'
    )
    minimum_attendance_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=75,
        help_text='Minimum attendance required for promotion'
    )
    
    # Assignment Configuration
    assignments_enabled = models.BooleanField(
        default=True,
        help_text='Enable assignment tracking system'
    )
    assignments_weightage_enabled = models.BooleanField(
        default=False,
        help_text='Include assignment scores in final grade'
    )
    assignments_weightage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Percentage weight of assignments in final score'
    )
    
    # Promotion Settings
    auto_promotion_enabled = models.BooleanField(
        default=False,
        help_text='Automatically promote students meeting criteria'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'School Academic Configuration'
        verbose_name_plural = 'School Academic Configurations'
    
    def __str__(self):
        return f"Academic Config - {self.school.name}"


class GradeTermConfig(models.Model):
    """
    Defines the term/semester structure for each grade in a school.
    Different grades can have different number of terms.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='grade_term_configs'
    )
    grade = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='term_configs',
        null=True,
        blank=True
    )
    
    # Term Structure
    TERM_SYSTEM_CHOICES = [
        ('ANNUAL', 'Annual (1 Term)'),
        ('SEMESTER', 'Semester (2 Terms)'),
        ('TRIMESTER', 'Trimester (3 Terms)'),
        ('QUARTERLY', 'Quarterly (4 Terms)'),
        ('CUSTOM', 'Custom'),
    ]
    term_system = models.CharField(
        max_length=20,
        choices=TERM_SYSTEM_CHOICES,
        default='SEMESTER'
    )
    number_of_terms = models.PositiveSmallIntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(6)],
        help_text='Number of terms/semesters in academic year'
    )
    
    class Meta:
        unique_together = ('school', 'grade')
        verbose_name = 'Grade Term Configuration'
    
    def __str__(self):
        return f"{self.school.name} - {self.grade.grade_name}: {self.get_term_system_display()}"


class ExamType(models.Model):
    """
    Custom examination types defined by each school.
    e.g., Unit Test, Mid-Term, Final, Practical, Project, etc.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='exam_types'
    )
    
    name = models.CharField(max_length=100, help_text='e.g., Unit Test 1, Mid-Term, Final Exam')
    code = models.CharField(max_length=20, help_text='e.g., UT1, MID, FINAL')
    
    # Weightage in final grade
    weightage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Percentage weight of this exam type in final grade'
    )
    
    # Configuration
    max_marks = models.PositiveIntegerField(default=100, help_text='Default maximum marks')
    passing_marks_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=33,
        help_text='Passing percentage for this exam type'
    )
    
    # Exam category
    CATEGORY_CHOICES = [
        ('WRITTEN', 'Written Exam'),
        ('PRACTICAL', 'Practical/Lab'),
        ('PROJECT', 'Project Work'),
        ('ORAL', 'Oral/Viva'),
        ('ASSIGNMENT', 'Assignment Based'),
        ('INTERNAL', 'Internal Assessment'),
    ]
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='WRITTEN')
    
    # Applicable terms (null = all terms)
    applicable_terms = models.JSONField(
        default=list,
        blank=True,
        help_text='List of term numbers this exam applies to. Empty = all terms.'
    )
    
    # Ordering
    sequence = models.PositiveSmallIntegerField(default=1, help_text='Order of exam in term')
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('school', 'code')
        ordering = ['sequence', 'name']
        verbose_name = 'Exam Type'
    
    def __str__(self):
        return f"{self.school.name} - {self.name} ({self.weightage_percent}%)"


class GradeExamStructure(models.Model):
    """
    Links exam types to specific grades with custom weightages.
    Allows different grades to have different exam structures.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='grade_exam_structures'
    )
    grade = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.CASCADE,
        related_name='exam_structures',
        null=True,
        blank=True
    )
    exam_type = models.ForeignKey(
        ExamType,
        on_delete=models.CASCADE,
        related_name='grade_structures'
    )
    
    # Override weightage for this specific grade (optional)
    weightage_override = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Override default weightage for this grade. Leave empty to use exam type default.'
    )
    
    # Override max marks for this grade (optional)
    max_marks_override = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Override max marks for this grade'
    )
    
    is_mandatory = models.BooleanField(default=True, help_text='Is this exam mandatory for this grade?')
    
    class Meta:
        unique_together = ('school', 'grade', 'exam_type')
        verbose_name = 'Grade Exam Structure'
    
    @property
    def effective_weightage(self):
        return self.weightage_override if self.weightage_override is not None else self.exam_type.weightage_percent
    
    @property
    def effective_max_marks(self):
        return self.max_marks_override if self.max_marks_override is not None else self.exam_type.max_marks
    
    def __str__(self):
        return f"{self.grade.grade_name} - {self.exam_type.name}"


class CustomGradeScale(models.Model):
    """
    Custom grading scale for schools using letter grades or custom grades.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='grade_scales'
    )
    
    grade_letter = models.CharField(max_length=5, help_text='e.g., A+, A, B+, B, C, D, F')
    min_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    max_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    grade_points = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0,
        help_text='Grade points (for CGPA calculation)'
    )
    description = models.CharField(max_length=50, blank=True, help_text='e.g., Excellent, Good, Average')
    
    class Meta:
        unique_together = ('school', 'grade_letter')
        ordering = ['-min_percentage']
        verbose_name = 'Custom Grade Scale'
    
    def __str__(self):
        return f"{self.school.name} - {self.grade_letter} ({self.min_percentage}-{self.max_percentage}%)"
