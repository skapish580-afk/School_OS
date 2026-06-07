'use client';

import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';
import PermissionDenied from './PermissionDenied';

interface PermissionGateProps {
  children: ReactNode;
  /** Module required (e.g., 'students', 'teachers', 'finance') */
  module?: string;
  /** Specific permission codename required (e.g., 'students.view_student') */
  permission?: string;
  /** Multiple permissions - user needs ANY of these */
  anyPermission?: string[];
  /** Multiple permissions - user needs ALL of these */
  allPermissions?: string[];
  /** Custom fallback component instead of PermissionDenied */
  fallback?: ReactNode;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom denied message */
  deniedMessage?: string;
}

/**
 * Page-level permission gate component.
 * Wrap entire pages or sections that require specific permissions.
 * 
 * Usage:
 * <PermissionGate module="students">
 *   <StudentsPageContent />
 * </PermissionGate>
 * 
 * <PermissionGate permission="finance.create_invoice">
 *   <CreateInvoiceForm />
 * </PermissionGate>
 */
export default function PermissionGate({
  children,
  module,
  permission,
  anyPermission,
  allPermissions,
  fallback,
  loadingComponent,
  deniedMessage,
}: PermissionGateProps) {
  const { 
    loading, 
    hasModuleAccess, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    isAdmin 
  } = usePermissionContext();

  // Show loading state
  if (loading) {
    return loadingComponent || (
      <div className="flex justify-center items-center p-12 min-h-[40vh]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  // Admins always have access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check module access
  if (module && !hasModuleAccess(module)) {
    return fallback || (
      <PermissionDenied 
        message={deniedMessage || `You don't have access to the ${module} module.`}
      />
    );
  }

  // Check specific permission
  if (permission && !hasPermission(permission)) {
    return fallback || (
      <PermissionDenied 
        message={deniedMessage || `You don't have the required permission: ${permission}`}
      />
    );
  }

  // Check any of multiple permissions
  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    return fallback || (
      <PermissionDenied 
        message={deniedMessage || "You don't have any of the required permissions."}
      />
    );
  }

  // Check all of multiple permissions
  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(allPermissions)) {
    return fallback || (
      <PermissionDenied 
        message={deniedMessage || "You don't have all of the required permissions."}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Inline permission check - renders nothing or fallback if no permission.
 * Use for buttons, links, and small UI elements.
 */
export function IfPermission({
  children,
  permission,
  module,
  fallback = null,
}: {
  children: ReactNode;
  permission?: string;
  module?: string;
  fallback?: ReactNode;
}) {
  const { loading, hasPermission, hasModuleAccess, isAdmin } = usePermissionContext();

  if (loading) return null;
  if (isAdmin) return <>{children}</>;
  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (module && !hasModuleAccess(module)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Hook to check if user can perform action and get loading state
 */
export function useCanPerform(permission: string) {
  const { loading, hasPermission, isAdmin } = usePermissionContext();
  return {
    loading,
    canPerform: isAdmin || hasPermission(permission),
  };
}
