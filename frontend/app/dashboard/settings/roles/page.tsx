'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, Plus, Search, Users, Settings, Edit2, Trash2, 
  Copy, ChevronRight, ChevronDown, Lock, Unlock, CheckCircle2,
  AlertCircle, X, Filter, MoreVertical, RefreshCw, FileText
} from 'lucide-react';
import {
  useRoles,
  useRole,
  usePermissionGroups,
  useRoleTemplates,
  createRole,
  createRoleFromTemplate,
  updateRole,
  deleteRole,
  duplicateRole,
  updateRolePermissions,
} from '@/lib/rbac';
import { Role, RoleWithPermissions, Permission, PermissionGroup, RoleTemplate, ACTION_COLORS } from '@/types/rbac';

export default function RolesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'details'>('list');

  // Fetch roles
  const { roles, loading: rolesLoading, refetch: refetchRoles } = useRoles({ search: searchQuery });
  
  // Fetch selected role details
  const { role: roleDetails, loading: roleLoading, refetch: refetchRole } = useRole(selectedRole);
  
  // Fetch permission groups
  const { groups: permissionGroups, loading: permissionsLoading } = usePermissionGroups();
  
  // Fetch templates
  const { templates, loading: templatesLoading } = useRoleTemplates();

  const handleSelectRole = (roleId: string) => {
    setSelectedRole(roleId);
    setActiveTab('details');
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete.id);
      setIsDeleteModalOpen(false);
      setRoleToDelete(null);
      if (selectedRole === roleToDelete.id) {
        setSelectedRole(null);
        setActiveTab('list');
      }
      refetchRoles();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete role');
    }
  };

  const handleDuplicateRole = async (role: Role) => {
    const newName = prompt('Enter name for the new role:', `${role.name} (Copy)`);
    if (!newName) return;
    try {
      await duplicateRole(role.id, newName);
      refetchRoles();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to duplicate role');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create and manage roles with specific permissions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FileText className="h-4 w-4" />
              From Template
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {/* Info Banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>💡 Tip:</strong> Click <strong>"From Template"</strong> to create a role based on predefined templates like Principal, Vice Principal, etc.
                </p>
              </div>
              
              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Role List */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
                {rolesLoading ? (
                  <div className="p-8 text-center text-gray-500">Loading roles...</div>
                ) : roles.length === 0 ? (
                  <div className="p-8 text-center">
                    <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 mb-3">No custom roles yet</p>
                    <button
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Create from template →
                    </button>
                  </div>
                ) : (
                  roles.map((role) => (
                    <RoleListItem
                      key={role.id}
                      role={role}
                      isSelected={selectedRole === role.id}
                      onSelect={() => handleSelectRole(role.id)}
                      onDuplicate={() => handleDuplicateRole(role)}
                      onDelete={() => {
                        setRoleToDelete(role);
                        setIsDeleteModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Role Details */}
          <div className="lg:col-span-2">
            {selectedRole && roleDetails ? (
              <RoleDetailsPanel
                role={roleDetails}
                permissionGroups={permissionGroups}
                loading={roleLoading || permissionsLoading}
                onUpdate={() => {
                  refetchRole();
                  refetchRoles();
                }}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select a Role
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Choose a role from the list to view and edit its permissions
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Create Role Modal */}
        {isCreateModalOpen && (
          <CreateRoleModal
            onClose={() => setIsCreateModalOpen(false)}
            onCreated={() => {
              refetchRoles();
              setIsCreateModalOpen(false);
            }}
          />
        )}

        {/* Template Modal */}
        {isTemplateModalOpen && (
          <TemplateModal
            templates={templates}
            loading={templatesLoading}
            onClose={() => setIsTemplateModalOpen(false)}
            onCreated={() => {
              refetchRoles();
              setIsTemplateModalOpen(false);
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && roleToDelete && (
          <DeleteConfirmModal
            role={roleToDelete}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setRoleToDelete(null);
            }}
            onConfirm={handleDeleteRole}
          />
        )}
      </div>
    </div>
  );
}

// Role List Item Component
function RoleListItem({
  role,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-600' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {role.name}
            </h3>
            {role.is_system_role && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                <Lock className="h-3 w-3" />
                System
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {role.description || 'No description'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
              Level {role.hierarchy_level}
            </span>
            {!role.is_active && (
              <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                Inactive
              </span>
            )}
          </div>
        </div>
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDuplicate();
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              {!role.is_system_role && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Role Details Panel Component
function RoleDetailsPanel({
  role,
  permissionGroups,
  loading,
  onUpdate,
}: {
  role: RoleWithPermissions;
  permissionGroups: PermissionGroup[];
  loading: boolean;
  onUpdate: () => void;
}) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [editForm, setEditForm] = useState({
    name: role.name,
    description: role.description,
    hierarchy_level: role.hierarchy_level,
  });

  // Initialize local permissions when role changes
  useEffect(() => {
    setLocalPermissions(new Set(role.permission_ids));
    setHasChanges(false);
  }, [role.permission_ids]);

  useEffect(() => {
    setEditForm({
      name: role.name,
      description: role.description,
      hierarchy_level: role.hierarchy_level,
    });
  }, [role]);

  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
    }
    setExpandedModules(newExpanded);
  };

  const togglePermission = (permissionId: string) => {
    if (role.is_system_role) return;
    
    const newPermissions = new Set(localPermissions);
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId);
    } else {
      newPermissions.add(permissionId);
    }
    setLocalPermissions(newPermissions);
    setHasChanges(true);
  };

  const toggleModulePermissions = (group: PermissionGroup, enable: boolean) => {
    if (role.is_system_role) return;
    
    const newPermissions = new Set(localPermissions);
    group.permissions.forEach((perm) => {
      if (enable) {
        newPermissions.add(perm.id);
      } else {
        newPermissions.delete(perm.id);
      }
    });
    setLocalPermissions(newPermissions);
    setHasChanges(true);
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      const originalIds = new Set(role.permission_ids);
      
      const addPermissions = Array.from(localPermissions).filter((id) => !originalIds.has(id));
      const removePermissions = Array.from(originalIds).filter((id) => !localPermissions.has(id));
      
      await updateRolePermissions(role.id, {
        add_permissions: addPermissions,
        remove_permissions: removePermissions,
      });
      
      setHasChanges(false);
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    try {
      setSaving(true);
      await updateRole(role.id, editForm);
      setIsEditingBasic(false);
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const getModulePermissionCount = (group: PermissionGroup) => {
    const total = group.permissions.length;
    const selected = group.permissions.filter((p) => localPermissions.has(p.id)).length;
    return { total, selected };
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading role details...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Role Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            {isEditingBasic ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="Role name"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="Description"
                  rows={2}
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Hierarchy Level:</label>
                  <input
                    type="number"
                    value={editForm.hierarchy_level}
                    onChange={(e) => setEditForm({ ...editForm, hierarchy_level: parseInt(e.target.value) || 0 })}
                    className="w-20 px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveBasicInfo}
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingBasic(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{role.name}</h2>
                  {role.is_system_role && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs">
                      <Lock className="h-3 w-3" />
                      System Role (Read-only)
                    </span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{role.description || 'No description'}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Level: <span className="font-medium text-gray-900 dark:text-white">{role.hierarchy_level}</span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Users: <span className="font-medium text-gray-900 dark:text-white">{role.user_count || 0}</span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Permissions: <span className="font-medium text-gray-900 dark:text-white">{localPermissions.size}</span>
                  </span>
                </div>
              </>
            )}
          </div>
          {!role.is_system_role && !isEditingBasic && (
            <button
              onClick={() => setIsEditingBasic(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Permissions</h3>
          {hasChanges && !role.is_system_role && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</span>
              <button
                onClick={() => {
                  setLocalPermissions(new Set(role.permission_ids));
                  setHasChanges(false);
                }}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Reset
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Permissions
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {permissionGroups.map((group) => {
            const { total, selected } = getModulePermissionCount(group);
            const isExpanded = expandedModules.has(group.module);
            const allSelected = selected === total;
            const someSelected = selected > 0 && selected < total;

            return (
              <div
                key={group.module}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Module Header */}
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 cursor-pointer"
                  onClick={() => toggleModule(group.module)}
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <span className="font-medium text-gray-900 dark:text-white">{group.label}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({selected}/{total})
                    </span>
                  </div>
                  {!role.is_system_role && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleModulePermissions(group, true)}
                        className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => toggleModulePermissions(group, false)}
                        className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Permissions List */}
                {isExpanded && (
                  <div className="p-4 space-y-2">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          role.is_system_role
                            ? 'cursor-default'
                            : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={localPermissions.has(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          disabled={role.is_system_role}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                              {perm.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                ACTION_COLORS[perm.action as keyof typeof ACTION_COLORS] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {perm.action}
                            </span>
                            {perm.is_sensitive && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs">
                                <AlertCircle className="h-3 w-3" />
                                Sensitive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Create Role Modal
function CreateRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hierarchy_level: 50,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    try {
      setLoading(true);
      await createRole(formData);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Role</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Grade Coordinator"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the responsibilities of this role"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hierarchy Level (0-100)
            </label>
            <input
              type="number"
              value={formData.hierarchy_level}
              onChange={(e) => setFormData({ ...formData, hierarchy_level: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Higher values = more authority (Principal: 90, Teacher: 40)
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Template Modal
function TemplateModal({
  templates,
  loading,
  onClose,
  onCreated,
}: {
  templates: RoleTemplate[];
  loading: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    try {
      setCreating(true);
      await createRoleFromTemplate(selectedTemplate, customName || undefined);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role from template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Role from Template</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading templates...</div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {templates.map((template) => (
                  <label
                    key={template.key}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.key
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.key}
                      checked={selectedTemplate === template.key}
                      onChange={() => setSelectedTemplate(template.key)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{template.name}</span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                          Level {template.hierarchy_level}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        {template.permission_count} permissions included
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Name (optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="Leave empty to use template name"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !selectedTemplate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirm Modal
function DeleteConfirmModal({
  role,
  onClose,
  onConfirm,
}: {
  role: Role;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
            Delete Role?
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
            Are you sure you want to delete <strong>{role.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
