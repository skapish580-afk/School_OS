from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models_calendar import Holiday, SchoolEvent
from .serializers_calendar import HolidaySerializer, SchoolEventSerializer
from apps.core.school_isolation import get_user_school

class HolidayViewSet(viewsets.ModelViewSet):
    """ViewSet for school holidays"""
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated]

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
        serializer.save(school=school)


class SchoolEventViewSet(viewsets.ModelViewSet):
    """ViewSet for school events"""
    serializer_class = SchoolEventSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        serializer.save(school=school)
