from django.db import models
from django.conf import settings
import uuid
from apps.schools.models import School


class PlatformOwner(models.Model):
    """
    Platform Owner - Super admin who manages all schools
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owner_profile'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Owner: {self.user.email}"
    
    class Meta:
        verbose_name = "Platform Owner"
        verbose_name_plural = "Platform Owners"


class SchoolSubscription(models.Model):
    """
    Subscription plans for schools
    """
    PLAN_CHOICES = [
        ('FREE', 'Free Plan'),
        ('BASIC', 'Basic Plan'),
        ('PREMIUM', 'Premium Plan'),
        ('ENTERPRISE', 'Enterprise Plan'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('EXPIRED', 'Expired'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='owner_subscription')
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='FREE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    start_date = models.DateField(auto_now_add=True)
    end_date = models.DateField(null=True, blank=True)
    
    max_students = models.IntegerField(default=50)
    max_teachers = models.IntegerField(default=10)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_subscriptions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Suspension tracking
    suspended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suspended_subscriptions'
    )
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.school.name} - {self.plan}"
    
    class Meta:
        verbose_name = "School Subscription"
        verbose_name_plural = "School Subscriptions"


class FeatureToggle(models.Model):
    """
    Feature toggles for schools - STEP 6 of Onboarding
    
    Modular SaaS Model:
    - Core features (always ON): Students, Teachers, Attendance, Announcements
    - Optional features: Can be toggled per school for pricing tiers
    """
    FEATURE_CHOICES = [
        # Core (Always ON)
        ('STUDENTS', 'Students'),
        ('TEACHERS', 'Teachers'),
        ('ATTENDANCE', 'Attendance'),
        ('ANNOUNCEMENTS', 'Announcements'),
        
        # Optional Modules
        ('FINANCE', 'Finance'), # Shortened from 'Fees & Billing' per request context or keep as is? User said "according to school admin side panel only". Sidebar says 'Finance'.
        ('ONLINE_PAYMENTS', 'Online Payments'),
        ('EXAMS', 'Exams & Report Cards'),
        ('HOMEWORK', 'Homework'),
        ('TRANSPORT', 'Transport'),
        ('HOSTEL', 'Hostel'),
        ('LIBRARY', 'Library'),
        ('INVENTORY', 'Inventory'),
        ('TIMETABLE', 'Timetable'),
        ('LIVE_CLASSES', 'Live Classes'),
        ('AI_ANALYTICS', 'Analytics'),
        ('HEALTH', 'Health'),
        ('GATE_PASS', 'Gate Pass'),
        ('ACHIEVEMENTS', 'Achievements'),
        ('DISCIPLINE', 'Discipline'),
        ('REPORTS', 'Reports'),
        ('NOTIFICATIONS', 'Notifications'),
        ('CERTIFICATES', 'Certificates'),
        ('TRANSFERS', 'Transfers'),
        ('DATA_EXPORTS', 'Data Exports'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='feature_toggles')
    feature = models.CharField(max_length=50, choices=FEATURE_CHOICES)
    is_enabled = models.BooleanField(default=True)
    sub_features = models.JSONField(default=dict, blank=True, help_text="Granular feature flags e.g. {'health_pass': True}")
    
    enabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='toggled_features'
    )
    enabled_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        status = "Enabled" if self.is_enabled else "Disabled"
        return f"{self.school.name} - {self.get_feature_display()} ({status})"
    
    class Meta:
        verbose_name = "Feature Toggle"
        verbose_name_plural = "Feature Toggles"
        unique_together = ['school', 'feature']


class OwnerAuditLog(models.Model):
    """
    Audit log for platform owner actions
    """
    ACTION_CHOICES = [
        ('SCHOOL_CREATED', 'School Created'),
        ('SCHOOL_UPDATED', 'School Updated'),
        ('SCHOOL_SUSPENDED', 'School Suspended'),
        ('SCHOOL_ACTIVATED', 'School Activated'),
        ('ADMIN_CREATED', 'School Admin Created'),
        ('ADMIN_UPDATED', 'School Admin Updated'),
        ('ADMIN_DELETED', 'School Admin Deleted'),
        ('PASSWORD_RESET', 'Admin Password Reset'),
        ('SUBSCRIPTION_CREATED', 'Subscription Created'),
        ('SUBSCRIPTION_UPDATED', 'Subscription Updated'),
        ('PLAN_CHANGED', 'Subscription Plan Changed'),
        ('FEATURE_TOGGLED', 'Feature Toggled'),
        ('FEATURE_BULK_TOGGLED', 'Features Bulk Toggled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    school = models.ForeignKey(
        School,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owner_audit_logs'
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='owner_actions'
    )
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.get_action_display()} by {self.performed_by} at {self.created_at}"
    
    class Meta:
        verbose_name = "Owner Audit Log"
        verbose_name_plural = "Owner Audit Logs"
        ordering = ['-created_at']


# Import OnboardingChecklist
from .models_onboarding import OnboardingChecklist
