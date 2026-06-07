from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    school_id = serializers.SerializerMethodField()
    school_name = serializers.SerializerMethodField()
    is_platform_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'full_name', 'phone_number', 'is_active', 
            'role', 'user_type', 'school_id', 'school_name', 'is_platform_admin'
        ]
        read_only_fields = ['id', 'is_active', 'role', 'school_id', 'school_name', 'is_platform_admin']
    
    def get_role(self, obj):
        """Determine user role based on related models and user_type"""
        if obj.user_type == 'PLATFORM_ADMIN' or obj.is_superuser:
            return 'PLATFORM_ADMIN'
        if obj.user_type == 'SCHOOL_ADMIN':
            return 'SCHOOL_ADMIN'
        if hasattr(obj, 'teacher_profile') and obj.teacher_profile:
            return 'TEACHER'
        if hasattr(obj, 'student') and obj.student:
            return 'STUDENT'
        if obj.user_type == 'ADMIN' or obj.is_staff:
            return 'ADMIN'
        return obj.user_type or 'USER'
    
    def get_school_id(self, obj):
        """Get user's associated school ID"""
        if obj.school:
            return str(obj.school.id)
        # Try teacher profile
        if hasattr(obj, 'teacher_profile') and obj.teacher_profile:
            teacher = obj.teacher_profile
            if hasattr(teacher, 'school') and teacher.school:
                return str(teacher.school.id)
        return None
    
    def get_school_name(self, obj):
        """Get user's associated school name"""
        if obj.school:
            return obj.school.name
        # Try teacher profile
        if hasattr(obj, 'teacher_profile') and obj.teacher_profile:
            teacher = obj.teacher_profile
            if hasattr(teacher, 'school') and teacher.school:
                return teacher.school.name
        return None
    
    def get_is_platform_admin(self, obj):
        """Check if user is platform admin - only by explicit user_type, not superuser"""
        return obj.user_type == 'PLATFORM_ADMIN'

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'full_name', 'phone_number']

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone_number=validated_data.get('phone_number')
        )
        return user