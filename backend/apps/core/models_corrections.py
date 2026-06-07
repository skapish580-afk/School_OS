"""
CRITICAL MODULE: Data Correction & Approval Workflow System
============================================================
Reality: Wrong data happens. Schools need correction lifecycle.

This module handles:
- Correction requests for any data type
- Approval workflows
- "Edited after lock" audit logs
- Version history
- Prevents "one wrong click = permanent truth"

Use cases:
- Wrong attendance marked
- Wrong marks entered
- Wrong invoice amount
- Wrong promotion
- Wrong student details
"""

from django.db import models
from apps.schools.models import School
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
import uuid
import json

User = get_user_model()


class CorrectionRequest(models.Model):
    """
    Universal correction request for any data entity.
    Uses GenericForeignKey to link to any model (Student, Attendance, Invoice, etc.)
    """
    DATA_TYPES = [
        ('STUDENT', 'Student Details'),
        ('ATTENDANCE', 'Attendance Record'),
        ('MARKS', 'Marks/Result'),
        ('INVOICE', 'Fee Invoice'),
        ('ENROLLMENT', 'Enrollment'),
        ('PROMOTION', 'Promotion Record'),
        ('HEALTH', 'Health Record'),
        ('DISCIPLINE', 'Discipline Record'),
        ('ACHIEVEMENT', 'Achievement'),
        ('GATEPASS', 'Gate Pass'),
        ('OTHER', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('APPLIED', 'Correction Applied'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    URGENCY_LEVELS = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='correction_requests')
    
    # Link to any model (polymorphic)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    data_type = models.CharField(max_length=20, choices=DATA_TYPES)
    
    # What's wrong
    issue_description = models.TextField(help_text="Describe what's incorrect")
    
    # Current vs Proposed values
    current_values = models.JSONField(
        help_text="Current incorrect data as JSON",
        default=dict
    )
    proposed_values = models.JSONField(
        help_text="Proposed correct data as JSON",
        default=dict
    )
    
    # Why it's wrong
    reason = models.TextField(help_text="Why correction is needed")
    supporting_documents = models.FileField(
        upload_to='corrections/documents/',
        null=True,
        blank=True,
        help_text="Upload proof (photos, documents, etc.)"
    )
    
    # Request metadata
    urgency = models.CharField(max_length=10, choices=URGENCY_LEVELS, default='MEDIUM')
    requested_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='correction_requests_made'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    
    # Workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Approval
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='correction_requests_reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_comments = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Application
    applied_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='corrections_applied'
    )
    applied_at = models.DateTimeField(null=True, blank=True)
    
    # Audit trail link
    audit_log_id = models.UUIDField(null=True, blank=True, help_text="Link to AuditLog entry")
    
    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['status', 'urgency']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.data_type} Correction - {self.status} - {self.requested_at.date()}"
    
    def get_summary(self):
        """Human-readable summary of changes"""
        changes = []
        for key in self.proposed_values:
            old_val = self.current_values.get(key, 'N/A')
            new_val = self.proposed_values[key]
            if old_val != new_val:
                changes.append(f"{key}: {old_val} → {new_val}")
        return "\n".join(changes)


class DataVersionHistory(models.Model):
    """
    Tracks all versions of a data entity.
    Immutable log of every change.
    """
    CHANGE_TYPES = [
        ('CREATE', 'Created'),
        ('UPDATE', 'Updated'),
        ('DELETE', 'Deleted'),
        ('CORRECTION', 'Corrected'),
        ('RESTORE', 'Restored'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='data_versions')
    
    # Link to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255)
    
    # Version data
    version_number = models.PositiveIntegerField(default=1)
    data_snapshot = models.JSONField(help_text="Complete data at this version")
    
    # Change metadata
    change_type = models.CharField(max_length=20, choices=CHANGE_TYPES)
    changes_made = models.JSONField(
        help_text="Dict of field: {old, new}",
        default=dict
    )
    change_reason = models.TextField(blank=True)
    
    # Who & when
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    
    # Was this a correction?
    is_correction = models.BooleanField(default=False)
    correction_request = models.ForeignKey(
        CorrectionRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions'
    )
    
    class Meta:
        ordering = ['-version_number', '-changed_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"Version {self.version_number} - {self.content_type} - {self.changed_at}"


class ApprovalWorkflow(models.Model):
    """
    Generic approval workflow for any action.
    Used for: Marks submission, Certificate issuance, Data corrections, etc.
    """
    WORKFLOW_TYPES = [
        ('MARKS_APPROVAL', 'Marks Approval'),
        ('CERTIFICATE', 'Certificate Issuance'),
        ('CORRECTION', 'Data Correction'),
        ('PROMOTION', 'Promotion Approval'),
        ('TRANSFER', 'Student Transfer'),
        ('FEE_WAIVER', 'Fee Waiver'),
        ('CUSTOM', 'Custom Workflow'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_REVIEW', 'In Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='approval_workflows')
    
    workflow_type = models.CharField(max_length=30, choices=WORKFLOW_TYPES)
    
    # Link to the item needing approval
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Request details
    title = models.CharField(max_length=200)
    description = models.TextField()
    
    # Requester
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='approval_requests_made'
    )
    requested_at = models.DateTimeField(auto_now_add=True)
    
    # Approvers (can be multi-level)
    approvers = models.ManyToManyField(
        User,
        related_name='approval_workflows_assigned',
        through='ApprovalStep'
    )
    
    # Current status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    current_step = models.PositiveIntegerField(default=1)
    
    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)
    final_decision = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-requested_at']
    
    def __str__(self):
        return f"{self.workflow_type} - {self.title} - {self.status}"


class ApprovalStep(models.Model):
    """
    Individual approval step in a workflow.
    Supports multi-level approvals (Teacher → HOD → Principal)
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('SKIPPED', 'Skipped'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    workflow = models.ForeignKey(ApprovalWorkflow, on_delete=models.CASCADE, related_name='steps')
    step_number = models.PositiveIntegerField()
    
    approver = models.ForeignKey(User, on_delete=models.CASCADE)
    approver_role = models.CharField(max_length=50, help_text="e.g., 'HOD', 'Principal'")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Decision
    decision = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    
    # Notifications
    notified_at = models.DateTimeField(null=True, blank=True)
    reminder_sent = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['step_number']
        unique_together = ['workflow', 'step_number']
    
    def __str__(self):
        return f"Step {self.step_number} - {self.approver.full_name} - {self.status}"


class LockedDataOverride(models.Model):
    """
    Tracks admin overrides of locked data.
    Critical audit trail for compliance.
    
    Reality: "Data is locked but principal needs to change it"
    """
    OVERRIDE_TYPES = [
        ('MARKS_EDIT', 'Edit Approved Marks'),
        ('RESULT_CHANGE', 'Change Locked Result'),
        ('CERTIFICATE_REISSUE', 'Reissue Certificate'),
        ('ENROLLMENT_EDIT', 'Edit Closed Enrollment'),
        ('PROMOTION_REVERSAL', 'Reverse Promotion'),
        ('OTHER', 'Other Override'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='data_overrides')
    
    override_type = models.CharField(max_length=30, choices=OVERRIDE_TYPES)
    
    # What was overridden
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    # Why
    reason = models.TextField(help_text="Justification for override")
    urgency = models.CharField(
        max_length=20,
        choices=[
            ('ROUTINE', 'Routine Correction'),
            ('URGENT', 'Urgent Fix'),
            ('LEGAL', 'Legal/Compliance Requirement'),
            ('BOARD_DIRECTIVE', 'Board Directive'),
        ]
    )
    
    # Before & After
    data_before = models.JSONField()
    data_after = models.JSONField()
    
    # Authorization
    authorized_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='overrides_authorized',
        help_text="Must be Principal or Super Admin"
    )
    authorized_at = models.DateTimeField(auto_now_add=True)
    
    # Approval (optional second-level)
    requires_board_approval = models.BooleanField(default=False)
    board_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='board_approvals'
    )
    board_approved_at = models.DateTimeField(null=True, blank=True)
    
    # Audit
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-authorized_at']
    
    def __str__(self):
        return f"{self.override_type} Override by {self.authorized_by.full_name} on {self.authorized_at.date()}"


class EditAfterLockLog(models.Model):
    """
    Specific log for edits made after data was locked.
    More granular than general audit logs.
    
    Reality: Schools are paranoid about post-facto changes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='edit_after_lock_logs')
    
    # What was edited
    entity_type = models.CharField(max_length=50, help_text="e.g., 'StudentMark', 'Attendance'")
    entity_id = models.CharField(max_length=255)
    entity_description = models.CharField(max_length=200, help_text="Human-readable identifier")
    
    # Lock details
    was_locked_at = models.DateTimeField(help_text="When was it originally locked?")
    lock_type = models.CharField(
        max_length=30,
        choices=[
            ('APPROVED', 'Approved/Moderated'),
            ('FINAL', 'Finalized'),
            ('ARCHIVED', 'Archived'),
            ('BOARD_SUBMITTED', 'Submitted to Board'),
        ]
    )
    
    # Edit details
    fields_changed = models.JSONField(help_text="List of field names changed")
    old_values = models.JSONField()
    new_values = models.JSONField()
    
    # Authorization
    edited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='locked_edits')
    edit_timestamp = models.DateTimeField(auto_now_add=True)
    
    authorization_reason = models.TextField()
    authorized_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='locked_edit_authorizations'
    )
    
    # Visibility flag (for transparency)
    is_visible_to_parents = models.BooleanField(
        default=False,
        help_text="Should parents be notified of this change?"
    )
    parent_notification_sent = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-edit_timestamp']
    
    def __str__(self):
        return f"Locked Edit: {self.entity_type} by {self.edited_by.full_name} on {self.edit_timestamp.date()}"


class BulkCorrectionBatch(models.Model):
    """
    For bulk corrections (e.g., fix attendance for entire class).
    Prevents creating 50 individual correction requests.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='bulk_corrections')
    
    batch_name = models.CharField(max_length=200)
    correction_type = models.CharField(max_length=50)
    
    # Criteria for bulk operation
    criteria = models.JSONField(help_text="Filter criteria (e.g., {date: '2026-01-20', class: '9-A'})")
    
    # What to change
    changes_to_apply = models.JSONField(help_text="Changes to apply to all matching records")
    
    # Execution
    total_records = models.PositiveIntegerField(default=0)
    records_processed = models.PositiveIntegerField(default=0)
    records_failed = models.PositiveIntegerField(default=0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Authorization
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_corrections_requested')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bulk_corrections_approved')
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Results
    success_log = models.JSONField(default=list, help_text="List of successfully corrected IDs")
    error_log = models.JSONField(default=list, help_text="List of errors")
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self):
        return f"Bulk Correction: {self.batch_name} - {self.status}"
