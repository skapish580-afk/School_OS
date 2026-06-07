from rest_framework import serializers
from .models import (
    PlatformAdmin, SchoolSubscription, FeatureAccess,
    UsageMetric, PlatformAuditLog
)
from apps.schools.models import School
from apps.schools.serializers import SchoolSerializer


class SchoolSubscriptionSerializer(serializers.ModelSerializer):
    school_details = SchoolSerializer(source='school', read_only=True)
    days_remaining = serializers.SerializerMethodField()
    
    class Meta:
        model = SchoolSubscription
        fields = '__all__'
        read_only_fields = ['suspended_by', 'suspended_at']
    
    def get_days_remaining(self, obj):
        if obj.end_date and obj.status == 'ACTIVE':
            from datetime import date
            return (obj.end_date - date.today()).days
        return None


class FeatureAccessSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    feature_display = serializers.CharField(source='get_feature_display', read_only=True)
    
    class Meta:
        model = FeatureAccess
        fields = '__all__'
        read_only_fields = ['enabled_by', 'enabled_at']


class UsageMetricSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    
    class Meta:
        model = UsageMetric
        fields = '__all__'


class PlatformAuditLogSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    performed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = PlatformAuditLog
        fields = '__all__'
    
    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return f"{obj.performed_by.first_name} {obj.performed_by.last_name}"
        return "System"


class SchoolOnboardingSerializer(serializers.Serializer):
    """
    Complete school onboarding
    """
    name = serializers.CharField()
    code = serializers.CharField()
    board = serializers.ChoiceField(choices=['CBSE', 'ICSE', 'IGCSE', 'IB', 'STATE'])
    address = serializers.CharField(required=False, allow_blank=True)
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    plan = serializers.ChoiceField(choices=['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'], default='FREE')
    max_students = serializers.IntegerField(default=50)
    max_teachers = serializers.IntegerField(default=10)
