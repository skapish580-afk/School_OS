'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import api, { getMediaUrl } from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';
import { Plus, Loader2, UserCheck, Users, Briefcase, Award, Edit, X, Trash2, FileText } from 'lucide-react';
import Modal from '@/components/Modal';
import PermissionGate from '@/components/PermissionGate';
import { useResourcePermissions, usePermissionContext } from '@/lib/rbac-context';
import FeatureGuard from '@/components/FeatureGuard';

export default function TeachersPage() {
  const { formatAcademicYear, settings } = useSettings();
  const currentAcademicYear = settings?.current_academic_year || '';
  const [teachers, setTeachers] = useState<any[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNonTeachingAssignModal, setShowNonTeachingAssignModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedNonTeachingTeacher, setSelectedNonTeachingTeacher] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [nonTeachingError, setNonTeachingError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, assignments
  const [onboardFormData, setOnboardFormData] = useState<Record<string, string | number | boolean>>({});
  const [assignFormData, setAssignFormData] = useState<Record<string, string | number | boolean>>({});
  const [nonTeachingFormData, setNonTeachingFormData] = useState({
    role: 'NON_TEACHING_STAFF',
    department_select: 'Administration',
    department_custom: '',
  });
  const [academicsSections, setAcademicsSections] = useState<any[]>([]);
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // RBAC Permissions
  const { canCreate, canEdit, canDelete } = useResourcePermissions('teachers', 'teacher');
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();

  const canViewTeaching = isAdmin || hasPermission('teachers.view_teaching');
  const canViewNonTeaching = isAdmin || hasPermission('teachers.view_non_teaching');
  const canViewAny = canViewTeaching || canViewNonTeaching;
  const canDeleteAssignedRole = isAdmin || hasPermission('teachers.delete_assigned_role');

  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewAny) {
      fetchData();
    }
  }, [permissionsLoading, canViewAny]);

  // Set default active tab dynamically based on permissions
  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewTeaching) {
      setActiveTab('all');
    } else if (canViewNonTeaching) {
      setActiveTab('non-teaching');
    }
  }, [permissionsLoading, canViewTeaching, canViewNonTeaching]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersRes, associationsRes, assignmentsRes, sectionsRes] = await Promise.all([
        api.get('/teachers/profiles/'),
        api.get('/teachers/associations/?status=ACTIVE').catch(() => ({ data: [] })),
        api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] })),
        api.get('/academics/sections/?is_active=true').catch(() => ({ data: [] }))
      ]);
      setTeachers(teachersRes.data);
      setAssociations(associationsRes.data);
      setAssignments(assignmentsRes.data);
      setAcademicsSections(sectionsRes.data);
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

  const [docs, setDocs] = useState<{
    doc_resume: File | null;
    doc_id_proof: File | null;
    doc_qualification: File | null;
  }>({
    doc_resume: null,
    doc_id_proof: null,
    doc_qualification: null,
  });
  const [customDocs, setCustomDocs] = useState<{ id: string; title: string; file: File | null }[]>([]);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof typeof docs) => {
    if (e.target.files && e.target.files[0]) {
      setDocs(prev => ({ ...prev, [fieldName]: e.target.files![0] }));
    }
  };

  const addCustomDoc = () => {
    setCustomDocs(prev => [...prev, { id: Math.random().toString(), title: '', file: null }]);
  };

  const removeCustomDoc = (id: string) => {
    setCustomDocs(prev => prev.filter(doc => doc.id !== id));
  };

  const handleCustomDocChange = (id: string, field: 'title' | 'file', value: string | File) => {
    setCustomDocs(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, [field]: value };
      }
      return doc;
    }));
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    const defaultType = isAdmin || hasPermission('teachers.manage_teaching') ? 'TEACHING' : 'NON_TEACHING';
    const finalData = { ...onboardFormData };
    if (!finalData.teacher_type) {
      finalData.teacher_type = defaultType;
    }
    const formData = new FormData();
    Object.entries(finalData).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        formData.append(key, String(val));
      }
    });
    
    if (docs.doc_resume) {
      formData.append('doc_resume', docs.doc_resume);
    }
    if (docs.doc_id_proof) {
      formData.append('doc_id_proof', docs.doc_id_proof);
    }
    if (docs.doc_qualification) {
      formData.append('doc_qualification', docs.doc_qualification);
    }
    
    customDocs.forEach((doc) => {
      if (doc.title.trim() !== '' && doc.file) {
        formData.append('custom_doc_files', doc.file);
        formData.append('custom_doc_titles', doc.title);
      }
    });

    try {
      await api.post('/teachers/profiles/onboard/', formData);
      setShowOnboardModal(false);
      setOnboardFormData({});
      setDocs({ doc_resume: null, doc_id_proof: null, doc_qualification: null });
      setCustomDocs([]);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to onboard teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');

    if (data.role === 'CLASS_TEACHER' && selectedTeacher) {
      const existingClassTeacherAssignment = assignments.find(
        (a: any) =>
          (a.teacher === selectedTeacher.id || a.teacher?.id === selectedTeacher.id) &&
          a.role === 'CLASS_TEACHER' &&
          a.is_active !== false
      );
      if (existingClassTeacherAssignment) {
        const teacherName =
          selectedTeacher.user?.full_name ||
          selectedTeacher.full_name ||
          selectedTeacher.name ||
          'This teacher';
        setError(
          `${teacherName} is already assigned as Class Teacher for Grade ${existingClassTeacherAssignment.grade} Section ${existingClassTeacherAssignment.section}. A teaching staff member can only be the Class Teacher of one grade/section. Please delete the previous assignment first.`
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      await api.post('/teachers/assignments/', {
        teacher: selectedTeacher?.id,
        role: data.role,
        grade: data.grade || '',
        section: data.section || '',
        subject: data.subject || '',
        academic_year: currentAcademicYear,
        is_active: true,
      });
      setShowAssignModal(false);
      setSelectedTeacher(null);
      fetchData();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        (err.response?.data?.class_teacher_id
          ? Array.isArray(err.response.data.class_teacher_id)
            ? err.response.data.class_teacher_id[0]
            : err.response.data.class_teacher_id
          : null) ||
        'Failed to assign teacher';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignNonTeaching = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNonTeachingError('');

    const resolvedDepartment =
      nonTeachingFormData.department_select === 'Others'
        ? nonTeachingFormData.department_custom.trim()
        : nonTeachingFormData.department_select;

    if (!resolvedDepartment) {
      setNonTeachingError('Please specify a department name.');
      setSubmitting(false);
      return;
    }

    try {
      await api.post('/teachers/assignments/', {
        teacher: selectedNonTeachingTeacher?.id,
        role: nonTeachingFormData.role,
        department: resolvedDepartment,
        academic_year: currentAcademicYear,
        is_active: true,
      });
      setShowNonTeachingAssignModal(false);
      setSelectedNonTeachingTeacher(null);
      setNonTeachingFormData({
        role: 'NON_TEACHING_STAFF',
        department_select: 'Administration',
        department_custom: '',
      });
      fetchData();
    } catch (err: any) {
      setNonTeachingError(err.response?.data?.detail || err.response?.data?.error || 'Failed to assign role');
    } finally {
      setSubmitting(false);
    }
  };


  useEffect(() => {
    const fetchSectionSubjects = async () => {
      const selectedGrade = assignFormData.grade;
      const selectedSection = assignFormData.section;
      if (selectedGrade && selectedSection) {
        const selectedSectionObj = academicsSections.find(
          s => s.grade_name === selectedGrade && s.section_letter === selectedSection
        );
        if (selectedSectionObj) {
          setLoadingSubjects(true);
          try {
            const res = await api.get(`/academics/subject-mappings/?section=${selectedSectionObj.id}`);
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            const subjectsList = data
              .filter((sm: any) => sm.is_active)
              .map((sm: any) => sm.subject_name);
            const uniqueSubjects = Array.from(new Set(subjectsList)).sort();
            setSectionSubjects(uniqueSubjects);
          } catch (err) {
            console.error("Failed to fetch section subjects", err);
            setSectionSubjects([]);
          } finally {
            setLoadingSubjects(false);
          }
        } else {
          setSectionSubjects([]);
        }
      } else {
        setSectionSubjects([]);
      }
    };
    fetchSectionSubjects();
  }, [assignFormData.grade, assignFormData.section, academicsSections]);

  // Memoized academics data for role assignment dropdowns
  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(academicsSections.map(s => s.grade_name)))
      .filter(Boolean);
    
    return grades
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a).localeCompare(String(b));
      })
      .map(g => ({ value: g, label: `Grade ${g}` }));
  }, [academicsSections]);

  const sectionOptions = useMemo(() => {
    const selectedGrade = assignFormData.grade;
    const sections = Array.from(
      new Set(
        academicsSections
          .filter(s => !selectedGrade || s.grade_name === selectedGrade)
          .map(s => s.section_letter)
      )
    ).filter(Boolean);

    return sections
      .sort()
      .map(sec => ({ value: sec, label: `Section ${sec}` }));
  }, [academicsSections, assignFormData.grade]);

  const assignFields = useMemo(() => {
    const subjectOptions = sectionSubjects.map(sub => ({ value: sub, label: sub }));
    const isSubjectTeacher = assignFormData.role === 'SUBJECT_TEACHER';
    
    return [
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
      {
        name: 'grade',
        label: 'Grade',
        type: 'select' as const,
        required: true,
        options: gradeOptions,
      },
      {
        name: 'section',
        label: 'Section',
        type: 'select' as const,
        required: true,
        options: sectionOptions,
      },
      ...(isSubjectTeacher ? [
        {
          name: 'subject',
          label: 'Subject',
          type: 'select' as const,
          required: true,
          options: subjectOptions,
          placeholder: loadingSubjects ? 'Loading subjects...' : 'Select Subject'
        }
      ] : []),
    ];
  }, [gradeOptions, sectionOptions, sectionSubjects, assignFormData.role, loadingSubjects]);

  if (permissionsLoading || (loading && canViewAny)) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!canViewAny) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100 max-w-md mx-auto mt-12">
        Access Denied. You do not have permission to view staff profiles.
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
          {(isAdmin || hasPermission('teachers.manage_teaching') || hasPermission('teachers.manage_non_teaching')) && (
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
            {canViewTeaching && (
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-3 px-2 font-medium transition ${activeTab === 'all'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Teaching Staff
              </button>
            )}
            {canViewNonTeaching && (
              <button
                onClick={() => setActiveTab('non-teaching')}
                className={`pb-3 px-2 font-medium transition ${activeTab === 'non-teaching'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Non-teaching staff
              </button>
            )}
            {(canViewTeaching || canViewNonTeaching) && (
              <button
                onClick={() => setActiveTab('assignments')}
                className={`pb-3 px-2 font-medium transition ${activeTab === 'assignments'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Assignments
              </button>
            )}
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
                  {teachers.filter(teacher => teacher.teacher_type !== 'NON_TEACHING').map((teacher) => {
                    const association = associations.find(a => a.teacher === teacher.id && a.status === 'ACTIVE');
                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-xs font-mono font-bold text-blue-600 break-all max-w-[120px]">{teacher.tuid}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {teacher.photo ? (
                              <img
                                src={getMediaUrl(teacher.photo)}
                                alt={teacher.full_name}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                                {teacher.full_name?.charAt(0) || 'T'}
                              </div>
                            )}
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
                                  {canDeleteAssignedRole && (
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
                            {(isAdmin || hasPermission('teachers.assign_role_teaching')) && (
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
                            {(isAdmin || hasPermission('teachers.manage_teaching')) && (
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 transition-colors"
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            )}
                            {!(isAdmin || hasPermission('teachers.assign_role_teaching')) && !(isAdmin || hasPermission('teachers.manage_teaching')) && (
                              <span className="text-gray-400 italic">No actions</span>
                            )}
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

        {/* Non-teaching staff Tab */}
        {activeTab === 'non-teaching' && (
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
                  {teachers.filter(teacher => teacher.teacher_type === 'NON_TEACHING').map((teacher) => {
                    const association = associations.find(a => a.teacher === teacher.id && a.status === 'ACTIVE');
                    return (
                      <tr key={teacher.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-xs font-mono font-bold text-blue-600 break-all max-w-[120px]">{teacher.tuid}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {teacher.photo ? (
                              <img
                                src={getMediaUrl(teacher.photo)}
                                alt={teacher.full_name}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                                {teacher.full_name?.charAt(0) || 'T'}
                              </div>
                            )}
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
                          <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                            {assignments
                              .filter(a => a.teacher === teacher.id && a.is_active)
                              .map((a, idx) => (
                                <span 
                                  key={idx} 
                                  className="group/badge flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border whitespace-nowrap bg-teal-50 text-teal-700 border-teal-100"
                                  title={`${a.role.replace(/_/g, ' ')} ${a.department ? `- ${a.department}` : ''}`}
                                >
                                  <span>
                                    {a.department ? `${a.role.replace(/_/g, ' ')} (${a.department})` : a.role.replace(/_/g, ' ')}
                                  </span>
                                  {(canDeleteAssignedRole || isAdmin) && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAssignment(a.id);
                                      }}
                                      className="hover:text-red-600 transition-colors opacity-0 group-hover/badge:opacity-100 ml-1"
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
                            {(isAdmin || hasPermission('teachers.assign_role_non_teaching') || hasPermission('teachers.manage_non_teaching')) && (
                              <button
                                onClick={() => {
                                  setSelectedNonTeachingTeacher(teacher);
                                  setShowNonTeachingAssignModal(true);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                              >
                                <Edit size={14} /> Assign Role
                              </button>
                            )}
                            {(isAdmin || hasPermission('teachers.manage_non_teaching')) && (
                              <button
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 transition-colors"
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            )}
                            {!(isAdmin || hasPermission('teachers.assign_role_non_teaching') || hasPermission('teachers.manage_non_teaching')) && (
                              <span className="text-gray-400 italic">No actions</span>
                            )}
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
                    {canDeleteAssignedRole && (
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
            setDocs({ doc_resume: null, doc_id_proof: null, doc_qualification: null });
            setCustomDocs([]);
          }}
          title="Add New Teacher"
          size="2xl"
        >
          <form onSubmit={handleOnboardSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="max-h-[65vh] overflow-y-auto pr-2 space-y-6">
              {/* Personal Information */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">👤 Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
                    <select
                      required
                      value={(onboardFormData.title as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    >
                      <option value="">Select Title</option>
                      <option value="Mr">Mr</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Miss">Miss</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Dr">Dr</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      value={(onboardFormData.full_name as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={(onboardFormData.email as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone *</label>
                    <input
                      type="text"
                      required
                      value={(onboardFormData.phone as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={(onboardFormData.date_of_birth as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Gender *</label>
                    <select
                      required
                      value={(onboardFormData.gender as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    >
                      <option value="">Select Gender</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="O">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Marital Status</label>
                    <input
                      type="text"
                      value={(onboardFormData.marital_status as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, marital_status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Place of Birth</label>
                    <input
                      type="text"
                      value={(onboardFormData.place_of_birth as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, place_of_birth: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Blood Group</label>
                    <input
                      type="text"
                      value={(onboardFormData.blood_group as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, blood_group: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                      placeholder="e.g. O+"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={(onboardFormData.emergency_contact_phone as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                    <textarea
                      value={(onboardFormData.address as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, address: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                      placeholder="Enter teacher's physical address"
                    />
                  </div>
                </div>
              </div>

              {/* Professional & Employment Information */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">💼 Professional & Employment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Salary (Monthly) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={(onboardFormData.salary as number) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, salary: e.target.value ? parseFloat(e.target.value) : '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Joining *</label>
                    <input
                      type="date"
                      required
                      value={(onboardFormData.date_of_joining as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, date_of_joining: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Staff Type *</label>
                    <select
                      required
                      value={(onboardFormData.teacher_type as string) || 
                             (isAdmin || hasPermission('teachers.manage_teaching') ? 'TEACHING' : 'NON_TEACHING')}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, teacher_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    >
                      {(isAdmin || hasPermission('teachers.manage_teaching')) && (
                        <option value="TEACHING">Teaching Staff (Teacher)</option>
                      )}
                      {(isAdmin || hasPermission('teachers.manage_non_teaching')) && (
                        <option value="NON_TEACHING">Non-teaching Staff</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Years of Experience *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={onboardFormData.experience_years !== undefined && onboardFormData.experience_years !== null ? onboardFormData.experience_years : ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, experience_years: e.target.value !== '' ? parseInt(e.target.value) : '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Dietary Preference</label>
                    <input
                      type="text"
                      value={(onboardFormData.dietary_preference as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, dietary_preference: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Qualifications *</label>
                    <textarea
                      required
                      value={(onboardFormData.qualifications as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, qualifications: e.target.value }))}
                      placeholder="e.g., MSc Math, B.Ed"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900 h-20 resize-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Certified Subjects *</label>
                    <textarea
                      required
                      value={(onboardFormData.certified_subjects as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, certified_subjects: e.target.value }))}
                      placeholder="e.g., Mathematics, Physics"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900 h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Identity Details */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">🛡️ Identity Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Aadhaar (Last 4 digits)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={(onboardFormData.aadhaar_last_4_digits as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, aadhaar_last_4_digits: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                      placeholder="1234"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Number</label>
                    <input
                      type="text"
                      value={(onboardFormData.pan_number as string) || ''}
                      onChange={(e) => setOnboardFormData(prev => ({ ...prev, pan_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-1.5">
                  <FileText size={18} className="text-indigo-600" /> Hired Documents (PDF format)
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Resume / CV</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleDocChange(e, 'doc_resume')}
                      className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                    />
                    {docs.doc_resume && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_resume.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">ID Proof (Aadhaar/PAN/Passport) *</label>
                    <input
                      type="file"
                      required={!onboardFormData.id}
                      accept="application/pdf"
                      onChange={(e) => handleDocChange(e, 'doc_id_proof')}
                      className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                    />
                    {docs.doc_id_proof && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_id_proof.name}</p>}
                    <p className="text-[10px] text-amber-600 font-semibold mt-1">⚠️ Note: Submitting a valid ID Proof will automatically verify the teacher profile.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Qualification Certificate</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => handleDocChange(e, 'doc_qualification')}
                      className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                    />
                    {docs.doc_qualification && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_qualification.name}</p>}
                  </div>

                  {/* Custom Documents */}
                  {customDocs.length > 0 && (
                    <div className="pt-4 border-t border-gray-100 space-y-4">
                      <h5 className="text-xs font-bold text-gray-700 uppercase">Additional Documents</h5>
                      <div className="space-y-4">
                        {customDocs.map((doc) => (
                          <div key={doc.id} className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 relative space-y-3">
                            <button
                              type="button"
                              onClick={() => removeCustomDoc(doc.id)}
                              className="absolute right-3 top-3 text-red-500 hover:text-red-700 text-xs font-bold transition-colors"
                            >
                              Remove
                            </button>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">Document Title *</label>
                              <input
                                type="text"
                                required
                                value={doc.title}
                                onChange={(e) => handleCustomDocChange(doc.id, 'title', e.target.value)}
                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white text-gray-900"
                                placeholder="e.g. Recommendation Letter"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">Document File (PDF) *</label>
                              <input
                                type="file"
                                required
                                accept="application/pdf"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleCustomDocChange(doc.id, 'file', e.target.files[0]);
                                  }
                                }}
                                className="w-full p-2 border rounded-lg outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addCustomDoc}
                    className="w-full py-2.5 px-4 border border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-600 hover:text-indigo-700 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    + Add More Documents
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowOnboardModal(false);
                  setOnboardFormData({});
                  setDocs({ doc_resume: null, doc_id_proof: null, doc_qualification: null });
                  setCustomDocs([]);
                }}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition font-medium disabled:bg-gray-400 flex justify-center items-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Add Teacher'}
              </button>
            </div>
          </form>
        </Modal>

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
            onFormChange={(field, value) => {
              setAssignFormData(prev => {
                const newData = { ...prev, [field]: value };
                if (field === 'role') {
                  newData.subject = ''; // Reset subject if role changes
                }
                if (field === 'grade') {
                  newData.section = ''; // Reset section if grade changes
                  newData.subject = ''; // Reset subject if grade changes
                }
                if (field === 'section') {
                  newData.subject = ''; // Reset subject if section changes
                }
                return newData;
              });
            }}
            onSubmit={handleAssign}
            loading={submitting}
            error={error}
            submitButtonText="Assign"
            color="purple"
          />
        )}

        {showNonTeachingAssignModal && selectedNonTeachingTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  Assign Role to {selectedNonTeachingTeacher.full_name}
                </h2>
                <button
                  onClick={() => {
                    setShowNonTeachingAssignModal(false);
                    setSelectedNonTeachingTeacher(null);
                    setNonTeachingFormData({ role: 'NON_TEACHING_STAFF', department_select: 'Administration', department_custom: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {nonTeachingError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-100">
                  {nonTeachingError}
                </div>
              )}

              <form onSubmit={handleAssignNonTeaching} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={nonTeachingFormData.role}
                    onChange={(e) => setNonTeachingFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="NON_TEACHING_STAFF">Non-Teaching Staff</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="LIBRARIAN">Librarian</option>
                    <option value="LAB_ASSISTANT">Lab Assistant</option>
                    <option value="TRANSPORT_MANAGER">Transport Manager</option>
                    <option value="NURSE">Nurse / Medical Officer</option>
                    <option value="SECURITY_SUPERVISOR">Security Supervisor</option>
                    <option value="IT_SUPPORT">IT Support Specialist</option>
                    <option value="FACILITIES_MANAGER">Facilities Manager</option>
                    <option value="OFFICE_STAFF">Office Staff</option>
                    <option value="COUNSELOR">Counselor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={nonTeachingFormData.department_select}
                    onChange={(e) => setNonTeachingFormData(prev => ({ ...prev, department_select: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="Administration">Administration</option>
                    <option value="Accounts & Finance">Accounts & Finance</option>
                    <option value="Library">Library</option>
                    <option value="Laboratory & Technical Support">Laboratory & Technical Support</option>
                    <option value="Transport & Logistics">Transport & Logistics</option>
                    <option value="Medical & Health (Infirmary)">Medical & Health (Infirmary)</option>
                    <option value="Security & Maintenance">Security & Maintenance</option>
                    <option value="Sports & Physical Education">Sports & Physical Education</option>
                    <option value="IT & Systems Support">IT & Systems Support</option>
                    <option value="Hostel & Campus Facilities">Hostel & Campus Facilities</option>
                    <option value="Student Affairs & Welfare">Student Affairs & Welfare</option>
                    <option value="Admission & Counseling">Admission & Counseling</option>
                    <option value="Food Services & Canteen">Food Services & Canteen</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {nonTeachingFormData.department_select === 'Others' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Custom Department Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter department name"
                      value={nonTeachingFormData.department_custom}
                      onChange={(e) => setNonTeachingFormData(prev => ({ ...prev, department_custom: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNonTeachingAssignModal(false);
                      setSelectedNonTeachingTeacher(null);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Assign Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
