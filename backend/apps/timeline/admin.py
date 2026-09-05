from django.contrib import admin
from .models import TimelineMark, TimelineRemark, TimelineHealth, StudentEnrollmentArchive

@admin.register(TimelineMark)
class TimelineMarkAdmin(admin.ModelAdmin):
    list_display = ('student_global_id', 'subject', 'exam_name', 'grade', 'marks_obtained', 'total_marks', 'is_pass', 'recorded_at')
    list_filter = ('grade', 'subject', 'is_pass')
    search_fields = ('student_global_id', 'subject', 'exam_name')


@admin.register(TimelineRemark)
class TimelineRemarkAdmin(admin.ModelAdmin):
    list_display = ('student_global_id', 'grade', 'record_type', 'title', 'points', 'teacher_name', 'recorded_at')
    list_filter = ('grade', 'record_type')
    search_fields = ('student_global_id', 'title', 'teacher_name')


@admin.register(TimelineHealth)
class TimelineHealthAdmin(admin.ModelAdmin):
    list_display = ('student_global_id', 'visit_date', 'symptom', 'recorded_by', 'recorded_at')
    list_filter = ('visit_date', 'sent_home')
    search_fields = ('student_global_id', 'symptom', 'recorded_by')


@admin.register(StudentEnrollmentArchive)
class StudentEnrollmentArchiveAdmin(admin.ModelAdmin):
    list_display = ('student_global_id', 'status', 'school_name', 'archived_at')
    list_filter = ('status', 'school_name')
    search_fields = ('student_global_id', 'school_name')
