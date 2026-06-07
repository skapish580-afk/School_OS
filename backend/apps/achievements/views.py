from rest_framework import viewsets, permissions, status
from django.http import HttpResponse
import csv
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Achievement, StudentArtifact, StudentYearlyAward
from .serializers import AchievementSerializer, StudentArtifactSerializer, StudentYearlyAwardSerializer
from apps.accounts.permission_utils import RBACPermission

class AchievementViewSet(viewsets.ModelViewSet):
    queryset = Achievement.objects.all()
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'achievements'
    rbac_resource = 'achievement'
    rbac_action_permissions = {
        'by_category': 'achievements.view_achievement',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)
        
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        return queryset.order_by('-date_awarded')
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        achievements = self.get_queryset().filter(student__student_id=student_id)
        
        return Response({
            category: achievements.filter(category=category).count()
            for category, _ in Achievement.CATEGORY_CHOICES
        })


class StudentYearlyAwardViewSet(viewsets.ModelViewSet):
    """ViewSet for StudentYearlyAward - the main achievements data"""
    queryset = StudentYearlyAward.objects.select_related(
        'student', 'student__school', 'student_history', 'student_history__school'
    ).all()
    serializer_class = StudentYearlyAwardSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'achievements'
    rbac_resource = 'award'
    rbac_action_permissions = {
        'summary': 'achievements.view_award',
        'by_category': 'achievements.view_award',
        'export': 'achievements.view_award',
    }
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Filter by school for non-platform admins
        if hasattr(user, 'school') and user.school:
            queryset = queryset.filter(
                Q(student__school=user.school) | 
                Q(student_history__school=user.school)
            )
        
        # Filter by student
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by academic year
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year=academic_year)
        
        # Filter by level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(level=level)
        
        return queryset.order_by('-event_date', '-created_at')
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get statistics for awards - category counts, level counts, etc."""
        queryset = self.get_queryset()
        
        # Category stats
        category_stats = {}
        for cat_key, cat_name in StudentYearlyAward.CATEGORY_CHOICES:
            category_stats[cat_key] = {
                'name': cat_name,
                'count': queryset.filter(category=cat_key).count()
            }
        
        # Level stats
        level_stats = {}
        for level_key, level_name in StudentYearlyAward.LEVEL_CHOICES:
            level_stats[level_key] = {
                'name': level_name,
                'count': queryset.filter(level=level_key).count()
            }
        
        # Year-wise stats
        year_stats = queryset.values('academic_year').annotate(
            count=Count('id')
        ).order_by('-academic_year')
        
        return Response({
            'total': queryset.count(),
            'by_category': category_stats,
            'by_level': level_stats,
            'by_year': list(year_stats),
        })
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent awards for the school"""
        queryset = self.get_queryset()[:20]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Export achievements report as CSV/JSON"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        format_type = request.query_params.get('format', 'csv').lower()
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date are required'}, status=400)
            
        awards = StudentYearlyAward.objects.filter(
            event_date__gte=start_date,
            event_date__lte=end_date
        ).select_related('student', 'student__user').order_by('-event_date')
        
        if format_type == 'json':
            serializer = self.get_serializer(awards, many=True)
            return Response(serializer.data)
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="achievements_report_{start_date}_to_{end_date}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date', 'Student Name', 'SUID', 'Award/Achievement', 'Category', 'Level', 'Description'])
        
        for award in awards:
            writer.writerow([
                award.event_date,
                award.student.full_name_display if award.student else 'N/A',
                award.student.suid if award.student else 'N/A',
                award.title,
                award.category,
                award.level,
                award.description
            ])
            
        return response


class ArtifactViewSet(viewsets.ModelViewSet):
    queryset = StudentArtifact.objects.all()
    serializer_class = StudentArtifactSerializer
    permission_classes = [permissions.IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'achievements'
    rbac_resource = 'achievement'

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student__student_id=student_id)
        
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        
        return queryset.order_by('-upload_date')