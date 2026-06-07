from rest_framework.permissions import IsAuthenticated


class IsOwner(IsAuthenticated):
    """
    Permission class to check if user is a platform owner/admin
    """
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        
        # Check if user has user_type='PLATFORM_ADMIN' or has PlatformOwner profile
        if request.user.user_type == 'PLATFORM_ADMIN':
            return True
        
        # Also check if user has PlatformOwner profile
        from .models import PlatformOwner
        return PlatformOwner.objects.filter(user=request.user).exists()
