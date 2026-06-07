from django.contrib import admin
from .models import (
    NotificationTemplate,
    ParentContact,
    StudentNotificationLog,
    NotificationQueue,
)


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('category', 'title', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'school')
    search_fields = ('title', 'body')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('school', 'category', 'id')
        }),
        ('Content', {
            'fields': ('title', 'body')
        }),
        ('Channels', {
            'fields': ('channels',),
            'description': 'Enable/disable channels: {"email": true, "sms": true, "whatsapp": true}'
        }),
        ('Status', {
            'fields': ('is_active', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ParentContact)
class ParentContactAdmin(admin.ModelAdmin):
    list_display = ('parent', 'phone_number', 'email', 'notifications_enabled', 'updated_at')
    list_filter = ('notifications_enabled', 'whatsapp_enabled')
    search_fields = ('parent__first_name', 'parent__last_name', 'phone_number', 'email')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Parent', {
            'fields': ('id', 'parent')
        }),
        ('Contact Information', {
            'fields': ('phone_country_code', 'phone_number', 'email')
        }),
        ('Preferences', {
            'fields': ('notifications_enabled', 'whatsapp_enabled', 'preferred_channels'),
            'description': 'Preferred channels: ["sms", "email", "whatsapp"]'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(StudentNotificationLog)
class StudentNotificationLogAdmin(admin.ModelAdmin):
    list_display = ('student', 'parent', 'notification_type', 'status', 'created_at')
    list_filter = ('notification_type', 'status', 'created_at')
    search_fields = ('student__user__full_name', 'parent__full_name', 'subject')
    readonly_fields = ('id', 'created_at', 'sent_at')
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Recipient Info', {
            'fields': ('id', 'student', 'parent')
        }),
        ('Content', {
            'fields': ('notification_type', 'subject', 'message')
        }),
        ('Delivery', {
            'fields': ('channels_sent', 'delivery_status', 'status')
        }),
        ('Error Info', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'sent_at'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Logs are created automatically, don't allow manual creation


@admin.register(NotificationQueue)
class NotificationQueueAdmin(admin.ModelAdmin):
    list_display = ('log', 'status', 'retry_count', 'scheduled_at')
    list_filter = ('status', 'scheduled_at')
    readonly_fields = ('id', 'processed_at')
    
    fieldsets = (
        ('Notification', {
            'fields': ('id', 'log')
        }),
        ('Status', {
            'fields': ('status', 'retry_count', 'max_retries')
        }),
        ('Scheduling', {
            'fields': ('scheduled_at', 'processed_at')
        }),
    )
