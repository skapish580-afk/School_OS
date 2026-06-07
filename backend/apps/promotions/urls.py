from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PromotionBatchViewSet, PromotionAssignmentViewSet, AllocationAPIView, CommitAPIView, AcademicHistoryViewSet, MergedAcademicHistoryAPIView


router = DefaultRouter()
router.register(r'batches', PromotionBatchViewSet, basename='promotionbatch')
router.register(r'assignments', PromotionAssignmentViewSet, basename='promotionassignment')
router.register(r'academic-history', AcademicHistoryViewSet, basename='academichistory')


urlpatterns = [
    path('', include(router.urls)),
    path('merged-history/', MergedAcademicHistoryAPIView.as_view(), name='promotions-merged-history'),
    path('batches/<uuid:batch_pk>/allocate/', AllocationAPIView.as_view(), name='promotions-allocate'),
    path('batches/<uuid:batch_pk>/commit/', CommitAPIView.as_view(), name='promotions-commit'),
]
