from django.contrib import admin
from .models import Teacher, TeacherAssignment, Remark, TeacherDocument

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('user', 'tuid', 'experience_years', 'salary', 'date_of_joining')

@admin.register(TeacherAssignment)
class TeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'role', 'school', 'grade', 'section')

@admin.register(Remark)
class RemarkAdmin(admin.ModelAdmin):
    list_display = ['student', 'teacher', 'category', 'severity', 'context', 'visible_to_parent', 'created_at']
    list_filter = ['category', 'severity', 'visible_to_parent', 'created_at']
    search_fields = ['student__user__first_name', 'teacher__user__first_name', 'context']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(TeacherDocument)
class TeacherDocumentAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'document_type', 'title', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('teacher__user__first_name', 'teacher__user__last_name', 'title')
