"""
Notification System Models
Handles parent notifications via SMS, Email, WhatsApp
"""

import uuid
from django.db import models
from django.conf import settings
from apps.students.models import Student
from apps.schools.models import School


class NotificationTemplate(models.Model):
    """
    Template for different types of notifications.
    Supports variable substitution: {{student_name}}, {{attendance_percentage}}, etc.
    """
    CATEGORY_CHOICES = [
        ('ATTENDANCE', 'Attendance Alert'),
        ('MARKS', 'Marks Notification'),
        ('DISCIPLINE', 'Discipline Incident'),
        ('PROMOTION', 'Promotion Decision'),
        ('CERTIFICATE', 'Certificate Ready'),
        ('GENERAL', 'General Notification'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='notification_templates')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    
    # Template content
    title = models.CharField(max_length=200, help_text="e.g., 'Attendance Alert'")
    body = models.TextField(help_text="e.g., 'Dear {{parent_name}}, {{student_name}}'s attendance...'")
    
    # Channel configuration
    channels = models.JSONField(
        default=dict,
        help_text="{'email': True, 'sms': True, 'whatsapp': True}"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('school', 'category')
        ordering = ['category']
    
    def __str__(self):
        return f"{self.get_category_display()} - {self.title}"


class ParentContact(models.Model):
    """
    Contact information for parents.
    Tracks which notification channels are enabled and preferred.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parent_contact'
    )
    
    # Contact Information
    phone_number = models.CharField(max_length=15, blank=True, help_text="Format: 9876543210")
    phone_country_code = models.CharField(max_length=5, default='+91', help_text="e.g., +91 for India")
    email = models.EmailField(blank=True)
    
    # Preferences
    whatsapp_enabled = models.BooleanField(default=True)
    notifications_enabled = models.BooleanField(default=True)
    preferred_channels = models.JSONField(
        default=list,
        help_text="['sms', 'email', 'whatsapp']"
    )
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Parent Contacts"
    
    def __str__(self):
        return f"Contact for {self.parent.full_name}"
    
    def get_full_phone(self):
        """Returns phone with country code."""
        if self.phone_number:
            return f"{self.phone_country_code}{self.phone_number}"
        return None


class StudentNotificationLog(models.Model):
    """
    Log of all notifications sent to parents about a student.
    Tracks delivery status and errors.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
        ('BOUNCED', 'Bounced'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='notification_logs')
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_notifications'
    )
    
    # Notification Content
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationTemplate.CATEGORY_CHOICES
    )
    subject = models.CharField(max_length=200)
    message = models.TextField()
    
    # Channel Delivery Status
    channels_sent = models.JSONField(
        default=dict,
        help_text="{'sms': True/False, 'email': True/False, 'whatsapp': True/False}"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    delivery_status = models.JSONField(
        default=dict,
        help_text="{'sms': 'delivered', 'email': 'sent', 'whatsapp': 'read'}"
    )
    
    # Error Tracking
    error_message = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['parent', '-created_at']),
            models.Index(fields=['notification_type', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.notification_type} → {self.parent.full_name if self.parent else 'Unknown'}"


class NotificationQueue(models.Model):
    """
    Queue for pending notifications to be sent by background worker.
    Allows retry logic and rate limiting.
    """
    STATUS_CHOICES = [
        ('QUEUED', 'Queued'),
        ('PROCESSING', 'Processing'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    log = models.OneToOneField(StudentNotificationLog, on_delete=models.CASCADE, related_name='queue_item')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='QUEUED')
    retry_count = models.PositiveIntegerField(default=0)
    max_retries = models.PositiveIntegerField(default=3)
    
    # Scheduling
    scheduled_at = models.DateTimeField()
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['scheduled_at']
        verbose_name_plural = "Notification Queues"
    
    def __str__(self):
        return f"Queue - {self.log.notification_type} ({self.status})"
