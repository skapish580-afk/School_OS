from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GradeViewSet, SectionViewSet, SubjectViewSet, SubjectMappingViewSet,
    TimetableViewSet, PeriodViewSet, SyllabusViewSet, ChapterViewSet,
    ExamViewSet, ResultViewSet, ReportCardViewSet
)
from .views_exam_scheme import (
    ExamSchemeViewSet, ExamViewSet as SchemeExamViewSet, 
    ExamInstanceViewSet, StudentResultViewSet
)
from .views_marks import (
    teacher_exam_list, exam_marks_entry, marks_summary,
    compute_promotion, finalize_promotion, get_promotion_decision
)
from .views_assignments import AssignmentViewSet, AssignmentSubmissionViewSet

router = DefaultRouter()

# Class & Section Management
router.register(r'grades', GradeViewSet, basename='grade')
router.register(r'sections', SectionViewSet, basename='section')

# Subject Management
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'subject-mappings', SubjectMappingViewSet, basename='subject-mapping')

# Timetable Management
router.register(r'timetables', TimetableViewSet, basename='timetable')
router.register(r'periods', PeriodViewSet, basename='period')

# Syllabus Management
router.register(r'syllabuses', SyllabusViewSet, basename='syllabus')
router.register(r'chapters', ChapterViewSet, basename='chapter')

# Exam & Result Management
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'results', ResultViewSet, basename='result')
router.register(r'report-cards', ReportCardViewSet, basename='report-card')

# NEW: Exam Scheme Management (Industry-standard blueprint system)
router.register(r'exam-schemes', ExamSchemeViewSet, basename='exam-scheme')
router.register(r'exam-instances', ExamInstanceViewSet, basename='exam-instance')
router.register(r'student-results', StudentResultViewSet, basename='student-result')

# Assignment Management
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'submissions', AssignmentSubmissionViewSet, basename='submission')

urlpatterns = [
    path('', include(router.urls)),
    
    # Professional Marks Management URLs
    path('teacher/exams/', teacher_exam_list, name='teacher-exam-list'),
    path('teacher/exams/<uuid:exam_id>/marks/', exam_marks_entry, name='exam-marks-entry'),
    path('teacher/marks-summary/', marks_summary, name='marks-summary'),
    
    # Promotion & Result Status APIs
    path('promotion/<uuid:student_id>/compute/', compute_promotion, name='compute-promotion'),
    path('promotion/<uuid:student_id>/finalize/', finalize_promotion, name='finalize-promotion'),
    path('promotion/<uuid:student_id>/', get_promotion_decision, name='get-promotion-decision'),
]