"""
Role-Based Access Control (RBAC) Models for School-OS

This module provides a flexible permission system that allows:
1. School admins to create custom roles (Vice Principal, Accountant, etc.)
2. Assign granular CRUD permissions per feature
3. Assign roles to staff members

Permission Format: {module}.{action}_{resource}
Examples:
- students.view_student
- students.create_student
- finance.approve_fee
- academics.publish_results
"""

from django.db import models
from django.conf import settings
import uuid


class Permission(models.Model):
    """
    Individual permission definition.
    These are system-defined and cannot be created by users.
    """
    
    # Module categories
    MODULE_CHOICES = [
        ('students', 'Students'),
        ('teachers', 'Teachers'),
        ('academics', 'Academics'),
        ('attendance', 'Attendance'),
        ('finance', 'Finance'),
        ('health', 'Health'),
        ('discipline', 'Discipline'),
        ('gatepass', 'Gate Pass'),
        ('achievements', 'Achievements'),
        ('transfers', 'Transfers'),
        ('enrollments', 'Enrollments'),
        ('reports', 'Reports'),
        ('settings', 'Settings'),
        ('users', 'User Management'),
        ('roles', 'Role Management'),
    ]
    
    # Action types
    ACTION_CHOICES = [
        ('view', 'View'),
        ('create', 'Create'),
        ('edit', 'Edit'),
        ('delete', 'Delete'),
        ('approve', 'Approve'),
        ('export', 'Export'),
        ('import', 'Import'),
        ('publish', 'Publish'),
        ('manage', 'Manage'),  # Full control
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Permission identifiers
    codename = models.CharField(
        max_length=100, 
        unique=True,
        help_text="Unique permission code (e.g., students.view_student)"
    )
    name = models.CharField(max_length=255, help_text="Human-readable name")
    description = models.TextField(blank=True, help_text="Detailed description")
    
    # Categorization
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    resource = models.CharField(max_length=50, help_text="Resource being accessed")
    
    # Flags
    is_sensitive = models.BooleanField(
        default=False, 
        help_text="Requires extra confirmation for sensitive actions"
    )
    requires_school_context = models.BooleanField(
        default=True,
        help_text="Permission only valid within school context"
    )
    
    # Ordering
    display_order = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['module', 'display_order', 'action']
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
    
    def __str__(self):
        return f"{self.name} ({self.codename})"
    
    @classmethod
    def get_by_codename(cls, codename):
        """Get permission by codename, returns None if not found."""
        try:
            return cls.objects.get(codename=codename)
        except cls.DoesNotExist:
            return None


class Role(models.Model):
    """
    Custom role created by school admin.
    Each school can have its own set of roles.
    """
    
    # Predefined role types (for quick setup)
    ROLE_TYPE_CHOICES = [
        ('CUSTOM', 'Custom Role'),
        ('PRINCIPAL', 'Principal'),
        ('VICE_PRINCIPAL', 'Vice Principal'),
        ('HEAD_OF_DEPARTMENT', 'Head of Department'),
        ('CLASS_TEACHER', 'Class Teacher'),
        ('SUBJECT_TEACHER', 'Subject Teacher'),
        ('ACCOUNTANT', 'Accountant'),
        ('RECEPTIONIST', 'Receptionist'),
        ('LIBRARIAN', 'Librarian'),
        ('LAB_ASSISTANT', 'Lab Assistant'),
        ('COUNSELOR', 'Counselor'),
        ('SPORTS_COORDINATOR', 'Sports Coordinator'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # School this role belongs to (NULL = system-wide role)
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='roles',
        null=True,
        blank=True,
        help_text="School this role belongs to. NULL for system-wide roles."
    )
    
    # Role details
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    role_type = models.CharField(
        max_length=30, 
        choices=ROLE_TYPE_CHOICES, 
        default='CUSTOM'
    )
    
    # Permissions assigned to this role
    permissions = models.ManyToManyField(
        Permission,
        related_name='roles',
        blank=True
    )
    
    # Hierarchy (higher = more authority)
    hierarchy_level = models.IntegerField(
        default=1,
        help_text="Higher level = more authority. Admin=100, Principal=90, etc."
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_system_role = models.BooleanField(
        default=False,
        help_text="System roles cannot be deleted by school admins"
    )
    
    # Audit
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_roles'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-hierarchy_level', 'name']
        unique_together = ['school', 'name']  # Unique role names per school
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
    
    def __str__(self):
        school_name = self.school.name if self.school else "System"
        return f"{self.name} ({school_name})"
    
    def has_permission(self, codename):
        """Check if role has a specific permission."""
        return self.permissions.filter(codename=codename).exists()
    
    def get_permissions_by_module(self):
        """Get permissions grouped by module."""
        permissions_by_module = {}
        for perm in self.permissions.all():
            if perm.module not in permissions_by_module:
                permissions_by_module[perm.module] = []
            permissions_by_module[perm.module].append(perm)
        return permissions_by_module


class UserRole(models.Model):
    """
    Assignment of a role to a user within a school context.
    A user can have multiple roles (e.g., Class Teacher + Sports Coordinator).
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_roles'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='user_assignments'
    )
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='user_role_assignments'
    )
    
    # Optional scope limitations
    grade_scope = models.ForeignKey(
        'schools.GradeConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Limit role to specific grade (e.g., Class 10 teacher)"
    )
    section_scope = models.ForeignKey(
        'academics.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Limit role to specific section"
    )
    subject_scope = models.ForeignKey(
        'academics.Subject',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Limit role to specific subject"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Primary role shown in profile"
    )
    
    # Validity period (for temporary assignments)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    
    # Audit
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assigned_roles'
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_primary', '-role__hierarchy_level']
        unique_together = ['user', 'role', 'school']  # User can't have same role twice
        verbose_name = 'User Role Assignment'
        verbose_name_plural = 'User Role Assignments'
    
    def __str__(self):
        return f"{self.user.email} - {self.role.name} @ {self.school.name}"
    
    @property
    def is_valid(self):
        """Check if assignment is currently valid."""
        from django.utils import timezone
        today = timezone.now().date()
        
        if not self.is_active:
            return False
        if self.valid_from and today < self.valid_from:
            return False
        if self.valid_until and today > self.valid_until:
            return False
        return True


class RolePermissionLog(models.Model):
    """
    Audit log for role and permission changes.
    Tracks who changed what and when.
    """
    
    ACTION_CHOICES = [
        ('ROLE_CREATED', 'Role Created'),
        ('ROLE_UPDATED', 'Role Updated'),
        ('ROLE_DELETED', 'Role Deleted'),
        ('PERMISSION_ADDED', 'Permission Added'),
        ('PERMISSION_REMOVED', 'Permission Removed'),
        ('USER_ASSIGNED', 'User Assigned to Role'),
        ('USER_REMOVED', 'User Removed from Role'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='role_permission_logs'
    )
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='role_actions'
    )
    
    # What was affected
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='role_changes_received'
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Details
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Role Permission Log'
        verbose_name_plural = 'Role Permission Logs'
    
    def __str__(self):
        return f"{self.action} by {self.actor} at {self.timestamp}"
