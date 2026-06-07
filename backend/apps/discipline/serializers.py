from rest_framework import serializers
from .models import DisciplineRecord, KarmaActivity, StudentKarma, AttendanceEditLog

class DisciplineRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.full_name', read_only=True)
    
    class Meta:
        model = DisciplineRecord
        fields = '__all__'
        read_only_fields = ['reported_by', 'incident_date', 'points_deducted']


class KarmaActivitySerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    awarded_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = KarmaActivity
        fields = [
            'id', 'student', 'student_name', 'student_suid',
            'awarded_by', 'awarded_by_name', 'title', 'points', 'date'
        ]
        read_only_fields = ['id', 'date', 'awarded_by']
    
    def get_student_name(self, obj):
        return obj.student.user.full_name if hasattr(obj.student.user, 'full_name') else f"{obj.student.user.first_name} {obj.student.user.last_name}"
    
    def get_awarded_by_name(self, obj):
        if obj.awarded_by:
            return obj.awarded_by.full_name if hasattr(obj.awarded_by, 'full_name') else f"{obj.awarded_by.first_name} {obj.awarded_by.last_name}"
        return None


class StudentKarmaSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    given_by_name = serializers.SerializerMethodField()
    school_name = serializers.CharField(source='school.name', read_only=True)
    
    class Meta:
        model = StudentKarma
        fields = [
            'id', 'student', 'student_name', 'student_suid',
            'given_by_teacher', 'given_by_name', 'school', 'school_name',
            'type', 'category', 'points', 'remark', 'action_taken',
            'academic_year', 'grade', 'section',
            'visible_to_parent', 'visible_to_student',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_student_name(self, obj):
        return obj.student.user.full_name if hasattr(obj.student.user, 'full_name') else f"{obj.student.user.first_name} {obj.student.user.last_name}"
    
    def get_given_by_name(self, obj):
        if obj.given_by_teacher:
            return obj.given_by_teacher.user.full_name if hasattr(obj.given_by_teacher.user, 'full_name') else f"{obj.given_by_teacher.user.first_name} {obj.given_by_teacher.user.last_name}"
        return None


class AttendanceEditLogSerializer(serializers.ModelSerializer):
    edited_by_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    
    class Meta:
        model = AttendanceEditLog
        fields = [
            'id', 'attendance', 'edited_by', 'edited_by_name',
            'editor_role', 'old_status', 'new_status', 'reason',
            'edited_at', 'student_name'
        ]
        read_only_fields = ['id', 'edited_at']
    
    def get_edited_by_name(self, obj):
        if obj.edited_by:
            return obj.edited_by.full_name if hasattr(obj.edited_by, 'full_name') else f"{obj.edited_by.first_name} {obj.edited_by.last_name}"
        return None
    
    def get_student_name(self, obj):
        student = obj.attendance.student
        return student.user.full_name if hasattr(student.user, 'full_name') else f"{student.user.first_name} {student.user.last_name}"
