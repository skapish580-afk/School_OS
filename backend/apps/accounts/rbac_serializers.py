"""
RBAC Serializers for School-OS

Serializers for Role, Permission, and UserRole models.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .rbac_models import Permission, Role, UserRole, RolePermissionLog
from .permissions_registry import PERMISSION_REGISTRY

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    """Serializer for Permission model."""
    
    module_label = serializers.SerializerMethodField()
    action_label = serializers.SerializerMethodField()
    
    class Meta:
        model = Permission
        fields = [
            'id', 'codename', 'name', 'description',
            'module', 'module_label', 'action', 'action_label',
            'resource', 'is_sensitive', 'requires_school_context',
            'display_order'
        ]
        read_only_fields = fields  # Permissions are system-defined
    
    def get_module_label(self, obj):
        return dict(Permission.MODULE_CHOICES).get(obj.module, obj.module)
    
    def get_action_label(self, obj):
        return dict(Permission.ACTION_CHOICES).get(obj.action, obj.action)


class PermissionGroupSerializer(serializers.Serializer):
    """Serializer for grouped permissions by module."""
    
    module = serializers.CharField()
    label = serializers.CharField()
    icon = serializers.CharField()
    permissions = PermissionSerializer(many=True)


class RoleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for role lists."""
    
    school_name = serializers.CharField(source='school.name', read_only=True, allow_null=True)
    permission_count = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'role_type',
            'school', 'school_name', 'hierarchy_level',
            'is_active', 'is_system_role',
            'permission_count', 'user_count',
            'created_by_name', 'created_at'
        ]
    
    def get_permission_count(self, obj):
        return obj.permissions.count()
    
    def get_user_count(self, obj):
        return obj.user_assignments.filter(is_active=True).count()


class RoleDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for role with permissions."""
    
    school_name = serializers.CharField(source='school.name', read_only=True, allow_null=True)
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.SerializerMethodField()
    permission_ids_input = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
        source='permission_ids'
    )
    permissions_by_module = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'role_type',
            'school', 'school_name', 'hierarchy_level',
            'is_active', 'is_system_role',
            'permissions', 'permission_ids', 'permission_ids_input', 'permissions_by_module',
            'created_by', 'created_by_name',
            'created_at', 'updated_at', 'user_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'is_system_role']
    
    def get_permission_ids(self, obj):
        """Return list of permission IDs for the role."""
        return [str(perm.id) for perm in obj.permissions.all()]
    
    def get_permissions_by_module(self, obj):
        """Group permissions by module for easier display."""
        permissions_by_module = {}
        for perm in obj.permissions.all():
            if perm.module not in permissions_by_module:
                module_info = PERMISSION_REGISTRY.get(perm.module, {})
                permissions_by_module[perm.module] = {
                    'module': perm.module,
                    'label': module_info.get('label', perm.module),
                    'icon': module_info.get('icon', 'Shield'),
                    'permissions': []
                }
            permissions_by_module[perm.module]['permissions'].append(
                PermissionSerializer(perm).data
            )
        return list(permissions_by_module.values())
    
    def get_user_count(self, obj):
        return obj.user_assignments.filter(is_active=True).count()
    
    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        request = self.context.get('request')
        
        # Set created_by and school
        validated_data['created_by'] = request.user
        
        # Get school from request user
        from apps.core.school_isolation import get_user_school
        if not validated_data.get('school'):
            school = get_user_school(request.user)
            if school:
                validated_data['school'] = school
        
        role = Role.objects.create(**validated_data)
        
        # Add permissions
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            role.permissions.set(permissions)
        
        return role
    
    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', None)
        
        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update permissions if provided
        if permission_ids is not None:
            permissions = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(permissions)
        
        return instance


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for role assignments."""
    
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'user_type']


class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for UserRole assignments."""
    
    user_details = UserBasicSerializer(source='user', read_only=True)
    role_details = RoleListSerializer(source='role', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    grade_name = serializers.CharField(source='grade_scope.name', read_only=True, allow_null=True)
    section_name = serializers.CharField(source='section_scope.name', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject_scope.name', read_only=True, allow_null=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True, allow_null=True)
    is_valid = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'user_details', 'role', 'role_details',
            'school', 'school_name',
            'grade_scope', 'grade_name',
            'section_scope', 'section_name',
            'subject_scope', 'subject_name',
            'is_active', 'is_primary', 'is_valid',
            'valid_from', 'valid_until',
            'assigned_by', 'assigned_by_name', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'assigned_by', 'is_valid']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['assigned_by'] = request.user
        
        # Default school to user's school
        if not validated_data.get('school') and request.user.school:
            validated_data['school'] = request.user.school
        
        return super().create(validated_data)


class UserWithRolesSerializer(serializers.ModelSerializer):
    """User serializer with their assigned roles."""
    
    full_name = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()
    primary_role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'user_type', 'school', 'is_active',
            'roles', 'primary_role'
        ]
    
    def get_roles(self, obj):
        request = self.context.get('request')
        school = request.user.school if request else None
        
        user_roles = UserRole.objects.filter(
            user=obj,
            is_active=True
        )
        if school:
            user_roles = user_roles.filter(school=school)
        
        return UserRoleSerializer(user_roles, many=True, context=self.context).data
    
    def get_primary_role(self, obj):
        request = self.context.get('request')
        school = request.user.school if request else None
        
        primary = UserRole.objects.filter(
            user=obj,
            is_active=True,
            is_primary=True
        )
        if school:
            primary = primary.filter(school=school)
        
        primary = primary.first()
        if primary:
            return {
                'id': str(primary.role.id),
                'name': primary.role.name
            }
        return None


class RolePermissionLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs."""
    
    actor_name = serializers.CharField(source='actor.full_name', read_only=True, allow_null=True)
    role_name = serializers.CharField(source='role.name', read_only=True, allow_null=True)
    target_user_name = serializers.CharField(source='target_user.full_name', read_only=True, allow_null=True)
    permission_name = serializers.CharField(source='permission.name', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = RolePermissionLog
        fields = [
            'id', 'school', 'action', 'action_display',
            'actor', 'actor_name',
            'role', 'role_name',
            'target_user', 'target_user_name',
            'permission', 'permission_name',
            'details', 'ip_address', 'timestamp'
        ]


class RoleTemplateSerializer(serializers.Serializer):
    """Serializer for role templates (for quick role creation)."""
    
    key = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    hierarchy_level = serializers.IntegerField()
    permission_count = serializers.IntegerField()


class BulkPermissionUpdateSerializer(serializers.Serializer):
    """Serializer for bulk permission updates."""
    
    add_permissions = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )
    remove_permissions = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list
    )


class CurrentUserPermissionsSerializer(serializers.Serializer):
    """Serializer for current user's permissions."""
    
    user_id = serializers.UUIDField()
    email = serializers.EmailField()
    user_type = serializers.CharField()
    is_admin = serializers.BooleanField()
    roles = RoleListSerializer(many=True)
    permissions = serializers.ListField(child=serializers.CharField())
    permissions_by_module = serializers.DictField()
