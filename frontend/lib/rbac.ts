/**
 * RBAC API Hooks for School-OS
 * Provides React hooks for managing roles, permissions, and user assignments
 */

import { useState, useEffect, useCallback } from 'react';
import api from './api';
import {
  Permission,
  PermissionGroup,
  Role,
  RoleWithPermissions,
  UserRole,
  StaffWithRoles,
  RoleTemplate,
  RolePermissionLog,
  CurrentUserPermissions,
  CreateRolePayload,
  UpdateRolePayload,
  BulkPermissionUpdatePayload,
  AssignRolePayload,
  BulkAssignRolePayload,
} from '@/types/rbac';

const RBAC_BASE = '/auth/rbac';

// ============================================================
// Permission Hooks
// ============================================================

/**
 * Hook to fetch all permissions
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`${RBAC_BASE}/permissions/`);
      setPermissions(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return { permissions, loading, error, refetch: fetchPermissions };
}

/**
 * Hook to fetch permissions grouped by module
 */
export function usePermissionGroups() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`${RBAC_BASE}/permissions/grouped/`);
      setGroups(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch permission groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, error, refetch: fetchGroups };
}

// ============================================================
// Role Hooks
// ============================================================

/**
 * Hook to fetch all roles
 */
export function useRoles(filters?: { is_active?: boolean; role_type?: string; search?: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
      if (filters?.role_type) params.append('role_type', filters.role_type);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await api.get(`${RBAC_BASE}/roles/?${params.toString()}`);
      setRoles(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  }, [filters?.is_active, filters?.role_type, filters?.search]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, error, refetch: fetchRoles };
}

/**
 * Hook to fetch a single role with permissions
 */
export function useRole(roleId: string | null) {
  const [role, setRole] = useState<RoleWithPermissions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (!roleId) {
      setRole(null);
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get(`${RBAC_BASE}/roles/${roleId}/`);
      setRole(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch role');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return { role, loading, error, refetch: fetchRole };
}

/**
 * Hook to fetch role templates
 */
export function useRoleTemplates() {
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`${RBAC_BASE}/roles/templates/`);
      setTemplates(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch role templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}

// ============================================================
// Role Management Functions
// ============================================================

/**
 * Create a new role
 */
export async function createRole(data: CreateRolePayload): Promise<RoleWithPermissions> {
  const response = await api.post(`${RBAC_BASE}/roles/`, data);
  return response.data;
}

/**
 * Create a role from a template
 */
export async function createRoleFromTemplate(template: string, customName?: string): Promise<RoleWithPermissions> {
  const response = await api.post(`${RBAC_BASE}/roles/create_from_template/`, {
    template,
    name: customName,
  });
  return response.data;
}

/**
 * Update a role
 */
export async function updateRole(roleId: string, data: UpdateRolePayload): Promise<RoleWithPermissions> {
  const response = await api.patch(`${RBAC_BASE}/roles/${roleId}/`, data);
  return response.data;
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: string): Promise<void> {
  await api.delete(`${RBAC_BASE}/roles/${roleId}/`);
}

/**
 * Duplicate a role
 */
export async function duplicateRole(roleId: string, newName: string): Promise<RoleWithPermissions> {
  const response = await api.post(`${RBAC_BASE}/roles/${roleId}/duplicate/`, { name: newName });
  return response.data;
}

/**
 * Update permissions for a role
 */
export async function updateRolePermissions(
  roleId: string,
  data: BulkPermissionUpdatePayload
): Promise<RoleWithPermissions> {
  const response = await api.post(`${RBAC_BASE}/roles/${roleId}/update_permissions/`, data);
  return response.data;
}

// ============================================================
// User Role Assignment Hooks
// ============================================================

/**
 * Hook to fetch user role assignments
 */
export function useUserRoles(filters?: { user?: string; role?: string; is_active?: boolean }) {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.user) params.append('user', filters.user);
      if (filters?.role) params.append('role', filters.role);
      if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
      
      const response = await api.get(`${RBAC_BASE}/user-roles/?${params.toString()}`);
      setUserRoles(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user roles');
    } finally {
      setLoading(false);
    }
  }, [filters?.user, filters?.role, filters?.is_active]);

  useEffect(() => {
    fetchUserRoles();
  }, [fetchUserRoles]);

  return { userRoles, loading, error, refetch: fetchUserRoles };
}

/**
 * Hook to fetch staff with their roles
 */
export function useStaffWithRoles(search?: string) {
  const [staff, setStaff] = useState<StaffWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await api.get(`${RBAC_BASE}/staff-with-roles/${params}`);
      setStaff(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return { staff, loading, error, refetch: fetchStaff };
}

// ============================================================
// User Role Assignment Functions
// ============================================================

/**
 * Assign a role to a user
 */
export async function assignRole(data: AssignRolePayload): Promise<UserRole> {
  const response = await api.post(`${RBAC_BASE}/user-roles/`, data);
  return response.data;
}

/**
 * Remove a role assignment
 */
export async function removeRoleAssignment(userRoleId: string): Promise<void> {
  await api.delete(`${RBAC_BASE}/user-roles/${userRoleId}/`);
}

/**
 * Bulk assign a role to multiple users
 */
export async function bulkAssignRole(data: BulkAssignRolePayload): Promise<{ created: number; skipped: number; message: string }> {
  const response = await api.post(`${RBAC_BASE}/user-roles/bulk_assign/`, data);
  return response.data;
}

// ============================================================
// Current User Permissions
// ============================================================

/**
 * Hook to get current user's permissions
 */
export function useCurrentUserPermissions() {
  const [permissions, setPermissions] = useState<CurrentUserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`${RBAC_BASE}/my-permissions/`);
      setPermissions(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Helper function to check if user has a permission
  const hasPermission = useCallback((permissionCodename: string): boolean => {
    if (!permissions) return false;
    if (permissions.is_admin) return true;
    return permissions.permissions.includes(permissionCodename) || permissions.permissions.includes('*');
  }, [permissions]);

  // Helper function to check if user has any permission in a module
  const hasModuleAccess = useCallback((module: string): boolean => {
    if (!permissions) return false;
    if (permissions.is_admin) return true;
    return !!permissions.permissions_by_module[module]?.length;
  }, [permissions]);

  return { permissions, loading, error, refetch: fetchPermissions, hasPermission, hasModuleAccess };
}

/**
 * Check if user has a specific permission (standalone function)
 */
export async function checkPermission(permissionCodename: string): Promise<boolean> {
  try {
    const response = await api.post(`${RBAC_BASE}/check-permission/`, {
      permission: permissionCodename,
    });
    return response.data.has_permission;
  } catch {
    return false;
  }
}

// ============================================================
// Audit Logs
// ============================================================

/**
 * Hook to fetch RBAC audit logs
 */
export function useRBACLogs(filters?: { action?: string; from_date?: string; to_date?: string }) {
  const [logs, setLogs] = useState<RolePermissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.action) params.append('action', filters.action);
      if (filters?.from_date) params.append('from_date', filters.from_date);
      if (filters?.to_date) params.append('to_date', filters.to_date);
      
      const response = await api.get(`${RBAC_BASE}/logs/?${params.toString()}`);
      setLogs(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters?.action, filters?.from_date, filters?.to_date]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}