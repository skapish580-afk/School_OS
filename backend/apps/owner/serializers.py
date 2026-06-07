from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.schools.models import School
from .models import SchoolSubscription, FeatureToggle, OwnerAuditLog

User = get_user_model()


class SchoolDetailSerializer(serializers.ModelSerializer):
    """School details for listings"""
    class Meta:
        model = School
        fields = ['id', 'name', 'code', 'board']


class SchoolSubscriptionSerializer(serializers.ModelSerializer):
    """Subscription with school details"""
    school_details = SchoolDetailSerializer(source='school', read_only=True)
    days_remaining = serializers.SerializerMethodField()
    
    class Meta:
        model = SchoolSubscription
        fields = [
            'id', 'school', 'school_details', 'plan', 'status',
            'start_date', 'end_date', 'max_students', 'max_teachers',
            'days_remaining', 'suspended_by', 'suspended_at', 'suspension_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_days_remaining(self, obj):
        if obj.end_date:
            from datetime import date
            delta = obj.end_date - date.today()
            return delta.days if delta.days > 0 else 0
        return None


class OnboardSchoolSerializer(serializers.Serializer):
    """Onboard a new school"""
    name = serializers.CharField(max_length=255)
    code = serializers.CharField(max_length=50)
    board = serializers.ChoiceField(choices=['CBSE', 'ICSE', 'IGCSE', 'IB', 'STATE'])
    plan = serializers.ChoiceField(
        choices=['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'],
        default='FREE'
    )
    max_students = serializers.IntegerField(default=50)
    max_teachers = serializers.IntegerField(default=10)
    
    def validate_code(self, value):
        if School.objects.filter(code=value).exists():
            raise serializers.ValidationError("School with this code already exists.")
        return value


class SchoolAdminSerializer(serializers.Serializer):
    """Create or update school admin"""
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    school = serializers.UUIDField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    def validate_email(self, value):
        # Check if email already exists (for new admins)
        if not self.instance and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists.")
        return value
    
    def validate_school(self, value):
        if not School.objects.filter(id=value).exists():
            raise serializers.ValidationError("School does not exist.")
        return value


class SchoolAdminListSerializer(serializers.Serializer):
    """List school admins"""
    id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone_number = serializers.CharField()
    school_id = serializers.UUIDField(allow_null=True)
    school_name = serializers.CharField()
    is_active = serializers.BooleanField()
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)


class FeatureToggleSerializer(serializers.ModelSerializer):
    """Feature toggle serializer"""
    school_name = serializers.CharField(source='school.name', read_only=True)
    feature_display = serializers.CharField(source='get_feature_display', read_only=True)
    
    class Meta:
        model = FeatureToggle
        fields = [
            'id', 'school', 'school_name', 'feature', 'feature_display',
            'is_enabled', 'sub_features', 'enabled_by', 'enabled_at'
        ]
        read_only_fields = ['id', 'enabled_at']


class BulkFeatureToggleSerializer(serializers.Serializer):
    """Bulk toggle features"""
    school_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False
    )
    feature = serializers.CharField()
    is_enabled = serializers.BooleanField()
    
    def validate_school_ids(self, value):
        existing = School.objects.filter(id__in=value).count()
        if existing != len(value):
            raise serializers.ValidationError("One or more school IDs are invalid.")
        return value
    
    def validate_feature(self, value):
        valid_features = [choice[0] for choice in FeatureToggle.FEATURE_CHOICES]
        if value not in valid_features:
            raise serializers.ValidationError(f"Invalid feature. Must be one of: {valid_features}")
        return value


class PlatformStatsSerializer(serializers.Serializer):
    """Platform-wide statistics"""
    total_schools = serializers.IntegerField()
    active_schools = serializers.IntegerField()
    suspended_schools = serializers.IntegerField()
    expired_schools = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_teachers = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    
    # Plan breakdown
    free_plan_count = serializers.IntegerField()
    basic_plan_count = serializers.IntegerField()
    premium_plan_count = serializers.IntegerField()
    enterprise_plan_count = serializers.IntegerField()


class OwnerAuditLogSerializer(serializers.ModelSerializer):
    """Audit log serializer"""
    school_name = serializers.CharField(source='school.name', read_only=True, allow_null=True)
    performed_by_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = OwnerAuditLog
        fields = [
            'id', 'action', 'action_display', 'school', 'school_name',
            'performed_by', 'performed_by_name', 'description',
            'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return f"{obj.performed_by.first_name} {obj.performed_by.last_name}".strip() or obj.performed_by.email
        return "System"
