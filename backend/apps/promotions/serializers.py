from rest_framework import serializers
from .models import PromotionBatch, PromotionAssignment, PromotionAudit, AcademicHistory


class PromotionAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromotionAssignment
        fields = '__all__'


class PromotionBatchSerializer(serializers.ModelSerializer):
    assignments = PromotionAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = PromotionBatch
        fields = '__all__'


class AcademicHistorySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = AcademicHistory
        fields = (
            'id', 'student', 'academic_year', 'class_name', 'section',
            'marks', 'grades', 'awards', 'summary', 'archived_at', 'student_name'
        )

    def get_student_name(self, obj):
        try:
            first = getattr(obj.student, 'first_name', '') or ''
            last = getattr(obj.student, 'last_name', '') or ''
            full = (first + ' ' + last).strip()
            return full or str(obj.student)
        except Exception:
            return str(obj.student)
