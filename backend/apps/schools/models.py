from django.db import models
import uuid
from django.utils import timezone as django_timezone
import logging

logger = logging.getLogger(__name__)

class School(models.Model):
    """
    The TENANT model - Enhanced for Super Admin Onboarding.
    Every piece of data (StudentEnrollment, TeacherAssignment, Exam)
    must point back to a School.
    
    Entity Hierarchy: Company → School → Campus → Programs → Grades → Sections → Students
    """
    BOARD_CHOICES = [
        ('CBSE', 'CBSE'),
        ('ICSE', 'ICSE'),
        ('IGCSE', 'IGCSE'),
        ('IB', 'IB'),
        ('STATE', 'State Board'),
        ('SSC', 'SSC (State Board)'),
        ('CUSTOM', 'Custom'),
    ]
    
    ONBOARDING_STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ONBOARDING', 'Onboarding'),
        ('LIVE', 'Live'),
        ('SUSPENDED', 'Suspended'),
    ]

    # Primary Key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # STEP 1: School Identity (MANDATORY)
    legal_name = models.CharField(max_length=255, blank=True, help_text="Official legal name of the school")
    display_name = models.CharField(max_length=255, blank=True, help_text="Display name for UI")
    code = models.CharField(max_length=20, unique=True, help_text="Unique School Code (e.g., DAV-MUM-01)")
    
    # Legacy field - kept for backward compatibility, but programs now own boards
    board = models.CharField(max_length=10, choices=BOARD_CHOICES, default='CBSE', 
                            help_text="Default board (deprecated - use Academic Programs)")
    
    # Location
    country = models.CharField(max_length=100, default='India')
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # System Configuration
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    default_currency = models.CharField(max_length=10, default='INR')
    academic_year_start_month = models.IntegerField(default=4, help_text="Month when academic year starts (1-12)")
    primary_language = models.CharField(max_length=50, default='English')
    
    # Optional Fields
    logo = models.ImageField(upload_to='school_logos/', null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    
    # System Generated
    subdomain = models.CharField(max_length=100, unique=True, null=True, blank=True,
                                 help_text="schoolname.schoolos.in")
    
    # Contact (kept for backward compatibility)
    contact_email = models.EmailField(blank=True)
    
    # STEP 10: Legal & Compliance
    registration_number = models.CharField(max_length=100, null=True, blank=True,
                                          help_text="School registration number")
    gst_number = models.CharField(max_length=15, null=True, blank=True,
                                  help_text="GST number if applicable")
    agreement_accepted = models.BooleanField(default=False)
    agreement_accepted_at = models.DateTimeField(null=True, blank=True)
    
    # Onboarding Tracking
    onboarding_status = models.CharField(
        max_length=20,
        choices=ONBOARDING_STATUS_CHOICES,
        default='DRAFT'
    )
    onboarding_step = models.IntegerField(default=0, help_text="Current step in onboarding wizard (0-11)")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name or self.legal_name} ({self.code})"
    
    @property
    def name(self):
        """Backward compatibility - returns display_name"""
        return self.display_name or self.legal_name
    
    def save(self, *args, **kwargs):
        # Auto-generate subdomain from code if not set
        if not self.subdomain and self.code:
            self.subdomain = self.code.lower().replace('_', '-')
        
        # Set display_name to legal_name if not provided
        if not self.display_name and self.legal_name:
            self.display_name = self.legal_name
            
        # Timezone is fixed statically to Asia/Kolkata (Indian Standard Time)
        self.timezone = 'Asia/Kolkata'
                
        super().save(*args, **kwargs)
        
        # Sync to SchoolSettings
        if not getattr(self, '_syncing', False):
            try:
                from .models_settings import SchoolSettings
                settings, created = SchoolSettings.objects.get_or_create(school=self)
                
                def coords_equal(c1, c2):
                    if c1 is None and c2 is None:
                        return True
                    if c1 is None or c2 is None:
                        return False
                    try:
                        return round(float(c1), 6) == round(float(c2), 6)
                    except (ValueError, TypeError):
                        return False

                addr_diff = (settings.school_address or '').strip() != (self.address or '').strip()
                lat_diff = not coords_equal(settings.school_latitude, self.latitude)
                lng_diff = not coords_equal(settings.school_longitude, self.longitude)
                tz_diff = settings.timezone != self.timezone
                
                if addr_diff or lat_diff or lng_diff or tz_diff:
                    settings.school_address = self.address
                    settings.school_latitude = self.latitude
                    settings.school_longitude = self.longitude
                    settings.timezone = self.timezone
                    settings._syncing = True
                    settings.save()
            except Exception:
                pass


# Import settings model at the end to avoid circular import
from .models_settings import SchoolSettings
from .models_academic_config import (
    SchoolAcademicConfig, 
    GradeTermConfig, 
    ExamType, 
    GradeExamStructure, 
    CustomGradeScale
)
from .models_calendar import Holiday, SchoolEvent
from .models_programs import Campus, AcademicProgram, GradeConfiguration

