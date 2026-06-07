from django.contrib.contenttypes.models import ContentType
from .models import AuditLog

def log_action(user, action, target_object, details="", ip=None):
    """
    Universal function to record an event.
    Usage: log_action(request.user, 'UPDATE', mark_instance, "Changed score from 80 to 90")
    """
    if not user.is_authenticated:
        return

    AuditLog.objects.create(
        actor=user,
        action=action,
        content_type=ContentType.objects.get_for_model(target_object),
        object_id=str(target_object.pk),
        details=details,
        ip_address=ip
    )