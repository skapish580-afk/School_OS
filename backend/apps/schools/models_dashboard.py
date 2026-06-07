"""
Dashboard-related models for School Admin
- Admin Notes
- Broadcast Notifications
"""

import uuid
from django.db import models
from django.conf import settings
from .models import School


class AdminNote(models.Model):
    """
    Personal notes for school admin on their dashboard.
    Quick notes, reminders, to-do items.
    """
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ]
    
    COLOR_CHOICES = [
        ('yellow', 'Yellow'),
        ('blue', 'Blue'),
        ('green', 'Green'),
        ('pink', 'Pink'),
        ('purple', 'Purple'),
        ('orange', 'Orange'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='admin_notes')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='admin_notes')
    
    title = models.CharField(max_length=200)
    content = models.TextField()
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default='yellow')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    
    is_pinned = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    due_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-is_pinned', '-created_at']
    
    def __str__(self):
        return f"{self.title[:50]}..."


class BroadcastNotification(models.Model):
    """
    Broadcast notifications to teachers, students, or both.
    School admin can send announcements to entire groups.
    """
    AUDIENCE_CHOICES = [
        ('TEACHERS', 'Teachers Only'),
        ('STUDENTS', 'Students Only'),
        ('BOTH', 'Teachers & Students'),
        ('PARENTS', 'Parents Only'),
        ('ALL', 'Everyone'),
    ]
    
    PRIORITY_CHOICES = [
        ('LOW', 'Low - Informational'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High - Important'),
        ('URGENT', 'Urgent - Immediate Attention'),
    ]
    
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SCHEDULED', 'Scheduled'),
        ('SENT', 'Sent'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='broadcast_notifications')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='broadcast_notifications')
    
    title = models.CharField(max_length=200)
    message = models.TextField()
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    
    # Target filtering (optional - to narrow down audience)
    target_grades = models.JSONField(default=list, blank=True, help_text="List of grade numbers to target")
    target_sections = models.JSONField(default=list, blank=True, help_text="List of section IDs to target")
    
    # Delivery
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    # Metrics
    recipients_count = models.PositiveIntegerField(default=0)
    read_count = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} -> {self.get_audience_display()}"


class BroadcastReadReceipt(models.Model):
    """
    Track who has read a broadcast notification.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    broadcast = models.ForeignKey(BroadcastNotification, on_delete=models.CASCADE, related_name='read_receipts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='read_broadcasts')
    
    read_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('broadcast', 'user')
    
    def __str__(self):
        return f"{self.user} read {self.broadcast.title}"
