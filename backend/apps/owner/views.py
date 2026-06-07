from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.contrib.auth import get_user_model
from datetime import date

from apps.schools.models import School
from .models import SchoolSubscription, FeatureToggle, OwnerAuditLog
from .serializers import (
    SchoolSubscriptionSerializer, OnboardSchoolSerializer,
    SchoolAdminSerializer, SchoolAdminListSerializer,
    FeatureToggleSerializer, BulkFeatureToggleSerializer,
    PlatformStatsSerializer, OwnerAuditLogSerializer
)
from .permissions import IsOwner

User = get_user_model()


class SchoolManagementViewSet(viewsets.ModelViewSet):
    """
    Manage schools and subscriptions
    """
    queryset = SchoolSubscription.objects.select_related('school').all()
    serializer_class = SchoolSubscriptionSerializer
    permission_classes = [IsOwner]
    
    @action(detail=False, methods=['post'])
    def onboard(self, request):
        """
        Onboard a new school with subscription
        """
        serializer = OnboardSchoolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Create school
            school = School.objects.create(
                name=serializer.validated_data['name'],
                code=serializer.validated_data['code'],
                board=serializer.validated_data['board']
            )
            
            # Create subscription
            subscription = SchoolSubscription.objects.create(
                school=school,
                plan=serializer.validated_data['plan'],
                max_students=serializer.validated_data['max_students'],
                max_teachers=serializer.validated_data['max_teachers'],
                created_by=request.user
            )
            
            # Create default feature toggles (all enabled by default)
            for feature_code, _ in FeatureToggle.FEATURE_CHOICES:
                FeatureToggle.objects.create(
                    school=school,
                    feature=feature_code,
                    is_enabled=True,
                    enabled_by=request.user
                )
            
            # Log audit
            OwnerAuditLog.objects.create(
                action='SCHOOL_CREATED',
                school=school,
                performed_by=request.user,
                description=f"Created school: {school.name} with {serializer.validated_data['plan']} plan"
            )
        
        return Response({
            'status': 'success',
            'message': f'School {school.name} onboarded successfully',
            'school_id': school.id,
            'subscription_id': subscription.id
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """
        Suspend a school
        """
        subscription = self.get_object()
        reason = request.data.get('reason', 'No reason provided')
        
        subscription.status = 'SUSPENDED'
        subscription.suspended_by = request.user
        subscription.suspended_at = date.today()
        subscription.suspension_reason = reason
        subscription.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='SCHOOL_SUSPENDED',
            school=subscription.school,
            performed_by=request.user,
            description=f"Suspended school: {subscription.school.name}. Reason: {reason}"
        )
        
        return Response({
            'status': 'success',
            'message': f'School {subscription.school.name} suspended'
        })
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activate a suspended school
        """
        subscription = self.get_object()
        
        subscription.status = 'ACTIVE'
        subscription.suspended_by = None
        subscription.suspended_at = None
        subscription.suspension_reason = ''
        subscription.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='SCHOOL_ACTIVATED',
            school=subscription.school,
            performed_by=request.user,
            description=f"Activated school: {subscription.school.name}"
        )
        
        return Response({
            'status': 'success',
            'message': f'School {subscription.school.name} activated'
        })
    
    @action(detail=True, methods=['post'])
    def change_plan(self, request, pk=None):
        """
        Change subscription plan
        """
        subscription = self.get_object()
        new_plan = request.data.get('plan')
        
        if new_plan not in ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE']:
            return Response({'error': 'Invalid plan'}, status=400)
        
        old_plan = subscription.plan
        subscription.plan = new_plan
        subscription.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='PLAN_CHANGED',
            school=subscription.school,
            performed_by=request.user,
            description=f"Changed plan from {old_plan} to {new_plan} for {subscription.school.name}"
        )
        
        return Response({
            'status': 'success',
            'message': f'Plan changed to {new_plan}'
        })


class SchoolAdminManagementViewSet(viewsets.ViewSet):
    """
    Manage school administrators
    """
    permission_classes = [IsOwner]
    
    def list(self, request):
        """
        List all school admins
        """
        admins = User.objects.filter(
            user_type__in=['SCHOOL_ADMIN', 'ADMIN']
        ).select_related('school').order_by('-date_joined')
        
        data = [{
            'id': admin.id,
            'email': admin.email,
            'first_name': admin.first_name,
            'last_name': admin.last_name,
            'phone_number': admin.phone_number or '',
            'school_id': admin.school.id if admin.school else None,
            'school_name': admin.school.name if admin.school else 'No School',
            'is_active': admin.is_active,
            'date_joined': admin.date_joined,
            'last_login': admin.last_login,
        } for admin in admins]
        
        serializer = SchoolAdminListSerializer(data, many=True)
        return Response(serializer.data)
    
    def create(self, request):
        """
        Create a new school admin
        """
        serializer = SchoolAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            # Create user
            password = serializer.validated_data.get('password', 'ChangeMe123!')
            user = User.objects.create_user(
                email=serializer.validated_data['email'],
                password=password,
                first_name=serializer.validated_data['first_name'],
                last_name=serializer.validated_data['last_name'],
                phone_number=serializer.validated_data.get('phone_number', ''),
                user_type='SCHOOL_ADMIN',
                school_id=serializer.validated_data['school']
            )
            
            # Log audit
            school = School.objects.get(id=serializer.validated_data['school'])
            OwnerAuditLog.objects.create(
                action='ADMIN_CREATED',
                school=school,
                performed_by=request.user,
                description=f"Created school admin: {user.email} for {school.name}"
            )
        
        return Response({
            'status': 'success',
            'message': f'School admin {user.email} created successfully',
            'admin_id': user.id
        }, status=status.HTTP_201_CREATED)
    
    def retrieve(self, request, pk=None):
        """
        Get admin details
        """
        try:
            admin = User.objects.select_related('school').get(
                id=pk,
                user_type__in=['SCHOOL_ADMIN', 'ADMIN']
            )
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=404)
        
        data = {
            'id': admin.id,
            'email': admin.email,
            'first_name': admin.first_name,
            'last_name': admin.last_name,
            'phone_number': admin.phone_number or '',
            'school_id': admin.school.id if admin.school else None,
            'school_name': admin.school.name if admin.school else 'No School',
            'is_active': admin.is_active,
            'date_joined': admin.date_joined,
            'last_login': admin.last_login,
        }
        
        serializer = SchoolAdminListSerializer(data)
        return Response(serializer.data)
    
    def update(self, request, pk=None):
        """
        Update admin details
        """
        try:
            admin = User.objects.get(id=pk, user_type__in=['SCHOOL_ADMIN', 'ADMIN'])
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=404)
        
        serializer = SchoolAdminSerializer(data=request.data, instance=admin)
        serializer.is_valid(raise_exception=True)
        
        admin.email = serializer.validated_data['email']
        admin.first_name = serializer.validated_data['first_name']
        admin.last_name = serializer.validated_data['last_name']
        admin.phone_number = serializer.validated_data.get('phone_number', '')
        admin.school_id = serializer.validated_data['school']
        
        if serializer.validated_data.get('password'):
            admin.set_password(serializer.validated_data['password'])
        
        admin.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='ADMIN_UPDATED',
            school=admin.school,
            performed_by=request.user,
            description=f"Updated school admin: {admin.email}"
        )
        
        return Response({
            'status': 'success',
            'message': f'School admin {admin.email} updated successfully'
        })
    
    def destroy(self, request, pk=None):
        """
        Deactivate admin
        """
        try:
            admin = User.objects.get(id=pk, user_type__in=['SCHOOL_ADMIN', 'ADMIN'])
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=404)
        
        admin.is_active = False
        admin.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='ADMIN_DELETED',
            school=admin.school,
            performed_by=request.user,
            description=f"Deactivated school admin: {admin.email}"
        )
        
        return Response({
            'status': 'success',
            'message': f'School admin {admin.email} deactivated'
        })
    
    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """
        Reset admin password
        """
        try:
            admin = User.objects.get(id=pk, user_type__in=['SCHOOL_ADMIN', 'ADMIN'])
        except User.DoesNotExist:
            return Response({'error': 'Admin not found'}, status=404)
        
        new_password = request.data.get('password', 'ChangeMe123!')
        admin.set_password(new_password)
        admin.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='PASSWORD_RESET',
            school=admin.school,
            performed_by=request.user,
            description=f"Reset password for school admin: {admin.email}"
        )
        
        return Response({
            'status': 'success',
            'message': f'Password reset for {admin.email}'
        })


class FeatureControlViewSet(viewsets.ModelViewSet):
    """
    Control features for schools
    """
    queryset = FeatureToggle.objects.select_related('school').all()
    serializer_class = FeatureToggleSerializer
    permission_classes = [IsOwner]
    filterset_fields = ['school', 'feature', 'is_enabled']
    
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """
        Toggle a feature
        """
        feature = self.get_object()
        feature.is_enabled = not feature.is_enabled
        feature.enabled_by = request.user
        feature.save()
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='FEATURE_TOGGLED',
            school=feature.school,
            performed_by=request.user,
            description=f"Toggled {feature.get_feature_display()} to {'enabled' if feature.is_enabled else 'disabled'}"
        )
        
        return Response({
            'status': 'success',
            'is_enabled': feature.is_enabled
        })

    @action(detail=True, methods=['post'])
    def toggle_sub_feature(self, request, pk=None):
        """
        Toggle a sub-feature
        """
        feature = self.get_object()
        sub_feature = request.data.get('sub_feature')
        
        # Determine enabled state. If not provided, toggle current state (default false if missing)
        current_config = feature.sub_features or {}
        current_state = current_config.get(sub_feature, True) # Default to true if not set
        
        if 'enabled' in request.data:
            new_state = request.data['enabled']
        else:
            new_state = not current_state
            
        if not sub_feature:
            return Response({'error': 'sub_feature required'}, status=400)
            
        current_config[sub_feature] = new_state
        
        feature.sub_features = current_config
        feature.enabled_by = request.user
        feature.save()
        
        return Response({
            'status': 'success',
            'sub_feature': sub_feature,
            'is_enabled': new_state,
            'config': feature.sub_features
        })
    
    @action(detail=False, methods=['post'])
    def bulk_toggle(self, request):
        """
        Bulk toggle features for multiple schools
        """
        serializer = BulkFeatureToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        school_ids = serializer.validated_data['school_ids']
        feature = serializer.validated_data['feature']
        is_enabled = serializer.validated_data['is_enabled']
        
        updated_count = 0
        for school_id in school_ids:
            feature_toggle, created = FeatureToggle.objects.get_or_create(
                school_id=school_id,
                feature=feature,
                defaults={'is_enabled': is_enabled, 'enabled_by': request.user}
            )
            
            if not created and feature_toggle.is_enabled != is_enabled:
                feature_toggle.is_enabled = is_enabled
                feature_toggle.enabled_by = request.user
                feature_toggle.save()
                updated_count += 1
        
        # Log audit
        OwnerAuditLog.objects.create(
            action='FEATURE_BULK_TOGGLED',
            performed_by=request.user,
            description=f"Bulk toggled {feature} to {is_enabled} for {len(school_ids)} schools"
        )
        
        return Response({
            'status': 'success',
            'message': f'Feature {feature} toggled for {len(school_ids)} schools',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def matrix(self, request):
        """
        Get feature matrix for all schools
        """
        schools = School.objects.all()
        features = FeatureToggle.FEATURE_CHOICES
        
        matrix = []
        for school in schools:
            school_features = FeatureToggle.objects.filter(school=school)
            feature_dict = {f[0]: False for f in features}
            
            for feature_toggle in school_features:
                feature_dict[feature_toggle.feature] = feature_toggle.is_enabled
            
            matrix.append({
                'school_id': school.id,
                'school_name': school.name,
                'features': feature_dict
            })
        
        return Response(matrix)
    
    @action(detail=False, methods=['get'])
    def school_features(self, request):
        """
        Get features for a specific school
        """
        school_id = request.query_params.get('school_id')
        if not school_id:
            return Response({'error': 'school_id required'}, status=400)
        
        features = FeatureToggle.objects.filter(school_id=school_id)
        serializer = self.get_serializer(features, many=True)
        return Response(serializer.data)


class PlatformStatsView(APIView):
    """
    Get platform-wide statistics
    """
    permission_classes = [IsOwner]
    
    def get(self, request):
        from apps.students.models import Student
        from apps.teachers.models import Teacher
        
        stats = {
            'total_schools': School.objects.count(),
            'active_schools': SchoolSubscription.objects.filter(status='ACTIVE').count(),
            'suspended_schools': SchoolSubscription.objects.filter(status='SUSPENDED').count(),
            'expired_schools': SchoolSubscription.objects.filter(status='EXPIRED').count(),
            'total_students': Student.objects.count(),
            'total_teachers': Teacher.objects.count(),
            'total_revenue': 0,  # TODO: Calculate from subscriptions
            
            # Plan breakdown
            'free_plan_count': SchoolSubscription.objects.filter(plan='FREE').count(),
            'basic_plan_count': SchoolSubscription.objects.filter(plan='BASIC').count(),
            'premium_plan_count': SchoolSubscription.objects.filter(plan='PREMIUM').count(),
            'enterprise_plan_count': SchoolSubscription.objects.filter(plan='ENTERPRISE').count(),
        }
        
        serializer = PlatformStatsSerializer(stats)
        return Response(serializer.data)


class OwnerAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View audit logs
    """
    queryset = OwnerAuditLog.objects.select_related('school', 'performed_by').all()
    serializer_class = OwnerAuditLogSerializer
    permission_classes = [IsOwner]
    filterset_fields = ['action', 'school', 'performed_by']
