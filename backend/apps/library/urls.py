from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BookViewSet, IssueReturnLogViewSet, LibraryClearanceViewSet, 
    StockAuditViewSet, LibraryVisitorLogViewSet, LibraryPolicyViewSet
)

router = DefaultRouter()
router.register(r'books', BookViewSet)
router.register(r'logs', IssueReturnLogViewSet)
router.register(r'clearance', LibraryClearanceViewSet)
router.register(r'audits', StockAuditViewSet)
router.register(r'visitor-logs', LibraryVisitorLogViewSet)
router.register(r'policy', LibraryPolicyViewSet, basename='library-policy')

urlpatterns = [
    path('', include(router.urls)),
]
