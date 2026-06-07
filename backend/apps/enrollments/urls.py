from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EnrollmentViewSet
from .views_promotion import (
    AcademicYearViewSet, PromotionRuleViewSet, 
    PromotionBatchViewSet, DataCarryForwardViewSet,
    MergedHistoryViewSet
)

router = DefaultRouter()
router.register(r'academic-years', AcademicYearViewSet, basename='academic-year')
router.register(r'promotion-rules', PromotionRuleViewSet, basename='promotion-rule')
router.register(r'promotion-batches', PromotionBatchViewSet, basename='promotion-batch')
router.register(r'carry-forward', DataCarryForwardViewSet, basename='carry-forward')
router.register(r'student-enrollments', EnrollmentViewSet, basename='student-enrollment')
# Custom endpoint for history tab
router.register(r'promotions', MergedHistoryViewSet, basename='promotion-history')

urlpatterns = [
    path('', include(router.urls)),
]