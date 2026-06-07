"""
CRITICAL MODULE: School Certificates Generation System
======================================================
Indian schools live and die on certificates.

This module handles:
- Transfer Certificate (TC)
- Bonafide Certificate  
- Character Certificate
- Leaving Certificate
- Study Certificate

With:
- Serial numbers
- Principal signature tracking
- School seal metadata
- Audit trail
- PDF generation support
"""

from django.db import models
from apps.schools.models import School
from apps.students.models import Student
from django.contrib.auth import get_user_model
import uuid
from datetime import date

User = get_user_model()


class CertificateSerialCounter(models.Model):
    """
    Maintains serial number counters for each certificate type.
    Ensures unique, sequential serial numbers.
    """
    CERTIFICATE_TYPES = [
        ('TC', 'Transfer Certificate'),
        ('BONAFIDE', 'Bonafide Certificate'),
        ('CHARACTER', 'Character Certificate'),
        ('LEAVING', 'Leaving Certificate'),
        ('STUDY', 'Study Certificate'),
        ('CONDUCT', 'Conduct Certificate'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='certificate_counters')
    
    certificate_type = models.CharField(max_length=20, choices=CERTIFICATE_TYPES)
    
    # Serial format: TC/2026/001, BONAFIDE/2026/123
    current_year = models.PositiveIntegerField()
    last_serial_number = models.PositiveIntegerField(default=0)
    
    # Prefix customization
    prefix = models.CharField(
        max_length=20, 
        blank=True,
        help_text="e.g., 'TC', 'SCH001-TC'"
    )
    
    class Meta:
        unique_together = ['school', 'certificate_type', 'current_year']
    
    def get_next_serial(self):
        """Generate next serial number"""
        self.last_serial_number += 1
        self.save()
        
        prefix = self.prefix or self.certificate_type
        serial = f"{prefix}/{self.current_year}/{self.last_serial_number:04d}"
        return serial
    
    def __str__(self):
        return f"{self.school.name} - {self.certificate_type} - {self.current_year}"


class TransferCertificate(models.Model):
    """
    Transfer Certificate (TC) - Most critical document.
    Required when student leaves school.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    REASON_CHOICES = [
        ('TRANSFER', 'Transfer to Another School'),
        ('PARENT_TRANSFER', 'Parent Job Transfer'),
        ('RELOCATION', 'Family Relocation'),
        ('PERSONAL', 'Personal Reasons'),
        ('COMPLETION', 'Course Completion'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='transfer_certificates')
    
    # Serial number
    serial_number = models.CharField(max_length=50, unique=True, editable=False)
    
    # Student details
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transfer_certificates')
    
    # Academic details at time of leaving
    class_studying = models.CharField(max_length=50, help_text="e.g., 'Class 10-A'")
    admission_date = models.DateField()
    leaving_date = models.DateField(default=date.today)
    
    # Reason for leaving
    reason = models.CharField(max_length=50, choices=REASON_CHOICES)
    reason_details = models.TextField(blank=True)
    
    # Transfer destination
    transferring_to_school = models.CharField(max_length=200, blank=True)
    
    # Academic performance
    conduct = models.CharField(
        max_length=20,
        choices=[
            ('EXCELLENT', 'Excellent'),
            ('GOOD', 'Good'),
            ('SATISFACTORY', 'Satisfactory'),
        ],
        default='GOOD'
    )
    
    last_exam_appeared = models.CharField(max_length=100, blank=True)
    last_exam_result = models.CharField(max_length=50, blank=True)
    
    # Dues clearance
    fee_dues_cleared = models.BooleanField(default=False)
    library_clearance = models.BooleanField(default=False)
    lab_clearance = models.BooleanField(default=False)
    
    # Issuance details
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    
    issued_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='tcs_issued',
        help_text="Usually Principal or Authorized Officer"
    )
    issued_date = models.DateField(null=True, blank=True)
    
    # Digital signature/seal metadata
    principal_signature_file = models.FileField(
        upload_to='certificates/signatures/',
        null=True,
        blank=True
    )
    school_seal_applied = models.BooleanField(default=False)
    
    # PDF generation
    pdf_file = models.FileField(
        upload_to='certificates/tc/',
        null=True,
        blank=True
    )
    
    # Parent collection
    collected_by = models.CharField(max_length=200, blank=True, help_text="Parent/Guardian name")
    collected_on = models.DateField(null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_date', '-created_at']
    
    def save(self, *args, **kwargs):
        # Auto-generate serial number on first save
        if not self.serial_number:
            counter, _ = CertificateSerialCounter.objects.get_or_create(
                school=self.school,
                certificate_type='TC',
                current_year=date.today().year,
                defaults={'last_serial_number': 0}
            )
            self.serial_number = counter.get_next_serial()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"TC - {self.serial_number} - {self.student.user.full_name}"


class BonafideCertificate(models.Model):
    """
    Bonafide Certificate - Proof of student enrollment.
    Used for: Bank accounts, passport, scholarships, etc.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    PURPOSE_CHOICES = [
        ('BANK', 'Bank Account Opening'),
        ('PASSPORT', 'Passport Application'),
        ('SCHOLARSHIP', 'Scholarship Application'),
        ('COMPETITION', 'Competition/Exam'),
        ('TRAVEL', 'Travel/Visa'),
        ('OTHER', 'Other Purpose'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='bonafide_certificates')
    
    serial_number = models.CharField(max_length=50, unique=True, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='bonafide_certificates')
    
    # Academic details
    current_class = models.CharField(max_length=50)
    academic_year = models.CharField(max_length=9)
    roll_number = models.CharField(max_length=20)
    
    # Purpose
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES)
    purpose_details = models.TextField(blank=True)
    
    # Validity
    valid_from = models.DateField(default=date.today)
    valid_until = models.DateField(null=True, blank=True, help_text="Optional expiry date")
    
    # Issuance
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='bonafides_issued')
    issued_date = models.DateField(null=True, blank=True)
    
    pdf_file = models.FileField(upload_to='certificates/bonafide/', null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_date', '-created_at']
    
    def save(self, *args, **kwargs):
        if not self.serial_number:
            counter, _ = CertificateSerialCounter.objects.get_or_create(
                school=self.school,
                certificate_type='BONAFIDE',
                current_year=date.today().year,
                defaults={'last_serial_number': 0}
            )
            self.serial_number = counter.get_next_serial()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Bonafide - {self.serial_number} - {self.student.user.full_name}"


class CharacterCertificate(models.Model):
    """
    Character Certificate - Attests to student's moral character.
    Required for: College admissions, job applications
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='character_certificates')
    
    serial_number = models.CharField(max_length=50, unique=True, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='character_certificates')
    
    # Academic tenure
    studied_from = models.DateField()
    studied_to = models.DateField()
    final_class = models.CharField(max_length=50)
    
    # Character assessment
    conduct = models.CharField(
        max_length=20,
        choices=[
            ('EXCELLENT', 'Excellent'),
            ('VERY_GOOD', 'Very Good'),
            ('GOOD', 'Good'),
            ('SATISFACTORY', 'Satisfactory'),
        ],
        default='GOOD'
    )
    
    character_remarks = models.TextField(
        default="The student has been of good moral character during the tenure.",
        help_text="Standard character statement"
    )
    
    # Disciplinary check
    has_disciplinary_issues = models.BooleanField(default=False)
    disciplinary_remarks = models.TextField(blank=True)
    
    # Issuance
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='character_certs_issued')
    issued_date = models.DateField(null=True, blank=True)
    
    pdf_file = models.FileField(upload_to='certificates/character/', null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_date', '-created_at']
    
    def save(self, *args, **kwargs):
        if not self.serial_number:
            counter, _ = CertificateSerialCounter.objects.get_or_create(
                school=self.school,
                certificate_type='CHARACTER',
                current_year=date.today().year,
                defaults={'last_serial_number': 0}
            )
            self.serial_number = counter.get_next_serial()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Character Cert - {self.serial_number} - {self.student.user.full_name}"


class LeavingCertificate(models.Model):
    """
    Leaving Certificate (LC) - Similar to TC but used in some states.
    Certifies student has left the institution.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='leaving_certificates')
    
    serial_number = models.CharField(max_length=50, unique=True, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='leaving_certificates')
    
    # Academic details
    admission_date = models.DateField()
    leaving_date = models.DateField(default=date.today)
    last_class_attended = models.CharField(max_length=50)
    
    # Progress
    progress = models.CharField(
        max_length=20,
        choices=[
            ('PROMOTED', 'Promoted'),
            ('PASSED', 'Passed'),
            ('FAIL', 'Fail'),
            ('DETAINED', 'Detained'),
        ],
        default='PROMOTED'
    )
    
    # Attendance
    total_working_days = models.PositiveIntegerField(default=0)
    days_present = models.PositiveIntegerField(default=0)
    
    # Dues
    all_dues_cleared = models.BooleanField(default=False)
    
    # Issuance
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lcs_issued')
    issued_date = models.DateField(null=True, blank=True)
    
    pdf_file = models.FileField(upload_to='certificates/leaving/', null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_date', '-created_at']
    
    def save(self, *args, **kwargs):
        if not self.serial_number:
            counter, _ = CertificateSerialCounter.objects.get_or_create(
                school=self.school,
                certificate_type='LEAVING',
                current_year=date.today().year,
                defaults={'last_serial_number': 0}
            )
            self.serial_number = counter.get_next_serial()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"LC - {self.serial_number} - {self.student.user.full_name}"


class StudyCertificate(models.Model):
    """
    Study Certificate - Certifies period of study.
    General purpose certificate for various applications.
    """
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='study_certificates')
    
    serial_number = models.CharField(max_length=50, unique=True, editable=False)
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='study_certificates')
    
    # Study period
    studied_from = models.DateField()
    studied_to = models.DateField()
    classes_studied = models.CharField(max_length=200, help_text="e.g., 'Class 9 to Class 12'")
    
    # Purpose (optional)
    purpose = models.TextField(blank=True)
    
    # Issuance
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    issued_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='study_certs_issued')
    issued_date = models.DateField(null=True, blank=True)
    
    pdf_file = models.FileField(upload_to='certificates/study/', null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_date', '-created_at']
    
    def save(self, *args, **kwargs):
        if not self.serial_number:
            counter, _ = CertificateSerialCounter.objects.get_or_create(
                school=self.school,
                certificate_type='STUDY',
                current_year=date.today().year,
                defaults={'last_serial_number': 0}
            )
            self.serial_number = counter.get_next_serial()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Study Cert - {self.serial_number} - {self.student.user.full_name}"


class CertificateRequest(models.Model):
    """
    Tracks certificate requests from parents/students.
    Workflow: Request → Approval → Generation → Issuance
    """
    CERTIFICATE_TYPES = [
        ('TC', 'Transfer Certificate'),
        ('BONAFIDE', 'Bonafide Certificate'),
        ('CHARACTER', 'Character Certificate'),
        ('LEAVING', 'Leaving Certificate'),
        ('STUDY', 'Study Certificate'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('ISSUED', 'Issued'),
        ('COLLECTED', 'Collected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='certificate_requests')
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='certificate_requests')
    certificate_type = models.CharField(max_length=20, choices=CERTIFICATE_TYPES)
    
    # Request details
    purpose = models.TextField()
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cert_requests_made')
    requested_at = models.DateTimeField(auto_now_add=True)
    
    # Approval workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cert_requests_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Link to generated certificate
    tc_issued = models.ForeignKey(TransferCertificate, on_delete=models.SET_NULL, null=True, blank=True)
    bonafide_issued = models.ForeignKey(BonafideCertificate, on_delete=models.SET_NULL, null=True, blank=True)
    character_issued = models.ForeignKey(CharacterCertificate, on_delete=models.SET_NULL, null=True, blank=True)
    leaving_issued = models.ForeignKey(LeavingCertificate, on_delete=models.SET_NULL, null=True, blank=True)
    study_issued = models.ForeignKey(StudyCertificate, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Collection
    collected_by = models.CharField(max_length=200, blank=True)
    collected_at = models.DateTimeField(null=True, blank=True)
    
    remarks = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"{self.certificate_type} Request - {self.student.user.full_name} - {self.status}"
