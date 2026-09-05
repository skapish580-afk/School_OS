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
        
        self.stdout.write(self.style.MIGRATE_HEADING('\n[*] Syncing RBAC Permissions...\n'))
        
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
                        self.stdout.write(self.style.SUCCESS(f'   [+] Created: {codename}'))
                else:
                    updated += 1
        # Clean up database permissions not present in the registry
        all_registry_codenames = []
        for mod, mod_data in PERMISSION_REGISTRY.items():
            for perm_tuple in mod_data['permissions']:
                all_registry_codenames.append(perm_tuple[0])
        
        deleted_count, _ = Permission.objects.exclude(codename__in=all_registry_codenames).delete()
        if deleted_count > 0:
            self.stdout.write(self.style.WARNING(f'Cleaned up {deleted_count} obsolete permissions from database\n'))
        
        self.stdout.write(
            self.style.SUCCESS(f'\n[+] Permissions synced: {created} created, {updated} updated, {created + updated} total')
        )
        
        if create_roles:
            self.stdout.write(self.style.MIGRATE_HEADING('\n[*] Creating System Roles...\n'))
            
            roles_created = 0
            roles_updated = 0
            for template_key, template in DEFAULT_ROLE_TEMPLATES.items():
                role, created_role = Role.objects.get_or_create(
                    name=template['name'],
                    school__isnull=True,
                    is_system_role=True,
                    defaults={
                        'description': template['description'],
                        'role_type': template_key,
                        'hierarchy_level': template['hierarchy_level'],
                    }
                )
                
                expanded_perms = expand_wildcard_permissions(template['permissions'])
                permissions = Permission.objects.filter(codename__in=expanded_perms)
                role.permissions.set(permissions)
                
                if created_role:
                    roles_created += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'   [+] Created: {template["name"]} ({permissions.count()} permissions)')
                    )
                else:
                    roles_updated += 1
                    if verbose:
                        self.stdout.write(
                            self.style.SUCCESS(f'   [*] Updated: {template["name"]} ({permissions.count()} permissions)')
                        )
            
            self.stdout.write(
                self.style.SUCCESS(f'\n[+] Roles processed: {roles_created} created, {roles_updated} updated')
            )
        
        self.stdout.write(self.style.SUCCESS('\n[+] RBAC sync complete!\n'))
