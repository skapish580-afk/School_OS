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


class SchoolSettingsViewSet(viewsets.ModelViewSet):
    """
    API endpoint for school settings
    """
    queryset = SchoolSettings.objects.all()
    serializer_class = SchoolSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]
    
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
        Get settings for current user's school
        """
        from apps.core.school_isolation import get_user_school
        school = get_user_school(request.user)
        
        if not school:
            # Fallback to first school only if user has no school (e.g. platform admin)
            school = School.objects.first()
            
        if not school:
            return Response({'error': 'No school found'}, status=status.HTTP_404_NOT_FOUND)
        
        settings, created = SchoolSettings.objects.get_or_create(school=school)
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

        # Ensure CORE features are always enabled if no explicit config exists
        core_features = Feature.objects.filter(category='CORE')
        for core in core_features:
            if core.code not in configured_codes:
                features_map[core.code] = {"enabled": True, "sub_features": {}}
                
        return Response(features_map)
