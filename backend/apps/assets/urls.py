from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, AssetAssignmentViewSet, AssetScheduleViewSet, AssetSaleViewSet

router = DefaultRouter()
router.register(r'list', AssetViewSet)
router.register(r'assignments', AssetAssignmentViewSet)
router.register(r'schedules', AssetScheduleViewSet)
router.register(r'sales', AssetSaleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
