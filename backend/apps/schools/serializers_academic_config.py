"""
School Academic Configuration Serializers
"""

from rest_framework import serializers
from .models_academic_config import (
    SchoolAcademicConfig, GradeTermConfig, ExamType, 
    GradeExamStructure, CustomGradeScale
)


class SchoolAcademicConfigSerializer(serializers.ModelSerializer):
    """Serializer for SchoolAcademicConfig model."""
    
    class Meta:
        model = SchoolAcademicConfig
        fields = [
            'id', 'school', 'academic_year_start_month', 'grading_system',
            'attendance_weightage_enabled', 'attendance_weightage_percent',
            'minimum_attendance_percent', 'assignments_enabled',
            'assignments_weightage_enabled', 'assignments_weightage_percent',
            'auto_promotion_enabled', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class GradeTermConfigSerializer(serializers.ModelSerializer):
    """Serializer for GradeTermConfig model."""
    
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    
    class Meta:
        model = GradeTermConfig
        fields = [
            'id', 'school', 'grade', 'grade_name',
            'term_system', 'number_of_terms'
        ]
        read_only_fields = ['id']


class ExamTypeSerializer(serializers.ModelSerializer):
    """Serializer for ExamType model."""
    
    class Meta:
        model = ExamType
        fields = [
            'id', 'school', 'name', 'code', 'weightage_percent',
            'max_marks', 'passing_marks_percent', 'category',
            'applicable_terms', 'sequence', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class GradeExamStructureSerializer(serializers.ModelSerializer):
    """Serializer for GradeExamStructure model."""
    
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    exam_type_name = serializers.CharField(source='exam_type.name', read_only=True)
    effective_weightage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    effective_max_marks = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = GradeExamStructure
        fields = [
            'id', 'school', 'grade', 'grade_name', 'exam_type', 'exam_type_name',
            'weightage_override', 'max_marks_override', 'is_mandatory',
            'effective_weightage', 'effective_max_marks'
        ]
        read_only_fields = ['id']


class CustomGradeScaleSerializer(serializers.ModelSerializer):
    """Serializer for CustomGradeScale model."""
    
    class Meta:
        model = CustomGradeScale
        fields = [
            'id', 'school', 'grade_letter', 'min_percentage',
            'max_percentage', 'grade_points', 'description'
        ]
        read_only_fields = ['id']
