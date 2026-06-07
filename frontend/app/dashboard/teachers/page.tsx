'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';
import { Plus, Loader2, UserCheck, Users, Briefcase, Award, Edit, X, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import PermissionGate from '@/components/PermissionGate';
import { useResourcePermissions } from '@/lib/rbac-context';
import FeatureGuard from '@/components/FeatureGuard';

export default function TeachersPage() {
  const { formatAcademicYear } = useSettings();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, assignments
  const [onboardFormData, setOnboardFormData] = useState<Record<string, string | number | boolean>>({});
  const [assignFormData, setAssignFormData] = useState<Record<string, string | number | boolean>>({});

  // RBAC Permissions
  const { canCreate, canEdit, canDelete } = useResourcePermissions('teachers', 'teacher');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, associationsRes, assignmentsRes] = await Promise.all([
        api.get('/teachers/profiles/'),
        api.get('/teachers/associations/?status=ACTIVE'),
        api.get('/teachers/assignments/?is_active=true')
      ]);
      setTeachers(teachersRes.data);
      setAssociations(associationsRes.data);
      setAssignments(assignmentsRes.data);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return;
    
    setLoading(true);
    try {
      await api.delete(`/teachers/assignments/${assignmentId}/`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Are you sure you want to remove this teacher? This will also remove their user account and all associations.')) return;
    
    setLoading(true);
    try {
      await api.delete(`/teachers/profiles/${teacherId}/`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboard = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/teachers/profiles/onboard/', data);
      setShowOnboardModal(false);
      setOnboardFormData({});
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to onboard teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/teachers/assignments/', {
        teacher: selectedTeacher?.id,
        role: data.role,
        grade: data.grade || '',
        section: data.section || '',
        subject: data.subject || '',
        academic_year: '2025-2026',
        is_active: true,
      });
      setShowAssignModal(false);
      setSelectedTeacher(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to assign teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const onboardFields = [
    { 
      name: 'title', 
      label: 'Title', 
      type: 'select' as const, 
      required: true,
      options: [
        { value: 'Mr', label: 'Mr' },
        { value: 'Miss', label: 'Miss' },
        { value: 'Mrs', label: 'Mrs' },
        { value: 'Dr', label: 'Dr' }
      ]
    },
    { name: 'full_name', label: 'Full Legal Name', type: 'text' as const, required: true },
    { name: 'email', label: 'Email', type: 'text' as const, required: true },
    { name: 'phone', label: 'Phone', type: 'text' as const, required: true },
    { name: 'date_of_birth', label: 'Date of Birth', type: 'text' as const, required: true, placeholder: 'YYYY-MM-DD' },
    {
      name: 'gender',
      label: 'Gender',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'M', label: 'Male' },
        { value: 'F', label: 'Female' },
        { value: 'O', label: 'Other' }
      ]
    },
    { name: 'marital_status', label: 'Marital Status', type: 'text' as const },
    { name: 'place_of_birth', label: 'Place of Birth', type: 'text' as const },
    { name: 'blood_group', label: 'Blood Group', type: 'text' as const },
    { name: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text' as const },
    { name: 'aadhaar_last_4_digits', label: 'Aadhaar (Last 4)', type: 'text' as const, placeholder: '1234' },
    { name: 'pan_number', label: 'PAN Number', type: 'text' as const },
    { name: 'qualifications', label: 'Qualifications', type: 'textarea' as const, required: true, placeholder: 'e.g., MSc Math, B.Ed' },
    { name: 'certified_subjects', label: 'Certified Subjects', type: 'textarea' as const, required: true, placeholder: 'Mathematics, Physics' },
    { name: 'experience_years', label: 'Years of Experience', type: 'number' as const, required: true },
    { name: 'dietary_preference', label: 'Dietary Preference', type: 'text' as const },
  ];

  const assignFields = [
    {
      name: 'role',
      label: 'Role',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'SUBJECT_TEACHER', label: 'Subject Teacher' },
        { value: 'CLASS_TEACHER', label: 'Class Teacher' },
        { value: 'EXAM_INVIGILATOR', label: 'Exam Invigilator' },
        { value: 'SPORTS_TEACHER', label: 'Sports Teacher' },
      ]
    },
    { name: 'subject', label: 'Subject', type: 'text' as const, placeholder: 'e.g., Mathematics' },
    { name: 'grade', label: 'Grade', type: 'text' as const, placeholder: 'e.g., 10' },
    { name: 'section', label: 'Section', type: 'text' as const, placeholder: 'e.g., A' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const activeTeachers = associations.filter(a => a.status === 'ACTIVE');

  return (
    <FeatureGuard feature="TEACHERS">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👩‍🏫 Teacher Management</h1>
            <p className="text-gray-600 mt-1">Global TUID System • School-scoped Assignments</p>
          </div>
          {canCreate && (
            <button 
          onClick={() => setShowOnboardModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus size={20} /> Add Teacher
        </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Teachers</p>
                <p className="text-2xl font-bold text-gray-900">{teachers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserCheck size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{activeTeachers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Briefcase size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Award size={24} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {teachers.filter(t => t.verification_status === 'VERIFIED').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-2 font-medium transition ${activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              All Teachers
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`pb-3 px-2 font-medium transition ${activeTab === 'assignments'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Assignments
            </button>
          </div>
        </div>

        {/* All Teachers Tab */}
        {activeTab === 'all' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TUID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teachers.map((teacher) => {
                    const association = associations.find(a => a.teacher === teacher.id && a.status === 'ACTIVE');
                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-xs font-mono font-bold text-blue-600 break-all max-w-[120px]">{teacher.tuid}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
                              {teacher.full_name?.charAt(0) || 'T'}
                            </div>
                            <div>
                              <Link href={`/dashboard/teachers/${teacher.id}`} className="font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">
                                {teacher.full_name}
                              </Link>
                              <div className="text-sm text-gray-500">{teacher.qualifications?.split(',')[0]}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{teacher.certified_subjects?.split(',').slice(0, 2).join(', ')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700">{teacher.experience_years} years</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {association ? (
                            <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-600">
                              INACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {assignments
                              .filter(a => a.teacher === teacher.id && a.is_active)
                              .map((a, idx) => (
                                <span 
                                  key={idx} 
                                  className={`group/badge flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border whitespace-nowrap ${
                                    a.role === 'CLASS_TEACHER' 
                                      ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                      : 'bg-blue-50 text-blue-700 border-blue-100'
                                  }`}
                                  title={`${a.role.replace('_', ' ')} ${a.grade ? `(${a.grade}-${a.section})` : ''} ${a.subject ? `- ${a.subject}` : ''}`}
                                >
                                  <span>
                                    {a.role === 'CLASS_TEACHER' ? `CT: ${a.grade}-${a.section}` : 
                                     a.role === 'SUBJECT_TEACHER' ? `${a.subject || 'Subject'}` : 
                                     a.role.replace('_', ' ').split('_').map((w: string) => w[0]).join('')}
                                  </span>
                                  {canDelete && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAssignment(a.id);
                                      }}
                                      className="hover:text-red-600 transition-colors opacity-0 group-hover/badge:opacity-100"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </span>
                              ))
                            }
                            {assignments.filter(a => a.teacher === teacher.id && a.is_active).length === 0 && (
                              <span className="text-xs text-gray-400 italic bg-gray-50 px-2 py-0.5 rounded border border-gray-100">No roles</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-4">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setSelectedTeacher(teacher);
                                  setShowAssignModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                              >
                                <Edit size={14} /> Assign Role
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 transition-colors"
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            )}
                            {!canEdit && !canDelete && <span className="text-gray-400 italic">No actions</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {assignment.teacher_name?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{assignment.teacher_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{assignment.teacher_tuid}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-blue-100 text-blue-700">
                      {assignment.role.replace('_', ' ')}
                    </span>
                    {canDelete && (
                      <button 
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remove Assignment"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {assignment.subject && (
                    <div className="text-sm text-gray-700">
                      <strong>Subject:</strong> {assignment.subject}
                    </div>
                  )}

                  {assignment.grade && (
                    <div className="text-sm text-gray-700">
                      <strong>Class:</strong> {assignment.grade}-{assignment.section}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2">
                    Academic Year: {formatAcademicYear(assignment.academic_year)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={showOnboardModal}
          onClose={() => {
            setShowOnboardModal(false);
            setOnboardFormData({});
          }}
          title="Add New Teacher"
          fields={onboardFields}
          formData={onboardFormData}
          onFormChange={(field, value) => setOnboardFormData(prev => ({ ...prev, [field]: value }))}
          onSubmit={handleOnboard}
          loading={submitting}
          error={error}
          submitButtonText="Add Teacher"
          color="indigo"
        />

        {showAssignModal && selectedTeacher && (
          <Modal
            isOpen={showAssignModal}
            onClose={() => {
              setShowAssignModal(false);
              setSelectedTeacher(null);
              setAssignFormData({});
            }}
            title={`Assign Role to ${selectedTeacher.full_name}`}
            fields={assignFields}
            formData={assignFormData}
            onFormChange={(field, value) => setAssignFormData(prev => ({ ...prev, [field]: value }))}
            onSubmit={handleAssign}
            loading={submitting}
            error={error}
            submitButtonText="Assign"
            color="purple"
          />
        )}
      </div>
    </FeatureGuard>
  );
}
