from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TeacherViewSet, TeacherSchoolAssociationViewSet, 
    TeacherAssignmentViewSet, RemarkViewSet,
    teacher_profile, student_detail
)
from .views_efficiency import TeacherEfficiencyViewSet
from .views_upload import upload_photo
from .views_class_teacher import class_teacher_dashboard, class_student_details
from .views_search import smart_search, quick_student_search, get_class_students

router = DefaultRouter()
router.register(r'profiles', TeacherViewSet)
router.register(r'associations', TeacherSchoolAssociationViewSet)
router.register(r'assignments', TeacherAssignmentViewSet)
router.register(r'remarks', RemarkViewSet)
router.register(r'efficiency', TeacherEfficiencyViewSet, basename='teacher-efficiency')

urlpatterns = [
    path('me/', teacher_profile, name='teacher_profile'),
    path('me/upload-photo/', upload_photo, name='upload_photo'),
    path('my-classes/', lambda request: Response(TeacherAssignment.objects.filter(teacher__user=request.user, is_active=True).values('id', 'grade', 'section', 'role', 'subject')), name='my_classes'),
    path('students/<int:student_id>/', student_detail, name='student_detail'),
    
    # Smart search endpoints
    path('search/', smart_search, name='smart_search'),
    path('search/students/quick/', quick_student_search, name='quick_student_search'),
    path('students/by-class/', get_class_students, name='get_class_students'),
    
    # Class teacher endpoints
    path('class-teacher/dashboard/', class_teacher_dashboard, name='class_teacher_dashboard'),
    path('class-teacher/student/<uuid:student_id>/', class_student_details, name='class_student_details'),
    
    path('', include(router.urls)),
]
