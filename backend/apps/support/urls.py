from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupportTicketViewSet, SupportHierarchyViewSet

router = DefaultRouter()
router.register(r'tickets', SupportTicketViewSet, basename='support-ticket')

urlpatterns = [
    # Hierarchy endpoints for Super Admin drilldown
    path('hierarchy/schools/', SupportHierarchyViewSet.as_view({'get': 'schools'}), name='hierarchy-schools'),
    path('hierarchy/schools/<uuid:pk>/teachers/', SupportHierarchyViewSet.as_view({'get': 'teachers'}), name='hierarchy-teachers'),
    path('hierarchy/schools/<uuid:pk>/students/', SupportHierarchyViewSet.as_view({'get': 'students'}), name='hierarchy-students'),
    
    path('', include(router.urls)),
]
