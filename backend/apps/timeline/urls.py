from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TimelineMarkViewSet, TimelineRemarkViewSet, 
    TimelineHealthViewSet, StudentEnrollmentArchiveViewSet
)

router = DefaultRouter()
router.register('marks', TimelineMarkViewSet, basename='timeline-marks')
router.register('remarks', TimelineRemarkViewSet, basename='timeline-remarks')
router.register('health', TimelineHealthViewSet, basename='timeline-health')
router.register('archive', StudentEnrollmentArchiveViewSet, basename='timeline-archive')

urlpatterns = [
    path('', include(router.urls)),
]
