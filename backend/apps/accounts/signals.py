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
    If the user is a teacher, send using school SMTP credentials (gatepass settings)
    with the role's username/password.
    """
    user = user_role.user
    role = user_role.role
    school = user_role.school
    
    if not user.email:
        return
    
    # Check if school email notifications are enabled
    try:
        from apps.schools.models_settings import SchoolSettings
        school_settings = SchoolSettings.objects.filter(school=school).first()
        if school_settings and not getattr(school_settings, 'email_notifications', True):
            logger.info(f"Skipping role assignment email for {user.email} because email notifications are globally disabled for school {school.name}")
            return
    except Exception as e:
        logger.error(f"Error checking email settings: {e}")
        school_settings = None

    # Check if user is a teacher (taken from teachers module)
    is_teacher = False
    teacher_email = None
    try:
        from apps.teachers.models import Teacher
        teacher = Teacher.objects.filter(user=user).first()
        if teacher:
            is_teacher = True
            teacher_email = teacher.user.email
    except Exception as e:
        logger.error(f"Error checking teacher profile: {e}")

    if is_teacher and teacher_email:
        # Teacher flow: send using SMTP settings just like gate pass
        sender_email = getattr(school_settings, 'gatepass_sender_email', None) if school_settings else None
        password = getattr(school_settings, 'gatepass_app_password', None) if school_settings else None

        role_username = getattr(role, 'username', 'N/A') or 'N/A'
        role_password = getattr(role, 'plain_password', 'N/A') or 'N/A'

        subject = f"Official Notification: Role Assigned - {role.name}"
        body = (
            f"Dear Teacher,\n\n"
            f"This is an official message from {school.name} stating that you have been assigned a role.\n\n"
            f"Role Name: {role.name}\n"
            f"Description: {role.description or 'N/A'}\n\n"
            f"Login credentials of that role:\n"
            f"Username: {role_username}\n"
            f"Password: {role_password}\n\n"
            f"Regards,\n"
            f"{school.name} Administration"
        )

        if sender_email and password:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            message = MIMEMultipart()
            message['From'] = sender_email
            message['To'] = teacher_email
            message['Subject'] = subject
            message.attach(MIMEText(body, 'plain'))

            try:
                # Use 465 for SSL (just like gate pass)
                server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
                server.login(sender_email, password)
                server.send_message(message)
                logger.info(f"Role assignment email sent successfully via SMTP to teacher: {teacher_email}")
                return
            except Exception as e:
                logger.error(f"SMTP Error sending role assignment email to teacher: {e}")
                # Fallback to standard Django send_mail below on SMTP failure
            finally:
                try:
                    server.quit()
                except:
                    pass

        # Fallback to send_mail if custom SMTP credentials are missing or fail
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[teacher_email],
                fail_silently=False,
            )
            logger.info(f"Role assignment notification sent to teacher {teacher_email} using default mail server")
        except Exception as e:
            logger.error(f"Failed to send role assignment email to teacher {teacher_email}: {e}")
        return

    # Non-teacher flow: default email notification
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
    
    # Check if school email notifications are enabled
    try:
        from apps.schools.models_settings import SchoolSettings
        school_settings = SchoolSettings.objects.filter(school=school).first()
        if school_settings and not getattr(school_settings, 'email_notifications', True):
            logger.info(f"Skipping role removal email for {user.email} because email notifications are globally disabled for school {school.name}")
            return
    except Exception as e:
        logger.error(f"Error checking email settings: {e}")
    
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
