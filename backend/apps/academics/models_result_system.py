"""
CRITICAL MODULE: Academic Result & Promotion Linkage System
=====================================================
This module provides the REAL academic logic that links:
- Subject-wise marks
- Term exam results  
- Pass/Fail determination
- Compartment/ATKT handling
- Re-exam flows
- Promotion eligibility

Ground Reality: "Fail in Maths but pass overall – what happens?"
This module answers that.
"""

from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from apps.teachers.models import Teacher
from django.contrib.auth import get_user_model
import uuid
from decimal import Decimal

User = get_user_model()


class ExamTerm(models.Model):
    """
    Defines exam terms/cycles in an academic year.
    Example: Unit Test 1, Midterm, Final, Re-exam
    """
    TERM_TYPES = [
        ('UNIT', 'Unit Test'),
        ('MIDTERM', 'Mid Term'),
        ('FINAL', 'Final Exam'),
        ('REEXAM', 'Re-examination'),
        ('SUPPLEMENTARY', 'Supplementary Exam'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='exam_terms')
    
    term_name = models.CharField(max_length=100)  # "Unit Test 1", "Final Exam 2025"
    term_type = models.CharField(max_length=20, choices=TERM_TYPES)
    academic_year = models.CharField(max_length=9)  # "2025-2026"
    
    # Weightage for final result
    weightage_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        help_text="Contribution to final result (e.g., 20 for 20%)"
    )
    
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Result declaration
    result_declaration_date = models.DateField(null=True, blank=True)
    is_result_declared = models.BooleanField(default=False)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['start_date']
        unique_together = ['school', 'term_name', 'academic_year']
    
    def __str__(self):
        return f"{self.term_name} ({self.academic_year})"


class SubjectExam(models.Model):
    """
    A specific subject exam within a term.
    Links: Term → Subject → Grade → Marks Entry
    """
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subject_exams')
    
    term = models.ForeignKey(ExamTerm, on_delete=models.CASCADE, related_name='subject_exams')
    subject = models.ForeignKey('Subject', on_delete=models.CASCADE, related_name='exams')
    grade = models.ForeignKey('schools.GradeConfiguration', on_delete=models.CASCADE, related_name='exams', null=True, blank=True)
    
    exam_date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=60)
    
    total_marks = models.DecimalField(max_digits=6, decimal_places=2)
    passing_marks = models.DecimalField(max_digits=6, decimal_places=2)
    
    # Marks moderation
    moderation_status = models.CharField(
        max_length=20,
        choices=[
            ('DRAFT', 'Draft'),
            ('SUBMITTED', 'Submitted'),
            ('APPROVED', 'Approved'),
            ('LOCKED', 'Locked'),
        ],
        default='DRAFT'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['exam_date']
        unique_together = ['school', 'term', 'subject', 'grade']
    
    def __str__(self):
        return f"{self.subject.name} - {self.grade.grade_name} ({self.term.term_name})"


class StudentMark(models.Model):
    """
    Individual student marks for a subject exam.
    Replaces the generic Result model with proper academic structure.
    """
    GRADE_CHOICES = [
        ('A+', 'A+ (90-100%)'),
        ('A', 'A (80-89%)'),
        ('B', 'B (70-79%)'),
        ('C', 'C (60-69%)'),
        ('D', 'D (50-59%)'),
        ('E', 'E (40-49%)'),
        ('F', 'F (Below 40%)'),
        ('AB', 'Absent'),
        ('UF', 'Unfair Means'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_marks')
    
    exam = models.ForeignKey(SubjectExam, on_delete=models.CASCADE, related_name='marks')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='subject_marks')
    
    marks_obtained = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        null=True, 
        blank=True,
        help_text="Actual marks scored"
    )
    
    is_absent = models.BooleanField(default=False)
    is_unfair_means = models.BooleanField(default=False)
    
    # Auto-calculated fields
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    grade = models.CharField(max_length=3, choices=GRADE_CHOICES, blank=True)
    is_pass = models.BooleanField(default=False, help_text="Pass/Fail for this subject")
    
    # Teacher remarks
    remarks = models.TextField(blank=True)
    
    # Audit trail
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='marks_recorded')
    recorded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Corrections
    correction_requested = models.BooleanField(default=False)
    correction_reason = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['exam', 'student']
        ordering = ['exam__exam_date', 'student__user__first_name']
    
    def save(self, *args, **kwargs):
        """Auto-calculate percentage, grade, and pass status"""
        if self.is_absent:
            self.grade = 'AB'
            self.is_pass = False
            self.percentage = None
        elif self.is_unfair_means:
            self.grade = 'UF'
            self.is_pass = False
            self.percentage = None
        elif self.marks_obtained is not None:
            # Calculate percentage
            self.percentage = (self.marks_obtained / self.exam.total_marks) * 100
            
            # Assign grade
            if self.percentage >= 90:
                self.grade = 'A+'
            elif self.percentage >= 80:
                self.grade = 'A'
            elif self.percentage >= 70:
                self.grade = 'B'
            elif self.percentage >= 60:
                self.grade = 'C'
            elif self.percentage >= 50:
                self.grade = 'D'
            elif self.percentage >= 40:
                self.grade = 'E'
            else:
                self.grade = 'F'
            
            # Determine pass/fail
            self.is_pass = self.marks_obtained >= self.exam.passing_marks
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.exam.subject.name} - {self.marks_obtained}/{self.exam.total_marks}"


class TermResult(models.Model):
    """
    Consolidated result for a student for an entire term.
    Aggregates all subject marks and determines overall pass/fail.
    """
    RESULT_STATUS = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('COMPARTMENT', 'Compartment (Pass with grace)'),
        ('ATKT', 'ATKT (Allowed To Keep Term)'),
        ('WITHHELD', 'Withheld'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='term_results')
    
    term = models.ForeignKey(ExamTerm, on_delete=models.CASCADE, related_name='student_results')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='term_results')
    
    # Aggregate data
    total_marks_obtained = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_marks_maximum = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Subject-wise pass/fail
    subjects_passed = models.PositiveIntegerField(default=0)
    subjects_failed = models.PositiveIntegerField(default=0)
    subjects_absent = models.PositiveIntegerField(default=0)
    
    # Overall result
    result_status = models.CharField(max_length=20, choices=RESULT_STATUS)
    
    # Failed subjects (for compartment/re-exam)
    failed_subjects = models.JSONField(
        default=list,
        help_text="List of subject IDs where student failed"
    )
    
    # Rank
    class_rank = models.PositiveIntegerField(null=True, blank=True)
    grade_rank = models.PositiveIntegerField(null=True, blank=True)
    
    # Promotion eligibility
    eligible_for_promotion = models.BooleanField(
        default=False,
        help_text="Can this student be promoted based on this term?"
    )
    
    # Result declaration
    is_final = models.BooleanField(default=False)
    declared_at = models.DateTimeField(null=True, blank=True)
    declared_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='results_declared')
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['term', 'student']
        ordering = ['-term__start_date', '-percentage']
    
    def calculate_result(self):
        """
        Calculate term result from all subject marks.
        This is the CRITICAL business logic.
        """
        subject_marks = StudentMark.objects.filter(
            exam__term=self.term,
            student=self.student
        )
        
        self.total_marks_obtained = 0
        self.total_marks_maximum = 0
        self.subjects_passed = 0
        self.subjects_failed = 0
        self.subjects_absent = 0
        failed_subject_ids = []
        
        for mark in subject_marks:
            self.total_marks_maximum += mark.exam.total_marks
            
            if mark.is_absent:
                self.subjects_absent += 1
                failed_subject_ids.append(str(mark.exam.subject.id))
            elif mark.is_pass:
                self.subjects_passed += 1
                self.total_marks_obtained += mark.marks_obtained
            else:
                self.subjects_failed += 1
                self.total_marks_obtained += mark.marks_obtained
                failed_subject_ids.append(str(mark.exam.subject.id))
        
        # Calculate percentage
        if self.total_marks_maximum > 0:
            self.percentage = (self.total_marks_obtained / self.total_marks_maximum) * 100
        
        self.failed_subjects = failed_subject_ids
        
        # Determine result status (BUSINESS LOGIC)
        if self.subjects_failed == 0 and self.subjects_absent == 0:
            self.result_status = 'PASS'
            self.eligible_for_promotion = True
        elif self.subjects_failed == 1 and self.percentage >= 40:
            # Compartment: Failed 1 subject but overall percentage is 40%+
            self.result_status = 'COMPARTMENT'
            self.eligible_for_promotion = True  # With grace
        elif self.subjects_failed <= 2:
            # ATKT: Failed 2 subjects, needs re-exam
            self.result_status = 'ATKT'
            self.eligible_for_promotion = False
        else:
            self.result_status = 'FAIL'
            self.eligible_for_promotion = False
        
        self.save()
        return self.result_status
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.term.term_name} - {self.result_status}"


class ReExamRequest(models.Model):
    """
    Tracks re-examination requests for failed students.
    Reality: "Student failed Math, needs re-exam"
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SCHEDULED', 'Scheduled'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='reexam_requests')
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='reexam_requests')
    original_exam = models.ForeignKey(SubjectExam, on_delete=models.CASCADE, related_name='reexam_requests')
    
    # Re-exam details
    reexam_date = models.DateField(null=True, blank=True)
    reexam_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    is_pass = models.BooleanField(default=False)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Approval
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reexams_requested')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reexams_approved')
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.original_exam.subject.name} Re-exam"


class AnnualResult(models.Model):
    """
    Final annual result aggregating all terms.
    This determines promotion eligibility.
    """
    RESULT_STATUS = [
        ('PASS', 'Pass'),
        ('FAIL', 'Fail'),
        ('COMPARTMENT', 'Compartment'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='annual_results')
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='annual_results')
    academic_year = models.CharField(max_length=9)
    grade = models.ForeignKey('schools.GradeConfiguration', on_delete=models.CASCADE, related_name='annual_results', null=True, blank=True)
    
    # Aggregate from all terms
    final_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    result_status = models.CharField(max_length=20, choices=RESULT_STATUS)
    
    # Critical for promotion
    eligible_for_promotion = models.BooleanField(default=False)
    
    # Rank
    class_rank = models.PositiveIntegerField(null=True, blank=True)
    grade_rank = models.PositiveIntegerField(null=True, blank=True)
    school_rank = models.PositiveIntegerField(null=True, blank=True)
    
    # Result declaration
    declared_at = models.DateTimeField(null=True, blank=True)
    declared_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['student', 'academic_year']
        ordering = ['-academic_year', '-final_percentage']
    
    def __str__(self):
        return f"{self.student.user.full_name} - {self.academic_year} - {self.result_status}"
