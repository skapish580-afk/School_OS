"""
Dashboard Serializers for Admin Notes and Broadcast Notifications
"""

from rest_framework import serializers
from .models_dashboard import AdminNote, BroadcastNotification, BroadcastReadReceipt


class AdminNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = AdminNote
        fields = [
            'id', 'title', 'content', 'color', 'priority',
            'is_pinned', 'is_completed', 'due_date',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at', 'updated_at']


class BroadcastNotificationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    audience_display = serializers.CharField(source='get_audience_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = BroadcastNotification
        fields = [
            'id', 'title', 'message', 'audience', 'audience_display',
            'priority', 'priority_display', 'target_grades', 'target_sections',
            'status', 'status_display', 'scheduled_for', 'sent_at',
            'recipients_count', 'read_count',
            'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by_name', 'audience_display', 'priority_display',
            'status_display', 'recipients_count', 'read_count',
            'sent_at', 'created_at', 'updated_at'
        ]


class BroadcastReadReceiptSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_type = serializers.CharField(source='user.user_type', read_only=True)
    
    class Meta:
        model = BroadcastReadReceipt
        fields = ['id', 'user_name', 'user_type', 'read_at']


class SendBroadcastSerializer(serializers.Serializer):
    """Serializer for sending a broadcast notification"""
    title = serializers.CharField(max_length=200)
    message = serializers.CharField()
    audience = serializers.ChoiceField(choices=[
        ('TEACHERS', 'Teachers Only'),
        ('STUDENTS', 'Students Only'),
        ('BOTH', 'Teachers & Students'),
        ('ALL', 'Everyone'),
    ])
    priority = serializers.ChoiceField(choices=[
        ('LOW', 'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    ], default='NORMAL')
    target_grades = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
