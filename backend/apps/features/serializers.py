from rest_framework import serializers
from .services import school_has_feature

class FeatureFieldMixin:
    """
    Mixin to dynamically hide fields based on school features.
    The Meta class should have a 'feature_fields' dictionary mapping
    feature codes to a list of fields that require that feature.
    """
    def to_representation(self, instance):
        ret = super().to_representation(instance)
        
        # Get the school from the instance or context
        school = getattr(instance, 'school', None)
        if not school and hasattr(self, 'context'):
            request = self.context.get('request')
            if request and hasattr(request.user, 'school'):
                school = request.user.school
        
        if not school:
            return ret

        feature_fields = getattr(self.Meta, 'feature_fields', {})
        for feature_code, fields in feature_fields.items():
            if not school_has_feature(school.id, feature_code):
                for field in fields:
                    ret.pop(field, None)
        
        return ret
