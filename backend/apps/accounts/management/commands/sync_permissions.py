"""
Management command to sync RBAC permissions from registry to database.
"""

from django.core.management.base import BaseCommand
from apps.accounts.rbac_models import Permission, Role
from apps.accounts.permissions_registry import (
    PERMISSION_REGISTRY, DEFAULT_ROLE_TEMPLATES, expand_wildcard_permissions
)


class Command(BaseCommand):
    help = 'Sync RBAC permissions from registry to database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-roles',
            action='store_true',
            help='Also create default system roles from templates',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output',
        )

    def handle(self, *args, **options):
        verbose = options['verbose']
        create_roles = options['create_roles']
        
        self.stdout.write(self.style.MIGRATE_HEADING('\n🔐 Syncing RBAC Permissions...\n'))
        
        created = 0
        updated = 0
        display_order = 0
        
        for module, module_data in PERMISSION_REGISTRY.items():
            if verbose:
                self.stdout.write(f"\n📦 Module: {module_data['label']}")
            
            for perm_tuple in module_data['permissions']:
                codename, name, description, action, resource, is_sensitive = perm_tuple
                display_order += 1
                
                perm, was_created = Permission.objects.update_or_create(
                    codename=codename,
                    defaults={
                        'name': name,
                        'description': description,
                        'module': module,
                        'action': action,
                        'resource': resource,
                        'is_sensitive': is_sensitive,
                        'display_order': display_order,
                    }
                )
                
                if was_created:
                    created += 1
                    if verbose:
                        self.stdout.write(self.style.SUCCESS(f'   ✅ Created: {codename}'))
                else:
                    updated += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✅ Permissions synced: {created} created, {updated} updated, {created + updated} total')
        )
        
        if create_roles:
            self.stdout.write(self.style.MIGRATE_HEADING('\n👤 Creating System Roles...\n'))
            
            roles_created = 0
            for template_key, template in DEFAULT_ROLE_TEMPLATES.items():
                if Role.objects.filter(
                    name=template['name'],
                    school__isnull=True,
                    is_system_role=True
                ).exists():
                    if verbose:
                        self.stdout.write(f"   ⏭️  {template['name']} already exists")
                    continue
                
                role = Role.objects.create(
                    name=template['name'],
                    description=template['description'],
                    role_type=template_key,
                    hierarchy_level=template['hierarchy_level'],
                    is_system_role=True,
                    school=None,
                )
                
                expanded_perms = expand_wildcard_permissions(template['permissions'])
                permissions = Permission.objects.filter(codename__in=expanded_perms)
                role.permissions.set(permissions)
                
                roles_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'   ✅ Created: {template["name"]} ({permissions.count()} permissions)')
                )
            
            self.stdout.write(
                self.style.SUCCESS(f'\n✅ Roles created: {roles_created}')
            )
        
        self.stdout.write(self.style.SUCCESS('\n🎉 RBAC sync complete!\n'))
