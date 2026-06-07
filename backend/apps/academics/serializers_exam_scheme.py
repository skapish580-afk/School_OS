"""
Serializers for Exam Scheme system
"""

from rest_framework import serializers
from .models_exam_scheme import (
    ExamScheme, SchemeExam, ExamSubject, ExamInstance, StudentResult
)
from apps.academics.models import Subject, Section, Student


class SchemeExamSerializer(serializers.ModelSerializer):
    """Serializer for individual exams within a scheme"""
    
    class Meta:
        model = SchemeExam
        fields = [
            'id', 'name', 'code', 'description', 'max_marks',
            'passing_marks_percent', 'weightage_percent', 'exam_type',
            'is_final', 'sequence', 'status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ExamSubjectSerializer(serializers.ModelSerializer):
    """Serializer for exam-subject mapping"""
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    default_passing_marks = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamSubject
        fields = [
            'id', 'exam', 'exam_name', 'subject', 'subject_name',
            'passing_marks', 'default_passing_marks', 'is_mandatory',
            'sequence', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_default_passing_marks(self, obj):
        """Get default passing marks from exam"""
        return obj.exam.get_passing_marks()


class ExamSchemeListSerializer(serializers.ModelSerializer):
    """Simple list view for exam schemes"""
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    total_marks = serializers.SerializerMethodField()
    exam_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamScheme
        fields = [
            'id', 'grade', 'grade_name', 'academic_year', 'board',
            'school_name', 'total_marks', 'exam_count', 'is_active',
            'is_published', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_total_marks(self, obj):
        return obj.get_total_marks()
    
    def get_exam_count(self, obj):
        return obj.exams.count()


class ExamSchemeDetailSerializer(serializers.ModelSerializer):
    """Detailed view with all exams and subject mappings"""
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    exams = SchemeExamSerializer(many=True, read_only=True)
    total_marks = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamScheme
        fields = [
            'id', 'school', 'school_name', 'grade', 'grade_name',
            'academic_year', 'board', 'is_active', 'is_published',
            'exams', 'total_marks', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_total_marks(self, obj):
        return obj.get_total_marks()


class ExamInstanceListSerializer(serializers.ModelSerializer):
    """List view for exam instances (teacher sees these)"""
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    grade_name = serializers.CharField(source='grade.grade_name', read_only=True)
    submitted_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()
    
    class Meta:
        model = ExamInstance
        fields = [
            'id', 'exam_name', 'subject_name', 'section_name', 'grade_name',
            'status', 'exam_date', 'submitted_count', 'total_students', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_submitted_count(self, obj):
        """Count submitted results"""
        return obj.student_results.filter(
            moderation_status__in=['SUBMITTED', 'APPROVED', 'PUBLISHED']
        ).count()
    
    def get_total_students(self, obj):
        """Total students in section"""
        return obj.section.students.count()


class StudentResultListSerializer(serializers.ModelSerializer):
    """List of results for a teacher to enter marks"""
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_roll_no = serializers.CharField(source='student.roll_number', read_only=True)
    final_marks = serializers.SerializerMethodField()
    
    class Meta:
        model = StudentResult
        fields = [
            'id', 'student', 'student_name', 'student_roll_no',
            'marks_obtained', 'grace_marks', 'final_marks',
            'attendance_status', 'is_pass', 'remarks',
            'moderation_status', 'attempt_number'
        ]
    
    def get_final_marks(self, obj):
        return obj.calculate_final_marks()


class StudentResultDetailSerializer(serializers.ModelSerializer):
    """Full details of a single result"""
    exam_name = serializers.CharField(source='exam_instance.exam.name', read_only=True)
    subject_name = serializers.CharField(source='exam_instance.subject.name', read_only=True)
    max_marks = serializers.SerializerMethodField()
    passing_marks = serializers.SerializerMethodField()
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    final_marks = serializers.SerializerMethodField()
    
    class Meta:
        model = StudentResult
        fields = [
            'id', 'exam_name', 'subject_name', 'student_name',
            'marks_obtained', 'grace_marks', 'final_marks',
            'max_marks', 'passing_marks', 'is_pass',
            'attendance_status', 'remarks', 'moderation_status',
            'attempt_number', 'is_compartment', 'created_at'
        ]
        read_only_fields = ['id', 'is_pass', 'created_at']
    
    def get_max_marks(self, obj):
        return obj.exam_instance.exam.max_marks
    
    def get_passing_marks(self, obj):
        return obj.exam_instance.exam.get_passing_marks()
    
    def get_final_marks(self, obj):
        return obj.calculate_final_marks()
