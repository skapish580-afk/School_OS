"""
Assignment Serializers
"""

from rest_framework import serializers
from .models_assignments import Assignment, AssignmentSubmission


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Assignment model."""
    
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    section_name = serializers.CharField(source='section.section_letter', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    submission_count = serializers.IntegerField(read_only=True)
    graded_count = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Assignment
        fields = [
            'id', 'school', 'title', 'description', 'instructions',
            'grade', 'grade_name', 'section', 'section_name',
            'subject', 'subject_name', 'created_by', 'created_by_name',
            'assigned_date', 'due_date', 'max_marks',
            'assignment_type', 'status', 'include_in_grade',
            'attachments', 'submission_count', 'graded_count', 'is_overdue',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        # Auto-assign created_by and school
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
            if request.user.school and 'school' not in validated_data:
                validated_data['school'] = request.user.school
        return super().create(validated_data)


class AssignmentListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    section_name = serializers.CharField(source='section.section_letter', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'grade_name', 'section_name', 'subject_name',
            'created_by_name', 'assigned_date', 'due_date', 'max_marks',
            'assignment_type', 'status', 'created_at'
        ]


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for AssignmentSubmission model."""
    
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)
    final_marks = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    
    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment', 'assignment_title', 'student', 'student_name',
            'submission_text', 'attachments', 'submitted_at', 'updated_at',
            'is_graded', 'marks_obtained', 'feedback', 'graded_by', 'graded_at',
            'is_late', 'late_penalty_applied', 'final_marks'
        ]
        read_only_fields = ['id', 'submitted_at', 'updated_at', 'is_late', 'final_marks']
