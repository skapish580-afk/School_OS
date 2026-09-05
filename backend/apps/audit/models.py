from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
import uuid

class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('VIEW', 'View Sensitive Data'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # WHO did it?
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    
    # WHAT did they do?
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    
    # TO WHAT object? (Generic Relation)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=50) # UUIDs are strings here
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # EXTRA details (e.g. "Changed marks from 40 to 90")
    details = models.TextField(blank=True)
    
    # WHEN?
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.actor} - {self.action} - {self.timestamp}"


class RecordHierarchyLog(models.Model):
    """
    Dedicated table tracking hierarchy level, role name, and edit summary for EVERY record edit across ALL modules.
    
    Stores 3 key pieces of information:
    1. Who edited the data (name of the role: role_name)
    2. What was edited (summary of changes: edited_changes)
    3. What was that role's hierarchy level (hierarchy_level)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Generic relation linking to any object in any module
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, db_index=True)
    object_id = models.CharField(max_length=100, db_index=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 1. Who edited the data (name of the role)
    role_name = models.CharField(max_length=150, help_text="Name of the role of the user who made this edit")
    
    # 2. What was edited
    edited_changes = models.TextField(blank=True, help_text="Summary of what was created or edited")
    
    # 3. What was that role's hierarchy level
    hierarchy_level = models.IntegerField(default=1, help_text="Hierarchy level of the role at edit time (1-101)")
    
    # Metadata
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='hierarchy_record_logs')
    action = models.CharField(max_length=20, default='UPDATE')  # CREATE, UPDATE, DELETE
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Record Hierarchy Log'
        verbose_name_plural = 'Record Hierarchy Logs'
        indexes = [
            models.Index(fields=['content_type', 'object_id', '-timestamp']),
        ]

    def __str__(self):
        return f"{self.role_name} (Level {self.hierarchy_level}) - {self.action} on {self.content_type.model} #{self.object_id}"