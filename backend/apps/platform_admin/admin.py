from django.contrib import admin
from .models import (
    PlatformAdmin, SchoolSubscription, FeatureAccess,
    UsageMetric, PlatformAuditLog
)


@admin.register(PlatformAdmin)
class PlatformAdminAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_super_admin', 'created_at']
    list_filter = ['is_super_admin']
    search_fields = ['user__username', 'user__email']


@admin.register(SchoolSubscription)
class SchoolSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['school', 'plan', 'status', 'start_date', 'end_date']
    list_filter = ['plan', 'status']
    search_fields = ['school__name']


@admin.register(FeatureAccess)
class FeatureAccessAdmin(admin.ModelAdmin):
    list_display = ['school', 'feature', 'is_enabled', 'enabled_at']
    list_filter = ['feature', 'is_enabled']
    search_fields = ['school__name']


@admin.register(UsageMetric)
class UsageMetricAdmin(admin.ModelAdmin):
    list_display = ['school', 'metric_type', 'value', 'date']
    list_filter = ['metric_type', 'date']
    search_fields = ['school__name']


@admin.register(PlatformAuditLog)
class PlatformAuditLogAdmin(admin.ModelAdmin):
    list_display = ['school', 'action', 'performed_by', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['school__name', 'performed_by__username']
