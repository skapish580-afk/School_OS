from django.db import models
import uuid
from apps.schools.models import School
from django.contrib.auth import get_user_model

User = get_user_model()


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
    
    class Meta:
        verbose_name = 'School Settings'
        verbose_name_plural = 'School Settings'
    
    def __str__(self):
        return f"Settings for {self.school.name}"

    def save(self, *args, **kwargs):
        # Timezone is fixed statically to Asia/Kolkata (Indian Standard Time)
        self.timezone = 'Asia/Kolkata'
        super().save(*args, **kwargs)
        
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

