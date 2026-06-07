from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceViewSet
from .views_teacher import get_class_students, mark_attendance_bulk
from .views_class_teacher import (
    get_class_full_day_attendance, 
    edit_attendance_record, 
    get_attendance_edit_history,
    bulk_edit_attendance
)

router = DefaultRouter()
router.register(r'', AttendanceViewSet)

urlpatterns = [
    path('export/', AttendanceViewSet.as_view({'get': 'export'}), name='attendance-export'),
    # Subject teacher endpoints
    path('class/<uuid:assignment_id>/period/<int:period>/students/', get_class_students, name='get_class_students'),
    path('mark-bulk/', mark_attendance_bulk, name='mark_attendance_bulk'),
    
    # Class teacher endpoints
    path('class-teacher/<str:grade>/<str:section>/full-day/', get_class_full_day_attendance, name='class_full_day_attendance'),
    path('edit/<uuid:attendance_id>/', edit_attendance_record, name='edit_attendance'),
    path('<uuid:attendance_id>/history/', get_attendance_edit_history, name='attendance_history'),
    path('bulk-edit/', bulk_edit_attendance, name='bulk_edit_attendance'),
    
    path('', include(router.urls)),
]