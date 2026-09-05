"""
RBAC Serializers for School-OS

Serializers for Role, Permission, and UserRole models.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .rbac_models import Permission, Role, UserRole, RolePermissionLog
from .permissions_registry import PERMISSION_REGISTRY
from apps.schools.models import School

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
            'created_by', 'created_by_name', 'created_at'
        ]
    
    def get_permission_count(self, obj):
        return obj.permissions.count()
    
    def get_user_count(self, obj):
        return obj.user_assignments.filter(is_active=True).count()


class PermissionUUIDListField(serializers.Field):
    """Custom field to handle read/write list of permission UUIDs."""
    
    def to_representation(self, value):
        return [str(perm.id) for perm in value.all()]
        
    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of UUIDs.")
        import uuid
        validated_uuids = []
        for item in data:
            try:
                validated_uuids.append(uuid.UUID(str(item)))
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Invalid UUID: {item}")
        return validated_uuids


class GradeUUIDListField(serializers.Field):
    """Custom field to handle read/write list of grade configuration UUIDs."""
    
    def to_representation(self, value):
        return [str(grade.id) for grade in value.all()]
        
    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of UUIDs.")
        import uuid
        validated_uuids = []
        for item in data:
            try:
                validated_uuids.append(uuid.UUID(str(item)))
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Invalid UUID: {item}")
        return validated_uuids


class SubjectMappingUUIDListField(serializers.Field):
    """Custom field to handle read/write list of subject mapping UUIDs."""
    
    def to_representation(self, value):
        return [str(sm.id) for sm in value.all()]
        
    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of UUIDs.")
        import uuid
        validated_uuids = []
        for item in data:
            try:
                validated_uuids.append(uuid.UUID(str(item)))
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Invalid UUID: {item}")
        return validated_uuids


class SectionUUIDListField(serializers.Field):
    """Custom field to handle read/write list of section UUIDs."""
    
    def to_representation(self, value):
        return [str(sec.id) for sec in value.all()]
        
    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of UUIDs.")
        import uuid
        validated_uuids = []
        for item in data:
            try:
                validated_uuids.append(uuid.UUID(str(item)))
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Invalid UUID: {item}")
        return validated_uuids


class RoleDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for role with permissions."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove UniqueTogetherValidator because we populate school contextually and validate manually
        self.validators = [
            v for v in self.validators 
            if not isinstance(v, serializers.UniqueTogetherValidator)
        ]
    
    school_name = serializers.CharField(source='school.name', read_only=True, allow_null=True)
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = PermissionUUIDListField(source='permissions', required=False)
    timetable_grade_scopes = GradeUUIDListField(required=False)
    syllabus_subject_scopes = SubjectMappingUUIDListField(required=False)
    exam_subject_scopes = SubjectMappingUUIDListField(required=False)
    exam_type_scopes = serializers.ListField(child=serializers.CharField(), required=False)
    marks_subject_scopes = SubjectMappingUUIDListField(required=False)
    attendance_section_scopes = SectionUUIDListField(required=False)
    permissions_by_module = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    user_count = serializers.SerializerMethodField()
    
    # Custom credentials login fields
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = Role
        fields = [
            'id', 'name', 'description', 'role_type',
            'school', 'school_name', 'hierarchy_level',
            'is_active', 'is_system_role',
            'permissions', 'permission_ids', 'timetable_grade_scopes', 'syllabus_subject_scopes', 
            'exam_subject_scopes', 'exam_type_scopes', 'marks_subject_scopes', 'attendance_section_scopes', 'permissions_by_module',
            'created_by', 'created_by_name',
            'created_at', 'updated_at', 'user_count',
            'username', 'password', 'plain_password'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'is_system_role', 'plain_password']
        extra_kwargs = {
            'school': {'required': False, 'allow_null': True}
        }

    
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
        # Exclude the associated user from the user count as it is a virtual login user
        return obj.user_assignments.filter(is_active=True).exclude(user=obj.associated_user).count()
    
    def validate_hierarchy_level(self, value):
        if value is not None:
            if value < 1 or value > 100:
                raise serializers.ValidationError("Hierarchy level must be between 1 and 100. (School Admin is fixed at 101).")
        return value

    def validate(self, attrs):

        request = self.context.get('request')
        school = attrs.get('school')
        
        # Populate school contextually if not provided
        if request and not school:
            from apps.core.school_isolation import get_user_school
            school = get_user_school(request.user)
            if school:
                attrs['school'] = school
                
        # Get name and username
        name = attrs.get('name')
        username = attrs.get('username')
        if username:
            username = username.strip()
            if not username:
                username = None
        else:
            username = None
            
        # Unique check for (school, name)
        if name:
            qs = Role.objects.filter(school=school, name=name)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({"name": "A role with this name already exists in this school."})
                
        # Unique check for (school, username)
        if username:
            qs = Role.objects.filter(school=school, username__iexact=username)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({"username": "A role with this username already exists in this school."})
                
        return attrs

    def create(self, validated_data):
        permission_ids = validated_data.pop('permissions', validated_data.pop('permission_ids', []))
        timetable_grade_scopes = validated_data.pop('timetable_grade_scopes', [])
        syllabus_subject_scopes = validated_data.pop('syllabus_subject_scopes', [])
        exam_subject_scopes = validated_data.pop('exam_subject_scopes', [])
        exam_type_scopes = validated_data.pop('exam_type_scopes', [])
        marks_subject_scopes = validated_data.pop('marks_subject_scopes', [])
        attendance_section_scopes = validated_data.pop('attendance_section_scopes', [])
        username = validated_data.get('username')
        if username:
            username = username.strip()
            if not username:
                username = None
        else:
            username = None
        validated_data['username'] = username
        password = validated_data.pop('password', None)
        request = self.context.get('request')
        
        # Set created_by and school
        validated_data['created_by'] = request.user
        
        # Get school from request user
        from apps.core.school_isolation import get_user_school
        school = validated_data.get('school')
        if not school:
            school = get_user_school(request.user)
            if school:
                validated_data['school'] = school
        
        if username:
            if Role.objects.filter(school=school, username__iexact=username).exists():
                raise serializers.ValidationError({"username": "A role with this username already exists in this school."})
        
        # Save exam_type_scopes direct value
        validated_data['exam_type_scopes'] = exam_type_scopes
        role = Role.objects.create(**validated_data)
        
        # Add permissions
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            role.permissions.set(permissions)

        # Add timetable grade scopes
        if timetable_grade_scopes:
            from apps.schools.models import GradeConfiguration
            grades = GradeConfiguration.objects.filter(id__in=timetable_grade_scopes)
            role.timetable_grade_scopes.set(grades)
            
        # Add syllabus subject scopes
        if syllabus_subject_scopes:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=syllabus_subject_scopes)
            role.syllabus_subject_scopes.set(mappings)
            
        # Add exam subject scopes
        if exam_subject_scopes:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=exam_subject_scopes)
            role.exam_subject_scopes.set(mappings)

        # Add marks subject scopes
        if marks_subject_scopes:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=marks_subject_scopes)
            role.marks_subject_scopes.set(mappings)
            
        # Add attendance section scopes
        if attendance_section_scopes:
            from apps.academics.models import Section
            sections = Section.objects.filter(id__in=attendance_section_scopes)
            role.attendance_section_scopes.set(sections)
            
        # If credentials are provided, create the virtual user
        if username and password:
            import uuid
            from django.contrib.auth import get_user_model
            from .rbac_models import UserRole
            UserModel = get_user_model()
            
            virtual_user = UserModel.objects.create_user(
                email=f"role_{uuid.uuid4()}@schoolos.local",
                password=password,
                user_type='ROLE',
                school=school,
                first_name=role.name,
                last_name="Role User"
            )
            
            # Map user to role
            UserRole.objects.create(
                user=virtual_user,
                role=role,
                school=school,
                is_active=True,
                is_primary=True
            )
            
            role.associated_user = virtual_user
            role.plain_password = password
            role.save(update_fields=['associated_user', 'plain_password'])
        
        return role
    
    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permissions', validated_data.pop('permission_ids', None))
        timetable_grade_scopes = validated_data.pop('timetable_grade_scopes', None)
        syllabus_subject_scopes = validated_data.pop('syllabus_subject_scopes', None)
        exam_subject_scopes = validated_data.pop('exam_subject_scopes', None)
        exam_type_scopes = validated_data.pop('exam_type_scopes', None)
        marks_subject_scopes = validated_data.pop('marks_subject_scopes', None)
        attendance_section_scopes = validated_data.pop('attendance_section_scopes', None)
        username = validated_data.get('username', None)
        if username is not None:
            username = username.strip()
            if not username:
                username = None
            validated_data['username'] = username
        password = validated_data.pop('password', None)
        school = instance.school
        
        if username is not None and username != instance.username:
            if username and Role.objects.filter(school=school, username__iexact=username).exclude(id=instance.id).exists():
                raise serializers.ValidationError({"username": "A role with this username already exists in this school."})
        
        # Save exam_type_scopes directly if provided
        if exam_type_scopes is not None:
            validated_data['exam_type_scopes'] = exam_type_scopes
            
        # Update basic fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update permissions if provided
        if permission_ids is not None:
            permissions = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(permissions)
            
            # Invalidate permission cache for all users who have this role assigned
            from django.core.cache import cache
            for user_role in instance.user_assignments.filter(is_active=True).select_related('user', 'school'):
                cache_key = f"user_perms_{user_role.user.id}_{user_role.school.id}"
                cache.delete(cache_key)

        # Update timetable grade scopes if provided
        if timetable_grade_scopes is not None:
            from apps.schools.models import GradeConfiguration
            grades = GradeConfiguration.objects.filter(id__in=timetable_grade_scopes)
            instance.timetable_grade_scopes.set(grades)

        # Update syllabus subject scopes if provided
        if syllabus_subject_scopes is not None:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=syllabus_subject_scopes)
            instance.syllabus_subject_scopes.set(mappings)

        # Update exam subject scopes if provided
        if exam_subject_scopes is not None:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=exam_subject_scopes)
            instance.exam_subject_scopes.set(mappings)

        # Update marks subject scopes if provided
        if marks_subject_scopes is not None:
            from apps.academics.models import SubjectMapping
            mappings = SubjectMapping.objects.filter(id__in=marks_subject_scopes)
            instance.marks_subject_scopes.set(mappings)

        # Update attendance section scopes if provided
        if attendance_section_scopes is not None:
            from apps.academics.models import Section
            sections = Section.objects.filter(id__in=attendance_section_scopes)
            instance.attendance_section_scopes.set(sections)

            
        # Update virtual user credentials
        if username is not None or password is not None:
            from django.contrib.auth import get_user_model
            from .rbac_models import UserRole
            import uuid
            UserModel = get_user_model()
            
            if instance.associated_user:
                # Update existing virtual user
                if password:
                    instance.associated_user.set_password(password)
                    instance.associated_user.save()
                    instance.plain_password = password
                    instance.save(update_fields=['plain_password'])
                
                # Make sure the user role assignment exists and is active
                UserRole.objects.get_or_create(
                    user=instance.associated_user,
                    role=instance,
                    school=school,
                    defaults={'is_active': True, 'is_primary': True}
                )
            elif username and password:
                # Create a new virtual user
                virtual_user = UserModel.objects.create_user(
                    email=f"role_{uuid.uuid4()}@schoolos.local",
                    password=password,
                    user_type='ROLE',
                    school=school,
                    first_name=instance.name,
                    last_name="Role User"
                )
                UserRole.objects.create(
                    user=virtual_user,
                    role=instance,
                    school=school,
                    is_active=True,
                    is_primary=True
                )
                instance.associated_user = virtual_user
                instance.plain_password = password
                instance.save(update_fields=['associated_user', 'plain_password'])
        
        return instance


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user info for role assignments."""
    
    full_name = serializers.CharField(read_only=True)
    teacher_type = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'user_type', 'teacher_type']

    def get_teacher_type(self, obj):
        from apps.teachers.models import Teacher
        teacher = Teacher.objects.filter(user=obj).first()
        return teacher.teacher_type if teacher else None


class SubjectUUIDListField(serializers.Field):
    """Custom field to handle read/write list of subject UUIDs."""
    
    def to_representation(self, value):
        return [str(subject.id) for subject in value.all()]
        
    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError("Expected a list of UUIDs.")
        import uuid
        validated_uuids = []
        for item in data:
            try:
                validated_uuids.append(uuid.UUID(str(item)))
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"Invalid UUID: {item}")
        return validated_uuids


class UserRoleSerializer(serializers.ModelSerializer):
    """Serializer for UserRole assignments."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove UniqueTogetherValidator because we populate school contextually and validate manually
        self.validators = [
            v for v in self.validators 
            if not isinstance(v, serializers.UniqueTogetherValidator)
        ]
    
    user_details = UserBasicSerializer(source='user', read_only=True)
    role_details = RoleListSerializer(source='role', read_only=True)
    school = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.all(),
        required=False,
        allow_null=True
    )
    school_name = serializers.CharField(source='school.name', read_only=True)
    grade_name = serializers.CharField(source='grade_scope.grade_name', read_only=True, allow_null=True)
    section_name = serializers.CharField(source='section_scope.full_name', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject_scope.name', read_only=True, allow_null=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True, allow_null=True)
    is_valid = serializers.BooleanField(read_only=True)
    
    syllabus_custom_subjects = SubjectUUIDListField(required=False)
    
    class Meta:
        model = UserRole
        fields = [
            'id', 'user', 'user_details', 'role', 'role_details',
            'school', 'school_name',
            'grade_scope', 'grade_name',
            'section_scope', 'section_name',
            'subject_scope', 'subject_name',
            'syllabus_scope_type', 'syllabus_custom_subjects',
            'is_active', 'is_primary', 'is_valid',
            'valid_from', 'valid_until',
            'assigned_by', 'assigned_by_name', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_at', 'assigned_by', 'is_valid']
        extra_kwargs = {
            'school': {'required': False, 'allow_null': True}
        }
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['assigned_by'] = request.user
        
        # Default school to user's school
        if not validated_data.get('school') and request.user.school:
            validated_data['school'] = request.user.school
            
        syllabus_custom_subjects = validated_data.pop('syllabus_custom_subjects', [])
        user_role = super().create(validated_data)
        
        if syllabus_custom_subjects:
            from apps.academics.models import Subject
            subjects = Subject.objects.filter(id__in=syllabus_custom_subjects)
            user_role.syllabus_custom_subjects.set(subjects)
            
        return user_role

    def update(self, instance, validated_data):
        syllabus_custom_subjects = validated_data.pop('syllabus_custom_subjects', None)
        user_role = super().update(instance, validated_data)
        
        if syllabus_custom_subjects is not None:
            from apps.academics.models import Subject
            subjects = Subject.objects.filter(id__in=syllabus_custom_subjects)
            user_role.syllabus_custom_subjects.set(subjects)
            
        return user_role


class UserWithRolesSerializer(serializers.ModelSerializer):
    """User serializer with their assigned roles."""
    
    full_name = serializers.CharField(read_only=True)
    roles = serializers.SerializerMethodField()
    primary_role = serializers.SerializerMethodField()
    teacher_type = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'user_type', 'school', 'is_active',
            'roles', 'primary_role', 'teacher_type'
        ]
        
    def get_teacher_type(self, obj):
        from apps.teachers.models import Teacher
        teacher = Teacher.objects.filter(user=obj).first()
        return teacher.teacher_type if teacher else None
    
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
