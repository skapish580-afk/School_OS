from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DisciplineViewSet
from .views_karma import StudentKarmaViewSet, get_student_karma_summary, bulk_add_karma

router = DefaultRouter()
# REGISTER THE VIEWSETS
router.register(r'records', DisciplineViewSet, basename='discipline')
router.register(r'incidents', DisciplineViewSet, basename='incidents')  # Alias for frontend
router.register(r'karma', StudentKarmaViewSet, basename='karma')

urlpatterns = [
    # Direct access to karma_history at root level for frontend compatibility
    path('karma_history/', DisciplineViewSet.as_view({'get': 'karma_history'}), name='karma_history'),
    path('scorecard/', DisciplineViewSet.as_view({'get': 'scorecard'}), name='scorecard'),
    path('award_karma/', DisciplineViewSet.as_view({'post': 'award_karma'}), name='award_karma'),
    path('summary/', DisciplineViewSet.as_view({'get': 'summary'}), name='summary'),
    path('karma/student/<uuid:student_id>/summary/', get_student_karma_summary, name='student_karma_summary'),
    path('karma/bulk-add/', bulk_add_karma, name='bulk_add_karma'),
    path('', include(router.urls)),
]