import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.schools.models import School


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('INVESTIGATING', 'Under Investigation'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    ]

    SEVERITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]

    CATEGORY_CHOICES = [
        ('TECHNICAL_ERROR', 'Technical Error / Crash'),
        ('UI_BUG', 'UI / Display Issue'),
        ('PERFORMANCE', 'Slow Performance / Timeout'),
        ('DATA_ISSUE', 'Data / Sync Inconsistency'),
        ('FEATURE_REQUEST', 'Feature Request'),
        ('GENERAL', 'General Inquiry'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=32, unique=True, editable=False, db_index=True)
    
    # Context
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='support_tickets', null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_tickets')
    user_role = models.CharField(max_length=50, blank=True, default='')
    user_name = models.CharField(max_length=255, blank=True, default='')
    user_email = models.CharField(max_length=255, blank=True, default='')

    # Issue Content
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='TECHNICAL_ERROR')
    description = models.TextField()
    screenshot = models.ImageField(upload_to='support_screenshots/', null=True, blank=True)
    current_route = models.CharField(max_length=255, blank=True, default='')

    # State & Prioritization
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN', db_index=True)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='MEDIUM')

    # Device & Telemetry Dump (Captured automatically by Flight Recorder)
    diagnostic_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Flight recorder telemetry dump (device specs, console logs, network errors, breadcrumbs)"
    )

    # Management / Admin Handling
    assigned_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_support_tickets'
    )
    admin_notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Support Ticket'
        verbose_name_plural = 'Support Tickets'

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            prefix = "TKT"
            date_str = timezone.now().strftime("%Y%m%d")
            short_id = uuid.uuid4().hex[:6].upper()
            self.ticket_number = f"{prefix}-{date_str}-{short_id}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.ticket_number}] {self.title} ({self.status})"


class TicketMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_ticket_messages')
    
    sender_name = models.CharField(max_length=255, blank=True, default='')
    sender_role = models.CharField(max_length=50, blank=True, default='')
    is_admin_reply = models.BooleanField(default=False)
    
    message = models.TextField()
    attachment = models.FileField(upload_to='ticket_attachments/', null=True, blank=True)
    
    is_read_by_user = models.BooleanField(default=False)
    is_read_by_admin = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Ticket Message'
        verbose_name_plural = 'Ticket Messages'

    def __str__(self):
        return f"Message by {self.sender} on {self.ticket.ticket_number}"
