"""
School Academic Configuration API Views
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models_academic_config import (
    SchoolAcademicConfig, GradeTermConfig, ExamType,
    GradeExamStructure, CustomGradeScale
)
from .serializers_academic_config import (
    SchoolAcademicConfigSerializer, GradeTermConfigSerializer,
    ExamTypeSerializer, GradeExamStructureSerializer, CustomGradeScaleSerializer
)
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin


class SchoolAcademicConfigViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing school academic configuration.
    Only school admins can modify their school's config.
    """
    serializer_class = SchoolAcademicConfigSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        queryset = SchoolAcademicConfig.objects.select_related('school')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    @action(detail=False, methods=['get'])
    def my_config(self, request):
        """Get current user's school config, create if not exists."""
        user_school = get_user_school(request.user)
        if not user_school:
            return Response(
                {'error': 'No school associated with user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        config, created = SchoolAcademicConfig.objects.get_or_create(
            school=user_school,
            defaults={}
        )
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class GradeTermConfigViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for grade term configuration."""
    serializer_class = GradeTermConfigSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        queryset = GradeTermConfig.objects.select_related('school', 'grade')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    def perform_create(self, serializer):
        user_school = get_user_school(self.request.user)
        serializer.save(school=user_school)


class ExamTypeViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for custom exam types."""
    serializer_class = ExamTypeSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        queryset = ExamType.objects.select_related('school')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    def perform_create(self, serializer):
        user_school = get_user_school(self.request.user)
        serializer.save(school=user_school)
    
    @action(detail=False, methods=['post'], url_path='bulk-create-exams')
    def bulk_create_exams(self, request):
        """
        Bulk create exams for a grade and multiple subjects.
        
        Request body:
        {
            "exam_type_id": "uuid",
            "grade_id": "uuid",
            "subject_ids": ["uuid1", "uuid2"],
            "academic_year": "2025-2026"
        }
        """
        from apps.academics.models import Exam, Subject
        
        exam_type_id = request.data.get('exam_type_id')
        grade_id = request.data.get('grade_id')
        subject_ids = request.data.get('subject_ids', [])
        academic_year = request.data.get('academic_year', '2025-2026')
        
        user_school = get_user_school(request.user)
        if not user_school:
            return Response(
                {'error': 'No school associated with user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate exam type exists and belongs to user's school
        try:
            exam_type = ExamType.objects.get(id=exam_type_id, school=user_school)
        except ExamType.DoesNotExist:
            return Response(
                {'error': 'Exam type not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate grade exists
        try:
            grade = Grade.objects.get(id=grade_id)
        except Grade.DoesNotExist:
            return Response(
                {'error': 'Grade not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate subjects exist
        subjects = Subject.objects.filter(id__in=subject_ids)
        if subjects.count() != len(subject_ids):
            return Response(
                {'error': 'Some subjects not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all sections for the grade
        from apps.academics.models import Section
        sections = Section.objects.filter(grade=grade).order_by('name')
        
        if not sections.exists():
            return Response(
                {'error': f'No sections found for grade {grade.grade_name}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create exams for each subject-section combination
        created_exams = []
        for subject in subjects:
            for section in sections:
                exam_name = f"{exam_type.name} - {subject.name} {grade.grade_name} {section.name}"
                
                exam, created = Exam.objects.get_or_create(
                    name=exam_name,
                    exam_type=exam_type,
                    grade=grade,
                    section=section,
                    subject=subject,
                    academic_year=academic_year,
                    defaults={
                        'school': user_school,
                        'max_marks': exam_type.max_marks or 100,
                        'passing_marks': int((exam_type.passing_marks_percent or 33) / 100 * (exam_type.max_marks or 100)),
                        'status': 'DRAFT'
                    }
                )
                
                if created:
                    created_exams.append({
                        'id': str(exam.id),
                        'name': exam.name,
                        'subject': subject.name,
                        'section': section.name,
                        'max_marks': exam.max_marks,
                        'passing_marks': exam.passing_marks
                    })
        
        return Response({
            'success': True,
            'message': f'Created {len(created_exams)} exams',
            'created_exams': created_exams
        }, status=status.HTTP_201_CREATED)


class GradeExamStructureViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for grade exam structure."""
    serializer_class = GradeExamStructureSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        queryset = GradeExamStructure.objects.select_related('school', 'grade', 'exam_type')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    def perform_create(self, serializer):
        user_school = get_user_school(self.request.user)
        serializer.save(school=user_school)


class CustomGradeScaleViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """ViewSet for custom grade scales."""
    serializer_class = CustomGradeScaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        queryset = CustomGradeScale.objects.select_related('school')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    def perform_create(self, serializer):
        user_school = get_user_school(self.request.user)
        serializer.save(school=user_school)
