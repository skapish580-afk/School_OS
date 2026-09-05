from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import School
from .models_settings import SchoolSettings
from .serializers import SchoolSerializer
from .serializers_settings import SchoolSettingsSerializer

from apps.core.school_isolation import SchoolIsolationMixin

class SchoolViewSet(SchoolIsolationMixin, viewsets.ModelViewSet):
    """
    API endpoint that allows Schools to be viewed or edited.
    """
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]
    school_field = 'id'


class IsSchoolSettingsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access to role users, full access to platform/school admins.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.user_type == 'ROLE':
            return request.method in permissions.SAFE_METHODS
        return True


class SchoolSettingsViewSet(viewsets.ModelViewSet):
    """
    API endpoint for school settings
    """
    queryset = SchoolSettings.objects.all()
    serializer_class = SchoolSettingsSerializer
    permission_classes = [permissions.IsAuthenticated, IsSchoolSettingsAdminOrReadOnly]
    
    def get_queryset(self):
        # Filter by user's school (assuming user has school relationship)
        user = self.request.user
        if hasattr(user, 'school'):
            return SchoolSettings.objects.filter(school=user.school)
        # For now, return all (will add proper school filtering later)
        return SchoolSettings.objects.all()
    
    @action(detail=False, methods=['get'])
    def my_settings(self, request):
        """
        Get settings for current user's school.
        Also auto-syncs AcademicYear DB records on every read so that when the
        academic year rolls over the new year becomes ACTIVE without any manual action.
        """
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        
        if not school:
            # Fallback to first school only if user has no school (e.g. platform admin)
            school = School.objects.first()
            
        if not school:
            return Response({'error': 'No school found'}, status=status.HTTP_404_NOT_FOUND)
        
        settings, created = SchoolSettings.objects.get_or_create(school=school)

        # Auto-sync academic year statuses so the DB reflects today's date
        # (handles automatic year rollover without any manual settings save)
        try:
            from apps.schools.models_settings import sync_school_academic_years
            sync_school_academic_years(school)
        except Exception:
            pass

        serializer = self.get_serializer(settings)
        return Response(serializer.data)

    
    @action(detail=False, methods=['patch'])
    def update_my_settings(self, request):
        """
        Update settings for current user's school.
        Timezone is auto-detected from coordinates here in the view,
        so it is always computed reliably regardless of model save() caching.
        """
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        
        if not school:
            school = School.objects.first()
            
        if not school:
            return Response({'error': 'No school found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Handle school logo upload/removal
        if 'school_logo' in request.data:
            logo_file = request.data['school_logo']
            if logo_file == '' or logo_file == 'null':
                school.logo = None
                school.save()
            elif not isinstance(logo_file, str):
                school.logo = logo_file
                school.save()

        settings, created = SchoolSettings.objects.get_or_create(school=school)
        serializer = self.get_serializer(settings, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Always refresh from DB before returning so the response reflects reality
        settings.refresh_from_db()
        final_serializer = self.get_serializer(settings)
        return Response(final_serializer.data)
    @action(detail=False, methods=['get'])
    def features(self, request):
        """
        Get enabled features for current user's school (Unified System)
        """
        school = None
        if hasattr(request.user, 'school') and request.user.school:
            school = request.user.school
        else:
            school = School.objects.first()
            
        if not school:
            return Response({'error': 'No school found'}, status=status.HTTP_404_NOT_FOUND)
            
        from apps.features.models import SchoolFeatureConfig, Feature
        
        # Fetch all configurations for this school
        configs = SchoolFeatureConfig.objects.filter(school=school).select_related('feature')
        
        features_map = {}
        configured_codes = set()
        
        for config in configs:
            code = config.feature.code
            configured_codes.add(code)
            if config.enabled:
                features_map[code] = {
                    "enabled": True,
                    "sub_features": config.config  # Uses the @property helper
                }

        # Ensure CORE and ALWAYS-ON features are enabled if no explicit config exists
        default_always_on = ['REPORTS', 'COMMUNITY', 'AI_ANALYTICS']
        for code in default_always_on:
            if code not in configured_codes:
                features_map[code] = {"enabled": True, "sub_features": {}}

        core_features = Feature.objects.filter(category='CORE')
        for core in core_features:
            if core.code not in configured_codes:
                features_map[core.code] = {"enabled": True, "sub_features": {}}
                
        return Response(features_map)
