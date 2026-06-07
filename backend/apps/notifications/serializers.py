"""
Notification Serializers
"""

from rest_framework import serializers
from .models import NotificationTemplate, ParentContact, StudentNotificationLog, NotificationQueue


class NotificationTemplateSerializer(serializers.ModelSerializer):
    """Serializer for NotificationTemplate model."""
    
    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'school', 'category', 'title', 'body', 
            'channels', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ParentContactSerializer(serializers.ModelSerializer):
    """Serializer for ParentContact model."""
    
    parent_name = serializers.CharField(source='parent.full_name', read_only=True)
    full_phone = serializers.SerializerMethodField()
    
    class Meta:
        model = ParentContact
        fields = [
            'id', 'parent', 'parent_name', 'phone', 'country_code', 
            'full_phone', 'email', 'whatsapp_enabled', 
            'preferred_channels', 'notifications_enabled',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'parent', 'parent_name', 'full_phone', 'created_at', 'updated_at']
    
    def get_full_phone(self, obj):
        return obj.get_full_phone()


class StudentNotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for StudentNotificationLog model."""
    
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    parent_name = serializers.CharField(source='parent.full_name', read_only=True)
    
    class Meta:
        model = StudentNotificationLog
        fields = [
            'id', 'student', 'student_name', 'parent', 'parent_name',
            'notification_type', 'subject', 'message', 'channels_sent',
            'status', 'delivery_status', 'error_message', 'created_at'
        ]
        read_only_fields = '__all__'


class NotificationQueueSerializer(serializers.ModelSerializer):
    """Serializer for NotificationQueue model."""
    
    class Meta:
        model = NotificationQueue
        fields = [
            'id', 'log', 'status', 'retry_count', 'max_retries',
            'scheduled_at', 'processed_at', 'created_at'
        ]
        read_only_fields = '__all__'


class SendTestNotificationSerializer(serializers.Serializer):
    """Serializer for sending test notifications."""
    
    student_id = serializers.IntegerField(required=True)
    notification_type = serializers.ChoiceField(
        choices=['ATTENDANCE', 'MARKS', 'DISCIPLINE', 'PROMOTION', 'CERTIFICATE', 'GENERAL'],
        required=True
    )
    message = serializers.CharField(required=False, allow_blank=True)
