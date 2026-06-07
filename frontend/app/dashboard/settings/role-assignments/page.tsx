'use client';

import { useState, useEffect } from 'react';
import { 
  UserCog, Search, Plus, Trash2, X, Shield, Users, 
  ChevronDown, Check, AlertCircle, RefreshCw, Filter
} from 'lucide-react';
import {
  useRoles,
  useStaffWithRoles,
  useUserRoles,
  assignRole,
  removeRoleAssignment,
  bulkAssignRole,
} from '@/lib/rbac';
import { Role, UserRole, StaffWithRoles, AssignRolePayload } from '@/types/rbac';

export default function RoleAssignmentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  
  // Fetch data
  const { roles, loading: rolesLoading } = useRoles({ is_active: true });
  const { staff, loading: staffLoading, refetch: refetchStaff } = useStaffWithRoles(searchQuery);
  const { userRoles, loading: userRolesLoading, refetch: refetchUserRoles } = useUserRoles({
    role: selectedRole || undefined,
  });

  const handleRemoveAssignment = async (userRoleId: string) => {
    if (!confirm('Are you sure you want to remove this role assignment?')) return;
    try {
      await removeRoleAssignment(userRoleId);
      refetchUserRoles();
      refetchStaff();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove assignment');
    }
  };

  const handleAssignCreated = () => {
    setIsAssignModalOpen(false);
    refetchUserRoles();
    refetchStaff();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <UserCog className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Assignments</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Assign roles to staff members
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBulkAssignOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Users className="h-4 w-4" />
              Bulk Assign
            </button>
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Assign Role
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-64">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Staff List with Roles */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Staff Members ({staff.length})
            </h2>
          </div>
          
          {staffLoading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading staff...
            </div>
          ) : staff.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No staff members found
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {staff.map((member) => (
                <StaffMemberRow
                  key={member.id}
                  member={member}
                  roles={roles}
                  onAssign={() => setIsAssignModalOpen(true)}
                  onRefresh={() => {
                    refetchStaff();
                    refetchUserRoles();
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Role Assignments Table */}
        {selectedRole && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-6">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Role Assignments ({userRoles.length})
              </h2>
            </div>
            
            {userRolesLoading ? (
              <div className="p-8 text-center text-gray-500">Loading assignments...</div>
            ) : userRoles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No assignments for this role
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Scope
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Assigned
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {userRoles.map((ur) => (
                      <tr key={ur.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                {ur.user.first_name?.[0]}{ur.user.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {ur.user.first_name} {ur.user.last_name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {ur.user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm">
                            {ur.role.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {ur.grade_scope ? `Grade: ${ur.grade_scope.name}` : 
                           ur.section_scope ? `Section: ${ur.section_scope.name}` :
                           ur.subject_scope ? `Subject: ${ur.subject_scope.name}` :
                           'School-wide'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(ur.assigned_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveAssignment(ur.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Assign Role Modal */}
        {isAssignModalOpen && (
          <AssignRoleModal
            roles={roles}
            staff={staff}
            onClose={() => setIsAssignModalOpen(false)}
            onAssigned={handleAssignCreated}
          />
        )}

        {/* Bulk Assign Modal */}
        {isBulkAssignOpen && (
          <BulkAssignModal
            roles={roles}
            staff={staff}
            onClose={() => setIsBulkAssignOpen(false)}
            onAssigned={() => {
              setIsBulkAssignOpen(false);
              refetchUserRoles();
              refetchStaff();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Staff Member Row Component
function StaffMemberRow({
  member,
  roles,
  onAssign,
  onRefresh,
}: {
  member: StaffWithRoles;
  roles: Role[];
  onAssign: () => void;
  onRefresh: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');

  const handleQuickAssign = async () => {
    if (!selectedRole) return;
    try {
      setAssigning(true);
      await assignRole({ user: member.id, role: selectedRole });
      setSelectedRole('');
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign role');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {member.first_name?.[0]}{member.last_name?.[0]}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 dark:text-white">
                {member.first_name} {member.last_name}
              </p>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                {member.user_type}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Existing Roles */}
          <div className="flex items-center gap-2">
            {member.roles.length > 0 ? (
              member.roles.slice(0, 3).map((role) => (
                <span
                  key={role.id}
                  className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm"
                >
                  {role.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">No roles assigned</span>
            )}
            {member.roles.length > 3 && (
              <span className="text-sm text-gray-500">+{member.roles.length - 3} more</span>
            )}
          </div>

          {/* Quick Assign */}
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-40 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white"
            >
              <option value="">Add Role...</option>
              {roles
                .filter((r) => !member.roles.some((mr) => mr.id === r.id))
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
            </select>
            <button
              onClick={handleQuickAssign}
              disabled={!selectedRole || assigning}
              className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Assign Role Modal
function AssignRoleModal({
  roles,
  staff,
  onClose,
  onAssigned,
}: {
  roles: Role[];
  staff: StaffWithRoles[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [formData, setFormData] = useState<AssignRolePayload>({
    user: '',
    role: '',
    valid_from: '',
    valid_until: '',
    is_primary: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user || !formData.role) {
      setError('Please select both user and role');
      return;
    }

    try {
      setLoading(true);
      // Clean up empty date fields
      const payload = {
        ...formData,
        valid_from: formData.valid_from || undefined,
        valid_until: formData.valid_until || undefined,
      };
      await assignRole(payload);
      onAssigned();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Role</h3>
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
              Staff Member *
            </label>
            <select
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select staff member...</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name} ({member.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} (Level {role.hierarchy_level})
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={formData.is_primary || false}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="is_primary" className="text-sm text-gray-700 dark:text-gray-300">
                  Primary role (shown in profile)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={formData.valid_from || ''}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until || ''}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Leave dates empty for permanent assignment. Set dates for temporary roles (e.g., Acting Principal).
              </p>
            </div>
          )}

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
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bulk Assign Modal
function BulkAssignModal({
  roles,
  staff,
  onClose,
  onAssigned,
}: {
  roles: Role[];
  staff: StaffWithRoles[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStaff = staff.filter(
    (m) =>
      m.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAll = () => {
    setSelectedUsers(new Set(filteredStaff.map((m) => m.id)));
  };

  const clearAll = () => {
    setSelectedUsers(new Set());
  };

  const handleSubmit = async () => {
    if (!selectedRole || selectedUsers.size === 0) {
      setError('Please select a role and at least one user');
      return;
    }

    try {
      setLoading(true);
      const result = await bulkAssignRole({
        role: selectedRole,
        users: Array.from(selectedUsers),
      });
      alert(result.message);
      onAssigned();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Assign Role</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role to Assign *
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="">Select role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} (Level {role.hierarchy_level})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Users ({selectedUsers.size} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAll}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {filteredStaff.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(member.id)}
                    onChange={() => toggleUser(member.id)}
                    className="h-4 w-4 text-purple-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                    {member.user_type}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedRole || selectedUsers.size === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Assigning...' : `Assign to ${selectedUsers.size} Users`}
          </button>
        </div>
      </div>
    </div>
  );
}
