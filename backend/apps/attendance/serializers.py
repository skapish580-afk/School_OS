from rest_framework import serializers
from .models import AttendanceSession, StudentAttendance
from apps.students.models import Student

class StudentDetailSerializer(serializers.ModelSerializer):
    """Minimal student info for attendance"""
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone_number', read_only=True)
    
    class Meta:
        model = Student
        fields = ['id', 'suid', 'user_name', 'email', 'phone', 'profile_photo']

class StudentAttendanceSerializer(serializers.ModelSerializer):
    # Student Details
    student = StudentDetailSerializer(read_only=True)
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    student_suid = serializers.CharField(read_only=True)
    roll_number = serializers.SerializerMethodField()
    
    # Audit Info
    marked_by_name = serializers.CharField(source='marked_by.full_name', read_only=True)
    edited_by_name = serializers.CharField(source='edited_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = StudentAttendance
        fields = [
            'id', 'student', 'student_id', 'student_name', 'student_suid', 'roll_number',
            'status', 'remarks', 'time_in', 
            'gate_pass_id', 'health_visit_id',
            'marked_by_name', 'marked_at',
            'edited_by_name', 'edited_at'
        ]
        read_only_fields = ['student_suid', 'marked_at', 'edited_at']

    def get_roll_number(self, obj):
        """Get roll number from active enrollment"""
        enrollment = obj.student.enrollments.filter(status='ACTIVE').first()
        return enrollment.roll_number if enrollment else None

class AttendanceSessionSerializer(serializers.ModelSerializer):
    records = StudentAttendanceSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    locked_by_name = serializers.CharField(source='locked_by.full_name', read_only=True, allow_null=True)
    
    # Summary Stats
    total_students = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()
    absent_count = serializers.SerializerMethodField()
    late_count = serializers.SerializerMethodField()
    out_count = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'grade', 'section', 'date', 'session_type', 'subject',
            'is_locked', 'created_by_name', 'created_at', 'updated_at',
            'locked_by_name', 'locked_at',
            'total_students', 'present_count', 'absent_count', 'late_count', 'out_count',
            'records'
        ]
        read_only_fields = ['created_at', 'updated_at', 'locked_at']

    def validate(self, attrs):
        date_val = attrs.get('date')
        if date_val:
            if date_val.weekday() == 6:
                raise serializers.ValidationError("Attendance cannot be marked on a Sunday.")
            
            from apps.schools.models_calendar import Holiday
            request = self.context.get('request')
            school = None
            if request and request.user:
                school = getattr(request.user, 'school', None)
            
            if school:
                if Holiday.objects.filter(school=school, date=date_val).exists():
                    raise serializers.ValidationError("Attendance cannot be marked on a school holiday.")
            else:
                if Holiday.objects.filter(date=date_val).exists():
                    raise serializers.ValidationError("Attendance cannot be marked on a school holiday.")
        return attrs

    def get_total_students(self, obj):
        return obj.records.count()
    
    def get_present_count(self, obj):
        return obj.records.filter(status='PRESENT').count()
    
    def get_absent_count(self, obj):
        return obj.records.filter(status='ABSENT').count()
    
    def get_late_count(self, obj):
        return obj.records.filter(status='LATE').count()
    
    def get_out_count(self, obj):
        return obj.records.filter(status='OUT').count()