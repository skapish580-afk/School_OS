from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RouteViewSet, StopViewSet, VehicleViewSet, TransportAssignmentViewSet

router = DefaultRouter()
router.register(r'routes', RouteViewSet)
router.register(r'stops', StopViewSet)
router.register(r'vehicles', VehicleViewSet)
router.register(r'assignments', TransportAssignmentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
