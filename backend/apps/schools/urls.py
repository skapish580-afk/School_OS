from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SchoolViewSet, SchoolSettingsViewSet
from .views_academic_config import (
    SchoolAcademicConfigViewSet, GradeTermConfigViewSet,
    ExamTypeViewSet, GradeExamStructureViewSet, CustomGradeScaleViewSet
)
from .views_calendar import HolidayViewSet, SchoolEventViewSet
from .views_dashboard import AdminNoteViewSet, BroadcastNotificationViewSet

router = DefaultRouter()

# Calendar - Holidays & Events (register BEFORE the empty prefix)
router.register(r'holidays', HolidayViewSet, basename='holiday')
router.register(r'events', SchoolEventViewSet, basename='school-event')

# Dashboard - Notes & Broadcasts
router.register(r'notes', AdminNoteViewSet, basename='admin-note')
router.register(r'broadcasts', BroadcastNotificationViewSet, basename='broadcast')

# Academic Configuration
router.register(r'academic-config', SchoolAcademicConfigViewSet, basename='academic-config')
router.register(r'term-configs', GradeTermConfigViewSet, basename='term-config')
router.register(r'exam-types', ExamTypeViewSet, basename='exam-type')
router.register(r'exam-structures', GradeExamStructureViewSet, basename='exam-structure')
router.register(r'grade-scales', CustomGradeScaleViewSet, basename='grade-scale')

# Settings
router.register(r'settings', SchoolSettingsViewSet, basename='school-settings')

# Base school viewset (register LAST since it has empty prefix)
router.register(r'', SchoolViewSet)

urlpatterns = [
    path('', include(router.urls)),
]