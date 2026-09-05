"""
RBAC API Views for School-OS

API endpoints for managing roles, permissions, and user role assignments.
Only school admins and platform admins can access these endpoints.
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q, Count
from django.contrib.auth import get_user_model

from .rbac_models import Permission, Role, UserRole, RolePermissionLog
from .rbac_serializers import (
    PermissionSerializer, PermissionGroupSerializer,
    RoleListSerializer, RoleDetailSerializer,
    UserRoleSerializer, UserWithRolesSerializer,
    RolePermissionLogSerializer, RoleTemplateSerializer,
    BulkPermissionUpdateSerializer, CurrentUserPermissionsSerializer
)
from .permissions_registry import (
    PERMISSION_REGISTRY, DEFAULT_ROLE_TEMPLATES,
    expand_wildcard_permissions, get_all_permission_codenames
)
from .permission_utils import (
    has_permission, get_user_permissions, get_user_roles,
    clear_permission_cache
)
from apps.core.school_isolation import get_user_school, is_platform_admin

User = get_user_model()


class IsSchoolAdmin:
    """Permission check for school admin access or users with specific permissions."""
    
    def check_admin_access(self, request):
        """Check if user has admin access or appropriate RBAC permissions."""
        user = request.user
        if not user.is_authenticated:
            return False
        if user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']:
            return True
            
        # Determine permission based on request method and path/action
        method = request.method
        path = request.path
        
        # Staff list and logs are read-only
        if 'staff-with-roles' in path or 'logs' in path:
            from apps.accounts.permission_utils import get_user_permissions
            user_perms = get_user_permissions(user)
            return (
                has_permission(user, 'roles.view_roles') or 
                has_permission(user, 'roles.assign_role') or
                has_permission(user, 'teachers.assign_role_teaching') or
                has_permission(user, 'teachers.assign_role_non_teaching') or
                has_permission(user, 'teachers.manage_non_teaching') or
                any(p.startswith('assignment_settings.') for p in user_perms)
            )
            
        # User role assignments
        if 'user-roles' in path:
            from apps.accounts.permission_utils import get_user_permissions
            user_perms = get_user_permissions(user)
            has_assignment_access = (
                has_permission(user, 'roles.assign_role') or
                has_permission(user, 'teachers.assign_role_teaching') or
                has_permission(user, 'teachers.assign_role_non_teaching') or
                has_permission(user, 'teachers.manage_non_teaching') or
                any(p.startswith('assignment_settings.') for p in user_perms)
            )
            if method in ['GET', 'OPTIONS', 'HEAD']:
                return (
                    has_permission(user, 'roles.view_roles') or 
                    has_assignment_access
                )
            elif method in ['POST', 'PUT', 'PATCH', 'DELETE']:
                return has_assignment_access
                
        # Roles management
        if 'roles' in path:
            if 'update_permissions' in path:
                return has_permission(user, 'roles.edit_role')
            if method in ['GET', 'OPTIONS', 'HEAD']:
                return (
                    has_permission(user, 'roles.view_roles') or
                    has_permission(user, 'roles.allow_role_creation')
                )
            elif method == 'POST':
                return (
                    has_permission(user, 'roles.create_role') or
                    has_permission(user, 'roles.allow_role_creation')
                )
            elif method in ['PUT', 'PATCH']:
                return has_permission(user, 'roles.edit_role')
            elif method == 'DELETE':
                return (
                    has_permission(user, 'roles.delete_role') or
                    has_permission(user, 'roles.allow_role_creation') or
                    has_permission(user, 'roles.create_role') or
                    has_permission(user, 'roles.edit_role') or
                    has_permission(user, 'roles.assign_role')
                )
                
        return False


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing and retrieving permissions.
    Permissions are system-defined and cannot be created/edited by users.
    """
    
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Dynamically sync vehicle permissions for all existing buses
        try:
            from apps.transport.models import Vehicle
            from apps.accounts.rbac_models import Permission
            
            vehicles = Vehicle.objects.all()
            existing_codenames = set(queryset.filter(codename__startswith='transport.mark_attendance_').values_list('codename', flat=True))
            
            for vehicle in vehicles:
                codename = f"transport.mark_attendance_{vehicle.id}"
                if codename not in existing_codenames:
                    Permission.objects.get_or_create(
                        codename=codename,
                        defaults={
                            'name': f"Mark Attendance: {vehicle.school_bus_number or vehicle.registration_number}",
                            'description': f"Gives permission to mark attendance for bus {vehicle.school_bus_number or vehicle.registration_number}",
                            'module': 'transport',
                            'action': 'edit',
                            'resource': 'mark_attendance',
                            'requires_school_context': True,
                            'display_order': 200
                        }
                    )
        except Exception as e:
            print(f"Error syncing vehicle permissions: {e}")

        # Dynamically sync custom department permissions for non-teaching staff
        try:
            from apps.teachers.models import TeacherAssignment
            from django.utils.text import slugify
            
            STANDARD_DEPTS = {
                "administration", "accounts & finance", "library",
                "laboratory & technical support", "transport & logistics",
                "medical & health (infirmary)", "security & maintenance",
                "sports & physical education", "it & systems support",
                "hostel & campus facilities", "student affairs & welfare",
                "admission & counseling", "food services & canteen"
            }
            
            user_school = getattr(self.request.user, 'school', None)
            dept_qs = TeacherAssignment.objects.filter(department__isnull=False).exclude(department='')
            if user_school and self.request.user.user_type not in ['PLATFORM_ADMIN']:
                dept_qs = dept_qs.filter(school=user_school)
                
            custom_departments = set(dept_qs.values_list('department', flat=True).distinct())
            existing_dept_codenames = set(queryset.filter(module='assignment_settings').values_list('codename', flat=True))
            
            display_order = 300
            for dept_name in custom_departments:
                if dept_name.strip().lower() not in STANDARD_DEPTS:
                    slug = slugify(dept_name).replace('-', '_')
                    codename = f"assignment_settings.dept_custom_{slug}"
                    display_order += 1
                    if codename not in existing_dept_codenames:
                        Permission.objects.get_or_create(
                            codename=codename,
                            defaults={
                                'name': f"Department: {dept_name}",
                                'description': f"Permission to assign roles to staff in custom {dept_name} department",
                                'module': 'assignment_settings',
                                'action': 'manage',
                                'resource': 'dept_others',
                                'display_order': display_order
                            }
                        )
        except Exception as e:
            print(f"Error syncing custom department permissions: {e}")
            
        # Filter bus-specific permissions by school
        user = self.request.user
        if user.is_authenticated and user.user_type not in ['PLATFORM_ADMIN']:
            school = getattr(user, 'school', None)
            if school:
                from apps.transport.models import Vehicle
                allowed_bus_ids = list(Vehicle.objects.filter(school=school).values_list('id', flat=True))
                allowed_bus_codenames = [f"transport.mark_attendance_{bus_id}" for bus_id in allowed_bus_ids]
                
                queryset = queryset.filter(
                    ~Q(codename__startswith='transport.mark_attendance_') |
                    Q(codename__in=allowed_bus_codenames)
                )
        
        # Filter by module
        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(module=module)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Search by name or codename
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | 
                Q(codename__icontains=search)
            )
        
        return queryset.order_by('module', 'display_order', 'action')
    
    @action(detail=False, methods=['get'])
    def grouped(self, request):
        """Get permissions grouped by module."""
        grouped = {}
        
        for perm in self.get_queryset():
            if perm.module not in grouped:
                module_info = PERMISSION_REGISTRY.get(perm.module, {})
                grouped[perm.module] = {
                    'module': perm.module,
                    'label': module_info.get('label', perm.module),
                    'icon': module_info.get('icon', 'Shield'),
                    'permissions': []
                }
            grouped[perm.module]['permissions'].append(
                PermissionSerializer(perm).data
            )
        
        # Sort by module order in registry
        module_order = list(PERMISSION_REGISTRY.keys())
        sorted_groups = sorted(
            grouped.values(),
            key=lambda x: module_order.index(x['module']) if x['module'] in module_order else 999
        )
        
        return Response(sorted_groups)
    
    @action(detail=False, methods=['get'])
    def modules(self, request):
        """Get list of available modules."""
        modules = []
        for module, data in PERMISSION_REGISTRY.items():
            modules.append({
                'key': module,
                'label': data['label'],
                'icon': data['icon'],
                'permission_count': len(data['permissions'])
            })
        return Response(modules)


class RoleViewSet(viewsets.ModelViewSet, IsSchoolAdmin):
    """
    ViewSet for CRUD operations on roles.
    School admins can only manage roles for their own school.
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RoleListSerializer
        return RoleDetailSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = Role.objects.all()
        
        # Check if we want to include system roles (for templates endpoint)
        include_system = self.request.query_params.get('include_system', 'false').lower() == 'true'
        for_assignment = self.request.query_params.get('for_assignment', 'false').lower() == 'true'

        # Platform admin sees all roles
        if is_platform_admin(user):
            pass
        # School admin sees all custom roles in their school created by anyone
        elif user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            school = get_user_school(user)
            if school:
                if include_system:
                    queryset = queryset.filter(
                        Q(school=school) | Q(school__isnull=True, is_system_role=True)
                    )
                else:
                    queryset = queryset.filter(school=school)
            else:
                queryset = queryset.none()
        # Non-school-admin users (including role logins)
        else:
            from apps.accounts.permission_utils import get_user_permissions
            user_perms = get_user_permissions(user)
            
            has_assign_perm = (
                has_permission(user, 'roles.assign_role') or
                has_permission(user, 'teachers.assign_role_teaching') or
                has_permission(user, 'teachers.assign_role_non_teaching') or
                has_permission(user, 'teachers.manage_non_teaching') or
                any(p.startswith('assignment_settings.') for p in user_perms)
            )
            has_mgmt_perm = (
                has_permission(user, 'roles.view_roles') or
                has_permission(user, 'roles.allow_role_creation') or
                has_permission(user, 'roles.create_role') or
                has_permission(user, 'roles.edit_role') or
                has_permission(user, 'roles.delete_role')
            )

            school = get_user_school(user)
            if school:
                if for_assignment and has_assign_perm:
                    # Role assignment dropdowns: see custom roles for their school so they can assign them
                    if include_system:
                        queryset = queryset.filter(
                            Q(school=school) | Q(school__isnull=True, is_system_role=True)
                        )
                    else:
                        queryset = queryset.filter(school=school)
                elif has_mgmt_perm or has_assign_perm:
                    # Role Settings page: ONLY see roles created by themselves (created_by=user)
                    if include_system:
                        queryset = queryset.filter(
                            Q(school=school, created_by=user) | Q(school__isnull=True, is_system_role=True)
                        )
                    else:
                        queryset = queryset.filter(school=school, created_by=user)
                else:
                    # Regular users can only see roles they're assigned to
                    queryset = queryset.filter(
                        user_assignments__user=user,
                        user_assignments__is_active=True
                    ).distinct()
            else:
                queryset = queryset.none()
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by role type
        role_type = self.request.query_params.get('role_type')
        if role_type:
            queryset = queryset.filter(role_type=role_type)
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        return queryset.select_related('school', 'created_by').prefetch_related('permissions')
    
    def create(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins or authorized role creators can create roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Delegated-creator enforcement: non-admins who only have 'allow_role_creation'
        # are capped to their own hierarchy level and can only grant their own permissions (excluding allow_role_creation).
        user = request.user
        is_full_admin = (
            is_platform_admin(user) or
            user.user_type in ['SCHOOL_ADMIN', 'ADMIN'] or
            has_permission(user, 'roles.create_role')
        )
        if not is_full_admin and has_permission(user, 'roles.allow_role_creation'):
            # Determine the creator's own max hierarchy level
            school = get_user_school(user)
            creator_roles = Role.objects.filter(
                user_assignments__user=user,
                user_assignments__is_active=True,
                school=school
            ).distinct()
            max_hierarchy = max(
                (r.hierarchy_level for r in creator_roles), default=1
            )
            
            # Enforce hierarchy cap
            requested_level = request.data.get('hierarchy_level', 1)
            try:
                requested_level = int(requested_level)
            except (TypeError, ValueError):
                requested_level = 1
            if requested_level > max_hierarchy:
                return Response(
                    {'error': f'You can only assign a hierarchy level up to your own level ({max_hierarchy}).'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Enforce permission subset — only permissions the creator themselves hold (excluding allow_role_creation)
            creator_permission_codenames = set()
            for r in creator_roles:
                creator_permission_codenames.update(
                    r.permissions.values_list('codename', flat=True)
                )
            if 'roles.allow_role_creation' in creator_permission_codenames:
                creator_permission_codenames.remove('roles.allow_role_creation')
            
            # Check requested permission_ids are a subset
            requested_perm_ids = request.data.get('permission_ids', [])
            if requested_perm_ids:
                allowed_perms = Permission.objects.filter(
                    id__in=requested_perm_ids,
                    codename__in=creator_permission_codenames
                )
                if len(allowed_perms) < len(requested_perm_ids):
                    return Response(
                        {'error': 'You can only grant permissions that you yourself hold. Only School Admin can assign the "Allow role creation" permission.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins or authorized role creators can edit roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()
        
        # Cannot edit system roles (unless platform admin)
        if role.is_system_role and not is_platform_admin(request.user):
            return Response(
                {'error': 'System roles cannot be modified'},
                status=status.HTTP_403_FORBIDDEN
            )

        user = request.user
        is_full_admin = (
            is_platform_admin(user) or
            user.user_type in ['SCHOOL_ADMIN', 'ADMIN']
        )
        if not is_full_admin:
            if role.created_by_id != user.id:
                return Response(
                    {'error': 'You can only edit roles that were created by you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            school = get_user_school(user)
            creator_roles = Role.objects.filter(
                user_assignments__user=user,
                user_assignments__is_active=True,
                school=school
            ).distinct()
            max_hierarchy = max(
                (r.hierarchy_level for r in creator_roles), default=1
            )
            
            if role.hierarchy_level > max_hierarchy:
                return Response(
                    {'error': f'You cannot edit a role with a higher hierarchy level than your own ({max_hierarchy}).'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            requested_level = request.data.get('hierarchy_level')
            if requested_level is not None:
                try:
                    requested_level = int(requested_level)
                    if requested_level > max_hierarchy:
                        return Response(
                            {'error': f'You can only assign a hierarchy level up to your own level ({max_hierarchy}).'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (TypeError, ValueError):
                    pass
            
            creator_permission_codenames = set()
            for r in creator_roles:
                creator_permission_codenames.update(
                    r.permissions.values_list('codename', flat=True)
                )
            if 'roles.allow_role_creation' in creator_permission_codenames:
                creator_permission_codenames.remove('roles.allow_role_creation')
            
            requested_perm_ids = request.data.get('permission_ids')
            if requested_perm_ids is not None and len(requested_perm_ids) > 0:
                allowed_perms = Permission.objects.filter(
                    id__in=requested_perm_ids,
                    codename__in=creator_permission_codenames
                )
                if len(allowed_perms) < len(requested_perm_ids):
                    return Response(
                        {'error': 'You can only grant permissions that you yourself hold. Only School Admin can assign the "Allow role creation" permission.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins or authorized role creators can delete roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()
        
        # Cannot delete system roles
        if role.is_system_role:
            return Response(
                {'error': 'System roles cannot be deleted'},
                status=status.HTTP_403_FORBIDDEN
            )

        user = request.user
        is_full_admin = (
            is_platform_admin(user) or
            user.user_type in ['SCHOOL_ADMIN', 'ADMIN']
        )
        if not is_full_admin:
            if role.created_by_id != user.id:
                return Response(
                    {'error': 'You can only delete roles that were created by you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            school = get_user_school(user)
            creator_roles = Role.objects.filter(
                user_assignments__user=user,
                user_assignments__is_active=True,
                school=school
            ).distinct()
            max_hierarchy = max(
                (r.hierarchy_level for r in creator_roles), default=1
            )
            if role.hierarchy_level >= max_hierarchy:
                return Response(
                    {'error': 'You cannot delete a role with an equal or higher hierarchy level than your own.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Check if role is assigned to users (excluding the virtual user itself)
        if role.user_assignments.filter(is_active=True).exclude(user=role.associated_user).exists():
            return Response(
                {'error': 'Cannot delete role that is assigned to users. Remove assignments first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def update_permissions(self, request, pk=None):
        """Bulk update permissions for a role."""
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins or authorized role creators can modify permissions'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()

        user = request.user
        is_full_admin = (
            is_platform_admin(user) or
            user.user_type in ['SCHOOL_ADMIN', 'ADMIN']
        )
        if not is_full_admin:
            if role.created_by_id != user.id:
                return Response(
                    {'error': 'You can only edit roles that were created by you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            school = get_user_school(user)
            creator_roles = Role.objects.filter(
                user_assignments__user=user,
                user_assignments__is_active=True,
                school=school
            ).distinct()
            max_hierarchy = max(
                (r.hierarchy_level for r in creator_roles), default=1
            )
            if role.hierarchy_level > max_hierarchy:
                return Response(
                    {'error': f'You cannot edit permissions for a role with a higher hierarchy level than your own ({max_hierarchy}).'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = BulkPermissionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        add_perms = serializer.validated_data.get('add_permissions', [])
        remove_perms = serializer.validated_data.get('remove_permissions', [])
        
        if not is_full_admin and has_permission(user, 'roles.allow_role_creation') and add_perms:
            creator_permission_codenames = set()
            for r in creator_roles:
                creator_permission_codenames.update(
                    r.permissions.values_list('codename', flat=True)
                )
            if 'roles.allow_role_creation' in creator_permission_codenames:
                creator_permission_codenames.remove('roles.allow_role_creation')
            
            allowed_add = Permission.objects.filter(
                Q(id__in=add_perms) | Q(codename__in=add_perms),
                codename__in=creator_permission_codenames
            )
            if len(allowed_add) < len(add_perms):
                return Response(
                    {'error': 'You can only grant permissions that you yourself hold. Only School Admin can assign the "Allow role creation" permission.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            # Add permissions
            if add_perms:
                perms_to_add = Permission.objects.filter(id__in=add_perms)
                role.permissions.add(*perms_to_add)
            
            # Remove permissions
            if remove_perms:
                perms_to_remove = Permission.objects.filter(id__in=remove_perms)
                role.permissions.remove(*perms_to_remove)
            
            # Log the change
            RolePermissionLog.objects.create(
                school=role.school,
                action='ROLE_UPDATED',
                actor=request.user,
                role=role,
                details={
                    'added': len(add_perms),
                    'removed': len(remove_perms)
                }
            )
        
        # Clear permission cache for all users with this role
        for user_role in role.user_assignments.filter(is_active=True):
            clear_permission_cache(user_role.user, role.school)
        
        return Response(RoleDetailSerializer(role, context={'request': request}).data)
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get users assigned to this role."""
        role = self.get_object()
        user_roles = UserRole.objects.filter(
            role=role,
            is_active=True
        ).select_related('user', 'school', 'grade_scope', 'section_scope')
        
        return Response(UserRoleSerializer(user_roles, many=True, context={'request': request}).data)
    
    @action(detail=False, methods=['get'])
    def my_creation_context(self, request):
        """
        Returns the caller's role-creation constraints:
        - max_hierarchy_level: the highest hierarchy level the caller can assign
        - allowed_permission_ids: IDs of permissions the caller can delegate
        - is_full_admin: whether the caller has unrestricted creation rights

        Used by the frontend to cap the hierarchy input and filter the permission list.
        """
        user = request.user
        school = get_user_school(user)
        is_full_admin = (
            is_platform_admin(user) or
            user.user_type in ['SCHOOL_ADMIN', 'ADMIN'] or
            has_permission(user, 'roles.create_role')
        )
        
        if is_full_admin:
            return Response({
                'user_id': str(user.id),
                'is_full_admin': True,
                'max_hierarchy_level': 100,
                'allowed_permission_ids': None,  # null = no restriction
            })
        
        # Non-admin delegated creator
        creator_roles = Role.objects.filter(
            user_assignments__user=user,
            user_assignments__is_active=True,
            school=school
        ).distinct()
        
        max_hierarchy = max(
            (r.hierarchy_level for r in creator_roles), default=1
        )
        
        # Collect all permission IDs the creator holds
        allowed_perm_ids = set()
        for r in creator_roles:
            allowed_perm_ids.update(
                r.permissions.values_list('id', flat=True)
            )
        
        return Response({
            'user_id': str(user.id),
            'is_full_admin': False,
            'max_hierarchy_level': max_hierarchy,
            'allowed_permission_ids': [str(pid) for pid in allowed_perm_ids],
        })

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Get available role templates."""
        templates = []
        for key, template in DEFAULT_ROLE_TEMPLATES.items():
            expanded_perms = expand_wildcard_permissions(template['permissions'])
            templates.append({
                'key': key,
                'name': template['name'],
                'description': template['description'],
                'hierarchy_level': template['hierarchy_level'],
                'permission_count': len(expanded_perms)
            })
        return Response(templates)
    
    @action(detail=False, methods=['post'])
    def create_from_template(self, request):
        """Create a role from a template."""
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can create roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        template_key = request.data.get('template')
        custom_name = request.data.get('name')
        
        if template_key not in DEFAULT_ROLE_TEMPLATES:
            return Response(
                {'error': f'Invalid template: {template_key}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = DEFAULT_ROLE_TEMPLATES[template_key]
        school = get_user_school(request.user)
        
        # Check if role with this name already exists
        role_name = custom_name or template['name']
        if Role.objects.filter(school=school, name=role_name).exists():
            return Response(
                {'error': f'Role "{role_name}" already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create the role
            role = Role.objects.create(
                school=school,
                name=role_name,
                description=template['description'],
                role_type=template_key,
                hierarchy_level=template['hierarchy_level'],
                created_by=request.user
            )
            
            # Expand and add permissions
            expanded_perms = expand_wildcard_permissions(template['permissions'])
            permissions = Permission.objects.filter(codename__in=expanded_perms)
            role.permissions.set(permissions)
            
            # Log
            RolePermissionLog.objects.create(
                school=school,
                action='ROLE_CREATED',
                actor=request.user,
                role=role,
                details={'template': template_key}
            )
        
        return Response(
            RoleDetailSerializer(role, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate an existing role."""
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can create roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        source_role = self.get_object()
        new_name = request.data.get('name', f"{source_role.name} (Copy)")
        school = get_user_school(request.user)
        
        if Role.objects.filter(school=school, name=new_name).exists():
            return Response(
                {'error': f'Role "{new_name}" already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create new role
            new_role = Role.objects.create(
                school=school,
                name=new_name,
                description=source_role.description,
                role_type='CUSTOM',
                hierarchy_level=source_role.hierarchy_level,
                created_by=request.user
            )
            
            # Copy permissions
            new_role.permissions.set(source_role.permissions.all())
            
            # Log
            RolePermissionLog.objects.create(
                school=school,
                action='ROLE_CREATED',
                actor=request.user,
                role=new_role,
                details={'duplicated_from': str(source_role.id)}
            )
        
        return Response(
            RoleDetailSerializer(new_role, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class UserRoleViewSet(viewsets.ModelViewSet, IsSchoolAdmin):
    """
    ViewSet for managing user role assignments.
    """
    
    serializer_class = UserRoleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        queryset = UserRole.objects.all()
        
        # Filter by school
        if not is_platform_admin(user):
            school = get_user_school(user)
            if school:
                queryset = queryset.filter(school=school)
            else:
                queryset = queryset.none()
        
        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by role
        role_id = self.request.query_params.get('role')
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.select_related(
            'user', 'role', 'school', 
            'grade_scope', 'section_scope', 'subject_scope',
            'assigned_by'
        )
    
    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user')
        role_id = request.data.get('role')
        school = get_user_school(request.user)

        from apps.accounts.rbac_models import UserRole

        # Block assigning role to self
        if str(user_id) == str(request.user.id):
            return Response(
                {'error': 'You cannot assign a role to yourself.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if request.user.user_type == 'ROLE':
            assigned_staff_ids = [str(uid) for uid in UserRole.objects.filter(role__associated_user=request.user, is_active=True).values_list('user_id', flat=True)]
            if str(user_id) in assigned_staff_ids:
                return Response(
                    {'error': 'You cannot assign a role to yourself.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # GRANULAR TARGET CHECK
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.accounts.permission_utils import has_permission, get_department_permission_codename, get_user_permissions
        target_teacher = Teacher.objects.filter(user_id=user_id).first()
        is_authorized = False
        if target_teacher:
            if target_teacher.teacher_type == 'TEACHING':
                is_authorized = has_permission(request.user, 'teachers.assign_role_teaching')
            else:
                dept_assignment = TeacherAssignment.objects.filter(
                    teacher=target_teacher,
                    is_active=True
                ).exclude(department__isnull=True).exclude(department='').first()
                dept_name = dept_assignment.department if dept_assignment else 'Administration'
                required_perm = get_department_permission_codename(dept_name)

                has_dept_perm = has_permission(request.user, required_perm)
                has_global = (
                    has_permission(request.user, 'teachers.assign_role_non_teaching') or
                    has_permission(request.user, 'teachers.manage_non_teaching') or
                    has_permission(request.user, 'roles.assign_role')
                )

                user_perms = get_user_permissions(request.user)
                has_dept_restriction = any(p.startswith('assignment_settings.') for p in user_perms)

                if not (is_platform_admin(request.user) or request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN']):
                    if has_dept_restriction and not has_dept_perm:
                        return Response(
                            {'error': f'You do not have permission to assign roles to staff in the "{dept_name}" department.'},
                            status=status.HTTP_403_FORBIDDEN
                        )

                is_authorized = has_dept_perm or (has_global and not has_dept_restriction)
        else:
            is_authorized = has_permission(request.user, 'roles.assign_role')

        if not (is_platform_admin(request.user) or request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN'] or is_authorized):
            return Response(
                {'error': 'You do not have permission to assign roles to this user'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check for duplicate assignment
        if UserRole.objects.filter(
            user_id=user_id,
            role_id=role_id,
            school=school
        ).exists():
            return Response(
                {'error': 'This user already has this role assigned'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Check if role is ALREADY assigned to another active staff member
        if role_id:
            import uuid
            try:
                role_uuid = uuid.UUID(str(role_id))
            except (ValueError, TypeError):
                role_uuid = role_id

            existing = UserRole.objects.filter(role_id=role_uuid, is_active=True)

            if user_id:
                try:
                    user_uuid = uuid.UUID(str(user_id))
                    existing = existing.exclude(user_id=user_uuid)
                except (ValueError, TypeError):
                    existing = existing.exclude(user_id=user_id)

            target_role = Role.objects.filter(id=role_uuid).first()
            if target_role and target_role.associated_user_id:
                existing = existing.exclude(user_id=target_role.associated_user_id)

            existing_assignment = existing.first()
            if existing_assignment:
                assigned_user_name = existing_assignment.user.full_name or existing_assignment.user.email
                return Response(
                    {'error': f'This role is already assigned to "{assigned_user_name}". A role can only be assigned to one person at a time. Please revoke the existing assignment before reassigning.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_201_CREATED:
            # Log the assignment
            RolePermissionLog.objects.create(
                school=school,
                action='USER_ASSIGNED',
                actor=request.user,
                role_id=role_id,
                target_user_id=user_id
            )
            
            # Clear permission cache
            clear_permission_cache(User.objects.get(id=user_id), school)
        
        return response
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user_id = request.data.get('user', instance.user_id)
        role_id = request.data.get('role', instance.role_id)
        
        import uuid
        try:
            role_uuid = uuid.UUID(str(role_id))
        except (ValueError, TypeError):
            role_uuid = role_id

        target_role = Role.objects.filter(id=role_uuid).first()
        if target_role:
            target_user_uuid = None
            if user_id:
                try:
                    target_user_uuid = uuid.UUID(str(user_id))
                except (ValueError, TypeError):
                    pass

            existing = UserRole.objects.filter(
                role=target_role,
                is_active=True
            ).exclude(id=instance.id)
            if target_user_uuid:
                existing = existing.exclude(user_id=target_user_uuid)
            if target_role.associated_user_id:
                existing = existing.exclude(user_id=target_role.associated_user_id)

            existing_assignment = existing.first()
            if existing_assignment:
                assigned_user_name = existing_assignment.user.full_name or existing_assignment.user.email
                return Response(
                    {'error': f'This role is already assigned to "{assigned_user_name}". A role can only be assigned to one person at a time. Please revoke the existing assignment before reassigning.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user_role = self.get_object()

        # GRANULAR TARGET CHECK
        from apps.teachers.models import Teacher, TeacherAssignment
        from apps.accounts.permission_utils import has_permission, get_department_permission_codename, get_user_permissions
        target_teacher = Teacher.objects.filter(user_id=user_role.user_id).first()
        is_authorized = False
        if target_teacher:
            if target_teacher.teacher_type == 'TEACHING':
                is_authorized = (
                    has_permission(request.user, 'teachers.assign_role_teaching') or
                    has_permission(request.user, 'teachers.delete_assigned_role')
                )
            else:
                dept_assignment = TeacherAssignment.objects.filter(
                    teacher=target_teacher,
                    is_active=True
                ).exclude(department__isnull=True).exclude(department='').first()
                dept_name = dept_assignment.department if dept_assignment else 'Administration'
                required_perm = get_department_permission_codename(dept_name)

                has_dept_perm = has_permission(request.user, required_perm)
                has_global = (
                    has_permission(request.user, 'teachers.assign_role_non_teaching') or
                    has_permission(request.user, 'teachers.delete_assigned_role') or
                    has_permission(request.user, 'roles.assign_role')
                )

                user_perms = get_user_permissions(request.user)
                has_dept_restriction = any(p.startswith('assignment_settings.') for p in user_perms)

                if not (is_platform_admin(request.user) or request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN']):
                    if has_dept_restriction and not has_dept_perm:
                        return Response(
                            {'error': f'You do not have permission to remove roles from staff in the "{dept_name}" department.'},
                            status=status.HTTP_403_FORBIDDEN
                        )

                is_authorized = has_dept_perm or (has_global and not has_dept_restriction)
        else:
            is_authorized = has_permission(request.user, 'roles.assign_role')

        if not (is_platform_admin(request.user) or request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN'] or is_authorized):
            return Response(
                {'error': 'You do not have permission to remove roles from this user'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Log before deletion
        RolePermissionLog.objects.create(
            school=user_role.school,
            action='USER_REMOVED',
            actor=request.user,
            role=user_role.role,
            target_user=user_role.user
        )
        
        # Clear cache for both user and virtual role user if present
        clear_permission_cache(user_role.user, user_role.school)
        if user_role.role and user_role.role.associated_user:
            clear_permission_cache(user_role.role.associated_user, user_role.school)
        
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def revoke_all(self, request):
        """Revoke all role assignments for a specific user: POST /api/v1/auth/rbac/assignments/revoke_all/"""
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Enforce same-school validation
        school = get_user_school(request.user)
        queryset = UserRole.objects.filter(user_id=user_id, is_active=True)
        if not is_platform_admin(request.user) and school:
            queryset = queryset.filter(school=school)
            
        # Log and clear cache for each assignment
        target_user = None
        for ur in queryset:
            target_user = ur.user
            RolePermissionLog.objects.create(
                school=ur.school,
                action='USER_REMOVED',
                actor=request.user,
                role=ur.role,
                target_user=ur.user
            )
            clear_permission_cache(ur.user, ur.school)
            
        count = queryset.count()
        queryset.delete()
        
        return Response({'message': f'Successfully revoked {count} role assignments.'})
    
    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """Assign a role to multiple users at once."""
        role_id = request.data.get('role')
        user_ids = request.data.get('users', [])
        school = get_user_school(request.user)
        
        if not role_id or not user_ids:
            return Response(
                {'error': 'Both role and users are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # GRANULAR TARGET CHECK
        from apps.teachers.models import Teacher
        from apps.accounts.permission_utils import has_permission
        for uid in user_ids:
            target_teacher = Teacher.objects.filter(user_id=uid).first()
            is_authorized = False
            if target_teacher:
                if target_teacher.teacher_type == 'TEACHING':
                    is_authorized = has_permission(request.user, 'teachers.assign_role_teaching')
                else:
                    is_authorized = has_permission(request.user, 'teachers.assign_role_non_teaching')
            else:
                is_authorized = has_permission(request.user, 'roles.assign_role')

            if not (is_platform_admin(request.user) or request.user.user_type in ['SCHOOL_ADMIN', 'ADMIN'] or is_authorized):
                return Response(
                    {'error': 'You do not have permission to assign roles to some of the selected users'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        created = []
        skipped = []
        
        with transaction.atomic():
            for user_id in user_ids:
                if UserRole.objects.filter(
                    user_id=user_id,
                    role_id=role_id,
                    school=school
                ).exists():
                    skipped.append(str(user_id))
                    continue
                
                user_role = UserRole.objects.create(
                    user_id=user_id,
                    role_id=role_id,
                    school=school,
                    assigned_by=request.user
                )
                created.append(str(user_role.id))
                
                # Clear cache
                clear_permission_cache(User.objects.get(id=user_id), school)
        
        return Response({
            'created': len(created),
            'skipped': len(skipped),
            'message': f'Assigned role to {len(created)} users, {len(skipped)} already had the role'
        })


class CurrentUserPermissionsView(APIView):
    """
    Get the current user's roles and permissions.
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        school = get_user_school(user)
        
        # Get roles
        roles = get_user_roles(user, school)
        
        # Get permissions
        permissions = get_user_permissions(user, school)
        
        # Group permissions by module
        permissions_by_module = {}
        if permissions != {'*'}:  # Not admin
            for perm in permissions:
                module = perm.split('.')[0] if '.' in perm else 'other'
                if module not in permissions_by_module:
                    permissions_by_module[module] = []
                permissions_by_module[module].append(perm)
        
        # Get active assignments to extract grade scopes
        from .rbac_models import UserRole
        assignments = UserRole.objects.filter(user=user, school=school, is_active=True)
        grade_scopes = [str(ur.grade_scope.id) for ur in assignments if ur.grade_scope and ur.is_valid]
        
        # Extract exam type scopes from active roles
        exam_type_scopes = []
        for role in roles:
            if role.exam_type_scopes:
                exam_type_scopes.extend(role.exam_type_scopes)
        exam_type_scopes = list(set(exam_type_scopes))
        
        is_admin = user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        
        return Response({
            'user_id': str(user.id),
            'email': user.email,
            'user_type': user.user_type,
            'is_admin': is_admin,
            'roles': RoleListSerializer(roles, many=True).data,
            'permissions': list(permissions) if permissions != {'*'} else ['*'],
            'permissions_by_module': permissions_by_module if not is_admin else {'*': ['All permissions']},
            'grade_scopes': grade_scopes,
            'exam_type_scopes': exam_type_scopes,
        })


class CheckPermissionView(APIView):
    """
    Check if current user has a specific permission.
    """
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        permission_codename = request.data.get('permission')
        
        if not permission_codename:
            return Response(
                {'error': 'Permission codename is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        has_perm = has_permission(request.user, permission_codename)
        
        return Response({
            'permission': permission_codename,
            'has_permission': has_perm
        })


class StaffWithRolesListView(generics.ListAPIView, IsSchoolAdmin):
    """
    List all staff members with their roles.
    """
    
    serializer_class = UserWithRolesSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if not self.check_admin_access(self.request):
            return User.objects.none()
        
        user = self.request.user
        school = get_user_school(user)
        
        if not school and not is_platform_admin(user):
            return User.objects.none()
            
        from apps.teachers.models import Teacher
        
        if is_platform_admin(user) or user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            teacher_user_ids = Teacher.objects.filter(
                Q(school_associations__school=school, school_associations__status='ACTIVE') |
                Q(user__school=school)
            ).values_list('user_id', flat=True).distinct()
        else:
            from apps.teachers.models import TeacherAssignment
            from apps.accounts.permission_utils import get_user_permissions, DEPT_CODENAME_REVERSE_MAP
            user_perms = get_user_permissions(user)
            
            can_assign_teaching = has_permission(user, 'teachers.assign_role_teaching') or has_permission(user, 'teachers.manage_teaching')
            
            allowed_dept_names = set()
            for perm in user_perms:
                if perm.startswith('assignment_settings.dept_'):
                    if perm in DEPT_CODENAME_REVERSE_MAP:
                        allowed_dept_names.add(DEPT_CODENAME_REVERSE_MAP[perm])
                    else:
                        p_obj = Permission.objects.filter(codename=perm).first()
                        if p_obj and p_obj.name.startswith("Department: "):
                            allowed_dept_names.add(p_obj.name[12:])

            teacher_qs = Teacher.objects.filter(
                Q(school_associations__school=school, school_associations__status='ACTIVE') |
                Q(user__school=school)
            )
            
            teaching_user_ids = set()
            if can_assign_teaching:
                teaching_user_ids = set(teacher_qs.filter(teacher_type='TEACHING').values_list('user_id', flat=True))

            non_teaching_user_ids = set()
            if allowed_dept_names:
                assigned_non_teaching_user_ids = set(TeacherAssignment.objects.filter(
                    school=school,
                    teacher__teacher_type='NON_TEACHING',
                    department__in=allowed_dept_names,
                    is_active=True
                ).values_list('teacher__user_id', flat=True))

                if "Administration" in allowed_dept_names or "assignment_settings.dept_others" in user_perms:
                    unassigned = set(teacher_qs.filter(teacher_type='NON_TEACHING').exclude(
                        assignments__is_active=True, assignments__department__isnull=False
                    ).values_list('user_id', flat=True))
                    non_teaching_user_ids = assigned_non_teaching_user_ids | unassigned
                else:
                    non_teaching_user_ids = assigned_non_teaching_user_ids

            teacher_user_ids = teaching_user_ids | non_teaching_user_ids
        
        queryset = User.objects.filter(
            id__in=teacher_user_ids,
            is_active=True
        ).exclude(user_type__in=['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN', 'ROLE'])

        # Exclude the current logged-in user and any staff member assigned to the active role
        exclude_ids = {user.id}
        if user.user_type == 'ROLE':
            from apps.accounts.rbac_models import UserRole
            assigned_staff_ids = set(UserRole.objects.filter(
                role__associated_user=user,
                is_active=True
            ).values_list('user_id', flat=True))
            exclude_ids.update(assigned_staff_ids)
        
        queryset = queryset.exclude(id__in=exclude_ids)
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        return queryset.order_by('first_name', 'last_name')


class RolePermissionLogViewSet(viewsets.ReadOnlyModelViewSet, IsSchoolAdmin):
    """
    ViewSet for viewing role/permission audit logs.
    """
    
    serializer_class = RolePermissionLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if not self.check_admin_access(self.request):
            return RolePermissionLog.objects.none()
        
        user = self.request.user
        queryset = RolePermissionLog.objects.all()
        
        if not is_platform_admin(user):
            school = get_user_school(user)
            if school:
                queryset = queryset.filter(school=school)
            else:
                queryset = queryset.none()
        
        # Filter by action type
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(timestamp__date__gte=from_date)
        if to_date:
            queryset = queryset.filter(timestamp__date__lte=to_date)
        
        return queryset.select_related('actor', 'role', 'target_user', 'permission')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_permissions(request):
    """
    Sync permissions from registry to database.
    Only platform admins can do this.
    """
    if not is_platform_admin(request.user):
        return Response(
            {'error': 'Only platform admins can sync permissions'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    created = 0
    updated = 0
    
    for module, module_data in PERMISSION_REGISTRY.items():
        for perm_tuple in module_data['permissions']:
            codename, name, description, action, resource, is_sensitive = perm_tuple
            
            perm, was_created = Permission.objects.update_or_create(
                codename=codename,
                defaults={
                    'name': name,
                    'description': description,
                    'module': module,
                    'action': action,
                    'resource': resource,
                    'is_sensitive': is_sensitive,
                }
            )
            
            if was_created:
                created += 1
            else:
                updated += 1
    
    return Response({
        'message': 'Permissions synced successfully',
        'created': created,
        'updated': updated,
        'total': created + updated
    })


# ============================================
# ROLE-BASED LOGIN VIEW
# ============================================
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from apps.schools.models import School

class RoleLoginView(APIView):
    """
    API endpoint for logging in as a Role.
    Checks School existence by name, then verifies Role credentials (username & password).
    Returns access and refresh JWT tokens.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        from apps.accounts.rbac_models import Role, UserRole
        from apps.teachers.models import Teacher, TeacherSchoolAssociation
        from django.utils import timezone

        school_name = request.data.get('school_name', '').strip()
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        
        if not school_name or not username or not password:
            return Response(
                {'error': 'School name, username, and password are all required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 1. Find school by name or code (case-insensitive)
        school = School.objects.filter(
            Q(display_name__iexact=school_name) | 
            Q(legal_name__iexact=school_name) |
            Q(code__iexact=school_name) |
            Q(subdomain__iexact=school_name) |
            Q(display_name__icontains=school_name) |
            Q(legal_name__icontains=school_name)
        ).first()
        
        if not school:
            return Response(
                {'error': f'School bearing the name "{school_name}" does not exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 2. Search for Role matching username or email in this school or associated staff
        role = Role.objects.filter(
            Q(username__iexact=username) | Q(associated_user__email__iexact=username)
        ).filter(
            Q(school=school) | 
            Q(associated_user__school=school) |
            Q(user_assignments__school=school) |
            Q(user_assignments__user__school=school) |
            Q(user_assignments__user__teacher_profile__school_associations__school=school)
        ).distinct().first()

        if not role:
            # Check UserRole assignment
            ur = UserRole.objects.filter(
                Q(school=school) | Q(user__school=school) | Q(user__teacher_profile__school_associations__school=school),
                Q(role__username__iexact=username) | 
                Q(user__email__iexact=username) |
                Q(user__teacher_profile__tuid__iexact=username),
                is_active=True
            ).select_related('role', 'user').first()
            if ur:
                role = ur.role

        if not role:
            pass

        if role:
            if not role.is_active:
                return Response(
                    {'error': 'This role is currently deactivated.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            auth_user = role.associated_user
            if not auth_user:
                ur_match = UserRole.objects.filter(role=role, is_active=True).first()
                if ur_match:
                    auth_user = ur_match.user

            if not auth_user:
                return Response(
                    {'error': 'This role does not have login credentials configured.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate password against auth_user or plain_password fallback
            is_valid_pw = auth_user.check_password(password)
            if not is_valid_pw and role.plain_password and role.plain_password == password:
                auth_user.set_password(password)
                auth_user.save(update_fields=['password'])
                is_valid_pw = True

            if is_valid_pw:
                auth_user.is_active = True
                auth_user.school = school
                auth_user.save(update_fields=['is_active', 'school'])

                from apps.accounts.rbac_models import UserRole
                UserRole.objects.filter(user=auth_user, is_active=True).update(school=school)

                from django.utils import timezone
                from apps.teachers.models import Teacher, TeacherSchoolAssociation
                t_prof = Teacher.objects.filter(user=auth_user).first()
                if t_prof:
                    TeacherSchoolAssociation.objects.get_or_create(
                        teacher=t_prof,
                        school=school,
                        defaults={'status': 'ACTIVE', 'joining_date': timezone.now().date()}
                    )

                from apps.accounts.permission_utils import clear_permission_cache
                clear_permission_cache(auth_user, school)

                refresh = RefreshToken.for_user(auth_user)
                refresh['school_id'] = str(school.id)
                refresh['user_type'] = auth_user.user_type if auth_user.user_type != 'ROLE' else 'TEACHER'
                refresh['role'] = role.name

                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user_type': auth_user.user_type if auth_user.user_type != 'ROLE' else 'TEACHER',
                    'role_name': role.name,
                    'school_name': school.display_name,
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': f'Incorrect password for role or teacher username "{username}".'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 3. Search for direct Teacher Account (by Email, TUID, or assigned Role Username/Name)
        from apps.teachers.models import Teacher, TeacherSchoolAssociation
        teacher_obj = Teacher.objects.filter(
            Q(user__school=school) | Q(school_associations__school=school),
            Q(tuid__iexact=username) | 
            Q(user__email__iexact=username) | 
            Q(user__user_roles__role__username__iexact=username) | 
            Q(user__user_roles__role__name__iexact=username)
        ).distinct().first()

        if not teacher_obj and hasattr(school, 'teacher_associations'):
            teacher_obj = Teacher.objects.filter(
                school_associations__school=school
            ).filter(
                Q(tuid__iexact=username) | Q(user__email__iexact=username)
            ).distinct().first()

        if teacher_obj and teacher_obj.user:
            user = teacher_obj.user
            is_valid_pw = user.check_password(password)
            
            # Check UserRole plain_password fallback
            if not is_valid_pw:
                ur_check = UserRole.objects.filter(user=user, is_active=True).first()
                if ur_check and ur_check.role and ur_check.role.plain_password and ur_check.role.plain_password == password:
                    user.set_password(password)
                    user.save(update_fields=['password'])
                    is_valid_pw = True

            if is_valid_pw:
                user.is_active = True
                user.school = school
                user.save(update_fields=['is_active', 'school'])

                from apps.accounts.rbac_models import UserRole
                UserRole.objects.filter(user=user, is_active=True).update(school=school)

                from django.utils import timezone
                TeacherSchoolAssociation.objects.get_or_create(
                    teacher=teacher_obj,
                    school=school,
                    defaults={'status': 'ACTIVE', 'joining_date': timezone.now().date()}
                )

                ur = UserRole.objects.filter(user=user, is_active=True).first()
                if not ur:
                    teacher_role, _ = Role.objects.get_or_create(
                        school=school,
                        name='Teacher',
                        defaults={
                            'role_type': 'SUBJECT_TEACHER',
                            'hierarchy_level': 50,
                            'is_system_role': True
                        }
                    )
                    ur = UserRole.objects.create(
                        user=user,
                        role=teacher_role,
                        school=school,
                        is_active=True,
                        is_primary=True
                    )

                from apps.accounts.permission_utils import clear_permission_cache
                clear_permission_cache(user, school)

                refresh = RefreshToken.for_user(user)
                refresh['school_id'] = str(school.id)
                refresh['user_type'] = 'TEACHER'
                refresh['role'] = ur.role.name if ur and ur.role else 'Teacher'

                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user_type': 'TEACHER',
                    'role_name': ur.role.name if ur and ur.role else 'Teacher',
                    'school_name': school.display_name,
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': f'Incorrect password for teacher account "{username}".'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 4. Search for direct Student Account
        from apps.students.models import Student
        student = Student.objects.filter(
            Q(school=school) | Q(user__school=school),
            Q(suid__iexact=username) | Q(user__email__iexact=username)
        ).distinct().first()

        if student and student.user:
            if student.status != 'ACTIVE':
                return Response(
                    {'error': 'This student account is currently inactive.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = student.user
            if user.check_password(password):
                user.is_active = True
                user.user_type = 'STUDENT'
                if student.school and not user.school:
                    user.school = student.school
                user.save()

                refresh = RefreshToken.for_user(user)
                refresh['school_id'] = str(school.id)
                refresh['user_type'] = 'STUDENT'
                refresh['role'] = 'STUDENT'

                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user_type': 'STUDENT',
                    'role_name': 'STUDENT',
                    'school_name': school.display_name,
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': f'Incorrect password for student account "{username}".'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response(
            {'error': f'No role, teacher, or student account matching username "{username}" found for school "{school.display_name}".'},
            status=status.HTTP_400_BAD_REQUEST
        )

            
        # 3. Check if role is active
        if not role.is_active:
            return Response(
                {'error': 'This role is currently deactivated.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 3b. Check if role is currently assigned to at least one active staff member
        is_direct_staff_account = role.associated_user and role.associated_user.user_type != 'ROLE'
        has_staff_assignment = UserRole.objects.filter(
            role=role,
            is_active=True
        ).exclude(user__user_type='ROLE').exists()

        if not is_direct_staff_account and not has_staff_assignment:
            return Response(
                {'error': 'This role is not currently assigned to any staff member. Login is disabled until the role is assigned.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 4. Check if role has an associated user or staff assignment
        auth_user = role.associated_user
        if not auth_user:
            ur = UserRole.objects.filter(role=role, is_active=True).first()
            if ur:
                auth_user = ur.user

        if not auth_user:
            return Response(
                {'error': 'This role does not have login credentials configured.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 5. Verify password on the associated user
        if not auth_user.check_password(password):
            return Response(
                {'error': 'Invalid username or password for this role.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if auth_user and not auth_user.school:
            auth_user.school = school
            auth_user.save(update_fields=['school'])

        # 6. Clear permission cache for the user to ensure updated permissions are loaded
        if auth_user:
            from apps.accounts.permission_utils import clear_permission_cache
            clear_permission_cache(auth_user, school)

        # 7. Generate SimpleJWT tokens for the user
        refresh = RefreshToken.for_user(auth_user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'role_name': role.name,
            'school_name': school.name,
        })


from rest_framework_simplejwt.views import TokenRefreshView

class RoleAwareTokenRefreshView(TokenRefreshView):
    """
    Subclass of TokenRefreshView that verifies virtual role users still have an active assignment.
    If revoked, token refresh returns HTTP 401 Unauthorized, forcing frontend to logout.
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK and 'access' in response.data:
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                token = AccessToken(response.data['access'])
                user_id = token.get('user_id')
                user = User.objects.filter(id=user_id).first()
                if user and user.user_type == 'ROLE':
                    has_active_assignment = UserRole.objects.filter(
                        role__associated_user=user,
                        is_active=True
                    ).exclude(user=user).exists()
                    if not has_active_assignment:
                        return Response(
                            {'detail': 'This role assignment has been revoked. You have been logged out.', 'code': 'role_revoked'},
                            status=status.HTTP_401_UNAUTHORIZED
                        )
            except Exception:
                pass
        return response

