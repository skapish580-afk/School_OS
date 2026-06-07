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
    
    # Platform admins have all permissions
    if user.user_type == 'PLATFORM_ADMIN':
        return True
    
    # School admins have all permissions for their school
    if user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
        return True
    
    # Get school context
    if school is None:
        school = getattr(user, 'school', None)
    
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
    
    # Get school context
    if school is None:
        school = getattr(user, 'school', None)
    
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
    
    # Get school context
    if school is None:
        school = getattr(user, 'school', None)
    
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
    # First check basic permission
    if not has_permission(user, permission_codename):
        return False
    
    # Platform/School admins bypass object-level checks
    if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
        return True
    
    # Check scope limitations based on user's role assignments
    from .rbac_models import UserRole
    
    school = getattr(user, 'school', None)
    if not school:
        return False
    
    user_roles = UserRole.objects.filter(
        user=user,
        school=school,
        is_active=True,
        role__permissions__codename=permission_codename
    ).select_related('grade_scope', 'section_scope', 'subject_scope')
    
    for user_role in user_roles:
        if not user_role.is_valid:
            continue
        
        # If no scope limitations, allow
        if not user_role.grade_scope and not user_role.section_scope and not user_role.subject_scope:
            return True
        
        # Check grade scope
        if user_role.grade_scope:
            obj_grade = getattr(obj, 'grade', None) or getattr(obj, 'current_grade', None)
            if obj_grade and obj_grade.id != user_role.grade_scope.id:
                continue
        
        # Check section scope
        if user_role.section_scope:
            obj_section = getattr(obj, 'section', None) or getattr(obj, 'current_section', None)
            if obj_section and obj_section.id != user_role.section_scope.id:
                continue
        
        # Check subject scope
        if user_role.subject_scope:
            obj_subject = getattr(obj, 'subject', None)
            if obj_subject and obj_subject.id != user_role.subject_scope.id:
                continue
        
        # Passed all scope checks
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
        school = getattr(user, 'school', None)
    
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
        else:
            # Build permission codename from action
            perm_suffix = self.ACTION_MAP.get(action, 'view')
            required_permission = f"{rbac_module}.{perm_suffix}_{rbac_resource}"
        
        # Check permission
        return has_permission(user, required_permission)
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions with scope support."""
        user = request.user
        
        # Platform/School admins bypass object checks
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
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
