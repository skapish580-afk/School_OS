from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthProfileViewSet, ClinicVisitViewSet

router = DefaultRouter()
router.register(r'profiles', HealthProfileViewSet)
router.register(r'visits', ClinicVisitViewSet)

urlpatterns = [
    path('', include(router.urls)),
]