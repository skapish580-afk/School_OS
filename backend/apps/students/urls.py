from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, teacher_remarks

router = DefaultRouter()
router.register(r'', StudentViewSet)

urlpatterns = [
    path('export/', StudentViewSet.as_view({'get': 'export'}), name='student-export'),
    path('teacher-remarks/', teacher_remarks, name='teacher-remarks'),
    path('', include(router.urls)),
]