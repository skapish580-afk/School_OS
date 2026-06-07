from rest_framework import serializers
from .models import Achievement, StudentArtifact, StudentYearlyAward

class AchievementSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.student.suid', read_only=True)
    current_class = serializers.SerializerMethodField()
    
    class Meta:
        model = Achievement
        fields = '__all__'
    
    def get_current_class(self, obj):
        return f"{obj.student.grade}-{obj.student.section}"


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