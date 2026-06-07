from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchoolSubscriptionViewSet, FeatureAccessViewSet,
    UsageMetricViewSet, PlatformAuditLogViewSet
)

router = DefaultRouter()
router.register(r'subscriptions', SchoolSubscriptionViewSet, basename='subscription')
router.register(r'features', FeatureAccessViewSet, basename='feature')
router.register(r'metrics', UsageMetricViewSet, basename='metric')
router.register(r'audit-logs', PlatformAuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
