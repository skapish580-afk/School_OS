"""
Permission Checking Utilities for School-OS

Provides decorators, mixins, and utility functions for checking permissions
in views and throughout the application.
"""

from functools import wraps
from rest_framework import permissions, status
from rest_framework.response import Response
from django.core.cache import cache
from django.conf import settings


DEPT_CODENAME_MAP = {
    "administration": "assignment_settings.dept_administration",
    "accounts & finance": "assignment_settings.dept_accounts_finance",
    "library": "assignment_settings.dept_library",
    "laboratory & technical support": "assignment_settings.dept_laboratory_technical",
    "transport & logistics": "assignment_settings.dept_transport_logistics",
    "medical & health (infirmary)": "assignment_settings.dept_medical_health",
    "security & maintenance": "assignment_settings.dept_security_maintenance",
    "sports & physical education": "assignment_settings.dept_sports_physical_education",
    "it & systems support": "assignment_settings.dept_it_systems_support",
    "hostel & campus facilities": "assignment_settings.dept_hostel_campus_facilities",
    "student affairs & welfare": "assignment_settings.dept_student_affairs_welfare",
    "admission & counseling": "assignment_settings.dept_admission_counseling",
    "food services & canteen": "assignment_settings.dept_food_services_canteen",
}

DEPT_CODENAME_REVERSE_MAP = {
    "assignment_settings.dept_administration": "Administration",
    "assignment_settings.dept_accounts_finance": "Accounts & Finance",
    "assignment_settings.dept_library": "Library",
    "assignment_settings.dept_laboratory_technical": "Laboratory & Technical Support",
    "assignment_settings.dept_transport_logistics": "Transport & Logistics",
    "assignment_settings.dept_medical_health": "Medical & Health (Infirmary)",
    "assignment_settings.dept_security_maintenance": "Security & Maintenance",
    "assignment_settings.dept_sports_physical_education": "Sports & Physical Education",
    "assignment_settings.dept_it_systems_support": "IT & Systems Support",
    "assignment_settings.dept_hostel_campus_facilities": "Hostel & Campus Facilities",
    "assignment_settings.dept_student_affairs_welfare": "Student Affairs & Welfare",
    "assignment_settings.dept_admission_counseling": "Admission & Counseling",
    "assignment_settings.dept_food_services_canteen": "Food Services & Canteen",
}

def get_department_permission_codename(department_name):
    if not department_name:
        return 'assignment_settings.dept_others'
    key = department_name.strip().lower()
    if key in DEPT_CODENAME_MAP:
        return DEPT_CODENAME_MAP[key]
    from django.utils.text import slugify
    slug = slugify(department_name).replace('-', '_')
    return f"assignment_settings.dept_custom_{slug}"


def get_teacher_for_user(user):
    """Get the Teacher instance linked to a User, if any."""
    if not user or not user.is_authenticated:
        return None
    if hasattr(user, 'teacher_profile') and user.teacher_profile:
        return user.teacher_profile
    try:
        from apps.teachers.models import Teacher
        return Teacher.objects.filter(user=user).first()
    except Exception:
        return None


class SchoolPermission(permissions.BasePermission):
    """
    Base permission class for school-based permissions.
    Checks if user has required permission within their school context.
    """
    
    # Override in subclass or pass as view attribute
    required_permission = None
    
    def has_permission(self, request, view):
        user = request.user
        
        if not user.is_authenticated:
            return False
        
        # Platform admins have all permissions
        if user.user_type == 'PLATFORM_ADMIN':
            return True
        
        # School admins have all permissions for their school
        if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            return True
        
        # Get required permission from view
        required = getattr(view, 'required_permission', self.required_permission)
        if not required:
            # No specific permission required, allow authenticated users
            return True
        
        # Check if user has the permission
        return has_permission(user, required)


def has_permission(user, permission_codename, school=None):
    """
    Check if a user has a specific permission.
    
    Args:
        user: User object
        permission_codename: Permission codename (e.g., 'students.view_student')
        school: Optional school context (defaults to user's school)
    
    Returns:
        bool: True if user has permission
    """
    if not user or not user.is_authenticated:
        return False

    if isinstance(permission_codename, (list, tuple)):
        return any(has_permission(user, perm, school) for perm in permission_codename)
    
    # Platform admins have all permissions
    if user.user_type == 'PLATFORM_ADMIN':
        return True
    
    # School admins have all permissions for their school
    if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
        return True
    
    # Get school context
    if school is None:
        from apps.core.school_isolation import get_user_school
        school = get_user_school(user)
    
    if not school:
        return False
    
    # Check cache first
    cache_key = f"user_perms_{user.id}_{school.id}"
    cached_perms = cache.get(cache_key)
    
    if cached_perms is None:
        # Get user's permissions from their roles
        cached_perms = get_user_permissions(user, school)
        cache.set(cache_key, cached_perms, timeout=300)  # Cache for 5 minutes
    
    return permission_codename in cached_perms


def get_user_permissions(user, school=None):
    """
    Get all permission codenames for a user within a school.
    
    Returns:
        set: Set of permission codenames
    """
    from .rbac_models import UserRole
    
    if not user or not user.is_authenticated:
        return set()
    
    # Platform admins - return special marker
    if user.user_type == 'PLATFORM_ADMIN':
        return {'*'}  # All permissions
    
    # School admins - return special marker
    if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
        return {'*'}  # All permissions
        
    # For virtual role login users, return permissions of the associated Role directly
    if user.user_type == 'ROLE':
        from .rbac_models import Role
        associated_role = Role.objects.filter(associated_user=user, is_active=True).first()
        if associated_role:
            perms = {perm.codename for perm in associated_role.permissions.all()}
            # If no custom permissions set yet or is a teacher role, grant core teaching defaults
            if not perms or associated_role.role_type == 'TEACHER' or 'Teacher' in associated_role.name or 'teacher' in associated_role.name.lower():
                perms.update({
                    'attendance.view_attendance',
                    'attendance.change_attendance',
                    'teachers.view_teaching',
                    'academics.view_class',
                    'academics.view_subject_allocation',
                    'academics.view_marks_entry',
                    'academics.view_exam',
                    'students.view_student_only',
                    'students.view_profile',
                    'students.view_journey',
                })
            return perms
        return set()
    
    # Get school context
    if school is None:
        from apps.core.school_isolation import get_user_school
        school = get_user_school(user)
    
    if not school:
        return set()
    
    # Get active role assignments for user in this school
    user_roles = UserRole.objects.filter(
        user=user,
        school=school,
        is_active=True
    ).select_related('role').prefetch_related('role__permissions')
    
    permissions_set = set()
    
    for user_role in user_roles:
        if not user_role.is_valid:
            continue
        
        for perm in user_role.role.permissions.all():
            permissions_set.add(perm.codename)
    
    if user.user_type == 'TEACHER' or hasattr(user, 'teacher_profile'):
        permissions_set.update({
            'attendance.view_attendance',
            'attendance.change_attendance',
            'teachers.view_teaching',
            'academics.view_class',
            'academics.view_subject_allocation',
            'academics.view_marks_entry',
            'academics.view_exam',
            'students.view_student_only',
            'students.view_profile',
            'students.view_journey',
        })

    return permissions_set


def get_user_roles(user, school=None):
    """
    Get all active roles for a user within a school.
    
    Returns:
        list: List of Role objects
    """
    from .rbac_models import UserRole
    
    if not user or not user.is_authenticated:
        return []
        
    # For virtual role login users, return the associated Role directly
    if user.user_type == 'ROLE':
        from .rbac_models import Role
        associated_role = Role.objects.filter(associated_user=user, is_active=True).first()
        if associated_role:
            return [associated_role]
        return []
    
    # Get school context
    if school is None:
        from apps.core.school_isolation import get_user_school
        school = get_user_school(user)
    
    if not school:
        return []
    
    user_roles = UserRole.objects.filter(
        user=user,
        school=school,
        is_active=True
    ).select_related('role')
    
    return [ur.role for ur in user_roles if ur.is_valid]


def clear_permission_cache(user, school=None):
    """Clear cached permissions for a user."""
    if school:
        cache_key = f"user_perms_{user.id}_{school.id}"
        cache.delete(cache_key)
    else:
        # Clear all school caches for this user
        # Note: This is a simplified version; in production you'd track keys
        pass


def require_permission(permission_codename):
    """
    Decorator for view functions that require a specific permission.
    
    Usage:
        @require_permission('students.view_student')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not has_permission(request.user, permission_codename):
                return Response(
                    {
                        'error': 'Permission denied',
                        'required_permission': permission_codename,
                        'message': f'You need the "{permission_codename}" permission to perform this action.'
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def require_any_permission(*permission_codenames):
    """
    Decorator requiring at least one of the specified permissions.
    
    Usage:
        @require_any_permission('students.view_student', 'students.edit_student')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            for perm in permission_codenames:
                if has_permission(request.user, perm):
                    return view_func(request, *args, **kwargs)
            
            return Response(
                {
                    'error': 'Permission denied',
                    'required_permissions': permission_codenames,
                    'message': 'You need one of the required permissions to perform this action.'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        return wrapper
    return decorator


def require_all_permissions(*permission_codenames):
    """
    Decorator requiring ALL specified permissions.
    
    Usage:
        @require_all_permissions('students.view_student', 'students.edit_student')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            missing = []
            for perm in permission_codenames:
                if not has_permission(request.user, perm):
                    missing.append(perm)
            
            if missing:
                return Response(
                    {
                        'error': 'Permission denied',
                        'missing_permissions': missing,
                        'message': 'You are missing required permissions.'
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


class PermissionRequiredMixin:
    """
    Mixin for class-based views that require specific permissions.
    
    Usage:
        class MyView(PermissionRequiredMixin, APIView):
            required_permission = 'students.view_student'
            # OR
            required_permissions = ['students.view_student', 'students.edit_student']
            permission_operator = 'AND'  # or 'OR'
    """
    
    required_permission = None
    required_permissions = None
    permission_operator = 'AND'  # 'AND' or 'OR'
    
    def check_permissions(self, request):
        super().check_permissions(request)
        
        # Skip for platform/school admins
        if request.user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return
        
        # Single permission
        if self.required_permission:
            if not has_permission(request.user, self.required_permission):
                self.permission_denied(
                    request,
                    message=f'Permission "{self.required_permission}" required.'
                )
        
        # Multiple permissions
        if self.required_permissions:
            if self.permission_operator == 'AND':
                for perm in self.required_permissions:
                    if not has_permission(request.user, perm):
                        self.permission_denied(
                            request,
                            message=f'Permission "{perm}" required.'
                        )
            else:  # OR
                has_any = any(
                    has_permission(request.user, perm) 
                    for perm in self.required_permissions
                )
                if not has_any:
                    self.permission_denied(
                        request,
                        message='One of the required permissions needed.'
                    )


SCHOOL_ADMIN_HIERARCHY_LEVEL = 101


def get_user_role_and_level(user, school=None):
    """
    Get (role_name, hierarchy_level) for a user contextually.
    School/Platform Admin = ("School Admin", 101).
    Custom Staff User = (Primary Role Name, Role Hierarchy Level 1-100).
    """
    if not user or not user.is_authenticated:
        return "Anonymous", 0
        
    if getattr(user, 'is_superuser', False) or user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
        return "School Admin", SCHOOL_ADMIN_HIERARCHY_LEVEL
        
    roles = get_user_roles(user, school)
    if not roles:
        role_type_display = getattr(user, 'user_type', 'Staff')
        return role_type_display.capitalize() if isinstance(role_type_display, str) else "Staff", 1
        
    # Pick role with highest hierarchy level
    top_role = max(roles, key=lambda r: getattr(r, 'hierarchy_level', 1) or 1)
    role_name = getattr(top_role, 'name', 'Staff Role')
    hierarchy_level = getattr(top_role, 'hierarchy_level', 1) or 1
    return role_name, hierarchy_level


def log_hierarchy_record_edit(user, instance, action='UPDATE', changes_summary='', school=None):
    """
    Log an entry into RecordHierarchyLog for an object in ANY module.
    Stores the 3 required fields:
    1. who edited the data (role_name)
    2. what was edited (edited_changes)
    3. what was that role's hierarchy level (hierarchy_level)
    """
    if not user or not user.is_authenticated or not instance or not getattr(instance, 'id', None):
        return
        
    try:
        role_name, hierarchy_level = get_user_role_and_level(user, school)
        from django.contrib.contenttypes.models import ContentType
        from apps.audit.models import RecordHierarchyLog, AuditLog
        
        ct = ContentType.objects.get_for_model(instance)
        
        # Log to dedicated RecordHierarchyLog
        RecordHierarchyLog.objects.create(
            content_type=ct,
            object_id=str(instance.id),
            role_name=role_name,
            edited_changes=changes_summary or f"{action.capitalize()}d {instance.__class__.__name__}",
            hierarchy_level=hierarchy_level,
            user=user,
            action=action.upper()
        )
        
        # Also log to general AuditLog for backward compatibility
        AuditLog.objects.create(
            actor=user,
            action=action.upper() if action.upper() in ['CREATE', 'UPDATE', 'DELETE'] else 'UPDATE',
            content_type=ct,
            object_id=str(instance.id),
            details=f"[{role_name} L{hierarchy_level}] {changes_summary or action}"
        )
    except Exception as e:
        print(f"Error logging hierarchy edit record: {e}")


def get_object_author(obj, _depth=0):
    """
    Determine the User who created or last modified an object.
    Inspects standard author/editor FK fields across models, falls back to RecordHierarchyLog & AuditLog,
    and recursively checks parent object relations if applicable.
    """
    if not obj or _depth > 2:
        return None
        
    # 1. Check direct FK fields on the model
    for field_name in ['last_updated_by', 'updated_by', 'modified_by', 'recorded_by', 'created_by', 'assigned_by', 'user', 'actor']:
        if hasattr(obj, field_name):
            val = getattr(obj, field_name, None)
            if val is not None:
                if hasattr(val, 'user_type'):  # User model instance
                    return val
                elif hasattr(val, 'user') and hasattr(val.user, 'user_type'):  # e.g. Teacher model instance
                    return val.user

    # 2. Check RecordHierarchyLog / AuditLog records for this object ID
    try:
        if hasattr(obj, 'id') and obj.id:
            from django.contrib.contenttypes.models import ContentType
            from apps.audit.models import RecordHierarchyLog
            ct = ContentType.objects.get_for_model(obj)
            latest_log = RecordHierarchyLog.objects.filter(
                content_type=ct,
                object_id=str(obj.id)
            ).order_by('-timestamp').first()
            
            if latest_log and latest_log.user:
                return latest_log.user
    except Exception:
        pass

    # 3. Check parent relations if applicable (e.g. Section -> GradeConfiguration -> Program)
    for parent_field in ['grade_config', 'program', 'syllabus', 'exam', 'section']:
        if hasattr(obj, parent_field):
            parent_obj = getattr(obj, parent_field, None)
            if parent_obj and parent_obj != obj:
                author = get_object_author(parent_obj, _depth=_depth + 1)
                if author:
                    return author

    return None


def can_user_edit_object_by_hierarchy(user, obj, school=None):
    """
    Hierarchy Overwrite Conditioning:
    If a record was created or edited by a role of higher hierarchy level,
    a user with a lower hierarchy level cannot edit or overwrite it,
    irrespective of the module.
    
    Checks the dedicated RecordHierarchyLog table for who edited the data (role_name),
    what was edited, and that role's hierarchy_level.
    """
    if not user or not user.is_authenticated:
        return False, "Authentication required"
        
    current_role_name, current_user_level = get_user_role_and_level(user, school)
    
    # School Admin / Platform Admin (Level 101) can edit anything
    if current_user_level >= SCHOOL_ADMIN_HIERARCHY_LEVEL:
        return True, "Admin access"

    # Teaching staff permission overrides for student profile, attendance, discipline & achievements
    model_name = obj.__class__.__name__
    if model_name in ['Student', 'StudentDocument', 'AttendanceSession', 'StudentAttendance', 'DisciplineRecord', 'Achievement', 'KarmaActivity']:
        if user.user_type in ['TEACHER', 'ROLE'] or hasattr(user, 'teacher_profile'):
            return True, "Teaching staff management"
        
    # Check dedicated RecordHierarchyLog table first for target object
    latest_hierarchy_log = None
    try:
        if hasattr(obj, 'id') and obj.id:
            from django.contrib.contenttypes.models import ContentType
            from apps.audit.models import RecordHierarchyLog
            ct = ContentType.objects.get_for_model(obj)
            latest_hierarchy_log = RecordHierarchyLog.objects.filter(
                content_type=ct,
                object_id=str(obj.id)
            ).order_by('-timestamp').first()
    except Exception:
        pass

    if latest_hierarchy_log:
        # Same user editing their own record is allowed
        if latest_hierarchy_log.user_id == user.id:
            return True, "Same user editing own record"
            
        if latest_hierarchy_log.hierarchy_level > current_user_level:
            return False, (
                f"Permission denied: This data was last edited by role '{latest_hierarchy_log.role_name}' "
                f"(Hierarchy Level {latest_hierarchy_log.hierarchy_level}). "
                f"Your role '{current_role_name}' has a lower hierarchy level ({current_user_level})."
            )
        return True, "Hierarchy level requirement satisfied"

    # Fallback to direct author resolution if no RecordHierarchyLog exists yet
    author = get_object_author(obj)
    if not author:
        return True, "No record author tracked"
        
    if author.id == user.id:
        return True, "Author editing own record"
        
    author_role_name, author_level = get_user_role_and_level(author, school)
    if author_level > current_user_level:
        return False, (
            f"Permission denied: This data was last edited by role '{author_role_name}' "
            f"(Hierarchy Level {author_level}). "
            f"Your role '{current_role_name}' has a lower hierarchy level ({current_user_level})."
        )
        
    return True, "Hierarchy check passed"



def check_object_permission(user, permission_codename, obj):
    """
    Check permission with object-level context.
    
    For example, a class teacher might only have permission for their own class.
    
    Args:
        user: User object
        permission_codename: Permission codename
        obj: The object being accessed
    
    Returns:
        bool: True if user has permission for this object
    """
    # Hierarchy check on write/edit permissions
    if any(k in str(permission_codename).lower() for k in ['edit', 'change', 'delete', 'manage', 'update']):
        allowed, _ = can_user_edit_object_by_hierarchy(user, obj)
        if not allowed:
            return False

    # First check basic permission
    if not has_permission(user, permission_codename):
        return False
    
    # Platform/School admins bypass object-level checks
    if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
        return True

    from apps.core.school_isolation import get_user_school
    school = get_user_school(user)
    if not school:
        return False
    
    # Get user roles (handles virtual user fallback automatically)
    roles = get_user_roles(user, school)
    if not roles:
        # User has basic permission and no specific role scopes restricting them
        return True
        
    from .rbac_models import UserRole
    
    for role in roles:
        # Check if this role has the permission (handles list/tuple of codenames)
        if isinstance(permission_codename, (list, tuple)):
            matched_perms = role.permissions.filter(codename__in=permission_codename)
            if not matched_perms.exists():
                continue
            active_codename = matched_perms.first().codename
        else:
            if not role.permissions.filter(codename=permission_codename).exists():
                continue
            active_codename = permission_codename
            
        # 1. Timetable grade scopes check
        if active_codename == 'academics.add_timetable':
            scopes = role.timetable_grade_scopes.all()
            if scopes.exists():
                grade = getattr(obj, 'grade', None) or getattr(obj, 'current_grade', None)
                if not grade and hasattr(obj, 'section') and obj.section:
                    grade = getattr(obj.section, 'grade_config', None)
                if grade and not scopes.filter(id=grade.id).exists():
                    continue  # Try next role
                    
        # 2. Syllabus subject scopes check
        elif active_codename in ['academics.view_syllabus', 'academics.add_syllabus', 'academics.add_chapter', 'academics.edit_chapter']:
            scopes = role.syllabus_subject_scopes.all()
            if scopes.exists():
                subject_mapping_id = getattr(obj, 'subject_mapping_id', None)
                if not subject_mapping_id and hasattr(obj, 'syllabus') and obj.syllabus:
                    subject_mapping_id = getattr(obj.syllabus, 'subject_mapping_id', None)
                if subject_mapping_id and not scopes.filter(id=subject_mapping_id).exists():
                    continue  # Try next role
                    
        # 3. Exam subject & type scopes check
        elif active_codename in ['academics.view_exam', 'academics.add_exam']:
            scopes = role.exam_subject_scopes.all()
            if scopes.exists():
                subject_mapping_id = getattr(obj, 'subject_mapping_id', None)
                if subject_mapping_id and not scopes.filter(id=subject_mapping_id).exists():
                    continue  # Try next role
                    
            type_scopes = role.exam_type_scopes
            if type_scopes:
                exam_type = getattr(obj, 'exam_type', None)
                if exam_type and exam_type not in type_scopes:
                    continue  # Try next role
                    
        # 3.5 Marks subject scopes check
        elif active_codename in ['academics.view_marks_entry']:
            scopes = role.marks_subject_scopes.all()
            if scopes.exists():
                subject_mapping_id = getattr(obj, 'subject_mapping_id', None)
                if not subject_mapping_id and hasattr(obj, 'exam') and obj.exam:
                    subject_mapping_id = getattr(obj.exam, 'subject_mapping_id', None)
                if subject_mapping_id and not scopes.filter(id=subject_mapping_id).exists():
                    continue  # Try next role
                    
        # 3.7 Attendance section scopes check
        elif active_codename in ['attendance.view_attendance', 'attendance.change_attendance']:
            if user.user_type == 'TEACHER' or hasattr(user, 'teacher_profile'):
                pass  # Teaching accounts manage assigned class attendance registers
            else:
                scopes = role.attendance_section_scopes.all()
                if scopes.exists():
                    grade = getattr(obj, 'grade', None)
                    section = getattr(obj, 'section', None)
                    if not grade or not section:
                        if hasattr(obj, 'grade_config') and obj.grade_config:
                            grade = obj.grade_config.grade_name
                        if hasattr(obj, 'current_section') and obj.current_section:
                            section = obj.current_section.section_letter
                    if grade and section:
                        clean_grade = str(grade).replace('Grade', '').replace('grade', '').strip()
                        matched = scopes.filter(
                            Q(grade_config__grade_name__iexact=grade) |
                            Q(grade_config__grade_name__icontains=clean_grade),
                            section_letter__iexact=section
                        ).exists()
                        if not matched:
                            continue  # Try next role
                    
        # 4. Check legacy ForeignKey scopes on the UserRole assignment (only for non-virtual users)
        if user.user_type != 'ROLE':
            user_roles = UserRole.objects.filter(
                user=user,
                school=school,
                role=role,
                is_active=True
            ).select_related('grade_scope', 'section_scope', 'subject_scope')
            
            if not user_roles.exists():
                continue
                
            allowed_by_legacy = False
            for ur in user_roles:
                if not ur.is_valid:
                    continue
                # If no legacy scope limitations on the assignment, allow
                if not ur.grade_scope and not ur.section_scope and not ur.subject_scope:
                    allowed_by_legacy = True
                    break
                
                # Check legacy grade scope
                if ur.grade_scope:
                    obj_grade = getattr(obj, 'grade', None) or getattr(obj, 'current_grade', None)
                    if obj_grade and obj_grade.id != ur.grade_scope.id:
                        continue
                        
                # Check legacy section scope
                if ur.section_scope:
                    obj_section = getattr(obj, 'section', None) or getattr(obj, 'current_section', None)
                    if obj_section and obj_section.id != ur.section_scope.id:
                        continue
                        
                # Check legacy subject scope
                if ur.subject_scope:
                    obj_subject = getattr(obj, 'subject', None)
                    if obj_subject and obj_subject.id != ur.subject_scope.id:
                        continue
                        
                allowed_by_legacy = True
                break
                
            if not allowed_by_legacy:
                continue
                
        # Passed all checks for this role
        return True
        
    return False


# Permission check result for detailed responses
class PermissionCheckResult:
    """Result object for detailed permission checks."""
    
    def __init__(self, allowed, reason=None, missing_permissions=None):
        self.allowed = allowed
        self.reason = reason
        self.missing_permissions = missing_permissions or []
    
    def __bool__(self):
        return self.allowed
    
    def to_dict(self):
        return {
            'allowed': self.allowed,
            'reason': self.reason,
            'missing_permissions': self.missing_permissions
        }


def check_permission_detailed(user, permission_codename, school=None):
    """
    Check permission with detailed result.
    
    Returns:
        PermissionCheckResult: Detailed result object
    """
    if not user or not user.is_authenticated:
        return PermissionCheckResult(False, 'User not authenticated')
    
    if user.user_type == 'PLATFORM_ADMIN':
        return PermissionCheckResult(True, 'Platform admin has all permissions')
    
    if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
        return PermissionCheckResult(True, 'School admin has all permissions')
    
    if school is None:
        from apps.core.school_isolation import get_user_school
        school = get_user_school(user)
    
    if not school:
        return PermissionCheckResult(False, 'No school context')
    
    if has_permission(user, permission_codename, school):
        return PermissionCheckResult(True, 'Permission granted through role')
    
    return PermissionCheckResult(
        False, 
        'Permission not granted',
        missing_permissions=[permission_codename]
    )


class RBACPermission(permissions.BasePermission):
    """
    DRF Permission class that enforces RBAC permissions based on action.
    
    Maps ViewSet actions to permission codenames automatically:
    - list, retrieve -> module.view_resource
    - create -> module.create_resource
    - update, partial_update -> module.edit_resource
    - destroy -> module.delete_resource
    
    Usage in ViewSet:
        class StudentViewSet(ModelViewSet):
            permission_classes = [IsAuthenticated, RBACPermission]
            rbac_module = 'students'
            rbac_resource = 'student'
            
            # Optional: custom action permissions
            rbac_action_permissions = {
                'export': 'students.export_student',
                'import_students': 'students.import_student',
            }
    """
    
    # Default action to permission suffix mapping
    ACTION_MAP = {
        'list': 'view',
        'retrieve': 'view',
        'create': 'create',
        'update': 'edit',
        'partial_update': 'edit',
        'destroy': 'delete',
    }
    
    def has_permission(self, request, view):
        user = request.user
        
        if not user.is_authenticated:
            return False
        
        # Platform admins have all permissions
        if user.user_type == 'PLATFORM_ADMIN':
            return True
        
        # School admins have all permissions for their school
        if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            return True
        
        # Teacher accounts have permissions for attendance and teaching modules
        if user.user_type == 'TEACHER' or get_teacher_for_user(user):
            return True

        # Get RBAC configuration from view
        rbac_module = getattr(view, 'rbac_module', None)
        rbac_resource = getattr(view, 'rbac_resource', None)
        
        if not rbac_module or not rbac_resource:
            # No RBAC config, fall back to allowing authenticated users
            return True
        
        # Get current action
        action = getattr(view, 'action', None)
        
        if not action:
            # For non-ViewSet views, map HTTP method
            method_action_map = {
                'GET': 'retrieve',
                'POST': 'create',
                'PUT': 'update',
                'PATCH': 'partial_update',
                'DELETE': 'destroy',
            }
            action = method_action_map.get(request.method, 'retrieve')
        
        # Check for custom action permissions first
        custom_perms = getattr(view, 'rbac_action_permissions', {})
        if action in custom_perms:
            required_permission = custom_perms[action]
            if required_permission is None:
                return True
        else:
            # Build permission codename from action
            perm_suffix = self.ACTION_MAP.get(action, 'view')
            required_permission = f"{rbac_module}.{perm_suffix}_{rbac_resource}"
        
        # Check permission
        return has_permission(user, required_permission)
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions with scope support and hierarchy overwrite rules."""
        user = request.user
        
        if not user or not user.is_authenticated:
            return False

        # Enforce hierarchy overwrite conditioning for write actions (PUT, PATCH, DELETE)
        if request.method not in permissions.SAFE_METHODS:
            allowed, reason = can_user_edit_object_by_hierarchy(user, obj)
            if not allowed:
                self.message = reason
                return False

        # Platform/School admins and Teachers bypass object checks
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'TEACHER'] or get_teacher_for_user(user):
            return True

        
        # Get RBAC configuration
        rbac_module = getattr(view, 'rbac_module', None)
        rbac_resource = getattr(view, 'rbac_resource', None)
        
        if not rbac_module or not rbac_resource:
            return True
        
        action = getattr(view, 'action', 'retrieve')
        custom_perms = getattr(view, 'rbac_action_permissions', {})
        
        if action in custom_perms:
            required_permission = custom_perms[action]
            if required_permission is None:
                return True
        else:
            perm_suffix = self.ACTION_MAP.get(action, 'view')
            required_permission = f"{rbac_module}.{perm_suffix}_{rbac_resource}"
        
        return check_object_permission(user, required_permission, obj)


class RBACMixin:
    """
    Mixin to add RBAC permission enforcement to ViewSets.
    
    Just add this mixin and configure rbac_module and rbac_resource:
    
        class StudentViewSet(RBACMixin, ModelViewSet):
            rbac_module = 'students'
            rbac_resource = 'student'
    """
    
    def get_permissions(self):
        """Add RBACPermission to permission classes."""
        from rest_framework.permissions import IsAuthenticated
        
        # Get existing permission classes
        permission_classes = list(super().get_permissions())
        
        # Add RBAC permission if not already present
        rbac_perm = RBACPermission()
        if not any(isinstance(p, RBACPermission) for p in permission_classes):
            permission_classes.append(rbac_perm)
        
        return permission_classes
