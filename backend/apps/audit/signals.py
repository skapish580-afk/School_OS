from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.core.middleware import get_current_user
from apps.accounts.permission_utils import log_hierarchy_record_edit

EXCLUDED_MODELS = {
    'RecordHierarchyLog', 'AuditLog', 'Session', 'ContentType', 'Contenttype',
    'Permission', 'Group', 'Migration', 'LogEntry', 'Token', 'UserSession',
    'RolePermissionLog'
}

@receiver(post_save)
def auto_log_model_hierarchy_edit(sender, instance, created, **kwargs):
    """
    Automatic signal receiver that captures every model save across all modules
    and logs a RecordHierarchyLog entry with role_name, hierarchy_level, and edit summary.
    """
    model_name = sender.__name__
    app_label = getattr(sender._meta, 'app_label', '')
    
    if model_name in EXCLUDED_MODELS or app_label in ['admin', 'contenttypes', 'sessions', 'auth']:
        return
        
    user = get_current_user()
    
    # Fallback to model's user/author FK if set and thread-local user is not active
    if not user:
        for fk in ['created_by', 'last_updated_by', 'updated_by', 'recorded_by', 'assigned_by', 'user', 'actor']:
            if hasattr(instance, fk):
                val = getattr(instance, fk, None)
                if val is not None:
                    if hasattr(val, 'is_authenticated') and val.is_authenticated:
                        user = val
                        break
                    elif hasattr(val, 'user') and hasattr(val.user, 'is_authenticated') and val.user.is_authenticated:
                        user = val.user
                        break
                    
    if user and user.is_authenticated:
        action = 'CREATE' if created else 'UPDATE'
        summary = f"{'Created' if created else 'Updated'} {model_name} ({str(instance)[:100]})"
        log_hierarchy_record_edit(user, instance, action, changes_summary=summary)
