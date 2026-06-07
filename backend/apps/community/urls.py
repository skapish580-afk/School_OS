from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlumniDirectoryView, ForumPostViewSet, CommunitySchoolsView

router = DefaultRouter()
router.register(r'posts', ForumPostViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('alumni-directory/', AlumniDirectoryView.as_view(), name='alumni_directory'),
    path('schools/', CommunitySchoolsView.as_view(), name='community_schools'),
]
