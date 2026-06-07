from rest_framework import serializers
from .models_promotion import (
    AcademicYear, PromotionRule, PromotionBatch, 
    PromotionRecord, DataCarryForward
)
from .models import StudentEnrollment
from apps.students.models import StudentHistory


class AcademicYearSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    can_close = serializers.SerializerMethodField()
    
    class Meta:
        model = AcademicYear
        fields = '__all__'
        read_only_fields = ['closed_by', 'closed_at']
    
    def get_can_close(self, obj):
        # Can only close if ACTIVE and has enrollments
        return obj.status == 'ACTIVE' and StudentEnrollment.objects.filter(
            school=obj.school, 
            academic_year=obj.year_code, 
            status='ACTIVE'
        ).exists()


class PromotionRuleSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    
    class Meta:
        model = PromotionRule
        fields = '__all__'


class PromotionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromotionRecord
        fields = '__all__'
        read_only_fields = ['is_locked']


class PromotionBatchSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    academic_year_code = serializers.CharField(source='academic_year.year_code', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.first_name', read_only=True)
    records = PromotionRecordSerializer(many=True, read_only=True)
    
    class Meta:
        model = PromotionBatch
        fields = '__all__'
        read_only_fields = ['initiated_by', 'completed_at']


class DataCarryForwardSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)
    
    class Meta:
        model = DataCarryForward
        fields = '__all__'


class PromotionPreviewSerializer(serializers.Serializer):
    """
    Preview data before executing promotion
    """
    enrollment_id = serializers.UUIDField()
    student_name = serializers.CharField()
    student_suid = serializers.CharField()
    current_grade = serializers.CharField()
    current_section = serializers.CharField()
    target_grade = serializers.CharField()
    target_section = serializers.CharField(allow_blank=True)
    action = serializers.CharField()
    reason = serializers.CharField(allow_blank=True)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)


class StudentHistorySnapshotSerializer(serializers.ModelSerializer):
    """
    Simple serializer for Student History - shows student's grade/section for a given year
    Used in Year-End Promotion History Tab
    """
    student_name = serializers.SerializerMethodField()
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    student_id = serializers.UUIDField(source='student.id', read_only=True)
    academic_year = serializers.CharField(source='academic_year_name', read_only=True)
    promoted_to_grade = serializers.SerializerMethodField()
    
    class Meta:
        model = StudentHistory
        fields = [
            'id', 'student_id', 'student_name', 'student_suid',
            'academic_year', 'grade_name', 'section_name', 'roll_number',
            'promoted', 'promoted_to_grade', 'promotion_remarks', 'created_at'
        ]
    
    def get_student_name(self, obj):
        if obj.student and obj.student.user:
            return obj.student.user.full_name
        return "Unknown"
    
    def get_promoted_to_grade(self, obj):
        """Get the grade student was promoted to (next year's grade)"""
        if not obj.promoted:
            return None  # Current year, not promoted yet
        
        # Calculate next academic year
        if not obj.academic_year_name or '-' not in obj.academic_year_name:
            return None
        
        try:
            start_year, end_year = obj.academic_year_name.split('-')
            next_year_code = f"{int(start_year) + 1}-{int(end_year) + 1}"
        except (ValueError, AttributeError):
            return None
        
        # Look up next year's record
        next_history = StudentHistory.objects.filter(
            student=obj.student,
            academic_year_name=next_year_code
        ).first()
        
        if next_history:
            return next_history.grade_name
        
        # If no next year record, student may have graduated or left
        return None


# Keep old serializer for backward compatibility but mark as deprecated
class MergedHistorySerializer(StudentHistorySnapshotSerializer):
    """
    DEPRECATED: Use StudentHistorySnapshotSerializer instead
    Kept for backward compatibility
    """
    pass
