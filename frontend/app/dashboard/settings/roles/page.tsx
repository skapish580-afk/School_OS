'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Shield, Plus, Search, Users, Settings, Edit2, Trash2, 
  Copy, ChevronRight, ChevronDown, Lock, Unlock, CheckCircle2,
  AlertCircle, X, Filter, MoreVertical, RefreshCw, FileText,
  UserPlus, Key, Eye, EyeOff
} from 'lucide-react';
import JSZip from 'jszip';

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
import api from '@/lib/api';

export default function RolesPage() {
  const [roleSection, setRoleSection] = useState<'non-teacher' | 'teacher' | 'student'>('non-teacher');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'details'>('list');

  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Teaching staff state
  const [teachingStaff, setTeachingStaff] = useState<any[]>([]);
  const [loadingTeaching, setLoadingTeaching] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');

  // Student state
  const [studentList, setStudentList] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [registeringBatch, setRegisteringBatch] = useState(false);


  // Fetch roles
  const { roles, loading: rolesLoading, refetch: refetchRoles } = useRoles({ search: searchQuery });
  
  // Fetch selected role details
  const { role: roleDetails, loading: roleLoading, refetch: refetchRole } = useRole(selectedRole);
  
  // Fetch permission groups
  const { groups: permissionGroups, loading: permissionsLoading } = usePermissionGroups();
  
  // Fetch templates
  const { templates, loading: templatesLoading } = useRoleTemplates();

  const fetchTeachingStaff = () => {
    setLoadingTeaching(true);
    api.get('/teachers/profiles/')
      .then((res) => {
        const all = res.data || [];
        setTeachingStaff(all.filter((t: any) => t.teacher_type !== 'NON_TEACHING'));
      })
      .catch((err) => console.error('Failed to load teaching staff', err))
      .finally(() => setLoadingTeaching(false));
  };

  useEffect(() => {
    if (roleSection === 'teacher') {
      fetchTeachingStaff();
    }
  }, [roleSection]);

  useEffect(() => {
    if (roleSection === 'student' && studentList.length === 0) {
      setLoadingStudents(true);
      api.get('/students/?status=ACTIVE')
        .then((res) => {
          setStudentList(res.data?.results || res.data || []);
        })
        .catch((err) => console.error('Failed to load students', err))
        .finally(() => setLoadingStudents(false));
    }
  }, [roleSection, studentList.length]);

  const handleRegisterStudentsBatch = async () => {
    try {
      setRegisteringBatch(true);
      const res = await api.post('/students/register_batch/');
      const data = res.data;
      const studentsList: any[] = data.students || [];

      if (studentsList.length === 0) {
        alert('No active students found to register.');
        return;
      }

      // Group students by grade-section (e.g. 1-A, 2-B, N-A)
      const groups: { [key: string]: any[] } = {};
      studentsList.forEach((s) => {
        const g = s.grade && s.grade !== 'N/A' && s.grade !== 'null' && s.grade !== 'undefined' ? s.grade : 'N';
        const sec = s.section && s.section !== 'N/A' && s.section !== 'null' && s.section !== 'undefined' ? s.section : 'A';
        const key = `${g}-${sec}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      });

      const zip = new JSZip();

      Object.keys(groups).forEach((groupKey) => {
        const items = groups[groupKey];
        let csvContent = 'SUID,Student Name,Grade,Section,Username,Password\n';
        items.forEach((item) => {
          const cleanName = `"${(item.full_name || '').replace(/"/g, '""')}"`;
          csvContent += `${item.suid},${cleanName},${item.grade},${item.section},${item.username},${item.password}\n`;
        });
        const filename = `Student Login Credentials ${groupKey}.csv`;
        zip.file(filename, csvContent);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Student_Login_Credentials.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully registered credentials for ${studentsList.length} students! ZIP archive "Student_Login_Credentials.zip" containing CSV files per grade-section has been downloaded.`);

      api.get('/students/?status=ACTIVE').then((r) => setStudentList(r.data?.results || r.data || []));
    } catch (err: any) {
      console.error('Failed registering students', err);
      alert(err.response?.data?.error || 'Failed to register students.');
    } finally {
      setRegisteringBatch(false);
    }
  };


  const filteredTeachingStaff = useMemo(() => {
    if (!teacherSearch) return teachingStaff;
    const q = teacherSearch.toLowerCase();
    return teachingStaff.filter((t) => 
      t.full_name?.toLowerCase().includes(q) ||
      t.tuid?.toLowerCase().includes(q) ||
      t.subjects?.toLowerCase().includes(q) ||
      t.user?.email?.toLowerCase().includes(q)
    );
  }, [teachingStaff, teacherSearch]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return studentList;
    const q = studentSearch.toLowerCase();
    return studentList.filter((s) =>
      s.full_name?.toLowerCase().includes(q) ||
      s.suid?.toLowerCase().includes(q) ||
      s.admission_number?.toLowerCase().includes(q) ||
      s.current_grade_level?.toString().toLowerCase().includes(q)
    );
  }, [studentList, studentSearch]);

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
          {roleSection === 'non-teacher' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Role
              </button>
            </div>
          )}
          {roleSection === 'student' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegisterStudentsBatch}
                disabled={registeringBatch}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 font-semibold text-sm cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                {registeringBatch ? 'Registering...' : 'Register Students'}
              </button>
            </div>
          )}
        </div>


        {/* Section Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setRoleSection('teacher')}
              className={`pb-3 px-1 font-semibold text-sm transition relative ${
                roleSection === 'teacher'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Teacher Role
            </button>
            <button
              onClick={() => setRoleSection('non-teacher')}
              className={`pb-3 px-1 font-semibold text-sm transition relative ${
                roleSection === 'non-teacher'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Non-Teacher Role
            </button>
            <button
              onClick={() => setRoleSection('student')}
              className={`pb-3 px-1 font-semibold text-sm transition relative ${
                roleSection === 'student'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Student Role
            </button>
          </div>
        </div>

        {/* Non-Teacher Role Section (Default) */}
        {roleSection === 'non-teacher' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles List */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Info Banner */}
                <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800 space-y-1.5">
                  <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>👑 Role Hierarchy & Overwrite Rule</span>
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Hierarchy level (<strong>1–100</strong>) controls edit authority for shared permissions. A role can only edit or overwrite records created by roles with an <strong>equal or lower</strong> hierarchy level. <strong>School Admin</strong> is permanently set to <strong>101</strong> (full administrative control).
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
                        onClick={() => setIsCreateModalOpen(true)}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Create role →
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
        )}

        {/* Teacher Role Section */}
        {roleSection === 'teacher' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Teacher List */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>👩‍🏫 Teaching Staff List</span>
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    Select a teaching staff member to manage their assigned role and view permissions
                  </p>
                </div>
                
                {/* Search */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search teaching staff..."
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {loadingTeaching ? (
                    <div className="p-8 text-center text-gray-500">Loading teaching staff...</div>
                  ) : filteredTeachingStaff.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No teaching staff records found
                    </div>
                  ) : (
                    filteredTeachingStaff.map((teacher) => (
                      <div
                        key={teacher.id}
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedTeacherId === teacher.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-600' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {teacher.full_name?.charAt(0) || 'T'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {teacher.full_name}
                              </h3>
                              <span className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                {teacher.tuid}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {teacher.subjects || 'General Subject'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Teacher Details */}
            <div className="lg:col-span-2">
              {selectedTeacherId && filteredTeachingStaff.find(t => t.id === selectedTeacherId) ? (
                <TeacherDetailsPanel
                  teacher={filteredTeachingStaff.find(t => t.id === selectedTeacherId)}
                  roles={roles}
                  permissionGroups={permissionGroups}
                  onUpdate={() => {
                    fetchTeachingStaff();
                    refetchRoles();
                  }}
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                  <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Select a Teaching Staff Member
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Choose a teaching staff member from the list to view and manage their role & permissions
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Role Section */}
        {roleSection === 'student' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student List */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>🎓 Student List</span>
                  </p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    Select a student to manage their assigned role and view permissions
                  </p>
                </div>
                
                {/* Search */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {loadingStudents ? (
                    <div className="p-8 text-center text-gray-500">Loading students...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No student records found
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          selectedStudentId === student.id ? 'bg-indigo-50 dark:bg-indigo-900/30 border-l-4 border-indigo-600' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {student.full_name?.charAt(0) || 'S'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {student.full_name}
                              </h3>
                              <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                {student.suid}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {student.current_class ? `Class ${student.current_class}` : student.current_grade_level ? `Grade ${student.current_grade_level}` : 'Enrolled Student'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Student Details */}
            <div className="lg:col-span-2">
              {selectedStudentId && filteredStudents.find(s => s.id === selectedStudentId) ? (
                <StudentDetailsPanel
                  student={filteredStudents.find(s => s.id === selectedStudentId)}
                  onUpdate={() => {
                    api.get('/students/?status=ACTIVE').then((r) => setStudentList(r.data?.results || r.data || []));
                  }}
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                  <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Select a Student
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Choose a student from the list to manage their student login credentials & password
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

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
            {role.created_by_name && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded truncate max-w-[140px]" title={`Created by: ${role.created_by_name}`}>
                By: {role.created_by_name}
              </span>
            )}
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
  const [expandedSubModules, setExpandedSubModules] = useState<Set<string>>(new Set());
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(new Set());

  const [localTimetableGradeScopes, setLocalTimetableGradeScopes] = useState<Set<string>>(new Set());
  const [localSyllabusSubjectScopes, setLocalSyllabusSubjectScopes] = useState<Set<string>>(new Set());
  const [localExamSubjectScopes, setLocalExamSubjectScopes] = useState<Set<string>>(new Set());
  const [localExamTypeScopes, setLocalExamTypeScopes] = useState<Set<string>>(new Set());
  const [localMarksSubjectScopes, setLocalMarksSubjectScopes] = useState<Set<string>>(new Set());
  const [localAttendanceSectionScopes, setLocalAttendanceSectionScopes] = useState<Set<string>>(new Set());

  const [dbGrades, setDbGrades] = useState<any[]>([]);
  const [dbSections, setDbSections] = useState<any[]>([]);
  const [dbSubjectMappings, setDbSubjectMappings] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [gradesRes, sectionsRes, mappingsRes] = await Promise.all([
          api.get('/academics/grades/'),
          api.get('/academics/sections/'),
          api.get('/academics/subject-mappings/'),
        ]);
        setDbGrades(gradesRes.data.results || gradesRes.data || []);
        setDbSections(sectionsRes.data.results || sectionsRes.data || []);
        setDbSubjectMappings(mappingsRes.data.results || mappingsRes.data || []);
      } catch (err) {
        console.error('Failed to load scope metadata', err);
      }
    };
    fetchMetadata();
  }, []);

  const toggleTimetableGradeScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localTimetableGradeScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalTimetableGradeScopes(newScopes);
    setHasChanges(true);
  };

  const toggleSyllabusSubjectScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localSyllabusSubjectScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalSyllabusSubjectScopes(newScopes);
    setHasChanges(true);
  };

  const toggleExamSubjectScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localExamSubjectScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalExamSubjectScopes(newScopes);
    setHasChanges(true);
  };

  const toggleExamTypeScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localExamTypeScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalExamTypeScopes(newScopes);
    setHasChanges(true);
  };

  const toggleMarksSubjectScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localMarksSubjectScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalMarksSubjectScopes(newScopes);
    setHasChanges(true);
  };

  const toggleAttendanceSectionScope = (id: string) => {
    if (role.is_system_role) return;
    const newScopes = new Set(localAttendanceSectionScopes);
    if (newScopes.has(id)) newScopes.delete(id);
    else newScopes.add(id);
    setLocalAttendanceSectionScopes(newScopes);
    setHasChanges(true);
  };

  const toggleSubModule = (subKey: string) => {
    const newExpanded = new Set(expandedSubModules);
    if (newExpanded.has(subKey)) {
      newExpanded.delete(subKey);
    } else {
      newExpanded.add(subKey);
    }
    setExpandedSubModules(newExpanded);
  };
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingBasic, setIsEditingBasic] = useState(false);

  // Creator context: max hierarchy & allowed permissions
  const [creatorCtx, setCreatorCtx] = useState<{
    is_full_admin: boolean;
    max_hierarchy_level: number;
    allowed_permission_ids: string[] | null;
  } | null>(null);

  useEffect(() => {
    const fetchCtx = async () => {
      try {
        const res = await api.get('/auth/rbac/roles/my_creation_context/');
        setCreatorCtx(res.data);
      } catch (err) {
        setCreatorCtx({ is_full_admin: true, max_hierarchy_level: 100, allowed_permission_ids: null });
      }
    };
    fetchCtx();
  }, []);
 
  const maxLevel = creatorCtx?.max_hierarchy_level ?? 100;

  // Filter visible permissions/groups based on creator context
  const filteredPermissionGroups = useMemo(() => {
    if (!creatorCtx) return permissionGroups;
    if (creatorCtx.is_full_admin || !creatorCtx.allowed_permission_ids) return permissionGroups;
    
    const allowed = new Set(creatorCtx.allowed_permission_ids);
    return permissionGroups
      .map(group => {
        const filteredPermissions = group.permissions.filter(p => allowed.has(p.id));
        return {
          ...group,
          permissions: filteredPermissions,
        };
      })
      .filter(group => group.permissions.length > 0);
  }, [permissionGroups, creatorCtx]);

  const [editForm, setEditForm] = useState({
    name: role.name,
    description: role.description,
    hierarchy_level: role.hierarchy_level,
    username: role.username || '',
    password: '',
  });

  // Initialize local permissions when role changes
  useEffect(() => {
    setLocalPermissions(new Set(role.permission_ids));
    setLocalTimetableGradeScopes(new Set(role.timetable_grade_scopes || []));
    setLocalSyllabusSubjectScopes(new Set(role.syllabus_subject_scopes || []));
    setLocalExamSubjectScopes(new Set(role.exam_subject_scopes || []));
    setLocalExamTypeScopes(new Set(role.exam_type_scopes || []));
    setLocalMarksSubjectScopes(new Set(role.marks_subject_scopes || []));
    setLocalAttendanceSectionScopes(new Set(role.attendance_section_scopes || []));
    setHasChanges(false);
  }, [role]);

  useEffect(() => {
    setEditForm({
      name: role.name,
      description: role.description,
      hierarchy_level: role.hierarchy_level,
      username: role.username || '',
      password: '',
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
      
      if (addPermissions.length > 0 || removePermissions.length > 0) {
        await updateRolePermissions(role.id, {
          add_permissions: addPermissions,
          remove_permissions: removePermissions,
        });
      }

      await updateRole(role.id, {
        timetable_grade_scopes: Array.from(localTimetableGradeScopes),
        syllabus_subject_scopes: Array.from(localSyllabusSubjectScopes),
        exam_subject_scopes: Array.from(localExamSubjectScopes),
        exam_type_scopes: Array.from(localExamTypeScopes),
        marks_subject_scopes: Array.from(localMarksSubjectScopes),
        attendance_section_scopes: Array.from(localAttendanceSectionScopes),
      });
      
      setHasChanges(false);
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save permissions and scopes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    const maxLevel = creatorCtx?.max_hierarchy_level ?? 100;
    if (editForm.hierarchy_level > maxLevel) {
      alert(`Hierarchy level cannot exceed ${maxLevel} (your own level).`);
      return;
    }

    try {
      setSaving(true);
      await updateRole(role.id, {
        name: editForm.name,
        description: editForm.description,
        hierarchy_level: editForm.hierarchy_level,
        username: editForm.username.trim() || undefined,
        password: editForm.password || undefined,
      });
      setIsEditingBasic(false);
      onUpdate();
    } catch (error: any) {
      alert(error.response?.data?.error || JSON.stringify(error.response?.data) || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const getModulePermissionCount = (group: PermissionGroup) => {
    const total = group.permissions.length;
    const selected = group.permissions.filter((p) => localPermissions.has(p.id)).length;
    return { total, selected };
  };

  const renderScopeSection = (
    title: string,
    items: { id: string; label: string }[],
    checkedSet: Set<string>,
    onToggle: (id: string) => void
  ) => {
    return (
      <div className="mt-4 pt-3 border-t border-dashed border-gray-250 dark:border-gray-700">
        <span className="text-[11px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
          {title} (Leave empty for no limit)
        </span>
        {items.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No configuration found in Classes & Sections</span>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-800">
            {items.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-2 p-1.5 rounded text-xs transition cursor-pointer ${
                  checkedSet.has(item.id)
                    ? 'bg-indigo-50/60 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-350 font-semibold'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedSet.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  disabled={role.is_system_role}
                  className="h-3.5 w-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="truncate">{item.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hierarchy Level (1–{maxLevel}):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm.hierarchy_level}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setEditForm({ ...editForm, hierarchy_level: Math.min(maxLevel, Math.max(1, val)) });
                      }}
                      className="w-24 px-3 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-sm"
                      min="1"
                      max={maxLevel}
                    />
                    <span className="text-xs text-gray-500">Higher = more authority. {creatorCtx && !creatorCtx.is_full_admin ? `⚠ Capped to ${maxLevel}.` : '(School Admin is fixed at 101)'}</span>
                  </div>
                </div>

                {/* Shared Login Credentials Section */}
                <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-3 mt-2">
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Shared Login Credentials
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., coordinator"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                      <input
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500"
                        placeholder={role.plain_password ? "•••••••• (Leave blank to keep)" : "•••••••• (Create password)"}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
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
                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    Hierarchy Level: <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">Level {role.hierarchy_level} / 100</span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Users: <span className="font-medium text-gray-900 dark:text-white">{role.user_count || 0}</span>
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Permissions: <span className="font-medium text-gray-900 dark:text-white">{localPermissions.size}</span>
                  </span>
                  {role.created_by_name && (
                    <span className="text-gray-600 dark:text-gray-400">
                      Created by: <span className="font-medium text-gray-900 dark:text-white">{role.created_by_name}</span>
                    </span>
                  )}
                  {role.username && (
                    <span className="text-gray-600 dark:text-gray-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-350">
                      <Users className="h-3.5 w-3.5" />
                      Shared Login: <strong className="font-semibold text-emerald-900 dark:text-emerald-250">{role.username}</strong>
                      {role.plain_password && (
                        <>
                          <span className="text-emerald-300 dark:text-emerald-700">|</span>
                          <span>Password: <strong className="font-semibold text-emerald-900 dark:text-emerald-250">{role.plain_password}</strong></span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Visual Authority Meter */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/80 dark:border-gray-700/80">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      Authority Rank
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">
                      School Admin (Fixed: 101) &gt; Custom Staff (1–100)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${(Math.min(100, Math.max(1, role.hierarchy_level)) / 101) * 100}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 rounded-full transition-all duration-500"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                    <span>Level 1 (Staff Base)</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">This Role: L{role.hierarchy_level}</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">School Admin: L101</span>
                  </div>
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
                  setLocalTimetableGradeScopes(new Set(role.timetable_grade_scopes || []));
                  setLocalSyllabusSubjectScopes(new Set(role.syllabus_subject_scopes || []));
                  setLocalExamSubjectScopes(new Set(role.exam_subject_scopes || []));
                  setLocalExamTypeScopes(new Set(role.exam_type_scopes || []));
                  setLocalMarksSubjectScopes(new Set(role.marks_subject_scopes || []));
                  setLocalAttendanceSectionScopes(new Set(role.attendance_section_scopes || []));
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
          {filteredPermissionGroups.map((group) => {
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
                  <div className="p-4 space-y-3">
                    {(() => {
                      const renderPermissionLabel = (perm: any) => {
                        const isBusSpecific = perm.codename.startsWith('transport.mark_attendance_');
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                              isBusSpecific ? 'ml-6 border-l-2 border-indigo-200 pl-3' : ''
                            } ${
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
                        );
                      };

                      // Group permissions by resource
                      const subGroups: Record<string, typeof group.permissions> = {};
                      group.permissions.forEach(perm => {
                        const resKey = perm.resource || 'general';
                        if (!subGroups[resKey]) subGroups[resKey] = [];
                        subGroups[resKey].push(perm);
                      });

                      if (group.module === 'library') {
                        const generalPerms = subGroups['general'] || [];
                        const logKeys = ['circulation_log', 'stock_register_log', 'visitor_log', 'fine_fees_log'];
                        const logSubGroups = logKeys.filter(k => subGroups[k]);
                        
                        const totalLogsPerms = logSubGroups.reduce((acc, k) => acc + (subGroups[k]?.length || 0), 0);
                        const selectedLogsPerms = logSubGroups.reduce((acc, k) => acc + (subGroups[k]?.filter(p => localPermissions.has(p.id)).length || 0), 0);
                        
                        const isLogsExpanded = !expandedSubModules.has('library_logs');

                        return (
                          <div className="space-y-3">
                            {/* 1. General Drop-down */}
                            {generalPerms.length > 0 && (() => {
                              const isGenExpanded = !expandedSubModules.has('library_general');
                              const genSelected = generalPerms.filter(p => localPermissions.has(p.id)).length;
                              return (
                                <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/20">
                                  <div
                                    className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 dark:bg-gray-800/60 cursor-pointer select-none"
                                    onClick={() => toggleSubModule('library_general')}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isGenExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                      <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">General</span>
                                      <span className="text-xs text-gray-500 font-normal">({genSelected}/{generalPerms.length})</span>
                                    </div>
                                  </div>
                                  {isGenExpanded && (
                                    <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                                      {generalPerms.map(renderPermissionLabel)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* 2. Logs Drop-down */}
                            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/20">
                              <div
                                className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 dark:bg-gray-800/60 cursor-pointer select-none"
                                onClick={() => toggleSubModule('library_logs')}
                              >
                                <div className="flex items-center gap-2">
                                  {isLogsExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                  <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">Logs</span>
                                  <span className="text-xs text-gray-500 font-normal">({selectedLogsPerms}/{totalLogsPerms})</span>
                                </div>
                              </div>

                              {isLogsExpanded && (
                                <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
                                  {logSubGroups.map(logKey => {
                                    const logPerms = subGroups[logKey];
                                    const logSubKey = `library_log_${logKey}`;
                                    const isLogExpanded = !expandedSubModules.has(logSubKey);
                                    const logSelected = logPerms.filter(p => localPermissions.has(p.id)).length;
                                    const logTitle = 
                                      logKey === 'circulation_log' ? 'Circulation Log' :
                                      logKey === 'stock_register_log' ? 'Stock Register Log' :
                                      logKey === 'visitor_log' ? 'Visitor Log' : 'Fine & Fees Log';

                                    return (
                                      <div key={logKey} className="border border-gray-200 dark:border-gray-700/40 rounded-lg overflow-hidden bg-gray-50/40 dark:bg-gray-800/10">
                                        <div
                                          className="flex items-center justify-between px-3 py-2 bg-gray-100/60 dark:bg-gray-800/40 cursor-pointer select-none"
                                          onClick={() => toggleSubModule(logSubKey)}
                                        >
                                          <div className="flex items-center gap-2">
                                            {isLogExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                            <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">{logTitle}</span>
                                            <span className="text-xs text-gray-400 font-normal">({logSelected}/{logPerms.length})</span>
                                          </div>
                                        </div>
                                        {isLogExpanded && (
                                          <div className="p-2.5 space-y-2 bg-white dark:bg-gray-900">
                                            {logPerms.map(renderPermissionLabel)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const formatSubLabel = (resKey: string) => {
                        if (resKey === 'student_gate_pass') return 'Student Gate Pass';
                        if (resKey === 'visitor_pass') return 'Visitor Pass';
                        if (resKey === 'general') return 'General';
                        if (resKey === 'mark_attendance') return 'Mark Attendance';
                        return resKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      };

                      const subKeys = Object.keys(subGroups);
                      const hasMultipleSub = subKeys.length > 1 || group.module === 'gatepass' || group.module === 'assets' || group.module === 'data_uploads' || group.module === 'student_archive';

                      if (hasMultipleSub) {
                        return subKeys.map(resKey => {
                          const subPerms = subGroups[resKey];
                          const subKey = `${group.module}_${resKey}`;
                          const isSubExpanded = !expandedSubModules.has(subKey);
                          const subSelected = subPerms.filter(p => localPermissions.has(p.id)).length;

                          return (
                            <div key={resKey} className="border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/20">
                              <div
                                className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 dark:bg-gray-800/60 cursor-pointer select-none"
                                onClick={() => toggleSubModule(subKey)}
                              >
                                <div className="flex items-center gap-2">
                                  {isSubExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                  )}
                                  <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                    {formatSubLabel(resKey)}
                                  </span>
                                  <span className="text-xs text-gray-500 font-normal">
                                    ({subSelected}/{subPerms.length})
                                  </span>
                                </div>
                              </div>

                              {isSubExpanded && (
                                <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                                  {subPerms.sort((a, b) => {
                                    const aIsBus = a.codename.startsWith('transport.mark_attendance_');
                                    const bIsBus = b.codename.startsWith('transport.mark_attendance_');
                                    if (aIsBus && !bIsBus) return 1;
                                    if (!aIsBus && bIsBus) return -1;
                                    return (a.display_order || 0) - (b.display_order || 0);
                                  }).map(renderPermissionLabel)}

                                  {/* Timetable Grade Scope */}
                                  {group.module === 'academics' && resKey === 'timetable' && (
                                    renderScopeSection(
                                      "Limit Timetable Access to Grades",
                                      dbGrades.map(g => ({ id: g.id, label: g.grade_name })),
                                      localTimetableGradeScopes,
                                      toggleTimetableGradeScope
                                    )
                                  )}

                                  {/* Syllabus Subject Scope */}
                                  {group.module === 'academics' && resKey === 'syllabus' && (
                                    renderScopeSection(
                                      "Limit Syllabus Access to Subjects",
                                      dbSubjectMappings.map(sm => ({ id: sm.id, label: `${sm.subject_name} (${sm.section_name})` })),
                                      localSyllabusSubjectScopes,
                                      toggleSyllabusSubjectScope
                                    )
                                  )}

                                  {/* Exams Subject & Exam Type Scope */}
                                  {group.module === 'academics' && resKey === 'exams' && (
                                    <>
                                      {renderScopeSection(
                                        "Limit Exam Access to Subjects",
                                        dbSubjectMappings.map(sm => ({ id: sm.id, label: `${sm.subject_name} (${sm.section_name})` })),
                                        localExamSubjectScopes,
                                        toggleExamSubjectScope
                                      )}
                                      {renderScopeSection(
                                        "Limit Exam Access to Exam Types",
                                        [
                                          { id: 'TERM', label: 'Term Exam' },
                                          { id: 'MIDTERM', label: 'Mid-Term Exam' },
                                          { id: 'UT', label: 'Unit Test' },
                                          { id: 'PERIODIC', label: 'Periodic Assessment' }
                                        ],
                                        localExamTypeScopes,
                                        toggleExamTypeScope
                                      )}
                                    </>
                                  )}

                                  {/* Marks Entry Subject Scope */}
                                  {group.module === 'academics' && resKey === 'marks_entry' && (
                                    renderScopeSection(
                                      "Limit Marks Entry Access to Subjects",
                                      dbSubjectMappings.map(sm => ({ id: sm.id, label: `${sm.subject_name} (${sm.section_name})` })),
                                      localMarksSubjectScopes,
                                      toggleMarksSubjectScope
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      }

                      if (group.module === 'attendance') {
                        return (
                          <div className="space-y-3">
                            {group.permissions.map(renderPermissionLabel)}
                            {renderScopeSection(
                              "Limit Attendance Access to Sections",
                              dbSections.map(s => ({ id: s.id, label: s.full_name || `Grade ${s.grade_name} - ${s.section_letter}` })),
                              localAttendanceSectionScopes,
                              toggleAttendanceSectionScope
                            )}
                          </div>
                        );
                      }

                      if (group.module === 'assignment_settings') {
                        const standardPerms = group.permissions.filter(p => p.resource !== 'dept_others');
                        const othersPerms = group.permissions.filter(p => p.resource === 'dept_others');
                        const othersSubKey = 'assignment_settings_others';
                        const isOthersExpanded = !expandedSubModules.has(othersSubKey);
                        const othersSelectedCount = othersPerms.filter(p => localPermissions.has(p.id)).length;

                        return (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              {standardPerms.map(renderPermissionLabel)}
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/20">
                              <div
                                className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 dark:bg-gray-800/60 cursor-pointer select-none"
                                onClick={() => toggleSubModule(othersSubKey)}
                              >
                                <div className="flex items-center gap-2">
                                  {isOthersExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                  )}
                                  <span className="font-semibold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                                    Others
                                  </span>
                                  <span className="text-xs text-gray-500 font-normal">
                                    ({othersSelectedCount}/{othersPerms.length})
                                  </span>
                                </div>
                              </div>

                              {isOthersExpanded && (
                                <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                                  {othersPerms.length > 0 ? (
                                    othersPerms.map(renderPermissionLabel)
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">No custom departments added under "Others" yet.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return group.permissions.map(renderPermissionLabel);
                    })()}
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
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Creator context: max hierarchy & allowed permissions
  const [creatorCtx, setCreatorCtx] = useState<{
    is_full_admin: boolean;
    max_hierarchy_level: number;
    allowed_permission_ids: string[] | null;
  } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  // Permission groups (full list from backend)
  const { groups: allPermissionGroups, loading: groupsLoading } = usePermissionGroups();

  // Selected permission IDs for this new role
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchCtx = async () => {
      try {
        setCtxLoading(true);
        const res = await api.get('/auth/rbac/roles/my_creation_context/');
        setCreatorCtx(res.data);
        // Default hierarchy to half of max
        setFormData(prev => ({
          ...prev,
          hierarchy_level: Math.min(prev.hierarchy_level, res.data.max_hierarchy_level),
        }));
      } catch (err) {
        // If error, assume full admin (fallback to no restrictions)
        setCreatorCtx({ is_full_admin: true, max_hierarchy_level: 100, allowed_permission_ids: null });
      } finally {
        setCtxLoading(false);
      }
    };
    fetchCtx();
  }, []);

  // Filter permission groups based on what the creator is allowed to delegate
  const visibleGroups = creatorCtx?.allowed_permission_ids === null
    ? allPermissionGroups  // Full admin — see everything
    : allPermissionGroups.map(group => ({
        ...group,
        permissions: group.permissions.filter(p =>
          creatorCtx?.allowed_permission_ids?.includes(p.id)
        ),
      })).filter(group => group.permissions.length > 0);

  const toggleGroup = (module: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(module) ? next.delete(module) : next.add(module);
      return next;
    });
  };

  const togglePerm = (id: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllGroup = (group: (typeof visibleGroups)[0]) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      group.permissions.forEach(p => next.add(p.id));
      return next;
    });
  };

  const clearGroup = (group: (typeof visibleGroups)[0]) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      group.permissions.forEach(p => next.delete(p.id));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    const maxLevel = creatorCtx?.max_hierarchy_level ?? 100;
    if (formData.hierarchy_level > maxLevel) {
      setError(`Hierarchy level cannot exceed ${maxLevel} (your own level).`);
      return;
    }

    try {
      setLoading(true);
      await createRole({
        ...formData,
        username: formData.username.trim() || undefined,
        password: formData.password || undefined,
        permission_ids: Array.from(selectedPermissions),
      } as any);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const maxLevel = creatorCtx?.max_hierarchy_level ?? 100;
  const isLoading = ctxLoading || groupsLoading;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Role</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Basic Info */}
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
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hierarchy Level (1–{maxLevel})
              </label>
              <input
                type="number"
                value={formData.hierarchy_level}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setFormData({ ...formData, hierarchy_level: Math.min(maxLevel, Math.max(1, val)) });
                }}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                min="1"
                max={maxLevel}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Higher values = more authority. {creatorCtx && !creatorCtx.is_full_admin
                  ? `⚠ Capped to ${maxLevel} (your own level).`
                  : 'School Admin is fixed at 101.'}
              </p>
            </div>

            {/* Credentials (optional virtual user) */}
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Shared Login Credentials (Optional)
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Create a single shared login for this role so all assigned staff can log in with a common username and password.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., coordinator"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* Permission Picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Initial Permissions
                  {selectedPermissions.size > 0 && (
                    <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                      {selectedPermissions.size} selected
                    </span>
                  )}
                </label>
                {selectedPermissions.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(new Set())}
                    className="text-xs text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                {creatorCtx && !creatorCtx.is_full_admin
                  ? 'Only permissions you currently hold are shown. You can only grant what you yourself have.'
                  : 'Select which permissions to assign to this role. You can edit them later.'}
              </p>

              {isLoading ? (
                <div className="py-4 text-center text-gray-400 text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
                  Loading permissions...
                </div>
              ) : visibleGroups.length === 0 ? (
                <div className="py-4 text-center text-gray-400 text-sm italic">
                  No permissions available to delegate.
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {visibleGroups.map(group => {
                    const groupSelected = group.permissions.filter(p => selectedPermissions.has(p.id)).length;
                    const isExpanded = expandedGroups.has(group.module);
                    return (
                      <div key={group.module} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <div
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/60 cursor-pointer"
                          onClick={() => toggleGroup(group.module)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                              : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{group.label}</span>
                            <span className="text-xs text-gray-500">({groupSelected}/{group.permissions.length})</span>
                          </div>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => selectAllGroup(group)}
                              className="px-2 py-0.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => clearGroup(group)}
                              className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-2 space-y-1 bg-white dark:bg-gray-900">
                            {group.permissions.map(perm => (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.has(perm.id)}
                                  onChange={() => togglePerm(perm.id)}
                                  className="h-3.5 w-3.5 text-indigo-600 rounded border-gray-300"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{perm.name}</span>
                                  <p className="text-[10px] text-gray-400 truncate">{perm.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || ctxLoading}
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

// Teacher Details Panel
function TeacherDetailsPanel({
  teacher,
  roles,
  permissionGroups,
  onUpdate
}: {
  teacher: any;
  roles: Role[];
  permissionGroups: PermissionGroup[];
  onUpdate: () => void;
}) {
  const [username, setUsername] = useState(teacher.username || teacher.user?.username || '');
  const [password, setPassword] = useState('');
  const [hierarchyLevel, setHierarchyLevel] = useState<string>(teacher.hierarchy_level ? String(teacher.hierarchy_level) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(teacher.username || teacher.user?.username || '');
    setPassword('');
    setHierarchyLevel(teacher.hierarchy_level ? String(teacher.hierarchy_level) : '');
  }, [teacher]);

  const handleRegisterCredentials = async () => {
    if (!username.trim() || !password.trim() || !hierarchyLevel.trim()) {
      alert('All three fields (Username, Password, and Hierarchy Level) must be provided to register the teaching staff account.');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/teachers/profiles/${teacher.id}/register_credentials/`, {
        username: username.trim(),
        password: password.trim(),
        hierarchy_level: parseInt(hierarchyLevel, 10)
      });
      alert('Teaching staff credentials registered successfully!');
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to register teaching staff credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* Teacher Profile Summary */}
      <div className="flex items-start justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md">
            {teacher.full_name?.charAt(0) || 'T'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{teacher.full_name}</h2>
              <span className="text-xs font-mono font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                {teacher.tuid}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {teacher.user?.email || teacher.email || 'No email registered'} • {teacher.subjects || 'General Subject'}
            </p>
          </div>
        </div>

        {teacher.is_registered && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            Registered Account
          </span>
        )}
      </div>

      {/* Account Registration & Role Credentials Card */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Account Registration & Role Credentials</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Provide <strong>Username</strong>, <strong>Password</strong>, and <strong>Hierarchy Level</strong> to register this teaching staff member as a full-fledged account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              placeholder="e.g. teacher_john"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            />
          </div>

          {/* Hierarchy Level */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hierarchy Level (1–100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 50"
              value={hierarchyLevel}
              onChange={(e) => setHierarchyLevel(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            * All 3 fields are required to activate full-fledged account registration.
          </p>
          <button
            onClick={handleRegisterCredentials}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? 'Registering...' : 'Save Credentials'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function for frontend password generation (10 chars: 3 alphabets upper/lower, 4 numbers, 3 special chars)
function generateStudentPasswordFrontend(): string {
  const lowerChars = 'abcdefghijklmnopqrstuvwxyz';
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numberChars = '0123456789';
  const specialChars = '@#$%&*!?';

  const lowerCount = Math.random() < 0.5 ? 2 : 1;
  const upperCount = 3 - lowerCount;

  let pwd: string[] = [];
  for (let i = 0; i < lowerCount; i++) pwd.push(lowerChars[Math.floor(Math.random() * lowerChars.length)]);
  for (let i = 0; i < upperCount; i++) pwd.push(upperChars[Math.floor(Math.random() * upperChars.length)]);
  for (let i = 0; i < 4; i++) pwd.push(numberChars[Math.floor(Math.random() * numberChars.length)]);
  for (let i = 0; i < 3; i++) pwd.push(specialChars[Math.floor(Math.random() * specialChars.length)]);

  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

// Student Details Panel
function StudentDetailsPanel({
  student,
  onUpdate
}: {
  student: any;
  onUpdate: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleGenerateRandom = () => {
    const pwd = generateStudentPasswordFrontend();
    setNewPassword(pwd);
  };

  const handleUpdatePassword = async () => {
    try {
      setSavingPassword(true);
      setSuccessMessage('');
      const response = await api.post(`/students/${student.id}/change_password/`, {
        password: newPassword
      });
      const updatedPwd = response.data.password || newPassword;
      setSuccessMessage(`Password updated successfully for ${student.suid}! Username: ${student.suid}, New Password: ${updatedPwd}`);
      setNewPassword('');
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* Student Profile Summary */}
      <div className="flex items-start justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md">
            {student.full_name?.charAt(0) || 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{student.full_name}</h2>
              <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                {student.suid}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {student.current_class ? `Class ${student.current_class}` : student.current_grade_level ? `Grade ${student.current_grade_level}` : 'Enrolled Student'} • Adm: {student.admission_number || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Student Role Notice */}
      <div className="p-3.5 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl space-y-1">
        <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-blue-600" />
          <span>Student Portal Access</span>
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Students are portal account bearers. They do not hold staff hierarchy levels or administrative control over school admin modules.
        </p>
      </div>

      {/* Student Password Management */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Student Password Settings</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Change or reset login credentials for student account (<strong className="font-mono">{student.suid}</strong>).
          </p>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>New Password</span>
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} /> Auto-Generate
              </button>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password or click auto-generate..."
                className="w-full pl-3 pr-10 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Leave blank to auto-generate a secure 10-character password adhering to security rules.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleUpdatePassword}
              disabled={savingPassword}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

