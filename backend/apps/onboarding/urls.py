from django.urls import path
from .views import RegisterSchoolView, VerifyPaymentView

urlpatterns = [
    path('register/', RegisterSchoolView.as_view(), name='onboarding_register'),
    path('verify-payment/', VerifyPaymentView.as_view(), name='onboarding_verify'),
]
