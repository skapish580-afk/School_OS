from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, 
    CurrentUserView, 
    dashboard_summary,
    RequestPasswordResetView,
    VerifyResetTokenView,
    ResetPasswordView,
    ValidateUIDView,
)
from .rbac_views import (
    PermissionViewSet,
    RoleViewSet,
    UserRoleViewSet,
    CurrentUserPermissionsView,
    CheckPermissionView,
    StaffWithRolesListView,
    RolePermissionLogViewSet,
    sync_permissions,
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Create router for RBAC viewsets
rbac_router = DefaultRouter()
rbac_router.register(r'permissions', PermissionViewSet, basename='permission')
rbac_router.register(r'roles', RoleViewSet, basename='role')
rbac_router.register(r'user-roles', UserRoleViewSet, basename='user-role')
rbac_router.register(r'logs', RolePermissionLogViewSet, basename='rbac-log')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', CurrentUserView.as_view(), name='current_user'),
    
    # Password Reset
    path('password-reset/request/', RequestPasswordResetView.as_view(), name='password_reset_request'),
    path('password-reset/verify/', VerifyResetTokenView.as_view(), name='password_reset_verify'),
    path('password-reset/confirm/', ResetPasswordView.as_view(), name='password_reset_confirm'),
    
    # UID Validation
    path('validate-uid/', ValidateUIDView.as_view(), name='validate_uid'),
    
    # RBAC URLs
    path('rbac/', include(rbac_router.urls)),
    path('rbac/my-permissions/', CurrentUserPermissionsView.as_view(), name='current_user_permissions'),
    path('rbac/check-permission/', CheckPermissionView.as_view(), name='check_permission'),
    path('rbac/staff-with-roles/', StaffWithRolesListView.as_view(), name='staff_with_roles'),
    path('rbac/sync-permissions/', sync_permissions, name='sync_permissions'),
]