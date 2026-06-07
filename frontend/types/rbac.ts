/**
 * RBAC Types and Interfaces for School-OS
 */

// Permission action types
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'manage' | 'export' | 'import' | 'publish';

// Permission modules
export type PermissionModule = 
  | 'students' | 'teachers' | 'academics' | 'attendance' 
  | 'finance' | 'health' | 'discipline' | 'gatepass' 
  | 'achievements' | 'transfers' | 'enrollments' 
  | 'reports' | 'settings' | 'users' | 'roles';

// Permission interface
export interface Permission {
  id: string;
  codename: string;
  name: string;
  description: string;
  module: PermissionModule;
  action: PermissionAction;
  resource: string;
  is_sensitive: boolean;
  display_order: number;
}

// Permission group (for UI display)
export interface PermissionGroup {
  module: string;
  label: string;
  icon: string;
  permissions: Permission[];
}

// Role types
export type RoleType = 
  | 'PRINCIPAL' | 'VICE_PRINCIPAL' | 'HEAD_OF_DEPARTMENT' 
  | 'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'ACCOUNTANT' 
  | 'RECEPTIONIST' | 'COUNSELOR' | 'CUSTOM';

// Role interface
export interface Role {
  id: string;
  name: string;
  description: string;
  role_type: RoleType;
  hierarchy_level: number;
  is_system_role: boolean;
  is_active: boolean;
  school: {
    id: string;
    name: string;
  } | null;
  created_by: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// Role with permissions (detailed view)
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
  permission_ids: string[];
  user_count: number;
}

// User role assignment
export interface UserRole {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    user_type: string;
  };
  role: Role;
  school: {
    id: string;
    name: string;
  };
  is_active: boolean;
  assigned_at: string;
  assigned_by: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  grade_scope: {
    id: string;
    name: string;
  } | null;
  section_scope: {
    id: string;
    name: string;
  } | null;
  subject_scope: {
    id: string;
    name: string;
  } | null;
}

// Staff with roles
export interface StaffWithRoles {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: string;
  roles: Role[];
  is_active: boolean;
}

// Role template
export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  hierarchy_level: number;
  permission_count: number;
}

// Permission log entry
export interface RolePermissionLog {
  id: string;
  timestamp: string;
  action: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED' | 'USER_ASSIGNED' | 'USER_REMOVED' | 'PERMISSION_CHANGED';
  actor: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: Role | null;
  target_user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  permission: Permission | null;
  details: Record<string, any>;
}

// Current user permissions
export interface CurrentUserPermissions {
  user_id: string;
  email: string;
  user_type: string;
  is_admin: boolean;
  roles: Role[];
  permissions: string[];
  permissions_by_module: Record<string, string[]>;
}

// Create/Update role payload
export interface CreateRolePayload {
  name: string;
  description?: string;
  role_type?: RoleType;
  hierarchy_level?: number;
  permission_ids?: string[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  role_type?: RoleType;
  hierarchy_level?: number;
  is_active?: boolean;
}

// Bulk permission update
export interface BulkPermissionUpdatePayload {
  add_permissions?: string[];
  remove_permissions?: string[];
}

// User role assignment payload
export interface AssignRolePayload {
  user: string;
  role: string;
  grade_scope?: string;
  section_scope?: string;
  subject_scope?: string;
  valid_from?: string;
  valid_until?: string;
  is_primary?: boolean;
}

// Bulk assign roles
export interface BulkAssignRolePayload {
  role: string;
  users: string[];
}

// Module metadata for display
export const MODULE_ICONS: Record<string, string> = {
  students: 'Users',
  teachers: 'GraduationCap',
  academics: 'BookOpen',
  attendance: 'ClipboardCheck',
  finance: 'Wallet',
  health: 'Heart',
  discipline: 'Gavel',
  gatepass: 'DoorOpen',
  achievements: 'Trophy',
  transfers: 'ArrowLeftRight',
  enrollments: 'UserPlus',
  reports: 'BarChart3',
  settings: 'Settings',
  users: 'UserCog',
  roles: 'Shield',
};

export const MODULE_LABELS: Record<string, string> = {
  students: 'Students',
  teachers: 'Teachers',
  academics: 'Academics',
  attendance: 'Attendance',
  finance: 'Finance',
  health: 'Health Records',
  discipline: 'Discipline',
  gatepass: 'Gate Pass',
  achievements: 'Achievements',
  transfers: 'Transfers',
  enrollments: 'Enrollments',
  reports: 'Reports',
  settings: 'Settings',
  users: 'User Management',
  roles: 'Role Management',
};

export const ACTION_COLORS: Record<PermissionAction, string> = {
  view: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  create: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  edit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  approve: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  manage: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  export: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  import: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  publish: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
};
