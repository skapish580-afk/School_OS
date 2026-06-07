from django.contrib import admin
from .models import Feature, SchoolFeatureConfig

@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'category', 'default_enabled')
    list_filter = ('category', 'default_enabled')
    search_fields = ('name', 'code')
    
    # Lock CORE features from being deleted or renamed carelessly
    def get_readonly_fields(self, request, obj=None):
        if obj and obj.category == 'CORE':
            return ('code', 'category')
        return ('code',)

@admin.register(SchoolFeatureConfig)
class SchoolFeatureConfigAdmin(admin.ModelAdmin):
    list_display = ('school', 'feature', 'enabled', 'has_custom_config')
    list_filter = ('school', 'enabled', 'feature__category')
    
    def has_custom_config(self, obj):
        return bool(obj.config_json)
    has_custom_config.boolean = True