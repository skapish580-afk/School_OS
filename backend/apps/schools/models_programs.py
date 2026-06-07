from django.db import models
import uuid


class Campus(models.Model):
    """
    Campus Model - STEP 3 of Onboarding
    
    A school can have multiple campuses (branches).
    Even single-campus schools should have a default "Main Campus".
    This enables future expansion without database migration.
    
    Entity: School → Campus → Programs
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='campuses')
    
    # Core Fields
    name = models.CharField(max_length=255, help_text="Campus name (e.g., Main Campus, North Branch)")
    code = models.CharField(max_length=50, help_text="Campus code (e.g., MAIN, NORTH)")
    address = models.TextField()
    
    # Flags
    is_primary = models.BooleanField(default=False, help_text="Is this the primary/main campus?")
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Campuses"
        unique_together = ['school', 'code']
        ordering = ['-is_primary', 'name']
    
    def __str__(self):
        return f"{self.school.display_name} - {self.name}"
    
    def save(self, *args, **kwargs):
        # Ensure only one primary campus per school
        if self.is_primary:
            Campus.objects.filter(school=self.school, is_primary=True).exclude(id=self.id).update(is_primary=False)
        super().save(*args, **kwargs)


class AcademicProgram(models.Model):
    """
    Academic Program Model - STEP 4A of Onboarding
    
    CORE PHILOSOPHY: Schools are NOT single structures.
    A school = multiple academic programs.
    Programs own boards, grades, and rules.
    
    Examples:
    - Primary Wing (CBSE, Grades LKG-5)
    - Secondary Wing (ICSE, Grades 6-10)
    - IB Diploma Program (IB, Grades 11-12)
    
    Entity: School → Campus → Programs → Grades
    """
    BOARD_CHOICES = [
        ('CBSE', 'CBSE'),
        ('ICSE', 'ICSE'),
        ('SSC', 'State Board (SSC)'),
        ('IB', 'International Baccalaureate'),
        ('IGCSE', 'IGCSE'),
        ('CUSTOM', 'Custom'),
    ]
    
    EDUCATION_LEVEL_CHOICES = [
        ('PRE_PRIMARY', 'Pre-Primary'),
        ('PRIMARY', 'Primary'),
        ('MIDDLE', 'Middle School'),
        ('SECONDARY', 'Secondary'),
        ('SENIOR_SECONDARY', 'Senior Secondary'),
    ]
    
    EVALUATION_SYSTEM_CHOICES = [
        ('MARKS', 'Marks Based'),
        ('GRADES', 'Grade Based'),
        ('HYBRID', 'Hybrid'),
    ]
    
    ACADEMIC_PATTERN_CHOICES = [
        ('ANNUAL', 'Annual'),
        ('SEMESTER', 'Semester'),
        ('TERM', 'Term'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey('schools.School', on_delete=models.CASCADE, related_name='academic_programs')
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='programs', null=True, blank=True)
    
    # Core Fields
    name = models.CharField(max_length=255, help_text="Program name (e.g., Primary Wing, ICSE Section)")
    code = models.CharField(max_length=50, help_text="Program code (e.g., PRI, SEC)")
    board = models.CharField(max_length=20, choices=BOARD_CHOICES)
    education_level = models.CharField(max_length=20, choices=EDUCATION_LEVEL_CHOICES, null=True, blank=True,
                                      help_text="Optional - for analytics only")
    
    # Academic Configuration
    medium_of_instruction = models.CharField(max_length=100, default='English')
    evaluation_system = models.CharField(max_length=20, choices=EVALUATION_SYSTEM_CHOICES, default='MARKS')
    academic_pattern = models.CharField(max_length=20, choices=ACADEMIC_PATTERN_CHOICES, default='ANNUAL')
    
    # Flags
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['school', 'code']
        ordering = ['school', 'name']
    
    def __str__(self):
        return f"{self.school.display_name} - {self.name} ({self.board})"


class GradeConfiguration(models.Model):
    """
    Grade Configuration Model - STEP 4B of Onboarding
    
    CORE PHILOSOPHY: Grades are TEXT with NUMERIC ordering.
    
    Why?
    - Real schools use "LKG", "UKG", "Pre-K", not numbers
    - grade_name (TEXT) = What humans see ("LKG", "UKG", "1", "2")
    - grade_order (INT) = For sorting and promotion logic
    
    This supports any naming convention while maintaining logic.
    
    Entity: Programs → Grades → Sections
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(AcademicProgram, on_delete=models.CASCADE, related_name='grades')
    
    # Grade as TEXT (LKG, UKG, 1, 2, 3... 12)
    grade_name = models.CharField(max_length=50, help_text="Grade name as TEXT (LKG, UKG, 1, 2, etc.)")
    
    # Numeric ordering for sorting and promotion logic
    grade_order = models.IntegerField(help_text="Numeric order for sorting (1, 2, 3...)")
    
    # Section Configuration
    max_sections = models.IntegerField(default=1, help_text="Maximum number of sections for this grade")
    default_section_names = models.JSONField(default=list, help_text='Default section names (e.g., ["A", "B", "C"])')
    section_capacity = models.IntegerField(null=True, blank=True, help_text="Student capacity per section")
    
    # Flags
    is_active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['program', 'grade_name']
        ordering = ['program', 'grade_order']
    
    def __str__(self):
        return f"{self.program.name} - Grade {self.grade_name} (Order: {self.grade_order})"
    
    def save(self, *args, **kwargs):
        # Ensure default_section_names is a list
        if not isinstance(self.default_section_names, list):
            self.default_section_names = []
        
        # Auto-populate default section names if empty
        if not self.default_section_names and self.max_sections > 0:
            self.default_section_names = [chr(65 + i) for i in range(self.max_sections)]  # A, B, C...
        
        super().save(*args, **kwargs)
