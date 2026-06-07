from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import StudentHealthProfile, ClinicVisit
from .serializers import HealthProfileSerializer, ClinicVisitSerializer
from apps.accounts.permission_utils import RBACPermission

class HealthProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentHealthProfile.objects.all()
    serializer_class = HealthProfileSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'health'
    rbac_resource = 'health_record'

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        return queryset

class ClinicVisitViewSet(viewsets.ModelViewSet):
    queryset = ClinicVisit.objects.all()
    serializer_class = ClinicVisitSerializer
    permission_classes = [IsAuthenticated, RBACPermission]
    
    # RBAC Configuration
    rbac_module = 'health'
    rbac_resource = 'clinic_visit'
    rbac_action_permissions = {
        'recent': 'health.view_clinic_visit',
        'sent_home_today': 'health.view_clinic_visit',
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        student_id = self.request.query_params.get('student')
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        return queryset.order_by('-visit_date')
    
    def perform_create(self, serializer):
        serializer.save(nurse=self.request.user)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        from datetime import timedelta
        from django.utils import timezone
        
        thirty_days_ago = timezone.now() - timedelta(days=30)
        visits = self.get_queryset().filter(visit_date__gte=thirty_days_ago)
        serializer = self.get_serializer(visits, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sent_home_today(self, request):
        from django.utils import timezone
        today = timezone.now().date()
        visits = self.get_queryset().filter(
            visit_date__date=today,
            sent_home=True
        )
        serializer = self.get_serializer(visits, many=True)
        return Response(serializer.data)