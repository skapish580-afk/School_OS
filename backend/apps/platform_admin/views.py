from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from datetime import date, timedelta
from .models import (
    PlatformAdmin, SchoolSubscription, FeatureAccess,
    UsageMetric, PlatformAuditLog
)
from .serializers import (
    SchoolSubscriptionSerializer, FeatureAccessSerializer,
    UsageMetricSerializer, PlatformAuditLogSerializer,
    SchoolOnboardingSerializer
)
from apps.schools.models import School


class IsPlatformAdmin(IsAuthenticated):
    """
    Check if user is a platform admin
    """
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return PlatformAdmin.objects.filter(user=request.user).exists()


class SchoolSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = SchoolSubscription.objects.all()
    serializer_class = SchoolSubscriptionSerializer
    permission_classes = [IsPlatformAdmin]
    
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """
        Suspend a school subscription
        """
        subscription = self.get_object()
        reason = request.data.get('reason', 'Not specified')
        
        subscription.status = 'SUSPENDED'
        subscription.suspended_by = request.user
        subscription.suspended_at = date.today()
        subscription.suspension_reason = reason
        subscription.save()
        
        # Log audit
        PlatformAuditLog.objects.create(
            school=subscription.school,
            action='SCHOOL_SUSPENDED',
            performed_by=request.user,
            metadata={'reason': reason}
        )
        
        return Response({
            'status': 'suspended',
            'message': f'School {subscription.school.name} suspended'
        })
    
    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """
        Reactivate a suspended school
        """
        subscription = self.get_object()
        
        subscription.status = 'ACTIVE'
        subscription.suspended_by = None
        subscription.suspended_at = None
        subscription.suspension_reason = None
        subscription.save()
        
        # Log audit
        PlatformAuditLog.objects.create(
            school=subscription.school,
            action='SCHOOL_REACTIVATED',
            performed_by=request.user
        )
        
        return Response({
            'status': 'reactivated',
            'message': f'School {subscription.school.name} reactivated'
        })
    
    @action(detail=True, methods=['post'])
    def change_plan(self, request, pk=None):
        """
        Change subscription plan
        """
        subscription = self.get_object()
        new_plan = request.data.get('plan')
        max_students = request.data.get('max_students')
        max_teachers = request.data.get('max_teachers')
        
        old_plan = subscription.plan
        subscription.plan = new_plan
        if max_students:
            subscription.max_students = max_students
        if max_teachers:
            subscription.max_teachers = max_teachers
        subscription.save()
        
        # Log audit
        PlatformAuditLog.objects.create(
            school=subscription.school,
            action='PLAN_CHANGED',
            performed_by=request.user,
            metadata={
                'old_plan': old_plan,
                'new_plan': new_plan
            }
        )
        
        return Response({
            'status': 'updated',
            'message': f'Plan changed from {old_plan} to {new_plan}'
        })
    
    @action(detail=False, methods=['post'])
    def onboard_school(self, request):
        """
        Complete school onboarding with subscription
        """
        serializer = SchoolOnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Create school
            school = School.objects.create(
                name=serializer.validated_data['name'],
                code=serializer.validated_data['code'],
                board=serializer.validated_data['board'],
                address=serializer.validated_data.get('address', ''),
                contact_email=serializer.validated_data.get('contact_email', '')
            )
            
            # Create subscription
            subscription = SchoolSubscription.objects.create(
                school=school,
                plan=serializer.validated_data['plan'],
                status='ACTIVE',
                start_date=date.today(),
                end_date=date.today() + timedelta(days=365),
                max_students=serializer.validated_data['max_students'],
                max_teachers=serializer.validated_data['max_teachers']
            )
            
            # Enable default features
            default_features = ['STUDENTS', 'TEACHERS', 'ATTENDANCE', 'ACADEMICS']
            for feature in default_features:
                FeatureAccess.objects.create(
                    school=school,
                    feature=feature,
                    is_enabled=True,
                    enabled_by=request.user
                )
            
            # Log audit
            PlatformAuditLog.objects.create(
                school=school,
                action='SCHOOL_CREATED',
                performed_by=request.user,
                metadata={
                    'plan': subscription.plan,
                    'board': school.board
                }
            )
        
        return Response({
            'status': 'success',
            'school_id': school.id,
            'subscription_id': subscription.id,
            'message': f'School {school.name} onboarded successfully'
        }, status=status.HTTP_201_CREATED)


class FeatureAccessViewSet(viewsets.ModelViewSet):
    queryset = FeatureAccess.objects.all()
    serializer_class = FeatureAccessSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ['school', 'feature', 'is_enabled']
    
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """
        Toggle feature access
        """
        access = self.get_object()
        old_status = access.is_enabled
        access.is_enabled = not access.is_enabled
        access.enabled_by = request.user
        access.enabled_at = date.today()
        access.save()
        
        # Log audit
        PlatformAuditLog.objects.create(
            school=access.school,
            action='FEATURE_TOGGLED',
            performed_by=request.user,
            metadata={
                'feature': access.feature,
                'old_status': old_status,
                'new_status': access.is_enabled
            }
        )
        
        return Response({
            'status': 'toggled',
            'feature': access.feature,
            'is_enabled': access.is_enabled
        })
    
    @action(detail=False, methods=['get'])
    def school_matrix(self, request):
        """
        Get feature access matrix for a school
        """
        school_id = request.query_params.get('school_id')
        if not school_id:
            return Response({'error': 'school_id required'}, status=400)
        
        features = FeatureAccess.objects.filter(school_id=school_id)
        serializer = self.get_serializer(features, many=True)
        return Response(serializer.data)


class UsageMetricViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UsageMetric.objects.all()
    serializer_class = UsageMetricSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ['school', 'metric_type', 'date']
    
    @action(detail=False, methods=['get'])
    def school_summary(self, request):
        """
        Get usage summary for a school
        """
        school_id = request.query_params.get('school_id')
        if not school_id:
            return Response({'error': 'school_id required'}, status=400)
        
        from django.db.models import Sum, Avg
        
        metrics = UsageMetric.objects.filter(school_id=school_id)
        
        summary = {
            'total_students': metrics.filter(metric_type='STUDENT_COUNT').aggregate(Avg('value'))['value__avg'] or 0,
            'total_teachers': metrics.filter(metric_type='TEACHER_COUNT').aggregate(Avg('value'))['value__avg'] or 0,
            'attendance_entries': metrics.filter(metric_type='ATTENDANCE_MARKED').aggregate(Sum('value'))['value__sum'] or 0,
            'invoices_created': metrics.filter(metric_type='INVOICES_CREATED').aggregate(Sum('value'))['value__sum'] or 0,
            'gate_passes': metrics.filter(metric_type='GATE_PASSES_ISSUED').aggregate(Sum('value'))['value__sum'] or 0,
            'transfers': metrics.filter(metric_type='TRANSFER_REQUESTS').aggregate(Sum('value'))['value__sum'] or 0,
        }
        
        return Response(summary)


class PlatformAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlatformAuditLog.objects.all().order_by('-created_at')
    serializer_class = PlatformAuditLogSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ['school', 'action', 'performed_by']
