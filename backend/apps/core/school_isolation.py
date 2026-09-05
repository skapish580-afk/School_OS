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
        
        # Superuser and platform admin see everything or filter by explicit school param
        if user.is_superuser or user.user_type == 'PLATFORM_ADMIN':
            school_id = self.request.query_params.get('school') or self.request.query_params.get('school_id')
            if school_id:
                return {self.school_field: school_id}
            return {}
        
        # Helper to get the right value for the filter
        def get_filter_val(school_obj):
            if self.school_field in ['id', 'pk']:
                return school_obj.id if hasattr(school_obj, 'id') else school_obj
            return school_obj

        # Dynamically resolve active school for user / request context
        user_school = self.get_user_school()
        if user_school:
            return {self.school_field: get_filter_val(user_school)}

        # Direct user.school fallback
        if getattr(user, 'school', None):
            return {self.school_field: get_filter_val(user.school)}
        
        # Try to get school from teacher profile
        if hasattr(user, 'teacher_profile') and user.teacher_profile:
            teacher = user.teacher_profile
            assoc = teacher.school_associations.filter(status='ACTIVE').first()
            if assoc:
                return {self.school_field: get_filter_val(assoc.school)}
        
        # No school association - show nothing
        return {self.school_field + '__isnull': False, 'pk': None}  # Returns empty queryset
    
    def get_queryset(self):
        """Filter queryset by user's school."""
        queryset = super().get_queryset()
        school_filter = self.get_school_filter()
        if school_filter:
            queryset = queryset.filter(**school_filter)
        return queryset

    def perform_create(self, serializer):
        """Save instance and record hierarchy edit log event."""
        user = self.request.user
        extra = {}
        if hasattr(serializer.Meta.model, 'created_by') and user.is_authenticated:
            extra['created_by'] = user
        if hasattr(serializer.Meta.model, 'school') and 'school' not in serializer.validated_data:
            school = self.get_user_school()
            if school:
                extra['school'] = school
        instance = serializer.save(**extra)
        
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        summary = f"Created {instance.__class__.__name__} ({str(instance)})"
        log_hierarchy_record_edit(user, instance, 'CREATE', changes_summary=summary, school=self.get_user_school())

    def perform_update(self, serializer):
        """Save updated instance and record hierarchy edit log event with diff summary."""
        user = self.request.user
        extra = {}
        if hasattr(serializer.Meta.model, 'last_updated_by') and user.is_authenticated:
            extra['last_updated_by'] = user
        elif hasattr(serializer.Meta.model, 'updated_by') and user.is_authenticated:
            extra['updated_by'] = user
            
        changed_fields = list(serializer.validated_data.keys()) if hasattr(serializer, 'validated_data') else []
        instance = serializer.save(**extra)
        
        from apps.accounts.permission_utils import log_hierarchy_record_edit
        diff_str = f"Updated fields: {', '.join(changed_fields)}" if changed_fields else f"Updated {instance.__class__.__name__}"
        log_hierarchy_record_edit(user, instance, 'UPDATE', changes_summary=diff_str, school=self.get_user_school())

    def get_user_school(self):
        """Get the school for the current user or request context."""
        req = getattr(self, 'request', None)
        if req:
            school_id = (
                req.query_params.get('school') or
                req.query_params.get('school_id') or
                (hasattr(req, 'data') and isinstance(req.data, dict) and (req.data.get('school') or req.data.get('school_id'))) or
                req.headers.get('X-School-Id') or
                req.COOKIES.get('active_school_id')
            )
            if school_id:
                try:
                    from apps.schools.models import School
                    s = School.objects.filter(id=school_id).first()
                    if s:
                        return s
                except Exception:
                    pass

            if hasattr(req, 'user') and req.user.is_authenticated:
                user_school = get_user_school(req.user)
                if user_school:
                    return user_school

                # Fallback for platform admin / superuser
                if req.user.is_superuser or req.user.user_type == 'PLATFORM_ADMIN':
                    from apps.schools.models import School
                    return School.objects.first()

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
        
        # School admin or role has access
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN', 'ROLE']:
            return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        # Platform admin has full access
        if request.user.user_type == 'PLATFORM_ADMIN' or request.user.is_superuser:
            return True
        
        # School admin or role can only access their school's objects
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN', 'ROLE']:
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
        
        # School admin, teachers, and roles have access
        if request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN', 'TEACHER', 'ROLE']:
            return True
        
        return False


def get_user_school(user):
    """
    Helper function to get school for any user type.
    """
    if not user or not user.is_authenticated:
        return None
    
    # 1. Direct school assignment on User
    if getattr(user, 'school', None):
        return user.school

    # 2. Check virtual Role or UserRole school
    from apps.accounts.rbac_models import Role, UserRole
    role = Role.objects.filter(associated_user=user).first()
    if role and role.school:
        return role.school

    ur = UserRole.objects.filter(user=user, is_active=True).first()
    if ur and ur.school:
        return ur.school

    # 3. Try teacher profile / teacher school association
    from apps.teachers.models import Teacher
    teacher = Teacher.objects.filter(user=user).first()
    if not teacher and role and role.associated_user:
        teacher = Teacher.objects.filter(user=role.associated_user).first()

    if teacher:
        if getattr(teacher.user, 'school', None):
            return teacher.user.school
        assoc = teacher.school_associations.filter(status='ACTIVE').order_by('-created_at').first()
        if assoc:
            return assoc.school
        if getattr(teacher, 'school', None):
            return teacher.school
    
    # 4. Try student profile
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
