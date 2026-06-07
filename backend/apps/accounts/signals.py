"""
Account and RBAC Signals

Handles automatic actions like:
- Sending notifications when roles are assigned
- Clearing permission cache when roles change
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from .rbac_models import UserRole, RolePermissionLog
from .permission_utils import clear_permission_cache
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=UserRole)
def on_role_assigned(sender, instance, created, **kwargs):
    """
    When a role is assigned to a user:
    1. Clear their permission cache
    2. Send notification email
    3. Log the assignment
    """
    user = instance.user
    role = instance.role
    school = instance.school
    
    # Clear permission cache
    clear_permission_cache(user, school)
    
    # Send email notification
    if created and instance.is_active:
        try:
            send_role_assignment_notification(instance)
        except Exception as e:
            logger.error(f"Failed to send role assignment notification: {e}")


@receiver(post_delete, sender=UserRole)
def on_role_removed(sender, instance, **kwargs):
    """
    When a role is removed from a user:
    1. Clear their permission cache
    2. Send notification email
    """
    user = instance.user
    school = instance.school
    
    # Clear permission cache
    clear_permission_cache(user, school)
    
    # Send notification
    try:
        send_role_removal_notification(instance)
    except Exception as e:
        logger.error(f"Failed to send role removal notification: {e}")


def send_role_assignment_notification(user_role: UserRole):
    """
    Send email to user when they're assigned a new role.
    """
    user = user_role.user
    role = user_role.role
    school = user_role.school
    
    if not user.email:
        return
    
    subject = f"New Role Assigned: {role.name} - {school.name}"
    
    # Get permission summary
    permissions_count = role.permissions.count()
    
    # Build scope description if any
    scope_parts = []
    if user_role.grade_scope:
        scope_parts.append(f"Grade: {user_role.grade_scope.name}")
    if user_role.section_scope:
        scope_parts.append(f"Section: {user_role.section_scope.name}")
    if user_role.subject_scope:
        scope_parts.append(f"Subject: {user_role.subject_scope.name}")
    scope_desc = " | ".join(scope_parts) if scope_parts else "Full school access"
    
    # Build validity description
    validity = "No expiration"
    if user_role.valid_from or user_role.valid_until:
        validity = f"From {user_role.valid_from or 'now'} to {user_role.valid_until or 'indefinite'}"
    
    message = f"""
Hello {user.full_name or user.email},

You have been assigned the role "{role.name}" at {school.name}.

Role Details:
- Name: {role.name}
- Description: {role.description or 'N/A'}
- Permissions: {permissions_count} permission(s)
- Scope: {scope_desc}
- Validity: {validity}

Assigned by: {user_role.assigned_by.email if user_role.assigned_by else 'System'}

You can now access features based on your new permissions. Log in to the dashboard to explore your new capabilities.

If you believe this assignment was made in error, please contact your school administrator.

Best regards,
School-OS System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Role assignment notification sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send role assignment email to {user.email}: {e}")


def send_role_removal_notification(user_role: UserRole):
    """
    Send email to user when a role is removed from them.
    """
    user = user_role.user
    role = user_role.role
    school = user_role.school
    
    if not user.email:
        return
    
    subject = f"Role Removed: {role.name} - {school.name}"
    
    message = f"""
Hello {user.full_name or user.email},

Your role "{role.name}" at {school.name} has been removed.

If you have other roles assigned, those will continue to work. Otherwise, your access may be limited to basic features.

If you believe this was done in error, please contact your school administrator.

Best regards,
School-OS System
"""
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Role removal notification sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send role removal email to {user.email}: {e}")


@receiver(post_save, sender=RolePermissionLog)
def on_permission_change_logged(sender, instance, created, **kwargs):
    """
    When a permission change is logged, clear caches for affected users.
    """
    if not created:
        return
    
    role = instance.role
    if not role:
        return
    
    # Clear cache for all users with this role
    for user_role in role.user_assignments.filter(is_active=True):
        clear_permission_cache(user_role.user, user_role.school)
