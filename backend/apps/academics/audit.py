"""
Audit logging utilities for Academic module.
All CRUD operations on academic models are logged here.

PRINCIPLE: Every change is traceable to a user.
"""

from apps.audit.models import AuditLog
from django.contrib.contenttypes.models import ContentType
from apps.features.models import SchoolFeatureConfig


def log_academic_action(user, action, obj, details="", ip_address=None):
    """
    Log any academic action to the audit trail.
    
    Args:
        user: The user performing the action
        action: 'CREATE', 'UPDATE', 'DELETE', etc.
        obj: The academic object being acted upon
        details: Extra context (e.g., "Changed marks from 40 to 50")
        ip_address: Client IP (optional)
    """
    content_type = ContentType.objects.get_for_model(obj)
    
    AuditLog.objects.create(
        actor=user,
        action=action,
        content_type=content_type,
        object_id=str(obj.id),
        details=details,
        ip_address=ip_address,
    )


def can_modify_locked_data(user, school):
    """
    Check if user can override locked timetables/results.
    Only Principal/SuperAdmin can do this.
    """
    if user.is_superuser:
        return True
    
    # Check if user is school admin (Principal)
    if hasattr(user, 'school_admin') and user.school_admin:
        return True
    
    return False


def has_feature(school, feature_code):
    """
    Check if a school has a particular feature enabled.
    
    Usage:
        if has_feature(school, 'ADVANCED_TIMETABLE'):
            # Show advanced features
    
    Args:
        school: School object
        feature_code: String code of the feature (e.g., 'ADVANCED_TIMETABLE')
    
    Returns:
        bool: True if feature is enabled for this school
    """
    try:
        from apps.features.models import Feature, SchoolFeatureConfig
        
        # Try to get the feature config
        feature_config = SchoolFeatureConfig.objects.select_related('feature').get(
            school=school,
            feature__code=feature_code
        )
        return feature_config.enabled
    except:
        # Feature doesn't exist or not configured - default to False for advanced features
        try:
            feature = Feature.objects.get(code=feature_code)
            return feature.default_enabled
        except:
            return False


def get_section_strength(section):
    """Get current student count in a section"""
    from apps.enrollments.models import StudentEnrollment
    
    return StudentEnrollment.objects.filter(
        grade=section.grade.grade_name,
        section=section.section_letter,
        status='ACTIVE'
    ).count()
