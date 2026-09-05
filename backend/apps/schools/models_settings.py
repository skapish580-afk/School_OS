from django.db import models
import uuid
from apps.schools.models import School
from django.contrib.auth import get_user_model

User = get_user_model()


def get_default_required_documents():
    return ['BIRTH_CERTIFICATE']


class SchoolSettings(models.Model):
    """
    School-level settings and preferences
    """
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='settings')
    
    # Appearance
    dark_mode = models.BooleanField(default=False)
    primary_color = models.CharField(max_length=7, default='#3B82F6', help_text="Hex color code")
    
    # Dashboard Widget Visibility
    show_student_stats = models.BooleanField(default=True)
    show_teacher_stats = models.BooleanField(default=True)
    show_attendance_widget = models.BooleanField(default=True)
    show_finance_widget = models.BooleanField(default=True)
    show_health_widget = models.BooleanField(default=True)
    show_gatepass_widget = models.BooleanField(default=True)
    show_achievements_widget = models.BooleanField(default=True)
    show_transfers_widget = models.BooleanField(default=True)
    show_alumni_stats = models.BooleanField(default=True, help_text="Show alumni statistics on dashboard")
    
    # Notifications
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)
    push_notifications = models.BooleanField(default=True)
    
    # Academic Settings
    academic_year_start_month = models.IntegerField(default=4, help_text="Month when academic year starts (1-12)")
    academic_year_start_day = models.IntegerField(default=1, help_text="Day when academic year starts (1-31)")
    academic_year_end_month = models.IntegerField(default=3, help_text="Month when academic year ends (1-12)")
    academic_year_end_day = models.IntegerField(default=31, help_text="Day when academic year ends (1-31)")
    academic_year_format = models.CharField(
        max_length=20, 
        choices=[
            ('YYYY-YYYY', '2025-2026'),
            ('YYYY/YYYY', '2025/2026'),
            ('YY-YY', '25-26'),
        ],
        default='YYYY-YYYY'
    )

    
    graduation_point = models.CharField(
        max_length=10,
        choices=[
            ('10', 'After Grade 10'),
            ('12', 'After Grade 12'),
        ],
        default='12',
        help_text="Grade level at which students graduate"
    )
    
    allow_continuation_after_10 = models.BooleanField(
        default=True,
        help_text="Allow students to continue to 11-12 after Grade 10"
    )
    
    # Class Teacher Features
    enable_class_teacher_attendance_edit = models.BooleanField(
        default=True,
        help_text="Allow class teachers to edit full-day attendance"
    )
    
    enable_class_teacher_gatepass_approval = models.BooleanField(
        default=True,
        help_text="Allow class teachers to approve gate passes for their class"
    )
    
    karma_system_enabled = models.BooleanField(
        default=True,
        help_text="Enable behavior/discipline tracking system"
    )
    
    karma_label = models.CharField(
        max_length=50,
        default='Karma',
        help_text="Custom name for behavior system (Karma, Conduct Points, Behavior Score, etc.)"
    )

    enable_gatepass_print = models.BooleanField(
        default=False,
        help_text="Show a print icon on the digital pass QR so staff can print the pass"
    )
    
    gatepass_secret_key = models.CharField(
        max_length=100, 
        default=uuid.uuid4, 
        help_text="Master Secret Key for QR Code generation and verification"
    )

    # Gate Pass Email Settings
    gatepass_sender_email = models.EmailField(
        null=True, 
        blank=True, 
        help_text="Gmail ID for Gate Pass notifications"
    )
    gatepass_app_password = models.CharField(
        max_length=100, 
        null=True, 
        blank=True, 
        help_text="Gmail App Password"
    )
    gatepass_creation_email_body = models.TextField(
        blank=True,
        default="",
        help_text="Custom email body for gate pass creation (6-digit secret key email)"
    )
    gatepass_departure_email_body = models.TextField(
        blank=True,
        default="",
        help_text="Custom email body for gate pass departure (when child leaves school)"
    )
    gatepass_verification_base_url = models.URLField(
        default="http://localhost:3000", 
        help_text="Base URL for QR verification link (e.g., http://localhost:3000)"
    )
    
    # Data Privacy
    show_student_photos = models.BooleanField(default=True)
    show_parent_contact = models.BooleanField(default=True)
    show_financial_data = models.BooleanField(default=True)
    
    # System Preferences
    default_language = models.CharField(max_length=10, default='en')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    date_format = models.CharField(
        max_length=20,
        choices=[
            ('DD/MM/YYYY', 'DD/MM/YYYY'),
            ('MM/DD/YYYY', 'MM/DD/YYYY'),
            ('YYYY-MM-DD', 'YYYY-MM-DD'),
        ],
        default='DD/MM/YYYY'
    )
    
    # Location Settings (for Transport)
    school_address = models.TextField(null=True, blank=True)
    school_latitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    school_longitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # ============================================================
    # FINANCE SETTINGS
    # ============================================================
    
    # Duplicate Billing Protection
    prevent_duplicate_billing = models.BooleanField(
        default=True,
        help_text="Prevent generating duplicate invoices for same student & installment"
    )
    
    require_billing_confirmation = models.BooleanField(
        default=True,
        help_text="Show confirmation dialog before generating invoice"
    )
    
    show_student_fee_history_on_invoice = models.BooleanField(
        default=True,
        help_text="Show student's fee history when creating invoice"
    )
    
    # Auto Invoice Generation
    auto_generate_installment_invoices = models.BooleanField(
        default=False,
        help_text="Automatically generate invoices when installments are due"
    )
    
    days_before_due_to_generate = models.PositiveIntegerField(
        default=7,
        help_text="Days before due date to auto-generate invoice"
    )
    
    # Late Fee Settings
    auto_apply_late_fee = models.BooleanField(
        default=True,
        help_text="Automatically apply late fees to overdue invoices"
    )
    
    # Fee Display
    show_fee_breakdown_on_invoice = models.BooleanField(
        default=True,
        help_text="Show detailed fee breakdown on invoices"
    )
    
    # Payment Reminders
    send_payment_reminders = models.BooleanField(
        default=True,
        help_text="Send automated payment reminders"
    )
    
    reminder_days_before_due = models.PositiveIntegerField(
        default=3,
        help_text="Days before due date to send reminder"
    )
    
    required_documents = models.JSONField(
        blank=True,
        default=get_default_required_documents,
        help_text="List of required document types for full active admission"
    )
    
    class Meta:
        verbose_name = 'School Settings'
        verbose_name_plural = 'School Settings'
    
    def get_academic_year_code_for_date(self, date_obj=None):
        if not date_obj:
            from django.utils import timezone
            date_obj = timezone.now().date()
        elif hasattr(date_obj, 'date'):
            date_obj = date_obj.date()
            
        start_month = self.academic_year_start_month or 4
        start_day = self.academic_year_start_day or 1
        
        year = date_obj.year
        try:
            cycle_start_this_year = date_obj.replace(year=year, month=start_month, day=start_day)
        except ValueError:
            cycle_start_this_year = date_obj.replace(year=year, month=start_month, day=28)
            
        if date_obj >= cycle_start_this_year:
            start_year = year
        else:
            start_year = year - 1
            
        end_year = start_year + 1
        
        fmt = self.academic_year_format or 'YYYY-YYYY'
        if fmt == 'YYYY/YYYY':
            return f"{start_year}/{end_year}"
        elif fmt == 'YY-YY':
            return f"{str(start_year)[2:]}-{str(end_year)[2:]}"
        else:
            return f"{start_year}-{end_year}"

    def get_available_academic_years(self, upcoming_count=3, past_count=10):
        from django.utils import timezone
        current_code = self.get_academic_year_code_for_date(timezone.now().date())
        try:
            start_year = int(current_code.split('-')[0].split('/')[0])
            if len(str(start_year)) == 2:
                start_year += 2000
        except Exception:
            start_year = timezone.now().year

        years = []
        for i in range(upcoming_count, -past_count, -1):
            y1 = start_year + i
            y2 = y1 + 1
            fmt = self.academic_year_format or 'YYYY-YYYY'
            if fmt == 'YYYY/YYYY':
                code = f"{y1}/{y2}"
            elif fmt == 'YY-YY':
                code = f"{str(y1)[2:]}-{str(y2)[2:]}"
            else:
                code = f"{y1}-{y2}"
            years.append(code)
        return years


    def save(self, *args, **kwargs):
        # Timezone is fixed statically to Asia/Kolkata (Indian Standard Time)
        self.timezone = 'Asia/Kolkata'
        super().save(*args, **kwargs)
        
        # Sync academic years for school
        if self.school and not getattr(self, '_syncing', False):
            try:
                sync_school_academic_years(self.school)
            except Exception:
                pass

        # Sync to School
        school = self.school
        if school and not getattr(self, '_syncing', False):

            def coords_equal(c1, c2):
                if c1 is None and c2 is None:
                    return True
                if c1 is None or c2 is None:
                    return False
                try:
                    return round(float(c1), 6) == round(float(c2), 6)
                except (ValueError, TypeError):
                    return False

            addr_diff = (school.address or '').strip() != (self.school_address or '').strip()
            lat_diff = not coords_equal(school.latitude, self.school_latitude)
            lng_diff = not coords_equal(school.longitude, self.school_longitude)
            tz_diff = school.timezone != self.timezone
            
            if addr_diff or lat_diff or lng_diff or tz_diff:
                school.address = self.school_address or ''
                school.latitude = self.school_latitude
                school.longitude = self.school_longitude
                school.timezone = self.timezone
                school._syncing = True
                school.save()


import urllib.parse
import urllib.request
import json
import logging

logger = logging.getLogger(__name__)

def geocode_address(address):
    """
    Geocode an address using Nominatim (OpenStreetMap).
    Returns (lat, lng) or (None, None).
    """
    if not address:
        return None, None
    try:
        url = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(address) + "&format=json&limit=1"
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'SchoolOS-Agent/1.0 (contact: support@schoolos.com)'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        logger.error(f"Error geocoding address '{address}': {e}")
    return None, None


def sync_school_academic_years(school):
    """
    Ensures AcademicYear records exist for the school matching its configured
    academic_year_start_month, start_day, end_month, end_day, and sets the active status
    correctly for the current date.
    """
    if not school:
        return
    try:
        from apps.enrollments.models_promotion import AcademicYear
        from django.utils import timezone
        import datetime
        
        settings = getattr(school, 'settings', None)
        if not settings:
            return

        curr_date = timezone.now().date()
        current_code = settings.get_academic_year_code_for_date(curr_date)
        
        start_m = settings.academic_year_start_month or 4
        start_d = settings.academic_year_start_day or 1
        end_m = settings.academic_year_end_month or 3
        end_d = settings.academic_year_end_day or 31

        available_codes = settings.get_available_academic_years(upcoming_count=3, past_count=5)

        for code in available_codes:
            try:
                y1 = int(code.split('-')[0].split('/')[0])
                if len(str(y1)) == 2:
                    y1 += 2000
            except Exception:
                continue

            try:
                s_date = datetime.date(y1, start_m, start_d)
            except ValueError:
                s_date = datetime.date(y1, start_m, 28)

            y2 = y1 + 1 if end_m <= start_m else y1
            try:
                e_date = datetime.date(y2, end_m, end_d)
            except ValueError:
                e_date = datetime.date(y2, end_m, 28)

            if code == current_code:
                st = 'ACTIVE'
            elif curr_date > e_date:
                st = 'CLOSED'
            else:
                st = 'UPCOMING'

            ay, created = AcademicYear.objects.get_or_create(
                school=school,
                year_code=code,
                defaults={
                    'start_date': s_date,
                    'end_date': e_date,
                    'status': st
                }
            )
            if not created:
                ay.start_date = s_date
                ay.end_date = e_date
                ay.status = st
                ay.save()

        # Automatic rollover for existing active students into current_code based on current date
        if current_code:
            from apps.students.models import Student
            from apps.enrollments.models import StudentEnrollment

            active_students = Student.objects.filter(
                school=school,
                status__in=['ACTIVE', 'TEMPORARY']
            )

            for st_obj in active_students:
                has_curr = StudentEnrollment.objects.filter(
                    student=st_obj,
                    academic_year=current_code
                ).exists()

                if not has_curr:
                    prior_enrollment = StudentEnrollment.objects.filter(
                        student=st_obj
                    ).order_by('-created_at').first()

                    if prior_enrollment:
                        StudentEnrollment.objects.create(
                            student=st_obj,
                            school=school,
                            grade=prior_enrollment.grade,
                            section=prior_enrollment.section,
                            roll_number=prior_enrollment.roll_number,
                            academic_year=current_code,
                            status='ACTIVE'
                        )
                    elif st_obj.grade_config:
                        sec_letter = st_obj.current_section.section_letter if st_obj.current_section else 'A'
                        StudentEnrollment.objects.create(
                            student=st_obj,
                            school=school,
                            grade=st_obj.grade_config.grade_name,
                            section=sec_letter,
                            academic_year=current_code,
                            status='ACTIVE'
                        )
    except Exception as e:
        logger.error(f"Error syncing academic years: {e}")


