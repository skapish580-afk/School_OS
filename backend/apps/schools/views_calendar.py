from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models_calendar import Holiday, SchoolEvent
from .serializers_calendar import HolidaySerializer, SchoolEventSerializer
from apps.core.school_isolation import get_user_school

class CalendarActionPermission(permissions.BasePermission):
    """
    Custom permission to restrict create/delete/update actions on calendar.
    - list/retrieve: allowed for all authenticated users
    - create/update/destroy: requires calendar.manage_holiday or calendar.manage_event
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
            
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        # Determine permission based on resource type
        is_holiday = view.__class__.__name__ == 'HolidayViewSet'
        required_perm = 'calendar.manage_holiday' if is_holiday else 'calendar.manage_event'
        
        from apps.accounts.permission_utils import has_permission
        return has_permission(user, required_perm)

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True


from apps.core.school_isolation import SchoolIsolationMixin


class HolidayViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for school holidays"""
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated, CalendarActionPermission]

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school:
            return Holiday.objects.filter(school=school)
        return Holiday.objects.none()

    def perform_create(self, serializer):
        school = get_user_school(self.request.user)
        if not school:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("User not associated with a school.")
        instance = serializer.save(school=school)
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        log_hierarchy_record_edit(self.request.user, instance, 'CREATE', f"Created Holiday ({instance})", school=school)

    def perform_update(self, serializer):
        instance = serializer.save()
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        log_hierarchy_record_edit(self.request.user, instance, 'UPDATE', f"Updated Holiday ({instance})")


class SchoolEventViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for school events"""
    serializer_class = SchoolEventSerializer
    permission_classes = [permissions.IsAuthenticated, CalendarActionPermission]

    def get_queryset(self):
        school = get_user_school(self.request.user)
        if school:
            return SchoolEvent.objects.filter(school=school)
        return SchoolEvent.objects.none()

    def perform_create(self, serializer):
        school = get_user_school(self.request.user)
        if not school:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("User not associated with a school.")
        instance = serializer.save(school=school)
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        log_hierarchy_record_edit(self.request.user, instance, 'CREATE', f"Created School Event ({instance})", school=school)

    def perform_update(self, serializer):
        instance = serializer.save()
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        log_hierarchy_record_edit(self.request.user, instance, 'UPDATE', f"Updated School Event ({instance})")

