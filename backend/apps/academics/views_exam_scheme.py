"""
Views for Exam Scheme system
Industry-standard exam blueprint approach

Admin Flow:
1. Create ExamScheme (blueprint)
2. Create Exams within scheme
3. Map subjects to exams (ExamSubject)
4. Auto-generate ExamInstances
5. Teachers enter marks in StudentResult

Teacher Flow:
1. See assigned ExamInstances
2. Enter marks for all students in section
3. Submit for approval
4. Admin reviews & publishes
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.db.models import Count, Q, F

from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin
from apps.academics.models import Subject, Section, Student
from .models_exam_scheme import (
    ExamScheme, SchemeExam, ExamSubject, ExamInstance, StudentResult
)
from .serializers_exam_scheme import (
    ExamSchemeListSerializer, ExamSchemeDetailSerializer,
    SchemeExamSerializer, ExamSubjectSerializer,
    ExamInstanceListSerializer, StudentResultListSerializer,
    StudentResultDetailSerializer
)


class ExamSchemeViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    ADMIN ENDPOINT: Manage exam schemes (blueprints)
    
    /api/v1/academics/exam-schemes/
    - GET: List schemes for admin's school
    - POST: Create new scheme
    - PUT/DELETE: Update/delete schemes
    """
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ExamSchemeDetailSerializer
        return ExamSchemeListSerializer
    
    def get_queryset(self):
        queryset = ExamScheme.objects.select_related('school', 'grade').prefetch_related('exams')
        
        user = self.request.user
        if is_platform_admin(user):
            return queryset
        
        user_school = get_user_school(user)
        if user_school:
            return queryset.filter(school=user_school)
        return queryset.none()
    
    def perform_create(self, serializer):
        """Auto-set school from user"""
        user_school = get_user_school(self.request.user)
        serializer.save(school=user_school, created_by=self.request.user)
    
    def perform_update(self, serializer):
        """Prevent editing published schemes"""
        if serializer.instance.is_published:
            raise ValidationError("Cannot edit published exam schemes")
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish an exam scheme (lock for editing)"""
        scheme = self.get_object()
        
        if scheme.is_published:
            return Response(
                {'error': 'Scheme already published'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation: Scheme must have exams
        if not scheme.exams.exists():
            return Response(
                {'error': 'Scheme must have at least one exam'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation: Each exam must have subject mappings
        for exam in scheme.exams.all():
            if not exam.subject_mappings.exists():
                return Response(
                    {'error': f'Exam "{exam.name}" has no subject mappings'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        scheme.is_published = True
        scheme.save()
        
        return Response(
            {'message': 'Exam scheme published successfully'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def generate_instances(self, request, pk=None):
        """
        Auto-generate ExamInstances for all sections
        
        Creates one instance per:
        - Exam in scheme
        - Subject (from ExamSubject mapping)
        - Section in the grade
        """
        scheme = self.get_object()
        
        if not scheme.is_published:
            return Response(
                {'error': 'Can only generate instances from published schemes'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_count = 0
        errors = []
        
        try:
            with transaction.atomic():
                # Get all sections for this grade
                sections = Section.objects.filter(grade=scheme.grade)
                
                if not sections.exists():
                    return Response(
                        {'error': 'No sections found for this grade'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # For each exam in scheme
                for exam in scheme.exams.all():
                    # For each subject mapped to this exam
                    for exam_subject in exam.subject_mappings.all():
                        # For each section in grade
                        for section in sections:
                            instance, created = ExamInstance.objects.get_or_create(
                                exam=exam,
                                subject=exam_subject.subject,
                                section=section,
                                defaults={
                                    'grade': scheme.grade,
                                    'school': scheme.school,
                                    'status': 'DRAFT'
                                }
                            )
                            if created:
                                created_count += 1
        
        except Exception as e:
            return Response(
                {'error': f'Failed to generate instances: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'message': f'Generated {created_count} exam instances',
            'created_count': created_count,
            'total_instances': ExamInstance.objects.filter(
                exam__scheme=scheme
            ).count()
        }, status=status.HTTP_201_CREATED)


class ExamViewSet(viewsets.ModelViewSet):
    """
    ADMIN ENDPOINT: Manage exams within a scheme
    
    /api/v1/academics/exam-schemes/{scheme_id}/exams/
    """
    serializer_class = SchemeExamSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        scheme_id = self.kwargs.get('scheme_id')
        return SchemeExam.objects.filter(scheme_id=scheme_id).order_by('sequence')
    
    def get_scheme(self):
        """Get scheme and verify access"""
        scheme_id = self.kwargs.get('scheme_id')
        try:
            scheme = ExamScheme.objects.get(id=scheme_id)
            user_school = get_user_school(self.request.user)
            
            if not is_platform_admin(self.request.user) and scheme.school != user_school:
                raise PermissionDenied("Access denied")
            
            return scheme
        except ExamScheme.DoesNotExist:
            raise ValidationError("Exam scheme not found")
    
    def perform_create(self, serializer):
        scheme = self.get_scheme()
        if scheme.is_published:
            raise ValidationError("Cannot add exams to published schemes")
        serializer.save(scheme=scheme)
    
    @action(detail=True, methods=['post'])
    def map_subjects(self, request, scheme_id=None, pk=None):
        """Map subjects to an exam"""
        exam = self.get_object()
        scheme = self.get_scheme()
        
        if scheme.is_published:
            raise ValidationError("Cannot modify subject mappings in published schemes")
        
        subject_ids = request.data.get('subject_ids', [])
        
        if not subject_ids:
            return Response(
                {'error': 'No subjects provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Clear existing mappings
        exam.subject_mappings.all().delete()
        
        # Create new mappings
        subjects = Subject.objects.filter(id__in=subject_ids)
        created = []
        
        for i, subject in enumerate(subjects):
            mapping = ExamSubject.objects.create(
                exam=exam,
                subject=subject,
                sequence=i
            )
            created.append({
                'id': str(mapping.id),
                'subject': subject.name
            })
        
        return Response({
            'message': f'Mapped {len(created)} subjects to exam',
            'mappings': created
        }, status=status.HTTP_201_CREATED)


class ExamInstanceViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    TEACHER ENDPOINT: View exam instances and enter marks
    
    /api/v1/academics/exam-instances/
    Teachers see instances assigned to their sections
    """
    serializer_class = ExamInstanceListSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin sees all instances
        if is_platform_admin(user):
            return ExamInstance.objects.select_related(
                'exam', 'subject', 'section', 'grade', 'school'
            ).all()
        
        user_school = get_user_school(user)
        if not user_school:
            return ExamInstance.objects.none()
        
        # Teacher sees instances for their assigned subjects
        from apps.academics.models import SubjectMapping
        teacher_mappings = SubjectMapping.objects.filter(
            teacher=user.teacher
        ).values('subject', 'section')
        
        query = Q()
        for mapping in teacher_mappings:
            query |= Q(subject_id=mapping['subject'], section_id=mapping['section'])
        
        return ExamInstance.objects.filter(
            school=user_school
        ).filter(query).select_related(
            'exam', 'subject', 'section', 'grade', 'school'
        )
    
    @action(detail=True, methods=['get'])
    def student_results(self, request, pk=None):
        """Get student results for marking"""
        instance = self.get_object()
        
        # Verify teacher is assigned to this section-subject
        self._verify_teacher_access(instance)
        
        results = instance.student_results.all().order_by('student__user__full_name')
        serializer = StudentResultListSerializer(results, many=True)
        
        return Response({
            'exam_instance': {
                'id': str(instance.id),
                'exam': instance.exam.name,
                'subject': instance.subject.name,
                'section': instance.section.name,
                'max_marks': instance.exam.max_marks,
                'passing_marks': instance.exam.get_passing_marks(),
                'status': instance.status
            },
            'results': serializer.data,
            'summary': {
                'total_students': instance.section.students.count(),
                'marked_count': instance.student_results.filter(
                    marks_obtained__isnull=False
                ).count(),
                'submitted_count': instance.student_results.filter(
                    moderation_status__in=['SUBMITTED', 'APPROVED', 'PUBLISHED']
                ).count()
            }
        })
    
    @action(detail=True, methods=['post'])
    def submit_marks(self, request, pk=None):
        """Submit marks for approval"""
        instance = self.get_object()
        self._verify_teacher_access(instance)
        
        if instance.status != 'ACTIVE':
            return Response(
                {'error': 'Exam instance is not in active state'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all results for this instance
        results = instance.student_results.filter(
            marks_obtained__isnull=False
        )
        
        if not results.exists():
            return Response(
                {'error': 'No marks have been entered'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Change status to submitted
        results.update(moderation_status='SUBMITTED')
        instance.status = 'SUBMITTED'
        instance.save()
        
        return Response({
            'message': f'Submitted {results.count()} results for approval',
            'status': instance.status
        })
    
    def _verify_teacher_access(self, instance):
        """Verify teacher is assigned to this section-subject"""
        user = self.request.user
        
        if is_platform_admin(user):
            return
        
        from apps.academics.models import SubjectMapping
        
        if not SubjectMapping.objects.filter(
            teacher=user.teacher,
            subject=instance.subject,
            section=instance.section
        ).exists():
            raise PermissionDenied(
                "You are not assigned to teach this subject-section"
            )


class StudentResultViewSet(viewsets.ModelViewSet):
    """
    TEACHER ENDPOINT: Mark entry
    
    /api/v1/academics/student-results/
    Teachers update marks here
    """
    serializer_class = StudentResultDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if is_platform_admin(user):
            return StudentResult.objects.all()
        
        user_school = get_user_school(user)
        
        # Teacher sees results for their assigned subjects
        from apps.academics.models import SubjectMapping
        teacher_mappings = SubjectMapping.objects.filter(
            teacher=user.teacher
        ).values('subject', 'section')
        
        query = Q()
        for mapping in teacher_mappings:
            query |= Q(
                exam_instance__subject_id=mapping['subject'],
                exam_instance__section_id=mapping['section']
            )
        
        return StudentResult.objects.filter(
            exam_instance__school=user_school
        ).filter(query).select_related(
            'exam_instance', 'student__user'
        )
    
    def perform_update(self, serializer):
        """Update marks and verify teacher access"""
        instance = serializer.instance
        
        # Verify teacher access
        from apps.academics.models import SubjectMapping
        user = self.request.user
        
        if not is_platform_admin(user):
            if not SubjectMapping.objects.filter(
                teacher=user.teacher,
                subject=instance.exam_instance.subject,
                section=instance.exam_instance.section
            ).exists():
                raise PermissionDenied("Access denied")
        
        # Prevent editing locked results
        if instance.moderation_status == 'PUBLISHED':
            raise ValidationError("Cannot edit published results")
        
        serializer.save()
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update marks for multiple students
        
        POST body:
        {
            "exam_instance_id": "uuid",
            "results": [
                {"student_id": "uuid", "marks_obtained": 85, "remarks": "Good"},
                ...
            ]
        }
        """
        exam_instance_id = request.data.get('exam_instance_id')
        results_data = request.data.get('results', [])
        
        try:
            instance = ExamInstance.objects.get(id=exam_instance_id)
        except ExamInstance.DoesNotExist:
            return Response(
                {'error': 'Exam instance not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify access
        user = self.request.user
        from apps.academics.models import SubjectMapping
        
        if not is_platform_admin(user):
            if not SubjectMapping.objects.filter(
                teacher=user.teacher,
                subject=instance.subject,
                section=instance.section
            ).exists():
                raise PermissionDenied("Access denied")
        
        updated_count = 0
        errors = []
        
        try:
            with transaction.atomic():
                for result_data in results_data:
                    try:
                        result = StudentResult.objects.get(
                            exam_instance=instance,
                            student_id=result_data['student_id']
                        )
                        
                        # Update marks
                        result.marks_obtained = result_data.get('marks_obtained')
                        result.remarks = result_data.get('remarks', '')
                        result.save()
                        updated_count += 1
                    
                    except StudentResult.DoesNotExist:
                        errors.append(f"Student {result_data['student_id']} not found")
                    except Exception as e:
                        errors.append(f"Error updating student: {str(e)}")
        
        except Exception as e:
            return Response(
                {'error': f'Bulk update failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'message': f'Updated {updated_count} results',
            'updated_count': updated_count,
            'errors': errors if errors else None
        }, status=status.HTTP_200_OK)
