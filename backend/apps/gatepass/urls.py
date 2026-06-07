from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GatePassViewSet, GatePassVerificationView, GatePassVerifyAPIView
from .views_approval import approve_gatepass, reject_gatepass, pending_gatepasses

router = DefaultRouter()
router.register(r'passes', GatePassViewSet)

urlpatterns = [
    path('verify/', GatePassVerificationView.as_view(), name='verify_gatepass'),
    path('passes/verify_api/', GatePassVerifyAPIView.as_view(), name='verify_gatepass_api'),
    path('pending/', pending_gatepasses, name='pending_gatepasses'),
    path('<uuid:gatepass_id>/approve/', approve_gatepass, name='approve_gatepass'),
    path('<uuid:gatepass_id>/reject/', reject_gatepass, name='reject_gatepass'),
    path('', include(router.urls)),
]