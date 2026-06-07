from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from apps.schools.models import ExamType
from apps.academics.models import Exam, Subject, Section
from apps.core.school_isolation import SchoolIsolationMixin, IsSchoolAdminOrPlatformAdmin
from django.core.exceptions import ValidationError


class ExamTypeViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    API for managing exam types per school.
    School admins can define custom exam types (Unit Test, Mid-Term, Final, etc.)
    """
    serializer_class = None  # Will define below
    permission_classes = [IsAuthenticated, IsSchoolAdminOrPlatformAdmin]
    school_field = 'school_id'
    
    def get_queryset(self):
        from apps.core.school_isolation import get_user_school, is_platform_admin
        user = self.request.user
        
        if is_platform_admin(user):
            return ExamType.objects.all()
        
        user_school = get_user_school(user)
        if user_school:
            return ExamType.objects.filter(school_id=user_school.id)
        return ExamType.objects.none()
    
    def get_serializer(self, *args, **kwargs):
        from apps.schools.serializers_academic_config import ExamTypeSerializer
        return ExamTypeSerializer(*args, **kwargs)
    
    def perform_create(self, serializer):
        from apps.core.school_isolation import get_user_school
        user = self.request.user
        user_school = get_user_school(user)
        serializer.save(school=user_school)


class BulkExamCreationViewSet(viewsets.ViewSet):
    """
    Bulk exam creation for a grade across all sections.
    Admin selects exam types, grade, and subjects, then creates exams for all sections at once.
    """
    permission_classes = [IsAuthenticated, IsSchoolAdminOrPlatformAdmin]
    
    @action(detail=False, methods=['post'], url_path='bulk-create-exams')
    def bulk_create_exams(self, request):
        """
        Create exams for multiple subjects and sections at once.
        
        Request body:
        {
            "exam_type_id": "uuid",
            "grade_id": "uuid",
            "subject_ids": ["uuid1", "uuid2"],
            "max_marks": 100,
            "passing_marks": 33,
            "academic_year": "2025-2026"
        }
        """
        from apps.core.school_isolation import get_user_school, is_platform_admin
        
        user = self.request.user
        user_school = get_user_school(user)
        
        if not user_school:
            return Response(
                {"error": "School not assigned to user"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            exam_type_id = request.data.get('exam_type_id')
            grade_id = request.data.get('grade_id')
            subject_ids = request.data.get('subject_ids', [])
            max_marks = request.data.get('max_marks', 100)
            passing_marks = request.data.get('passing_marks', 33)
            academic_year = request.data.get('academic_year', '2025-2026')
            
            # Validate exam type belongs to school
            exam_type = ExamType.objects.get(id=exam_type_id, school=user_school)
            
            # Validate grade
            grade = Grade.objects.get(id=grade_id)
            
            # Validate subjects belong to school
            subjects = Subject.objects.filter(
                id__in=subject_ids,
                school=user_school
            )
            
            if subjects.count() != len(subject_ids):
                return Response(
                    {"error": "Some subjects not found or don't belong to your school"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get all sections for the grade
            sections = Section.objects.filter(grade=grade, school=user_school)
            
            if not sections.exists():
                return Response(
                    {"error": f"No sections found for grade {grade.grade_name}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create exams in transaction
            created_exams = []
            with transaction.atomic():
                for subject in subjects:
                    for section in sections:
                        exam = Exam.objects.create(
                            exam_type=exam_type,
                            subject=subject,
                            grade=grade,
                            section=section,
                            max_marks=max_marks,
                            passing_marks=passing_marks,
                            academic_year=academic_year,
                            school=user_school
                        )
                        created_exams.append({
                            'id': str(exam.id),
                            'name': f"{exam_type.name} - {subject.subject_name} {grade.grade_name} {section.section_name}",
                            'subject': subject.subject_name,
                            'section': section.section_name
                        })
            
            return Response({
                'success': True,
                'message': f'Created {len(created_exams)} exams',
                'created_exams': created_exams
            }, status=status.HTTP_201_CREATED)
            
        except ExamType.DoesNotExist:
            return Response(
                {"error": "Exam type not found or doesn't belong to your school"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Grade.DoesNotExist:
            return Response(
                {"error": "Grade not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
