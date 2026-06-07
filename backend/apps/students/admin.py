from django.contrib import admin
from .models import Student

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    # FIX: Changed 'dob' to 'date_of_birth'
    list_display = ('suid', 'get_name', 'get_class', 'date_of_birth', 'gender', 'admission_date')
    search_fields = ('suid', 'user__full_name', 'user__email')
    
    # These helpers let us show User/Class info in the Student list
    def get_name(self, obj):
        return obj.user.full_name
    get_name.short_description = 'Student Name'

    def get_class(self, obj):
        # Safely get class if enrollment exists
        enrollment = obj.enrollments.filter(status='Active').first()
        if enrollment:
            return f"{enrollment.grade}-{enrollment.section}"
        return "Unassigned"
    get_class.short_description = 'Class'