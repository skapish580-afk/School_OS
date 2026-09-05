from django.db import models
from django.conf import settings
import uuid
from datetime import datetime
from apps.accounts.uid_validation import UIDGenerator, is_valid_suid

class Student(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('GRADUATED', 'Graduated'),
        ('ALUMNI', 'Alumni'),
        ('PENDING_ALUMNI', 'Pending Alumni'),
        ('TRANSFERRED', 'Transferred'),
        ('SUSPENDED', 'Suspended'),
        ('WITHDRAWN', 'Withdrawn'),
        ('TEMPORARY', 'Temporary'),
    ]
    
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]
    
    # Link to the main User Login
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='students', null=True)
    
    # --- IDENTITY ---
    suid = models.CharField(max_length=50, unique=True, editable=False)
    admission_number = models.CharField(max_length=50, blank=True, null=True)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    
    # --- PERSONAL ---
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='M')
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    profile_photo = models.ImageField(upload_to='student_photos/', null=True, blank=True)
    
    # --- MEDICAL ---
    medical_conditions = models.TextField(null=True, blank=True, help_text='Known medical conditions or allergies')
    emergency_contact_name = models.CharField(max_length=100, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, null=True, blank=True)
    
    # --- ADDRESS ---
    address_line1 = models.CharField(max_length=255, null=True, blank=True)
    address_line2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=10, null=True, blank=True)
    latitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    longitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    address = models.TextField(null=True, blank=True)  # Legacy field
    
    # --- DEMOGRAPHIC & SOCIAL ---
    category = models.CharField(max_length=20, null=True, blank=True, help_text="GEN/OBC/SC/ST")
    religion = models.CharField(max_length=50, null=True, blank=True)
    mother_tongue = models.CharField(max_length=50, null=True, blank=True)
    languages_known = models.TextField(null=True, blank=True, help_text="Comma-separated languages")
    nationality = models.CharField(max_length=50, default='Indian')
    birth_place = models.CharField(max_length=100, null=True, blank=True)
    is_rte_student = models.BooleanField(default=False)
    fee_concession_applicable = models.BooleanField(default=False)
    fee_concession_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, null=True, blank=True)
    house_color = models.CharField(max_length=50, null=True, blank=True)
    alumni_directory_consent = models.BooleanField(default=False)
    
    # --- GOVERNMENT IDENTIFIERS ---
    aadhaar_number = models.CharField(max_length=12, null=True, blank=True)
    aadhaar_last_4_digits = models.CharField(max_length=4, null=True, blank=True)
    apaar_id = models.CharField(max_length=50, null=True, blank=True, help_text="National Level ID")
    pen_id = models.CharField(max_length=50, null=True, blank=True, help_text="State Level ID")
    
    # --- DIETARY ---
    dietary_preference = models.CharField(max_length=100, null=True, blank=True, help_text="Veg/Non-Veg/Jain/Halal/Allergy-specific")

    # --- DYNAMIC ATTRIBUTES ---
    custom_attributes = models.JSONField(default=dict, blank=True)

    # --- CONTACT ---
    phone = models.CharField(max_length=20, null=True, blank=True, help_text="Student's personal phone if any")
    
    # --- ACADEMIC ---
    # Grade is now derived from Section -> GradeConfiguration
    # For students without section, we can optionally link to GradeConfiguration directly
    grade_config = models.ForeignKey(
        'schools.GradeConfiguration', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='students',
        help_text="Current grade level"
    )
    current_section = models.ForeignKey('academics.Section', on_delete=models.SET_NULL, null=True, blank=True, related_name='current_students')
    
    @property
    def current_grade(self):
        """Backward compatibility"""
        if self.current_section:
            return self.current_section.grade_config
        return self.grade_config

    @property
    def roll_number(self):
        """Helper to get student's active enrollment roll number"""
        enrollment = self.enrollments.filter(status='ACTIVE').first()
        return enrollment.roll_number if enrollment else None

    admission_date = models.DateField(null=True, blank=True)
    graduation_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # --- TIMESTAMPS ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user__first_name', 'user__last_name']

    def save(self, *args, **kwargs):
        if self.aadhaar_number and len(self.aadhaar_number) >= 4:
            self.aadhaar_last_4_digits = self.aadhaar_number[-4:]
        if not self.suid:
            # Get school code if available
            school_code = None
            if self.school:
                # Use first 4 chars of school name or code
                school_code = getattr(self.school, 'code', None) or self.school.name[:4]
            
            # Generate SUID with Luhn checksum
            self.suid = UIDGenerator.generate_suid(school_code)
        super().save(*args, **kwargs)

    @property
    def full_name_display(self):
        parts = [self.user.first_name, self.middle_name, self.user.last_name]
        return " ".join(filter(None, parts))
    
    @property
    def full_address(self):
        parts = [self.address_line1, self.address_line2, self.city, self.state, self.pincode]
        return ", ".join(filter(None, parts))

    def __str__(self):
        return f"{self.full_name_display} ({self.suid})"


class Guardian(models.Model):
    """Parent/Guardian information for a student"""
    RELATIONSHIP_CHOICES = [
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('GUARDIAN', 'Guardian'),
        ('GRANDFATHER', 'Grandfather'),
        ('GRANDMOTHER', 'Grandmother'),
        ('UNCLE', 'Uncle'),
        ('AUNT', 'Aunt'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='guardians')
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES)
    phone = models.CharField(max_length=20)
    email = models.EmailField(null=True, blank=True)
    occupation = models.CharField(max_length=100, null=True, blank=True)
    workplace = models.CharField(max_length=200, null=True, blank=True)
    annual_income = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True, help_text='Allowed to pick up student')
    
    class Meta:
        ordering = ['-is_primary', 'relationship']
    
    def __str__(self):
        return f"{self.name} ({self.relationship}) - {self.student.full_name_display}"


class StudentDocument(models.Model):
    """Documents uploaded for a student (birth certificate, transfer certificate, etc.)"""
    DOCUMENT_TYPES = [
        ('BIRTH_CERTIFICATE', 'Birth Certificate'),
        ('TRANSFER_CERTIFICATE', 'Transfer Certificate'),
        ('MARK_SHEET', 'Mark Sheet'),
        ('CHARACTER_CERTIFICATE', 'Character Certificate'),
        ('MEDICAL_CERTIFICATE', 'Medical Certificate'),
        ('ID_PROOF', 'ID Proof'),
        ('ADDRESS_PROOF', 'Address Proof'),
        ('PHOTO', 'Photograph'),
        ('OTHER', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='student_documents/')
    academic_year = models.CharField(max_length=20, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(null=True, blank=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.title} - {self.student.full_name_display}"


class StudentHistory(models.Model):
    """Track student's progression through grades over the years - COMPLETE JOURNEY DATA"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='history')
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, null=True, blank=True)
    school_name = models.CharField(max_length=200, blank=True, null=True, help_text="Snapshot of school name at time of recording")
    academic_year = models.ForeignKey('enrollments.AcademicYear', on_delete=models.CASCADE, null=True, blank=True)
    academic_year_name = models.CharField(max_length=20, null=True, blank=True, help_text="e.g. 2024-2025")
    grade_config = models.ForeignKey('schools.GradeConfiguration', on_delete=models.CASCADE, null=True, blank=True, related_name='student_history')
    grade_name = models.CharField(max_length=20, null=True, blank=True, help_text="e.g. 10, LKG")
    section = models.ForeignKey('academics.Section', on_delete=models.CASCADE, null=True, blank=True)
    section_name = models.CharField(max_length=5, null=True, blank=True, help_text="e.g. A, B")
    roll_number = models.CharField(max_length=20, null=True, blank=True)
    
    # Class Teacher who gave remarks - LINKED to teacher profile
    class_teacher = models.ForeignKey('teachers.Teacher', on_delete=models.SET_NULL, null=True, blank=True, related_name='history_remarks_made')
    class_teacher_name = models.CharField(max_length=200, null=True, blank=True)
    teacher_remarks = models.TextField(null=True, blank=True)
    remarks_date = models.DateField(null=True, blank=True, help_text="When teacher wrote this remark")
    
    # Academic Performance
    overall_grade = models.CharField(max_length=5, null=True, blank=True)  # A+, A, B+, etc.
    total_marks = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # 95.50%
    class_rank = models.PositiveIntegerField(null=True, blank=True)  # Rank in class (section)
    grade_rank = models.PositiveIntegerField(null=True, blank=True)  # Rank in entire grade
    total_students_in_class = models.PositiveIntegerField(null=True, blank=True)
    total_students_in_grade = models.PositiveIntegerField(null=True, blank=True)
    
    # Attendance Summary for the year
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    total_working_days = models.PositiveIntegerField(null=True, blank=True)
    days_present = models.PositiveIntegerField(null=True, blank=True)
    days_absent = models.PositiveIntegerField(null=True, blank=True)
    days_late = models.PositiveIntegerField(null=True, blank=True)
    
    # Karma/Discipline Points for the year
    karma_points_earned = models.IntegerField(default=0)
    karma_points_deducted = models.IntegerField(default=0)
    net_karma = models.IntegerField(default=0)
    
    # Achievements count (actual achievements linked separately)
    achievements_count = models.PositiveIntegerField(default=0)
    certificates_count = models.PositiveIntegerField(default=0)
    awards_count = models.PositiveIntegerField(default=0)
    
    # Status
    promoted = models.BooleanField(default=True)
    promotion_remarks = models.CharField(max_length=200, null=True, blank=True)  # "Promoted with distinction"
    
    # Photo for that year
    profile_photo_at_time = models.ImageField(upload_to='student_history_photos/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-academic_year_name']
        unique_together = ['student', 'academic_year_name']
    
    def __str__(self):
        return f"{self.student.full_name_display} - {self.academic_year_name} - {self.grade_name}"


# Re-export SchoolTenure for convenience
from apps.students.models_tenure import SchoolTenure  # noqa: E402, F401