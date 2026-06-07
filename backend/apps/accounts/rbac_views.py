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
    """Permission check for school admin access."""
    
    def check_admin_access(self, request):
        """Check if user has admin access."""
        user = request.user
        if not user.is_authenticated:
            return False
        return user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']


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
        
        # Platform admin sees all roles
        if is_platform_admin(user):
            pass
        # School admin sees their school's roles only (not system roles in main list)
        elif user.user_type in ['SCHOOL_ADMIN', 'ADMIN']:
            school = get_user_school(user)
            if school:
                if include_system:
                    # Include system roles when explicitly requested (for templates)
                    queryset = queryset.filter(
                        Q(school=school) | Q(school__isnull=True, is_system_role=True)
                    )
                else:
                    # Only show school's own roles in main list
                    queryset = queryset.filter(school=school)
            else:
                queryset = queryset.none()
        else:
            # Regular users can only see roles they're assigned to
            queryset = queryset.filter(
                user_assignments__user=user,
                user_assignments__is_active=True
            ).distinct()
        
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
                {'error': 'Only school admins can create roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can edit roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()
        
        # Cannot edit system roles (unless platform admin)
        if role.is_system_role and not is_platform_admin(request.user):
            return Response(
                {'error': 'System roles cannot be modified'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can delete roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()
        
        # Cannot delete system roles
        if role.is_system_role:
            return Response(
                {'error': 'System roles cannot be deleted'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if role is assigned to users
        if role.user_assignments.filter(is_active=True).exists():
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
                {'error': 'Only school admins can modify permissions'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role = self.get_object()
        serializer = BulkPermissionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        add_perms = serializer.validated_data.get('add_permissions', [])
        remove_perms = serializer.validated_data.get('remove_permissions', [])
        
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
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can assign roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check for duplicate assignment
        user_id = request.data.get('user')
        role_id = request.data.get('role')
        school = get_user_school(request.user)
        
        if UserRole.objects.filter(
            user_id=user_id,
            role_id=role_id,
            school=school
        ).exists():
            return Response(
                {'error': 'This user already has this role assigned'},
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
    
    def destroy(self, request, *args, **kwargs):
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can remove role assignments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_role = self.get_object()
        
        # Log before deletion
        RolePermissionLog.objects.create(
            school=user_role.school,
            action='USER_REMOVED',
            actor=request.user,
            role=user_role.role,
            target_user=user_role.user
        )
        
        # Clear cache
        clear_permission_cache(user_role.user, user_role.school)
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """Assign a role to multiple users at once."""
        if not self.check_admin_access(request):
            return Response(
                {'error': 'Only school admins can assign roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        role_id = request.data.get('role')
        user_ids = request.data.get('users', [])
        school = get_user_school(request.user)
        
        if not role_id or not user_ids:
            return Response(
                {'error': 'Both role and users are required'},
                status=status.HTTP_400_BAD_REQUEST
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
        
        is_admin = user.user_type in ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN']
        
        return Response({
            'user_id': str(user.id),
            'email': user.email,
            'user_type': user.user_type,
            'is_admin': is_admin,
            'roles': RoleListSerializer(roles, many=True).data,
            'permissions': list(permissions) if permissions != {'*'} else ['*'],
            'permissions_by_module': permissions_by_module if not is_admin else {'*': ['All permissions']}
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
        
        # Get staff users (teachers and admins)
        queryset = User.objects.filter(
            user_type__in=['TEACHER', 'SCHOOL_ADMIN', 'ADMIN'],
            is_active=True
        )
        
        if not is_platform_admin(user):
            queryset = queryset.filter(school=school)
        
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
