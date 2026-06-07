from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from .models import DisciplineRecord, KarmaActivity
from .serializers import DisciplineRecordSerializer
from apps.accounts.permission_utils import RBACPermission

class DisciplineViewSet(viewsets.ModelViewSet):
    queryset = DisciplineRecord.objects.all()
    serializer_class = DisciplineRecordSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'discipline'
    rbac_resource = 'incident'
    rbac_action_permissions = {
        'summary': 'discipline.view_incident',
        'karma_history': 'discipline.view_incident',
        'resolve': 'discipline.manage_incident',
        'escalate': 'discipline.manage_incident',
    }

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
    
    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'student parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
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
            
        history = KarmaActivity.objects.filter(student_id=student_id).order_by('-date')
        
        # We construct the data manually since we didn't make a serializer for KarmaActivity yet
        data = [{
            'id': k.id,
            'category': 'POSITIVE',  # Mark as positive for frontend
            'title': k.title,
            'points': k.points,
            'description': f"Awarded {k.points} Points",
            'date': k.date,
            'type': 'GOOD' # Helper for frontend color coding
        } for k in history]
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def scorecard(self, request):
        """
        GET /api/v1/discipline/scorecard/?student=1
        Calculates: Total Positive - Total Negative + Base 100
        """
        student_id = request.query_params.get('student')
        if not student_id:
            return Response({'error': 'Student ID required'}, status=400)

        # 1. Calculate Negative Points (from DisciplineRecord)
        neg_points = DisciplineRecord.objects.filter(student_id=student_id).aggregate(Sum('points_deducted'))['points_deducted__sum'] or 0
        
        # 2. Calculate Positive Points (from KarmaActivity)
        pos_points = KarmaActivity.objects.filter(student_id=student_id).aggregate(Sum('points'))['points__sum'] or 0

        # 3. Net Score (Start at 100 base score usually)
        net_score = 100 + (pos_points - neg_points)

        return Response({
            'student_id': student_id,
            'positive_karma': pos_points,
            'negative_discipline': neg_points,
            'net_score': net_score,
            'status': 'Good' if net_score > 80 else 'At Risk'
        })
    
    @action(detail=False, methods=['post'])
    def award_karma(self, request):
        """
        POST /api/v1/discipline/award_karma/
        Payload: { "student": 1, "title": "Helped clean lab", "points": 10 }
        """
        # Check permissions for House Points specifically
        if not can(request.user, 'ADD_DISCIPLINE', 'HOUSE_POINTS'):
             raise PermissionDenied("Karma System Disabled")
             
        student_id = request.data.get('student')
        points = request.data.get('points', 10)
        title = request.data.get('title')

        if not student_id or not title:
            return Response({'error': 'Student ID and Title are required'}, status=400)

        KarmaActivity.objects.create(
            student_id=student_id,
            awarded_by=request.user,
            title=title,
            points=points
        )
        return Response({'message': 'Points Awarded Successfully!'})