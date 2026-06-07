from rest_framework import serializers
from .models import Teacher, TeacherSchoolAssociation, TeacherAssignment, Remark
from apps.accounts.serializers import UserSerializer
from apps.schools.serializers import SchoolSerializer
from apps.features.serializers import FeatureFieldMixin


class TeacherSerializer(FeatureFieldMixin, serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone_number', read_only=True)

    class Meta:
        model = Teacher
        fields = [
            'id', 'tuid', 'user', 'user_details', 'full_name', 'email', 'phone',
            'photo', 'title', 'date_of_birth', 'gender', 'marital_status',
            'place_of_birth', 'blood_group', 'emergency_contact_phone',
            'aadhaar_last_4_digits', 'pan_number', 'dietary_preference',
            'custom_attributes',
            'qualifications', 'certified_subjects', 'experience_years', 'awards',
            'verification_status', 'created_at'
        ]
        read_only_fields = ['tuid']
    
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()


class TeacherSchoolAssociationSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_tuid = serializers.CharField(source='teacher.tuid', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = TeacherSchoolAssociation
        fields = '__all__'
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    school_details = SchoolSerializer(source='school', read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    teacher_tuid = serializers.CharField(source='teacher.tuid', read_only=True)
    student_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = [
            'id', 'teacher', 'teacher_name', 'teacher_tuid',
            'school', 'school_details',
            'role', 'grade', 'section', 'subject', 
            'academic_year', 'is_active', 'created_at', 'student_count'
        ]
        read_only_fields = ['school'] # Make school read-only so it's not required in POST
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()
    
    def get_student_count(self, obj):
        from apps.enrollments.models import StudentEnrollment
        return StudentEnrollment.objects.filter(
            grade=str(obj.grade),
            section=str(obj.section),
            status='ACTIVE'
        ).count()


class RemarkSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField(read_only=True)
    student_name = serializers.SerializerMethodField(read_only=True)
    student_suid = serializers.CharField(source='student.suid', read_only=True)
    
    class Meta:
        model = Remark
        fields = [
            'id', 'student', 'student_name', 'student_suid', 'teacher', 'teacher_name',
            'category', 'severity', 'context', 'details', 'visible_to_parent',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'teacher', 'created_at', 'updated_at']
    
    def get_teacher_name(self, obj):
        return f"{obj.teacher.user.first_name} {obj.teacher.user.last_name}".strip()
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}".strip()

