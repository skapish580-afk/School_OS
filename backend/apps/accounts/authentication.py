from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import exceptions
from apps.accounts.permission_utils import clear_permission_cache

class RoleRevocationJWTAuthentication(JWTAuthentication):
    """
    Custom JWT Authentication backend that checks whether virtual role users
    (user_type == 'ROLE') still have an active staff assignment in UserRole.
    If the role assignment has been revoked or deleted by an admin, authentication fails
    with HTTP 401 Unauthorized, automatically logging out all devices using that role.
    """
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user and user.user_type == 'ROLE':
            from apps.accounts.rbac_models import UserRole
            has_active_assignment = UserRole.objects.filter(
                role__associated_user=user,
                is_active=True
            ).exclude(user=user).exists()
            
            if not has_active_assignment:
                # Clear permission cache to prevent stale permission evaluations
                if hasattr(user, 'school') and user.school:
                    clear_permission_cache(user, user.school)
                raise exceptions.AuthenticationFailed('This role assignment has been revoked. You have been logged out.')
        return user
