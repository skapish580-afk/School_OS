from django.contrib import admin
from .models import PromotionBatch, PromotionAssignment, PromotionAudit, AcademicHistory


@admin.register(PromotionBatch)
class PromotionBatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'school', 'year_from', 'year_to', 'status', 'created_at')
    list_filter = ('status', 'year_from', 'year_to')


@admin.register(PromotionAssignment)
class PromotionAssignmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'batch', 'student', 'promoted_to_class', 'promoted_to_division', 'status')
    list_filter = ('status',)


@admin.register(PromotionAudit)
class PromotionAuditAdmin(admin.ModelAdmin):
    list_display = ('id', 'batch', 'action', 'user', 'timestamp')


@admin.register(AcademicHistory)
class AcademicHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'student', 'academic_year', 'class_name', 'archived_at')
