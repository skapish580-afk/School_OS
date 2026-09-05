from django.db import models
from django.conf import settings
import uuid
from datetime import datetime
from apps.schools.models import School # Add this import
from apps.accounts.uid_validation import UIDGenerator, is_valid_tuid


class Teacher(models.Model):
    """
    Global Teacher Identity (TUID).
    Platform-owned, survives school transfers.
    """
    VERIFICATION_STATUS = [
        ('UNVERIFIED', 'Unverified'),
        ('VERIFIED', 'Verified'),
    ]
    
    TEACHER_TYPE_CHOICES = [
        ('TEACHING', 'Teaching'),
        ('NON_TEACHING', 'Non-Teaching'),
    ]
    
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='teacher_profile')
    
    # Global Identity
    tuid = models.CharField(max_length=50, unique=True, editable=False, help_text="T-YYYY-XXXXXX format")
    
    # Personal Info
    photo = models.ImageField(upload_to='teacher_photos/', null=True, blank=True)
    title = models.CharField(max_length=10, choices=[('Mr', 'Mr'), ('Mr.', 'Mr.'), ('Miss', 'Miss'), ('Mrs', 'Mrs'), ('Mrs.', 'Mrs.'), ('Dr', 'Dr'), ('Dr.', 'Dr.')], null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='O')
    marital_status = models.CharField(max_length=20, null=True, blank=True)
    place_of_birth = models.CharField(max_length=100, null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    
    # Contact Info
    emergency_contact_phone = models.CharField(max_length=20, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    
    # Government Identifiers
    aadhaar_last_4_digits = models.CharField(max_length=4, null=True, blank=True)
    pan_number = models.CharField(max_length=10, null=True, blank=True)
    
    # Professional Info
    qualifications = models.TextField(help_text="e.g. MSc Math, B.Ed", default="")
    certified_subjects = models.TextField(help_text="Comma-separated subjects", default="")
    experience_years = models.PositiveIntegerField(default=0)
    awards = models.TextField(blank=True, default="", help_text="Professional awards & recognitions")
    
    # Dietary
    dietary_preference = models.CharField(max_length=100, null=True, blank=True)
    
    # Dynamic Attributes
    custom_attributes = models.JSONField(default=dict, blank=True)
    
    # Employment Info
    salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date_of_joining = models.DateField(null=True, blank=True)
    
    # Verification
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS, default='UNVERIFIED')
    
    teacher_type = models.CharField(
        max_length=20, 
        choices=TEACHER_TYPE_CHOICES, 
        default='TEACHING'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def full_name(self):
        if self.user:
            return self.user.full_name
        return f"Teacher #{self.tuid}"

    @property
    def full_name_display(self):
        return self.full_name

    def save(self, *args, **kwargs):
        if not self.tuid:
            # Generate TUID with Luhn checksum
            self.tuid = UIDGenerator.generate_tuid()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.tuid})"
    
class TeacherSchoolAssociation(models.Model):
    """
    Teacher-School Association (Employment History).
    Tracks joining, relieving, employment type.
    """
    EMPLOYMENT_TYPE = [
        ('FULL_TIME', 'Full-time'),
        ('PART_TIME', 'Part-time'),
        ('CONTRACT', 'Contract'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    ]
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='school_associations')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teacher_associations')
    
    joining_date = models.DateField()
    relieving_date = models.DateField(null=True, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE, default='FULL_TIME')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-joining_date']
    
    def __str__(self):
        return f"{self.teacher.tuid} @ {self.school.name} ({self.status})"


class TeacherAssignment(models.Model):
    """
    Derived Roles: Subject Teacher, Class Teacher, etc.
    Multiple assignments per teacher possible.
    """
    ROLE_CHOICES = [
        ('SUBJECT_TEACHER', 'Subject Teacher'),
        ('CLASS_TEACHER', 'Class Teacher'),
        ('SUBSTITUTE', 'Substitute / Proxy'),
        ('EXAM_INVIGILATOR', 'Exam Invigilator'),
        ('SPORTS_TEACHER', 'Sports / Activity Teacher'),
        ('NON_TEACHING_STAFF', 'Non-Teaching Staff'),
        ('ACCOUNTANT', 'Accountant'),
        ('LIBRARIAN', 'Librarian'),
        ('LAB_ASSISTANT', 'Lab Assistant'),
        ('TRANSPORT_MANAGER', 'Transport Manager'),
        ('NURSE', 'Nurse / Medical Officer'),
        ('SECURITY_SUPERVISOR', 'Security Supervisor'),
        ('IT_SUPPORT', 'IT Support Specialist'),
        ('FACILITIES_MANAGER', 'Facilities Manager'),
        ('OFFICE_STAFF', 'Office Staff'),
        ('COUNSELOR', 'Counselor'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='assignments')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teacher_assignments')
    
    role = models.CharField(max_length=100, choices=ROLE_CHOICES)
    grade = models.CharField(max_length=10, help_text="Target Grade", blank=True)
    section = models.CharField(max_length=5, help_text="Target Section", blank=True)
    subject = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Mathematics")
    department = models.CharField(max_length=100, blank=True, null=True, help_text="Department name for non-teaching staff")
    
    academic_year = models.CharField(max_length=9, help_text="2025-2026")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['school', 'academic_year', 'grade']
        verbose_name = "Teacher Assignment"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.role == 'CLASS_TEACHER' and self.is_active:
            if hasattr(self, 'school') and self.school:
                # 1. Check for another class teacher assigned to this grade and section
                queryset = TeacherAssignment.objects.filter(
                    school=self.school,
                    academic_year=self.academic_year,
                    grade__iexact=self.grade,
                    section__iexact=self.section,
                    role='CLASS_TEACHER',
                    is_active=True
                )
                if self.pk:
                    queryset = queryset.exclude(pk=self.pk)
                if queryset.exists():
                    teacher_names = ", ".join([f"{ta.teacher.user.full_name}" for ta in queryset])
                    raise ValidationError(
                        f"A Class Teacher is already assigned to Grade {self.grade} Section {self.section} for academic year {self.academic_year} (Assigned to: {teacher_names}). Only one class teacher is allowed."
                    )

                # 2. Check if this teacher is already assigned as Class Teacher for another grade/section
                teacher_qs = TeacherAssignment.objects.filter(
                    school=self.school,
                    teacher=self.teacher,
                    role='CLASS_TEACHER',
                    is_active=True
                )
                if self.pk:
                    teacher_qs = teacher_qs.exclude(pk=self.pk)
                if teacher_qs.exists():
                    existing_ta = teacher_qs.first()
                    teacher_name = self.teacher.user.full_name if (hasattr(self.teacher, 'user') and self.teacher.user) else f"Teacher {self.teacher.tuid}"
                    raise ValidationError(
                        f"{teacher_name} is already assigned as Class Teacher for Grade {existing_ta.grade} Section {existing_ta.section}. A teaching staff member can only be the Class Teacher of one grade/section."
                    )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.teacher.tuid} - {self.role} ({self.grade}-{self.section})"


class Remark(models.Model):
    """
    Teacher remarks about students - quick incident tagging
    """
    CATEGORY_CHOICES = [
        ('ACADEMIC', 'Academic'),
        ('BEHAVIORAL', 'Behavioral'),
        ('IMPROVEMENT', 'Improvement'),
        ('APPRECIATION', 'Appreciation'),
    ]
    
    SEVERITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE, related_name='remarks')
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='remarks_made')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    context = models.CharField(max_length=200)
    details = models.TextField(blank=True)
    visible_to_parent = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.category} - {self.student.suid} by {self.teacher.tuid}"


class TeacherEfficiency(models.Model):
    """
    Teacher Efficiency Scorecard Metrics
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.OneToOneField(Teacher, on_delete=models.CASCADE, related_name='efficiency_metrics')
    
    punctuality_index = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    appraisal_rating = models.PositiveSmallIntegerField(default=3)
    observation_notes = models.JSONField(default=list, blank=True)
    
    curriculum_completion = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    student_performance_impact = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    last_appraisal_date = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Efficiency: {self.teacher.tuid}"

    class Meta:
        verbose_name_plural = "Teacher Efficiency Metrics"


class TeacherDocument(models.Model):
    """Documents uploaded for a teacher (qualification certificate, ID proof, contract, etc.)"""
    DOCUMENT_TYPES = [
        ('RESUME', 'Resume/CV'),
        ('ID_PROOF', 'ID Proof'),
        ('QUALIFICATION_CERTIFICATE', 'Qualification Certificate'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='teacher_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.title} - {self.teacher.user.full_name if (self.teacher.user and self.teacher.user.full_name) else self.teacher.tuid}"