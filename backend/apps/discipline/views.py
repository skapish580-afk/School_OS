from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.db.models import Sum
from .models import DisciplineRecord, KarmaActivity
from .serializers import DisciplineRecordSerializer
from apps.accounts.permission_utils import RBACPermission
from apps.features.permissions import can
from apps.core.school_isolation import SchoolIsolationMixin, is_platform_admin, get_user_school
from apps.students.models import Student

from rest_framework import permissions

class DisciplineActionPermission(permissions.BasePermission):
    """
    Custom permission for Discipline:
    - Safe methods (GET, HEAD, OPTIONS): requires students.view_student_only, view_profile, or view_journey or admin
    - Write methods (POST, PUT, PATCH, DELETE): requires students.manage_behavior or admin
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
            
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True

        if user.user_type == 'STUDENT':
            if request.method in permissions.SAFE_METHODS or view.action in ['summary', 'karma_history', 'scorecard']:
                return True

        from apps.accounts.permission_utils import has_permission

        
        if request.method in permissions.SAFE_METHODS or view.action in ['summary', 'karma_history']:
            return (
                has_permission(user, 'students.view_student_only') or
                has_permission(user, 'students.view_profile') or
                has_permission(user, 'students.view_journey')
            )
        else:
            return user.user_type == 'TEACHER' or hasattr(user, 'teacher_profile') or has_permission(user, 'students.manage_behavior')

    def has_object_permission(self, request, view, obj):
        if request.method not in permissions.SAFE_METHODS:
            from apps.accounts.permission_utils import can_user_edit_object_by_hierarchy
            allowed, reason = can_user_edit_object_by_hierarchy(request.user, obj)
            if not allowed:
                self.message = reason
                return False
        return True



class DisciplineViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    queryset = DisciplineRecord.objects.all()
    serializer_class = DisciplineRecordSerializer
    permission_classes = [IsAuthenticated, DisciplineActionPermission]
    
    school_field = 'student__school'

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)
        
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset.order_by('-incident_date')
    
    def _validate_student_school(self, student_id):
        """Helper to ensure the student belongs to the same school as the user (unless platform admin)"""
        user = self.request.user
        if not is_platform_admin(user):
            school = get_user_school(user)
            if not Student.objects.filter(id=student_id, school=school).exists():
                raise PermissionDenied("Access Denied: Student does not belong to your school.")

    def perform_create(self, serializer):
        # Validate student matches user's school
        student_id = self.request.data.get('student')
        if student_id:
            self._validate_student_school(student_id)
        serializer.save(reported_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        self._validate_student_school(student_id)
        
        records = self.get_queryset().filter(student_id=student_id)
        total_points = records.aggregate(total=Sum('points_deducted'))['total'] or 0
        
        return Response({
            'total_incidents': records.count(),
            'total_points_deducted': total_points,
            'by_severity': {
                'LOW': records.filter(severity='LOW').count(),
                'MEDIUM': records.filter(severity='MEDIUM').count(),
                'CRITICAL': records.filter(severity='CRITICAL').count(),
            },
            'by_category': {
                category: records.filter(category=category).count()
                for category, _ in DisciplineRecord.CATEGORY_CHOICES
            }
        })
    
    @action(detail=False, methods=['get'])
    def karma_history(self, request):
        """
        GET /api/v1/discipline/karma_history/?student=1
        Returns list of positive karma records.
        """
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'Student ID required'}, status=400)
            
        self._validate_student_school(student_id)
        history = KarmaActivity.objects.filter(student_id=student_id).order_by('-date')
        
        # We construct the data manually since we didn't make a serializer for KarmaActivity yet
        data = [{
            'id': k.id,
            'category': 'POSITIVE',  # Mark as positive for frontend
            'title': k.title,
            'points': k.points,
            'description': k.description or f"Awarded {k.points} Points",
            'date': k.date,
            'type': 'GOOD' # Helper for frontend color coding
        } for k in history]
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def scorecard(self, request):
        """
        GET /api/v1/discipline/scorecard/?student=1
        Calculates: Total Positive - Total Negative
        """
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'Student ID required'}, status=400)
        
        self._validate_student_school(student_id)

        # 1. Calculate Negative Points (from DisciplineRecord)
        neg_points = self.get_queryset().filter(student_id=student_id).aggregate(Sum('points_deducted'))['points_deducted__sum'] or 0
        
        # 2. Calculate Positive Points (from KarmaActivity)
        pos_points = KarmaActivity.objects.filter(student_id=student_id).aggregate(Sum('points'))['points__sum'] or 0

        # 3. Net Score (Start at 0 base score)
        net_score = pos_points - neg_points

        return Response({
            'student_id': student_id,
            'positive_karma': pos_points,
            'negative_discipline': neg_points,
            'net_score': net_score,
            'status': 'Good Standing' if net_score >= 0 else 'Review Needed'
        })
    
    @action(detail=False, methods=['post'])
    def award_karma(self, request):
        """
        POST /api/v1/discipline/award_karma/
        Payload: { "student": 1, "title": "Helped clean lab", "points": 10, "description": "..." }
        """
        # Check permissions for House Points specifically
        if not can(request.user, 'ADD_DISCIPLINE', 'HOUSE_POINTS'):
            if request.user.user_type not in ['TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'ROLE'] and not hasattr(request.user, 'teacher_profile'):
                raise PermissionDenied("Karma System Disabled")
              
        student_id = request.data.get('student')
        points = request.data.get('points', 10)
        title = request.data.get('title')
        description = request.data.get('description', '')

        if not student_id or not title:
            return Response({'error': 'Student ID and Title are required'}, status=400)

        self._validate_student_school(student_id)

        KarmaActivity.objects.create(
            student_id=student_id,
            awarded_by=request.user,
            title=title,
            points=points,
            description=description
        )
        return Response({'message': 'Points Awarded Successfully!'})