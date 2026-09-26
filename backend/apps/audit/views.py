from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer

class IsSuperOrStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user = request.user
        return (
            getattr(user, 'is_superuser', False) or
            getattr(user, 'is_staff', False) or
            getattr(user, 'role', '') in ['SUPER_ADMIN', 'OWNER', 'PLATFORM_ADMIN']
        )

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-Only View for System History & Global Activity Stream.
    """
    queryset = AuditLog.objects.select_related('actor', 'content_type').all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperOrStaff]
    filterset_fields = ['actor', 'action', 'timestamp']