from django.contrib import admin
from .models import StudentEnrollment
from .models_continuation import ContinuationException

@admin.register(StudentEnrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    # Display these columns in the list
    list_display = ('student', 'school', 'grade', 'section', 'roll_number', 'status')
    
    # Allow filtering by these
    list_filter = ('school', 'grade', 'status', 'academic_year')
    
    # Allow searching
    search_fields = ('student__user__full_name', 'grade', 'roll_number')


@admin.register(ContinuationException)
class ContinuationExceptionAdmin(admin.ModelAdmin):
    list_display = ('student', 'school', 'is_active', 'approved_by', 'approved_date')
    list_filter = ('school', 'is_active', 'approved_date')
    search_fields = ('student__user__full_name', 'reason')
    readonly_fields = ('approved_date',)