from django.contrib import admin
from .models import (
    Section, Subject, SubjectMapping, Timetable, Period, TemporarySubstitution,
    Syllabus, Chapter, Exam, Result, ReportCard, ExamAbsenteeLog, MalpracticeIncident
)
from .models_exam_scheme import (
    ExamScheme, SchemeExam, ExamSubject, ExamInstance, StudentResult
)


# NOTE: GradeAdmin removed - Grades are now managed via GradeConfiguration in schools app

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'grade_config', 'section_letter', 'capacity', 'class_teacher', 'capacity_locked', 'is_active']
    list_filter = ['school', 'grade_config', 'is_active', 'capacity_locked']
    search_fields = ['section_letter', 'grade_config__grade_name', 'school__name']
    readonly_fields = ['id', 'created_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'school', 'grade_config', 'section_letter', 'room_number', 'created_at')
        }),
        ('Teachers', {
            'fields': ('class_teacher', 'co_class_teacher')
        }),
        ('Capacity Management', {
            'fields': ('capacity', 'capacity_locked'),
            'description': 'Lock to prevent new enrollments'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'subject_type', 'passing_marks', 'affects_promotion', 'is_active']
    list_filter = ['school', 'subject_type', 'affects_promotion', 'is_active']
    search_fields = ['code', 'name', 'school__name']
    readonly_fields = ['id', 'created_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'school', 'code', 'name', 'description', 'created_at')
        }),
        ('Classification', {
            'fields': ('subject_type', 'is_core')
        }),
        ('Academic Rules', {
            'fields': ('passing_marks', 'affects_promotion', 'included_in_board_report'),
            'description': 'Rules for this subject affecting promotion and reporting'
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


@admin.register(SubjectMapping)
class SubjectMappingAdmin(admin.ModelAdmin):
    list_display = ['subject', 'section', 'teacher', 'co_teacher', 'periods_per_week', 'max_marks', 'is_active']
    list_filter = ['school', 'subject', 'is_active']
    search_fields = ['subject__name', 'section__section_letter', 'teacher__user__full_name']
    readonly_fields = ['id', 'created_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'school', 'subject', 'section', 'created_at')
        }),
        ('Teachers', {
            'fields': ('teacher', 'co_teacher'),
            'description': 'Primary and co-teacher assignment'
        }),
        ('Allocation & Rules', {
            'fields': ('periods_per_week', 'max_marks', 'exam_weightage'),
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ['section', 'is_locked', 'locked_by', 'updated_at']
    list_filter = ['school', 'is_locked', 'updated_at']
    search_fields = ['section__section_letter', 'school__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'school', 'section', 'created_at', 'updated_at')
        }),
        ('Lock Control', {
            'fields': ('is_locked', 'locked_by'),
            'description': 'Lock to prevent changes (Principal only can override)'
        }),
    )


class PeriodInline(admin.TabularInline):
    model = Period
    extra = 1
    fields = ['day', 'period_number', 'start_time', 'end_time', 'subject_mapping', 'classroom']


@admin.register(Period)
class PeriodAdmin(admin.ModelAdmin):
    list_display = ['timetable', 'day', 'period_number', 'start_time', 'end_time', 'subject_mapping', 'classroom']
    list_filter = ['timetable__section', 'day', 'timetable__school']
    search_fields = ['classroom', 'timetable__section__section_letter']
    readonly_fields = ['id']


@admin.register(TemporarySubstitution)
class TemporarySubstitutionAdmin(admin.ModelAdmin):
    list_display = ['period', 'original_teacher', 'substitute_teacher', 'date_from', 'date_to', 'is_active']
    list_filter = ['is_active', 'date_from', 'approved_by']
    search_fields = ['original_teacher__user__full_name', 'substitute_teacher__user__full_name']
    readonly_fields = ['id', 'created_at']
    fieldsets = (
        ('Substitution Info', {
            'fields': ('id', 'period', 'original_teacher', 'substitute_teacher', 'reason', 'created_at')
        }),
        ('Duration', {
            'fields': ('date_from', 'date_to')
        }),
        ('Approval', {
            'fields': ('is_active', 'approved_by')
        }),
    )


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 1
    fields = ['chapter_number', 'title', 'status', 'planned_start_date', 'planned_end_date']


@admin.register(Syllabus)
class SyllabusAdmin(admin.ModelAdmin):
    list_display = ['subject_mapping', 'academic_year', 'total_chapters', 'progress_percentage', 'updated_at']
    list_filter = ['school', 'academic_year']
    search_fields = ['subject_mapping__subject__name', 'school__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    inlines = [ChapterInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ['syllabus', 'chapter_number', 'title', 'status', 'planned_end_date', 'last_updated_at']
    list_filter = ['status', 'syllabus__subject_mapping__subject']
    search_fields = ['title', 'syllabus__subject_mapping__subject__name']
    readonly_fields = ['id', 'last_updated_at']


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ['name', 'exam_type', 'section', 'exam_date', 'duration_minutes', 'max_marks', 'grace_marks']
    list_filter = ['school', 'exam_type', 'exam_date', 'academic_year']
    search_fields = ['name', 'subject_mapping__subject__name', 'exam_room']
    readonly_fields = ['id', 'created_at', 'updated_at']
    filter_horizontal = ['invigilators']
    fieldsets = (
        ('Exam Details', {
            'fields': ('id', 'school', 'section', 'subject_mapping', 'name', 'exam_type', 'academic_year', 'created_at', 'updated_at')
        }),
        ('Schedule & Duration', {
            'fields': ('exam_date', 'duration_minutes', 'exam_room')
        }),
        ('Marks & Rules', {
            'fields': ('max_marks', 'passing_marks', 'min_attendance_percentage', 'grace_marks'),
            'description': 'Grace marks can only be set by admin'
        }),
        ('Invigilators', {
            'fields': ('invigilators',)
        }),
    )


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'exam', 'marks_obtained', 'grade', 'moderation_status', 'recorded_at']
    list_filter = ['exam__school', 'moderation_status', 'grade', 'recorded_at']
    search_fields = ['student__user__full_name', 'exam__name']
    readonly_fields = ['id', 'recorded_at', 'grade', 'grade_point']
    fieldsets = (
        ('Exam & Student', {
            'fields': ('id', 'exam', 'student')
        }),
        ('Marks', {
            'fields': ('marks_obtained', 'is_absent', 'grade', 'grade_point'),
            'description': 'Grade calculated automatically'
        }),
        ('Moderation', {
            'fields': ('moderation_status', 'moderation_by', 'moderation_remarks'),
            'description': 'Workflow: DRAFT → SUBMITTED → APPROVED → LOCKED'
        }),
        ('Recording', {
            'fields': ('remarks', 'recorded_by', 'recorded_at')
        }),
    )


@admin.register(ExamAbsenteeLog)
class ExamAbsenteeLogAdmin(admin.ModelAdmin):
    list_display = ['result', 'is_eligible_for_reexam', 're_exam_date', 're_exam_marks']
    list_filter = ['is_eligible_for_reexam', 'created_at']
    search_fields = ['result__student__user__full_name', 'result__exam__name']
    readonly_fields = ['id', 'created_at']


@admin.register(MalpracticeIncident)
class MalpracticeIncidentAdmin(admin.ModelAdmin):
    list_display = ['student', 'exam', 'severity', 'reported_by', 'approved_by', 'created_at']
    list_filter = ['severity', 'exam__school', 'created_at']
    search_fields = ['student__user__full_name', 'exam__name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Incident Details', {
            'fields': ('id', 'exam', 'student', 'severity', 'description', 'created_at', 'updated_at')
        }),
        ('Reporting', {
            'fields': ('reported_by',)
        }),
        ('Action', {
            'fields': ('action_taken', 'approved_by'),
            'description': 'Disciplinary action and approval'
        }),
    )


@admin.register(ReportCard)
class ReportCardAdmin(admin.ModelAdmin):
    list_display = ['student', 'section', 'term_name', 'percentage', 'grade_awarded', 'rank', 'is_locked', 'generated_date']
    list_filter = ['section__school', 'academic_year', 'is_locked', 'generated_date']
    search_fields = ['student__user__full_name', 'term_name']
    readonly_fields = ['id', 'generated_date', 'locked_at']
    fieldsets = (
        ('Student & Academic Info', {
            'fields': ('id', 'student', 'section', 'term_name', 'academic_year', 'generated_date')
        }),
        ('Performance', {
            'fields': ('total_marks_obtained', 'total_marks_possible', 'percentage', 'grade_awarded', 'rank')
        }),
        ('Lock Control', {
            'fields': ('is_locked', 'locked_at'),
            'description': 'Lock to finalize results'
        }),
        ('Additional', {
            'fields': ('remarks', 'generated_by', 'file_path')
        }),
    )


# ============================================================================
# NEW EXAM SCHEME SYSTEM (Industry-standard CBSE/ICSE-aligned)
# ============================================================================

@admin.register(ExamScheme)
class ExamSchemeAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'academic_year', 'board', 'is_active', 'is_published', 'created_at']
    list_filter = ['school', 'is_active', 'is_published', 'academic_year']
    search_fields = ['grade__grade_name', 'school__name', 'academic_year']
    readonly_fields = ['id', 'created_at', 'updated_at', 'created_by']
    fieldsets = (
        ('Scheme Info', {
            'fields': ('id', 'school', 'grade', 'academic_year', 'board', 'created_by', 'created_at', 'updated_at')
        }),
        ('Status', {
            'fields': ('is_active', 'is_published'),
            'description': 'Published schemes cannot be edited. Instance generation available after publishing.'
        }),
    )
    actions = ['publish_schemes']
    
    def publish_schemes(self, request, queryset):
        updated = queryset.filter(is_published=False).update(is_published=True)
        self.message_user(request, f'{updated} schemes published')
    publish_schemes.short_description = 'Publish selected schemes'


@admin.register(SchemeExam)
class SchemeExamAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'scheme', 'exam_type', 'max_marks', 'weightage_percent', 'is_final', 'sequence']
    list_filter = ['scheme__school', 'exam_type', 'is_final', 'status']
    search_fields = ['name', 'code', 'scheme__grade__grade_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Exam Info', {
            'fields': ('id', 'scheme', 'name', 'code', 'description')
        }),
        ('Marks & Rules', {
            'fields': ('max_marks', 'passing_marks_percent', 'exam_type', 'is_final')
        }),
        ('Weightage', {
            'fields': ('weightage_percent',),
            'description': 'Percentage weight in final grade calculation'
        }),
        ('Display', {
            'fields': ('sequence', 'status', 'created_at', 'updated_at')
        }),
    )


@admin.register(ExamSubject)
class ExamSubjectAdmin(admin.ModelAdmin):
    list_display = ['exam', 'subject', 'is_mandatory', 'passing_marks', 'sequence']
    list_filter = ['exam__scheme__school', 'is_mandatory']
    search_fields = ['exam__name', 'subject__name']
    readonly_fields = ['id', 'created_at']
    fieldsets = (
        ('Mapping', {
            'fields': ('id', 'exam', 'subject')
        }),
        ('Settings', {
            'fields': ('is_mandatory', 'passing_marks', 'sequence'),
            'description': 'Leave passing_marks blank to use exam default'
        }),
        ('Meta', {
            'fields': ('created_at',)
        }),
    )


@admin.register(ExamInstance)
class ExamInstanceAdmin(admin.ModelAdmin):
    list_display = ['exam', 'subject', 'section', 'status', 'exam_date', 'published_at']
    list_filter = ['school', 'status', 'exam_date', 'grade']
    search_fields = ['exam__name', 'subject__name', 'section__name']
    readonly_fields = ['id', 'grade', 'school', 'created_at', 'updated_at', 'published_at']
    fieldsets = (
        ('Instance Info', {
            'fields': ('id', 'exam', 'subject', 'section', 'grade', 'school')
        }),
        ('Schedule', {
            'fields': ('exam_date', 'duration_minutes')
        }),
        ('Status', {
            'fields': ('status', 'published_at', 'created_at', 'updated_at'),
            'description': 'Status workflow: DRAFT → ACTIVE → SUBMITTED → APPROVED → PUBLISHED'
        }),
    )
    
    def has_add_permission(self, request):
        # Prevent manual creation - only auto-generate via button
        return False


@admin.register(StudentResult)
class StudentResultAdmin(admin.ModelAdmin):
    list_display = ['student', 'exam_instance', 'marks_obtained', 'is_pass', 'moderation_status', 'attempt_number']
    list_filter = ['exam_instance__school', 'moderation_status', 'is_pass', 'attempt_number', 'is_compartment']
    search_fields = ['student__user__full_name', 'exam_instance__exam__name', 'exam_instance__subject__name']
    readonly_fields = ['id', 'is_pass', 'locked_at', 'created_at', 'updated_at']
    fieldsets = (
        ('Student & Exam', {
            'fields': ('id', 'exam_instance', 'student', 'attempt_number')
        }),
        ('Marks Entry', {
            'fields': ('marks_obtained', 'grace_marks', 'attendance_status'),
            'description': 'Teachers enter marks_obtained. Admin only can award grace_marks'
        }),
        ('Results', {
            'fields': ('is_pass', 'remarks'),
            'description': 'Pass/Fail calculated automatically'
        }),
        ('Moderation', {
            'fields': ('moderation_status', 'locked_at'),
            'description': 'DRAFT → SUBMITTED → APPROVED → PUBLISHED (locked)'
        }),
        ('Re-exam & Compartment', {
            'fields': ('is_compartment',)
        }),
        ('Meta', {
            'fields': ('created_at', 'updated_at')
        }),
    )
