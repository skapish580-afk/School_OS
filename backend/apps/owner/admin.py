from django.contrib import admin
from .models import PlatformOwner, SchoolSubscription, FeatureToggle, OwnerAuditLog


@admin.register(PlatformOwner)
class PlatformOwnerAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']


@admin.register(SchoolSubscription)
class SchoolSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['school', 'plan', 'status', 'max_students', 'max_teachers', 'start_date', 'end_date']
    list_filter = ['plan', 'status']
    search_fields = ['school__name', 'school__code']
    date_hierarchy = 'created_at'


@admin.register(FeatureToggle)
class FeatureToggleAdmin(admin.ModelAdmin):
    list_display = ['school', 'feature', 'is_enabled', 'enabled_by', 'enabled_at']
    list_filter = ['feature', 'is_enabled']
    search_fields = ['school__name']


@admin.register(OwnerAuditLog)
class OwnerAuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'school', 'performed_by', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['description', 'school__name', 'performed_by__email']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']
