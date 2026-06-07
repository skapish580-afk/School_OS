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
    title = models.CharField(max_length=10, choices=[('Mr', 'Mr'), ('Miss', 'Miss'), ('Mrs', 'Mrs'), ('Dr', 'Dr')], null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='O')
    marital_status = models.CharField(max_length=20, null=True, blank=True)
    place_of_birth = models.CharField(max_length=100, null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    
    # Contact Info
    emergency_contact_phone = models.CharField(max_length=20, null=True, blank=True)
    
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
    
    # Verification
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS, default='UNVERIFIED')
    
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.tuid:
            # Generate TUID with Luhn checksum
            self.tuid = UIDGenerator.generate_tuid()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.full_name} ({self.tuid})"
    
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
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='assignments')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='teacher_assignments')
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    grade = models.CharField(max_length=10, help_text="Target Grade", blank=True)
    section = models.CharField(max_length=5, help_text="Target Section", blank=True)
    subject = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. Mathematics")
    
    academic_year = models.CharField(max_length=9, help_text="2025-2026")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['school', 'academic_year', 'grade']
        verbose_name = "Teacher Assignment"

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