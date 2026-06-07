from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchoolManagementViewSet,
    SchoolAdminManagementViewSet,
    FeatureControlViewSet,
    PlatformStatsView,
    OwnerAuditLogViewSet
)
from .views_onboarding import (
    OnboardingViewSet,
    CampusViewSet,
    AcademicProgramViewSet,
    GradeConfigurationViewSet
)

router = DefaultRouter()
router.register(r'schools', SchoolManagementViewSet, basename='school')
router.register(r'admins', SchoolAdminManagementViewSet, basename='admin')
router.register(r'features', FeatureControlViewSet, basename='feature')
router.register(r'audit', OwnerAuditLogViewSet, basename='audit')

# Onboarding endpoints
router.register(r'onboarding', OnboardingViewSet, basename='onboarding')
router.register(r'campuses', CampusViewSet, basename='campus')
router.register(r'programs', AcademicProgramViewSet, basename='program')
router.register(r'grades', GradeConfigurationViewSet, basename='grade')

urlpatterns = [
    path('stats/', PlatformStatsView.as_view(), name='stats'),
    path('', include(router.urls)),
]
