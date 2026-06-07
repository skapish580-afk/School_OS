"""
Assignment API Views
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models_assignments import Assignment, AssignmentSubmission
from .serializers_assignments import (
    AssignmentSerializer, AssignmentListSerializer, AssignmentSubmissionSerializer
)
from apps.core.school_isolation import SchoolIsolationMixin, get_user_school, is_platform_admin


class AssignmentViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing assignments.
    School admins can view all assignments in their school.
    Teachers can create/edit their own assignments.
    """
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'school'
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AssignmentListSerializer
        return AssignmentSerializer
    
    def get_queryset(self):
        queryset = Assignment.objects.select_related(
            'grade', 'section', 'subject', 'created_by', 'school'
        ).prefetch_related('submissions')
        
        user = self.request.user
        
        # Platform admin sees all
        if is_platform_admin(user):
            return queryset
        
        # School admin sees their school's assignments
        user_school = get_user_school(user)
        if user_school:
            queryset = queryset.filter(school=user_school)
        else:
            return queryset.none()
        
        # Teachers only see their own assignments (unless admin)
        if user.user_type == 'TEACHER':
            queryset = queryset.filter(created_by=user)
        
        # Filter by query params
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade_id=grade)
        
        section = self.request.query_params.get('section')
        if section:
            queryset = queryset.filter(section_id=section)
        
        subject = self.request.query_params.get('subject')
        if subject:
            queryset = queryset.filter(subject_id=subject)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        user = self.request.user
        user_school = get_user_school(user)
        serializer.save(created_by=user, school=user_school)
    
    @action(detail=False, methods=['get'])
    def my_assignments(self, request):
        """Get assignments created by current user."""
        queryset = self.get_queryset().filter(created_by=request.user)
        serializer = AssignmentListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue assignments."""
        queryset = self.get_queryset().filter(
            due_date__lt=timezone.now().date(),
            status='PUBLISHED'
        )
        serializer = AssignmentListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a draft assignment."""
        assignment = self.get_object()
        if assignment.status != 'DRAFT':
            return Response(
                {'error': 'Only draft assignments can be published'},
                status=status.HTTP_400_BAD_REQUEST
            )
        assignment.status = 'PUBLISHED'
        assignment.save()
        return Response({'status': 'published'})
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close an assignment for submissions."""
        assignment = self.get_object()
        assignment.status = 'CLOSED'
        assignment.save()
        return Response({'status': 'closed'})


class AssignmentSubmissionViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    ViewSet for assignment submissions.
    """
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'assignment__school'
    
    def get_queryset(self):
        queryset = AssignmentSubmission.objects.select_related(
            'assignment', 'student', 'student__user', 'graded_by'
        )
        
        user = self.request.user
        
        # Platform admin sees all
        if is_platform_admin(user):
            return queryset
        
        # School filter
        user_school = get_user_school(user)
        if user_school:
            queryset = queryset.filter(assignment__school=user_school)
        else:
            return queryset.none()
        
        # Filter by assignment
        assignment = self.request.query_params.get('assignment')
        if assignment:
            queryset = queryset.filter(assignment_id=assignment)
        
        return queryset.order_by('-submitted_at')
    
    @action(detail=True, methods=['post'])
    def grade(self, request, pk=None):
        """Grade a submission."""
        submission = self.get_object()
        marks = request.data.get('marks_obtained')
        feedback = request.data.get('feedback', '')
        
        if marks is None:
            return Response(
                {'error': 'marks_obtained is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        submission.marks_obtained = marks
        submission.feedback = feedback
        submission.is_graded = True
        submission.graded_by = request.user
        submission.graded_at = timezone.now()
        submission.save()
        
        serializer = self.get_serializer(submission)
        return Response(serializer.data)
