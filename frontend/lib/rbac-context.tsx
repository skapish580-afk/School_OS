'use client';

/**
 * RBAC Permission Context for React Components
 * Provides permission checking through React Context
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useCurrentUserPermissions } from './rbac';
import { CurrentUserPermissions } from '@/types/rbac';

interface PermissionContextType {
  permissions: CurrentUserPermissions | null;
  loading: boolean;
  hasPermission: (codename: string) => boolean;
  hasAnyPermission: (codenames: string[]) => boolean;
  hasAllPermissions: (codenames: string[]) => boolean;
  hasModuleAccess: (module: string) => boolean;
  canView: (module: string, resource: string) => boolean;
  canCreate: (module: string, resource: string) => boolean;
  canEdit: (module: string, resource: string) => boolean;
  canDelete: (module: string, resource: string) => boolean;
  isAdmin: boolean;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: null,
  loading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  hasModuleAccess: () => false,
  canView: () => false,
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  isAdmin: false,
  refetch: () => {},
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { permissions, loading, hasPermission, hasModuleAccess, refetch } = useCurrentUserPermissions();

  const value = useMemo(() => {
    const isAdmin = permissions?.is_admin || false;
    
    return {
      permissions,
      loading,
      hasPermission: (codename: string) => isAdmin || hasPermission(codename),
      hasAnyPermission: (codenames: string[]) => isAdmin || codenames.some(c => hasPermission(c)),
      hasAllPermissions: (codenames: string[]) => isAdmin || codenames.every(c => hasPermission(c)),
      hasModuleAccess: (module: string) => isAdmin || hasModuleAccess(module),
      canView: (module: string, resource: string) => isAdmin || hasPermission(`${module}.view_${resource}`),
      canCreate: (module: string, resource: string) => isAdmin || hasPermission(`${module}.create_${resource}`),
      canEdit: (module: string, resource: string) => isAdmin || hasPermission(`${module}.edit_${resource}`),
      canDelete: (module: string, resource: string) => isAdmin || hasPermission(`${module}.delete_${resource}`),
      isAdmin,
      refetch,
    };
  }, [permissions, loading, hasPermission, hasModuleAccess, refetch]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext() {
  return useContext(PermissionContext);
}

/**
 * Component wrapper that only renders children if user has permission
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission, loading } = usePermissionContext();

  if (loading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Component wrapper that only renders if user has ANY of the permissions
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
}: {
  permissions: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasAnyPermission, loading } = usePermissionContext();

  if (loading) return null;
  if (!hasAnyPermission(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Component wrapper that only renders children if user has access to module
 */
export function RequireModuleAccess({
  module,
  children,
  fallback = null,
}: {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasModuleAccess, loading } = usePermissionContext();

  if (loading) return null;
  if (!hasModuleAccess(module)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Component for permission-gated buttons
 */
export function PermissionButton({
  permission,
  children,
  disabled = false,
  disabledTitle = "You don't have permission for this action",
  className = '',
  onClick,
  ...props
}: {
  permission: string;
  children: ReactNode;
  disabled?: boolean;
  disabledTitle?: string;
  className?: string;
  onClick?: () => void;
  [key: string]: any;
}) {
  const { hasPermission, loading } = usePermissionContext();
  const canPerform = hasPermission(permission);

  if (loading) return null;

  return (
    <button
      className={`${className} ${!canPerform ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled || !canPerform}
      title={!canPerform ? disabledTitle : undefined}
      onClick={canPerform ? onClick : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Hook to check CRUD permissions for a resource
 */
export function useResourcePermissions(module: string, resource: string) {
  const { canView, canCreate, canEdit, canDelete, isAdmin, loading } = usePermissionContext();
  
  return {
    loading,
    canView: canView(module, resource),
    canCreate: canCreate(module, resource),
    canEdit: canEdit(module, resource),
    canDelete: canDelete(module, resource),
    isAdmin,
  };
}
