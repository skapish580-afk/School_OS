"""
Check for expired role assignments and deactivate them.

Usage:
    python manage.py expire_roles
    
Can be run daily via cron job or scheduled task.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.rbac_models import UserRole
from apps.accounts.signals import send_role_removal_notification
from apps.accounts.permission_utils import clear_permission_cache
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Deactivate expired role assignments'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deactivated without making changes'
        )
        parser.add_argument(
            '--notify',
            action='store_true',
            help='Send email notifications to users whose roles expired'
        )
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        notify = options['notify']
        today = timezone.now().date()
        
        # Find all expired but still active role assignments
        expired_roles = UserRole.objects.filter(
            is_active=True,
            valid_until__lt=today
        ).select_related('user', 'role', 'school')
        
        count = expired_roles.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired role assignments found.'))
            return
        
        self.stdout.write(f'Found {count} expired role assignment(s):')
        
        for user_role in expired_roles:
            self.stdout.write(
                f'  - {user_role.user.email}: {user_role.role.name} @ {user_role.school.name} '
                f'(expired {user_role.valid_until})'
            )
            
            if not dry_run:
                # Deactivate the role
                user_role.is_active = False
                user_role.save(update_fields=['is_active'])
                
                # Clear permission cache
                clear_permission_cache(user_role.user, user_role.school)
                
                # Send notification if requested
                if notify:
                    try:
                        send_role_removal_notification(user_role)
                        self.stdout.write(f'    ✓ Notification sent to {user_role.user.email}')
                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(f'    ⚠ Failed to send notification: {e}')
                        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'\nDry run - no changes made. Run without --dry-run to deactivate.')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'\n✓ Deactivated {count} expired role assignment(s).')
            )
