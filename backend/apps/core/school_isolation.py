"""
School Data Isolation Mixins
Ensures users only see data from their assigned school.
Platform admins can see all data.
"""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class SchoolIsolationMixin:
    """
    Mixin for ViewSets that filters queryset by user's school.
    Platform admins see all data, school admins see only their school's data.
    """
    
    # Override this in subclass to specify the school field path
    # e.g., 'school' for direct FK, 'student__school' for nested
    school_field = 'school'
    
    def get_school_filter(self):
        """Get filter kwargs for school isolation."""
        user = self.request.user
        
        # Only explicit Platform Admin sees everything (not just any superuser)
        if user.user_type == 'PLATFORM_ADMIN':
            return {}
        
        # Helper to get the right value for the filter
        def get_filter_val(school_obj):
            if self.school_field in ['id', 'pk']:
                return school_obj.id
            return school_obj

        # School admin/teacher sees only their school
        if user.school:
            return {self.school_field: get_filter_val(user.school)}
        
        # Try to get school from teacher profile
        if hasattr(user, 'teacher_profile') and user.teacher_profile:
            teacher = user.teacher_profile
            if hasattr(teacher, 'school') and teacher.school:
                return {self.school_field: get_filter_val(teacher.school)}
        
        # No school association - show nothing
        return {self.school_field + '__isnull': False, 'pk': None}  # Returns empty queryset
    
    def get_queryset(self):
        """Filter queryset by user's school."""
        queryset = super().get_queryset()
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
        return queryset
    
    def get_user_school(self):
        """Get the school for the current user."""
        user = self.request.user
        
        if user.school:
            return user.school
        
        if hasattr(user, 'teacher_profile') and user.teacher_profile:
            teacher = user.teacher_profile
            if hasattr(teacher, 'school'):
                return teacher.school
        
        return None


class IsSchoolAdminOrPlatformAdmin(permissions.BasePermission):
    """
    Permission class that allows:
    - Platform admins: full access
    - School admins: access to their school's data only
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Platform admin has full access
        if request.user.user_type == 'PLATFORM_ADMIN' or request.user.is_superuser:
            return True
        
        # School admin has access
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Platform admin has full access
        if request.user.user_type == 'PLATFORM_ADMIN' or request.user.is_superuser:
            return True
        
        # School admin can only access their school's objects
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            obj_school = getattr(obj, 'school', None)
            if obj_school is None and hasattr(obj, 'student'):
                obj_school = getattr(obj.student, 'school', None)
            
            return obj_school == request.user.school
        
        return False


class IsSchoolMember(permissions.BasePermission):
    """
    Permission for teachers and school admins to access their school's data.
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Platform admin has full access
        if request.user.user_type == 'PLATFORM_ADMIN' or request.user.is_superuser:
            return True
        
        # School admin and teachers have access
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN', 'TEACHER']:
            return True
        
        return False


def get_user_school(user):
    """
    Helper function to get school for any user type.
    """
    if not user.is_authenticated:
        return None
    
    # Direct school assignment
    if user.school:
        return user.school
    
    # Try teacher profile
    if hasattr(user, 'teacher_profile') and user.teacher_profile:
        teacher = user.teacher_profile
        if hasattr(teacher, 'school') and teacher.school:
            return teacher.school
    
    # Try student profile
    if hasattr(user, 'student_profile') and user.student_profile:
        student = user.student_profile
        if hasattr(student, 'school') and student.school:
            return student.school
    
    return None


def is_platform_admin(user):
    """Check if user is platform admin."""
    return user.is_authenticated and (
        user.user_type == 'PLATFORM_ADMIN' or user.is_superuser
    )
