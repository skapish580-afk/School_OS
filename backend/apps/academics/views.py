from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Count

from .models import (
    Section, Subject, SubjectMapping, Timetable, Period,
    Syllabus, Chapter, Exam, Result, ReportCard
)
from .serializers import (
    SectionListSerializer, SectionDetailSerializer, SectionSerializer,
    SubjectSerializer, SubjectMappingListSerializer, SubjectMappingDetailSerializer,
    TimetableSerializer, PeriodSerializer, SyllabusSerializer, ChapterSerializer,
    ExamSerializer, ResultSerializer, ReportCardSerializer
)
from apps.schools.models_programs import GradeConfiguration
from apps.schools.serializers_programs import GradeConfigurationSerializer
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin
from apps.accounts.permission_utils import RBACPermission


# ============================================================
# GRADE VIEW (Mapped to GradeConfiguration)
# ============================================================

class GradeViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing available grades.
    Mapped to GradeConfiguration for backward compatibility.
    """
    serializer_class = GradeConfigurationSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'program__school'
    
    def get_queryset(self):
        queryset = GradeConfiguration.objects.select_related('program', 'program__school')
        school_filter = self.get_school_filter()
        if school_filter:
            # school_filter is already {'program__school': user.school}
            queryset = queryset.filter(**school_filter)
        return queryset.order_by('grade_order')


# ============================================================
# SECTION VIEW
# ============================================================

class SectionViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'grade_config', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'section'
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SectionDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SectionSerializer
        return SectionListSerializer
    
    def get_queryset(self):
        queryset = Section.objects.prefetch_related('subject_mappings').select_related('grade_config', 'class_teacher')
        
        # Apply school isolation
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
            
        # Custom filter: handle 'grade' query parameter for backward compatibility
        grade_param = self.request.query_params.get('grade')
        if grade_param:
            queryset = queryset.filter(grade_config_id=grade_param)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_grade(self, request):
        """Get sections for a specific grade: /academics/sections/by_grade/?grade_id=<id>"""
        grade_id = request.query_params.get('grade_id') or request.query_params.get('grade')
        if not grade_id:
            return Response({'error': 'grade_id required'}, status=400)
        
        sections = self.get_queryset().filter(grade_config_id=grade_id, is_active=True)
        serializer = SectionListSerializer(sections, many=True)
        return Response(serializer.data)


# ============================================================
# SUBJECT VIEW
# ============================================================

class SubjectViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'is_core', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'subject'
    
    def perform_create(self, serializer):
        school = self.get_user_school()
        serializer.save(school=school)
    
    @action(detail=False, methods=['get'])
    def active_subjects(self, request):
        """Get all active subjects for user's school"""
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# ============================================================
# SUBJECT MAPPING VIEW
# ============================================================

class SubjectMappingViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'section', 'subject', 'is_active']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'subject'
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SubjectMappingDetailSerializer
        return SubjectMappingListSerializer
    
    def get_queryset(self):
        queryset = SubjectMapping.objects.select_related('subject', 'section', 'teacher')
        
        # Apply school isolation
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_section(self, request):
        """Get all subjects for a section: /academics/subject-mappings/by_section/?section_id=<id>"""
        section_id = request.query_params.get('section_id')
        if not section_id:
            return Response({'error': 'section_id required'}, status=400)
        
        mappings = self.get_queryset().filter(section_id=section_id, is_active=True)
        serializer = SubjectMappingListSerializer(mappings, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_teacher(self, request):
        """Get all subject assignments for a teacher: /academics/subject-mappings/by_teacher/?teacher_id=<id>"""
        teacher_id = request.query_params.get('teacher_id')
        if not teacher_id:
            return Response({'error': 'teacher_id required'}, status=400)
        
        mappings = self.get_queryset().filter(teacher_id=teacher_id, is_active=True)
        serializer = SubjectMappingListSerializer(mappings, many=True)
        return Response(serializer.data)


# ============================================================
# TIMETABLE VIEW
# ============================================================

class TimetableViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Timetable.objects.all()
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'section']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'timetable'
    
    @action(detail=False, methods=['get'])
    def for_section(self, request):
        """Get timetable for a section"""
        section_id = request.query_params.get('section_id')
        if not section_id:
            return Response({'error': 'section_id required'}, status=400)
        
        try:
            timetable = Timetable.objects.get(section_id=section_id)
            serializer = self.get_serializer(timetable)
            return Response(serializer.data)
        except Timetable.DoesNotExist:
            return Response({'error': 'Timetable not found'}, status=404)


class PeriodViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    serializer_class = PeriodSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['timetable', 'day']
    school_field = 'timetable__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'timetable'
    
    def get_queryset(self):
        return Period.objects.select_related('timetable', 'subject_mapping')
    
    @action(detail=False, methods=['get'])
    def by_timetable(self, request):
        """Get periods for a timetable"""
        timetable_id = request.query_params.get('timetable_id')
        if not timetable_id:
            return Response({'error': 'timetable_id required'}, status=400)
        
        periods = self.get_queryset().filter(timetable_id=timetable_id).order_by('day', 'period_number')
        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data)


# ============================================================
# SYLLABUS VIEW
# ============================================================

class SyllabusViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Syllabus.objects.all()
    serializer_class = SyllabusSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['school', 'subject_mapping', 'academic_year']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'syllabus'
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """Get detailed progress for a syllabus"""
        syllabus = self.get_object()
        chapters = syllabus.chapters.all()
        
        return Response({
            'total_chapters': chapters.count(),
            'completed': chapters.filter(status='COMPLETED').count(),
            'in_progress': chapters.filter(status='IN_PROGRESS').count(),
            'not_started': chapters.filter(status='NOT_STARTED').count(),
            'progress_percentage': syllabus.progress_percentage
        })


class ChapterViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['syllabus', 'status']
    school_field = 'syllabus__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'syllabus'
    
    def get_queryset(self):
        return Chapter.objects.select_related('syllabus', 'last_updated_by')
    
    @action(detail=True, methods=['patch'])
    def mark_complete(self, request, pk=None):
        """Mark a chapter as completed"""
        chapter = self.get_object()
        chapter.status = 'COMPLETED'
        chapter.last_updated_by = request.user
        chapter.save()
        
        serializer = self.get_serializer(chapter)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def mark_in_progress(self, request, pk=None):
        """Mark a chapter as in progress"""
        chapter = self.get_object()
        chapter.status = 'IN_PROGRESS'
        chapter.last_updated_by = request.user
        chapter.save()
        
        serializer = self.get_serializer(chapter)
        return Response(serializer.data)


# ============================================================
# EXAM VIEW
# ============================================================

class ExamViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['school', 'section', 'subject_mapping', 'exam_type', 'academic_year']
    school_field = 'school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'exam'
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming exams"""
        from django.utils import timezone
        exams = Exam.objects.filter(
            school_id=request.query_params.get('school'),
            exam_date__gte=timezone.now().date()
        ).order_by('exam_date')[:10]
        serializer = self.get_serializer(exams, many=True)
        return Response(serializer.data)


# ============================================================
# RESULT VIEW
# ============================================================

class ResultViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['exam', 'student']
    school_field = 'exam__school'
    
    # RBAC Configuration
    rbac_module = 'academics'
    rbac_resource = 'result'
    rbac_action_permissions = {
        'for_student': 'academics.view_result',
        'for_exam': 'academics.view_result',
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related('exam', 'student', 'recorded_by')
    
    @action(detail=False, methods=['get'])
    def for_student(self, request):
        """Get all results for a student"""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id required'}, status=400)
        
        results = self.get_queryset().filter(student_id=student_id).order_by('-exam__exam_date')
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def for_exam(self, request):
        """Get all results for an exam"""
        exam_id = request.query_params.get('exam_id')
        if not exam_id:
            return Response({'error': 'exam_id required'}, status=400)
        
        results = self.get_queryset().filter(exam_id=exam_id).order_by('-marks_obtained')
        
        # Calculate statistics
        total_results = results.count()
        absent_count = results.filter(is_absent=True).count()
        present_results = results.filter(is_absent=False)
        
        stats = {
            'total': total_results,
            'absent': absent_count,
            'present': present_results.count(),
            'average_marks': sum(r.marks_obtained for r in present_results) / max(present_results.count(), 1) if present_results.exists() else 0,
            'highest_marks': max((r.marks_obtained for r in present_results), default=0),
            'lowest_marks': min((r.marks_obtained for r in present_results), default=0),
        }
        
        serializer = self.get_serializer(results, many=True)
        return Response({
            'statistics': stats,
            'results': serializer.data
        })


# ============================================================
# REPORT CARD VIEW
# ============================================================

class ReportCardViewSet(SchoolIsolationMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportCardSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    filterset_fields = ['student', 'section', 'academic_year']
    school_field = 'student__school'
    
    # RBAC Configuration
    rbac_module = 'reports'
    rbac_resource = 'report_card'
    
    def get_queryset(self):
        return ReportCard.objects.select_related('student', 'section', 'generated_by')
    
    @action(detail=False, methods=['get'])
    def for_student(self, request):
        """Get all report cards for a student"""
        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({'error': 'student_id required'}, status=400)
        
        cards = self.get_queryset().filter(student_id=student_id).order_by('-generated_date')
        serializer = self.get_serializer(cards, many=True)
        return Response(serializer.data)