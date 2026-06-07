import json
from .models import Feature, SchoolFeatureConfig

def school_has_feature(school_id, feature_code):
    """
    Checks if a school has access to a specific feature.
    """
    # 1. Check for overrides
    try:
        config = SchoolFeatureConfig.objects.get(school_id=school_id, feature__code=feature_code)
        return config.enabled
    except SchoolFeatureConfig.DoesNotExist:
        pass

    # 2. Fallback to global default
    try:
        feature = Feature.objects.get(code=feature_code)
        return feature.default_enabled
    except Feature.DoesNotExist:
        return False

def get_school_dna(school_id, feature_code):
    """
    Returns the specific JSON config (DNA) for a feature.
    """
    try:
        config = SchoolFeatureConfig.objects.get(school_id=school_id, feature__code=feature_code)
        # FIX: Manually parse the JSON string
        return json.loads(config.config_json)
    except (SchoolFeatureConfig.DoesNotExist, json.JSONDecodeError):
        return {}