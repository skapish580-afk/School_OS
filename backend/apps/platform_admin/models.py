from django.db import models
from django.contrib.auth import get_user_model
from apps.schools.models import School
import uuid

User = get_user_model()


class PlatformAdmin(models.Model):
    """
    Platform-level administrators (Super Admins)
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='platform_admin')
    is_super_admin = models.BooleanField(default=False, help_text="Full platform access")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Platform Admin: {self.user.email}"


class SchoolSubscription(models.Model):
    """
    School subscription plans and feature access
    """
    PLAN_CHOICES = [
        ('FREE', 'Free Trial'),
        ('BASIC', 'Basic'),
        ('PREMIUM', 'Premium'),
        ('ENTERPRISE', 'Enterprise'),
    ]
    
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('EXPIRED', 'Expired'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='subscription')
    
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='FREE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    # Limits
    max_students = models.IntegerField(default=50, help_text="Maximum students allowed")
    max_teachers = models.IntegerField(default=10, help_text="Maximum teachers allowed")
    
    # Dates
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True, help_text="Subscription expiry")
    
    # Suspension
    suspended_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='suspended_schools')
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspension_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.school.name} - {self.plan} ({self.status})"


class FeatureAccess(models.Model):
    """
    Feature toggles per school
    """
    FEATURE_CHOICES = [
        ('ATTENDANCE', 'Attendance Management'),
        ('FINANCE', 'Finance & Invoicing'),
        ('HEALTH', 'Health Center'),
        ('GATE_PASS', 'Gate Pass System'),
        ('ACHIEVEMENTS', 'Achievements'),
        ('DISCIPLINE', 'Discipline Tracking'),
        ('TRANSFERS', 'Transfer Requests'),
        ('TEACHERS', 'Teacher Management'),
        ('ACADEMICS', 'Academics & Marks'),
        ('REPORTS', 'Report Cards'),
        ('NOTIFICATIONS', 'Notifications'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='feature_access')
    
    feature = models.CharField(max_length=25, choices=FEATURE_CHOICES)
    is_enabled = models.BooleanField(default=True)
    
    # Audit
    enabled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    enabled_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['school', 'feature']
        verbose_name_plural = 'Feature Access'
    
    def __str__(self):
        return f"{self.school.name} - {self.feature} ({'Enabled' if self.is_enabled else 'Disabled'})"


class UsageMetric(models.Model):
    """
    Track school usage for analytics
    """
    METRIC_TYPE = [
        ('STUDENT_COUNT', 'Active Students'),
        ('TEACHER_COUNT', 'Active Teachers'),
        ('ATTENDANCE_MARKED', 'Attendance Entries'),
        ('INVOICES_CREATED', 'Invoices Created'),
        ('GATE_PASSES_ISSUED', 'Gate Passes Issued'),
        ('HEALTH_VISITS', 'Health Visits'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='usage_metrics')
    
    metric_type = models.CharField(max_length=25, choices=METRIC_TYPE)
    value = models.IntegerField(default=0)
    date = models.DateField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['school', 'metric_type', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.school.name} - {self.metric_type}: {self.value} ({self.date})"


class PlatformAuditLog(models.Model):
    """
    Platform-level action logging
    """
    ACTION_CHOICES = [
        ('SCHOOL_CREATED', 'School Created'),
        ('SCHOOL_SUSPENDED', 'School Suspended'),
        ('SCHOOL_ACTIVATED', 'School Activated'),
        ('PLAN_CHANGED', 'Subscription Plan Changed'),
        ('FEATURE_TOGGLED', 'Feature Toggled'),
        ('USER_CREATED', 'User Created'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    action = models.CharField(max_length=25, choices=ACTION_CHOICES)
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, blank=True, related_name='platform_audit_logs')
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    description = models.TextField()
    metadata = models.TextField(blank=True, help_text="JSON string for additional action data")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} by {self.performed_by} at {self.created_at}"
class Payment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]
    
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    order_id = models.CharField(max_length=100, unique=True)
    payment_id = models.CharField(max_length=100, blank=True, null=True)
    signature = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    plan_requested = models.CharField(max_length=20, choices=SchoolSubscription.PLAN_CHOICES)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Payment {self.order_id} - {self.status}"
