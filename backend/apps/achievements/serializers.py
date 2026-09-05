from rest_framework import serializers
from .models import Achievement, StudentArtifact, StudentYearlyAward

from apps.enrollments.models import StudentEnrollment

class AchievementSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.student.suid', read_only=True)
    current_class = serializers.SerializerMethodField()
    
    # Allow student and title to be not required/custom resolved in to_internal_value
    student = serializers.PrimaryKeyRelatedField(queryset=StudentEnrollment.objects.all(), required=False)
    title = serializers.CharField(required=False, allow_blank=True)
    date_awarded = serializers.DateField(required=False)
    
    class Meta:
        model = Achievement
        fields = '__all__'
    
    def get_current_class(self, obj):
        if obj.student:
            return f"{obj.student.grade}-{obj.student.section}"
        return "Unassigned"

    def to_internal_value(self, data):
        # QueryDict is immutable, copy it if needed
        if hasattr(data, 'copy'):
            data = data.copy()
            
        student_id = data.get('student')
        if student_id:
            # Check if this is a Student ID instead of a StudentEnrollment ID
            from django.core.exceptions import ValidationError
            is_enrollment = False
            try:
                if StudentEnrollment.objects.filter(id=student_id).exists():
                    is_enrollment = True
            except (ValidationError, ValueError):
                pass

            if not is_enrollment:
                try:
                    # Find the active StudentEnrollment for this Student ID
                    enrollment = StudentEnrollment.objects.filter(student_id=student_id, status='ACTIVE').first()
                    if not enrollment:
                        enrollment = StudentEnrollment.objects.filter(student_id=student_id).first()
                    if enrollment:
                        data['student'] = str(enrollment.id)
                except (ValidationError, ValueError):
                    pass
        
        # Normalize category
        if 'category' in data:
            category_val = str(data['category']).upper().replace('-', '_')
            if category_val in ['CURRICULAR', 'NON_CURRICULAR', 'EXTRA_CURRICULAR']:
                data['category'] = category_val

        # Auto-populate date_awarded if missing
        if not data.get('date_awarded'):
            from django.utils import timezone
            data['date_awarded'] = str(timezone.now().date())
            
        # Auto-populate title if missing
        if not data.get('title'):
            category = data.get('category', 'OTHER')
            data['title'] = f"{category.replace('_', ' ').capitalize()} Achievement"
            
        return super().to_internal_value(data)


class StudentYearlyAwardSerializer(serializers.ModelSerializer):
    """Serializer for yearly awards - the main achievements data"""
    student_name = serializers.CharField(source='student.full_name_display', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    grade_name = serializers.CharField(source='student_history.grade_name', read_only=True, allow_null=True)
    section_name = serializers.CharField(source='student_history.section_name', read_only=True, allow_null=True)
    school_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    award_type_display = serializers.CharField(source='get_award_type_display', read_only=True)
    
    class Meta:
        model = StudentYearlyAward
        fields = [
            'id', 'student', 'student_name', 'student_suid', 
            'student_history', 'academic_year', 'grade_name', 'section_name', 'school_name',
            'title', 'description', 'award_type', 'award_type_display',
            'category', 'category_display', 'level', 'level_display',
            'position', 'cash_prize_amount', 'cash_prize_currency',
            'certificate_image', 'event_name', 'event_date', 'awarded_by',
            'created_at'
        ]
    
    def get_school_name(self, obj):
        if obj.student_history and obj.student_history.school:
            return obj.student_history.school.name
        return obj.student.school.name if obj.student.school else None


class StudentArtifactSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.student.suid', read_only=True)
    
    class Meta:
        model = StudentArtifact
        fields = '__all__'