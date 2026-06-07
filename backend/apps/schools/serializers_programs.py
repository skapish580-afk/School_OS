from rest_framework import serializers
from .models_programs import Campus, AcademicProgram, GradeConfiguration

class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = ['id', 'name', 'code', 'is_primary', 'address', 'phone', 'email', 'is_active']

class GradeConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradeConfiguration
        fields = ['id', 'grade_name', 'grade_order', 'max_sections', 'default_section_names', 'section_capacity']

class AcademicProgramSerializer(serializers.ModelSerializer):
    grades = GradeConfigurationSerializer(many=True, read_only=True)
    campus_name = serializers.CharField(source='campus.name', read_only=True)
    
    class Meta:
        model = AcademicProgram
        fields = [
            'id', 'name', 'code', 'campus', 'campus_name', 'board', 
            'education_level', 'medium_of_instruction', 'evaluation_system',
            'has_shift_system', 'grades', 'is_active'
        ]
