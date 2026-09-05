'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, Search, BookOpen, X, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  subject_type?: string;
  subject_limit?: number;
  passing_marks?: number;
  is_active: boolean;
}

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  subject_type: string;
  subject_limit: string;
  passing_marks: string;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCore, setFilterCore] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SubjectFormData>({
    name: '',
    code: '',
    description: '',
    subject_type: 'CORE',
    subject_limit: '',
    passing_marks: '40',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tab & Allocation states
  const [activeTab, setActiveTab] = useState<'directory' | 'allocation'>('directory');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  // Subject Allocation Modal States
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [selectedAllocGrade, setSelectedAllocGrade] = useState<any | null>(null);
  const [droppedSubjects, setDroppedSubjects] = useState<Subject[]>([]);
  const [allocStep, setAllocStep] = useState<1 | 2>(1);
  const [electiveMappings, setElectiveMappings] = useState<Record<string, string[]>>({}); // sectionId -> list of subjectIds
  const [studentElectiveMappings, setStudentElectiveMappings] = useState<Record<string, string[]>>({}); // subjectId -> list of studentIds
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [filterStudentSection, setFilterStudentSection] = useState('');
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);
  const [allocSubmitting, setAllocSubmitting] = useState(false);
  const [loadingAllocModalData, setLoadingAllocModalData] = useState(false);

  // RBAC Permissions
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();

  const canViewDirectory = isAdmin || hasPermission('academics.view_subject');
  const canManageDirectory = isAdmin || hasPermission('academics.manage_subject');
  const canEditDirectory = isAdmin || hasPermission('academics.edit_subject');

  const canViewAllocation = isAdmin || hasPermission('academics.view_subject_allocation');
  const canManageAllocation = isAdmin || hasPermission('academics.manage_subject_allocation');
  const isAllocReadOnly = !canManageAllocation;

  // Set default active tab dynamically based on permissions
  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewDirectory) {
      setActiveTab('directory');
    } else if (canViewAllocation) {
      setActiveTab('allocation');
    }
  }, [permissionsLoading, canViewDirectory, canViewAllocation]);

  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewDirectory) {
      fetchSubjects();
    }
    if (canViewAllocation) {
      fetchAllocationData();
    }
  }, [permissionsLoading, canViewDirectory, canViewAllocation]);

  const fetchSubjects = async () => {
    if (!canViewDirectory) return;
    setLoading(true);
    try {
      const response = await api.get('/academics/subjects/');
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to load subjects', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocationData = async () => {
    if (!canViewAllocation) return;
    try {
      const [gradesRes, sectionsRes, mappingsRes, studentsRes] = await Promise.all([
        api.get('/academics/grades/'),
        api.get('/academics/sections/?is_active=true'),
        api.get('/academics/subject-mappings/?is_active=true'),
        api.get('/students/?status=ACTIVE').catch(() => ({ data: [] }))
      ]);
      const rawGrades = (Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || []) as any[];
      const rawSections = (Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || []) as any[];
      const rawStudents = (Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.results || []) as any[];
      
      const activeSectionGradeNames = Array.from(new Set(rawSections.map((s: any) => s.grade_name as string)));
      const filteredGrades = activeSectionGradeNames.map((gradeName: string) => {
        const matchingGrade = rawGrades.find((g: any) => g.grade_name === gradeName);
        if (matchingGrade) return matchingGrade;
        return {
          id: gradeName,
          grade_name: gradeName,
          grade_number: parseInt(gradeName) || 0
        };
      }).sort((a: any, b: any) => (a.grade_number || 0) - (b.grade_number || 0));

      setGrades(filteredGrades);
      setSections(rawSections);
      setAllStudents(rawStudents);
      setSubjectMappings(Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || []);
    } catch (err) {
      console.error("Failed to load allocation data", err);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingId(subject.id);
    const resolvedType = (subject.subject_type || (subject.is_core ? 'CORE' : 'ELECTIVE')).toUpperCase();
    setFormData({
      name: subject.name,
      code: subject.code,
      description: subject.description || '',
      subject_type: resolvedType,
      subject_limit: subject.subject_limit !== undefined && subject.subject_limit !== null ? String(subject.subject_limit) : '',
      passing_marks: subject.passing_marks ? subject.passing_marks.toString() : '40',
    });
    setShowModal(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/academics/subjects/${id}/`);
      fetchSubjects();
    } catch (err: any) {
      console.error('Failed to delete subject', err);
      alert('Failed to delete subject. It might be linked to other records.');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', code: '', description: '', subject_type: 'CORE', subject_limit: '', passing_marks: '40' });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      setError('Subject Name and Code are required');
      return;
    }

    const isElective = (formData.subject_type || '').toUpperCase() === 'ELECTIVE';
    const limitNum = formData.subject_limit ? parseInt(String(formData.subject_limit), 10) : null;

    if (isElective) {
      if (!formData.subject_limit || isNaN(limitNum as number) || (limitNum as number) <= 0) {
        setError('Subject Limit is mandatory for Elective subjects and must be greater than 0');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const payload: any = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description,
        subject_type: isElective ? 'ELECTIVE' : 'CORE',
        subject_limit: isElective && limitNum && !isNaN(limitNum) ? limitNum : null,
        is_core: !isElective,
        passing_marks: parseInt(formData.passing_marks || '40', 10),
        is_active: true,
      };

      if (editingId) {
        await api.patch(`/academics/subjects/${editingId}/`, payload);
      } else {
        await api.post('/academics/subjects/', payload);
      }
      handleCloseModal();
      fetchSubjects();
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = data?.detail || 
                       (Array.isArray(data?.subject_limit) ? data.subject_limit[0] : data?.subject_limit) ||
                       'Failed to create subject';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAllocation = async (grade: any) => {
    setLoadingAllocModalData(true);
    try {
      const [subjectsRes, mappingsRes, studentsRes] = await Promise.all([
        api.get('/academics/subjects/'),
        api.get('/academics/subject-mappings/?is_active=true'),
        api.get('/students/?status=ACTIVE').catch(() => ({ data: [] }))
      ]);
      const latestSubjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : subjectsRes.data.results || [];
      const latestMappings = Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || [];
      const latestStudents = Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.results || [];
      
      setSubjects(latestSubjects);
      setSubjectMappings(latestMappings);
      setAllStudents(latestStudents);
      
      setSelectedAllocGrade(grade);
      setAllocStep(1);
      setSearchStudentQuery('');
      setFilterStudentSection('');
      
      // Find all sections belonging to this grade
      const gradeSections = sections.filter(s => s.grade_name === grade.grade_name);
      const gradeSectionIds = gradeSections.map(s => s.id);
      
      // Find all active subject mappings for this grade's sections
      const activeMappings = latestMappings.filter((sm: any) => gradeSectionIds.includes(sm.section_id || sm.section?.id));
      const allocatedSubIds = Array.from(new Set(activeMappings.map((sm: any) => sm.subject_id || sm.subject?.id)));
      const preallocatedSubjects = latestSubjects.filter((sub: any) => allocatedSubIds.includes(sub.id));
      
      setDroppedSubjects(preallocatedSubjects);

      // Load existing student elective mappings if cached
      try {
        const saved = localStorage.getItem(`student_elective_mappings_grade_${grade.grade_name}`);
        if (saved) {
          setStudentElectiveMappings(JSON.parse(saved));
        } else {
          setStudentElectiveMappings({});
        }
      } catch (e) {
        setStudentElectiveMappings({});
      }
      
      setShowAllocModal(true);
    } catch (err) {
      console.error("Failed to refresh allocation data on open", err);
      setSelectedAllocGrade(grade);
      setAllocStep(1);
      setShowAllocModal(true);
    } finally {
      setLoadingAllocModalData(false);
    }
  };

  const addDroppedSubject = (sub: Subject) => {
    if (!droppedSubjects.some(s => s.id === sub.id)) {
      setDroppedSubjects(prev => [...prev, sub]);
    }
  };
  
  const removeDroppedSubject = (subId: string) => {
    setDroppedSubjects(prev => prev.filter(s => s.id !== subId));
    setStudentElectiveMappings(prev => {
      const updated = { ...prev };
      delete updated[subId];
      return updated;
    });
  };

  const getSubjectLimit = (sub: any): number => {
    if (!sub) return 50;
    const raw = sub.subject_limit ?? sub.limit;
    if (raw !== null && raw !== undefined && raw !== '') {
      const val = parseInt(String(raw), 10);
      if (!isNaN(val) && val > 0) return val;
    }
    return 50;
  };

  const normalizeGradeKey = (g: string) => (g || '').toLowerCase().replace(/grade/g, '').trim();

  const getElectiveMappingsForGrade = (gradeName: string): Record<string, string[]> => {
    if (!gradeName || typeof window === 'undefined') return {};
    const norm = normalizeGradeKey(gradeName);
    try {
      const savedRaw = localStorage.getItem(`student_elective_mappings_grade_${gradeName}`);
      if (savedRaw) return JSON.parse(savedRaw);

      const savedNorm = localStorage.getItem(`student_elective_mappings_grade_${norm}`);
      if (savedNorm) return JSON.parse(savedNorm);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('student_elective_mappings_grade_')) {
          const kGrade = key.replace('student_elective_mappings_grade_', '');
          if (normalizeGradeKey(kGrade) === norm) {
            const val = localStorage.getItem(key);
            if (val) return JSON.parse(val);
          }
        }
      }
    } catch (e) {}
    return {};
  };

  const saveElectiveMappingsForGrade = (gradeName: string, mappings: Record<string, string[]>) => {
    if (!gradeName || typeof window === 'undefined') return;
    const norm = normalizeGradeKey(gradeName);
    try {
      const jsonStr = JSON.stringify(mappings);
      localStorage.setItem(`student_elective_mappings_grade_${gradeName}`, jsonStr);
      localStorage.setItem(`student_elective_mappings_grade_${norm}`, jsonStr);
    } catch (e) {}
  };

  const mapStudentToElective = (subject: Subject, studentId: string) => {
    if (isAllocReadOnly) return;
    const limit = getSubjectLimit(subject);
    const currentList = studentElectiveMappings[subject.id] || [];

    if (currentList.includes(studentId)) {
      return; // Already mapped
    }

    if (currentList.length >= limit) {
      alert(`Cannot add student. Subject "${subject.name}" has reached its maximum subject limit of ${limit} students.`);
      return;
    }

    const updatedList = [...currentList, studentId];
    const updated = {
      ...studentElectiveMappings,
      [subject.id]: updatedList
    };
    setStudentElectiveMappings(updated);

    if (selectedAllocGrade?.grade_name) {
      saveElectiveMappingsForGrade(selectedAllocGrade.grade_name, updated);
    }
  };

  const unmapStudentFromElective = (subjectId: string, studentId: string) => {
    if (isAllocReadOnly) return;
    const currentList = studentElectiveMappings[subjectId] || [];
    const updatedList = currentList.filter(id => id !== studentId);
    const updated = {
      ...studentElectiveMappings,
      [subjectId]: updatedList
    };
    setStudentElectiveMappings(updated);

    if (selectedAllocGrade?.grade_name) {
      saveElectiveMappingsForGrade(selectedAllocGrade.grade_name, updated);
    }
  };

  const handleAllocateSubmit = async () => {
    if (!selectedAllocGrade) return;
    
    const gradeSections = sections.filter(s => s.grade_name === selectedAllocGrade.grade_name);
    const gradeSectionIds = gradeSections.map(s => s.id);

    const gradeStudents = allStudents.filter((st: any) => {
      if (st.current_section && gradeSectionIds.includes(st.current_section.id || st.current_section)) return true;
      if (st.current_class && st.current_class.startsWith(`${selectedAllocGrade.grade_name}-`)) return true;
      if (st.grade_config && (st.grade_config.grade_name === selectedAllocGrade.grade_name || st.grade_config.id === selectedAllocGrade.id)) return true;
      return false;
    });

    const allocationsPayload = droppedSubjects.map(sub => {
      if (sub.is_core) {
        return {
          subject_id: sub.id,
          section_ids: gradeSections.map(s => s.id)
        };
      } else {
        const mappedStudentIds = studentElectiveMappings[sub.id] || [];
        let secIds = gradeSections
          .filter(sec => {
            const secStudentIds = gradeStudents
              .filter(st => (st.current_section?.id || st.current_section) === sec.id || st.current_class === `${selectedAllocGrade.grade_name}-${sec.section_letter}`)
              .map(st => st.id);
            return mappedStudentIds.some(stId => secStudentIds.includes(stId));
          })
          .map(s => s.id);

        if (secIds.length === 0) {
          secIds = gradeSections.map(s => s.id);
        }

        return {
          subject_id: sub.id,
          section_ids: secIds
        };
      }
    });
    
    setAllocSubmitting(true);
    try {
      await api.post('/academics/subject-mappings/bulk_allocate/', {
        grade_id: selectedAllocGrade.id,
        allocations: allocationsPayload
      });

      if (selectedAllocGrade.grade_name) {
        saveElectiveMappingsForGrade(selectedAllocGrade.grade_name, studentElectiveMappings);
      }

      setShowAllocModal(false);
      setSelectedAllocGrade(null);
      fetchAllocationData();
    } catch (err) {
      console.error("Failed to save subject allocations", err);
      alert("Failed to allocate subjects. Please try again.");
    } finally {
      setAllocSubmitting(false);
    }
  };

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCore = filterCore === '' ? true : (filterCore === 'core' ? s.is_core : !s.is_core);
    return matchesSearch && matchesCore;
  });

  return (
    <div className="space-y-6">
      {/* Access Denied View */}
      {(!canViewDirectory && !canViewAllocation) && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg mx-auto mt-12 text-center gap-4">
          <AlertTriangle size={48} className="text-red-500" />
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500">You do not have permission to view the Subjects section.</p>
        </div>
      )}

      {((canViewDirectory || canViewAllocation)) && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-2xl shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  <BookOpen size={32} /> Subjects Management
                </h1>
                <p className="text-purple-100">Create and manage subjects and grade-level allocations</p>
              </div>
              {canManageDirectory && activeTab === 'directory' && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-white text-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-purple-50 transition flex items-center gap-2"
                >
                  <Plus size={20} /> Add Subject
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-6">
              {canViewDirectory && (
                <button
                  onClick={() => setActiveTab('directory')}
                  className={`pb-3 px-2 font-medium transition ${activeTab === 'directory'
                    ? 'text-purple-600 border-b-2 border-purple-600 font-bold'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Subjects Directory
                </button>
              )}
              {canViewAllocation && (
                <button
                  onClick={() => {
                    setActiveTab('allocation');
                    if (canViewDirectory) fetchSubjects();
                    fetchAllocationData();
                  }}
                  className={`pb-3 px-2 font-medium transition ${activeTab === 'allocation'
                    ? 'text-purple-600 border-b-2 border-purple-600 font-bold'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Subject Allocation
                </button>
              )}
            </div>
          </div>

          {/* DIRECTORY TAB */}
          {activeTab === 'directory' && canViewDirectory && (
            <>
              {/* Filters */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <select
                    value={filterCore}
                    onChange={(e) => setFilterCore(e.target.value)}
                    className="px-4 py-2 border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="">All Subjects</option>
                    <option value="core">Core Only</option>
                    <option value="elective">Electives Only</option>
                  </select>
                </div>
              </div>

              {/* Subjects Table */}
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="animate-spin text-purple-600" size={40} />
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
                  <p className="text-lg">No subjects found</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Subject Name</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Code</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Type</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Description</th>
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Status</th>
                        {(canEditDirectory || canManageDirectory) && (
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSubjects.map((subject) => (
                        <tr key={subject.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 font-bold text-gray-900">{subject.name}</td>
                          <td className="px-6 py-4 font-mono text-sm text-gray-600">{subject.code}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${subject.is_core ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {subject.is_core ? 'Core' : `Elective${subject.subject_limit ? ` (Limit: ${subject.subject_limit})` : ''}`}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{subject.description || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${subject.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                              {subject.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {(canEditDirectory || canManageDirectory) && (
                            <td className="px-6 py-4 text-center flex justify-center gap-2">
                              {canEditDirectory && (
                                <button onClick={() => handleEdit(subject)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                                  <Edit2 size={18} className="text-blue-600" />
                                </button>
                              )}
                              {canManageDirectory && (
                                <button onClick={() => handleDelete(subject.id)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                                  <Trash2 size={18} className="text-red-600" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ALLOCATION TAB */}
          {activeTab === 'allocation' && canViewAllocation && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grades.map((grade) => {
            const gradeSections = sections.filter(s => s.grade_name === grade.grade_name);
            const gradeSectionIds = gradeSections.map(s => s.id);
            const gradeMappings = subjectMappings.filter(sm => gradeSectionIds.includes(sm.section_id || sm.section?.id));
            const uniqueAllocatedSubIds = Array.from(new Set(gradeMappings.map(sm => sm.subject_id || sm.subject?.id)));
            
            return (
              <div
                key={grade.id}
                onClick={() => handleOpenAllocation(grade)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-300 transition cursor-pointer flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    Grade {grade.grade_name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{gradeSections.length} Sections (Divisions)</p>
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                  <span className="text-xs bg-purple-50 text-purple-700 font-bold px-3 py-1 rounded-full border border-purple-100">
                    {uniqueAllocatedSubIds.length} Subjects Allocated
                  </span>
                  <span className="text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    Manage &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subject Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{editingId ? 'Edit Subject' : 'Add New Subject'}</h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name*</label>
                <input
                  type="text"
                  placeholder="e.g., Mathematics"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code*</label>
                <input
                  type="text"
                  placeholder="e.g., MATH-10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Type*</label>
                <select
                  value={formData.subject_type}
                  onChange={(e) => setFormData({ ...formData, subject_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="CORE">Core Subject</option>
                  <option value="ELECTIVE">Elective Subject</option>
                </select>
              </div>

              {formData.subject_type === 'ELECTIVE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Limit*</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter maximum student capacity"
                    value={formData.subject_limit}
                    onChange={(e) => setFormData({ ...formData, subject_limit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passing Marks</label>
                <input
                  type="number"
                  min="0"
                  value={formData.passing_marks}
                  onChange={(e) => setFormData({ ...formData, passing_marks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Subject description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:bg-gray-400"
                >
                  {submitting ? <Loader2 className="inline animate-spin" size={16} /> : (editingId ? 'Save Changes' : 'Create Subject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Subjects Modal */}
      {showAllocModal && selectedAllocGrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 flex flex-col h-[80vh] max-h-[700px] border border-gray-100">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">
                  {allocStep === 1 
                    ? "Allocate Subjects to this grade" 
                    : `Configure Optional / Elective Mappings - Grade ${selectedAllocGrade.grade_name}`}
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  {allocStep === 1 
                    ? (isAllocReadOnly ? "Allocated core and elective subjects for this grade level." : "Drag and drop subjects into the blank space below.") 
                    : (isAllocReadOnly ? "Mapped optional/elective subjects for each section." : "Select which optional/elective subjects apply to each section.")}
                </p>
              </div>
              <button
                onClick={() => { setShowAllocModal(false); setSelectedAllocGrade(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-800"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Content */}
            {sections.filter(s => s.grade_name === selectedAllocGrade.grade_name).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <AlertTriangle className="text-yellow-500" size={48} />
                <h3 className="text-lg font-bold text-gray-800">No Sections Found</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Please configure sections for Grade {selectedAllocGrade.grade_name} in the "Classes & Sections" module before allocating subjects.
                </p>
                <button
                  onClick={() => { setShowAllocModal(false); setSelectedAllocGrade(null); }}
                  className="mt-4 px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-bold rounded-lg border"
                >
                  Close
                </button>
              </div>
            ) : allocStep === 1 ? (
              // STEP 1: Drag and Drop Allocation
              <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Available Subjects List (Sidebar) */}
                {!isAllocReadOnly && (
                  <div className="w-1/3 flex flex-col h-full border-r border-gray-100 pr-6 min-h-0">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      Available Subjects
                      <span className="text-xs font-normal text-gray-500">(Drag or click +)</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                      {subjects.map((sub) => {
                        const isDropped = droppedSubjects.some(s => s.id === sub.id);
                        return (
                          <div
                            key={sub.id}
                            draggable={!isDropped}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', sub.id);
                            }}
                            className={`p-3 border rounded-xl flex items-center justify-between shadow-sm transition ${
                              isDropped 
                                ? 'bg-gray-50 border-gray-200 opacity-65' 
                                : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50/10 cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold text-gray-800 text-sm truncate">{sub.name}</p>
                              <span className={`inline-block text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded mt-1 ${
                                sub.is_core 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-105' 
                                  : 'bg-yellow-50 text-yellow-700 border border-yellow-105'
                              }`}>
                                {sub.is_core ? 'Core' : 'Elective'}
                              </span>
                            </div>
                            {!isDropped && (
                              <button
                                type="button"
                                onClick={() => addDroppedSubject(sub)}
                                className="p-1 text-purple-600 hover:bg-purple-100 rounded-lg transition font-bold"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Drop Zone (Main Space) */}
                <div className={`${isAllocReadOnly ? 'w-full' : 'w-2/3'} flex flex-col h-full pl-2 min-h-0`}>
                  <h3 className="font-bold text-gray-900 mb-3">Allocated to Grade {selectedAllocGrade.grade_name}</h3>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      if (isAllocReadOnly) return;
                      const subId = e.dataTransfer.getData('text/plain');
                      if (subId) {
                        const sub = subjects.find(s => s.id === subId);
                        if (sub) addDroppedSubject(sub);
                      }
                    }}
                    className={`flex-1 rounded-2xl border-2 transition overflow-y-auto p-5 ${
                      droppedSubjects.length === 0 
                        ? 'border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center text-center gap-2' 
                        : 'border-solid border-gray-200 bg-white grid grid-cols-2 gap-3.5 content-start'
                    }`}
                  >
                    {droppedSubjects.length === 0 ? (
                      <>
                        <BookOpen size={40} className="text-gray-300" />
                        <p className="text-sm font-semibold text-gray-500">
                          {isAllocReadOnly ? "No subjects allocated to this grade level." : "Drag subjects here"}
                        </p>
                        {!isAllocReadOnly && (
                          <p className="text-xs text-gray-400 max-w-xs">
                            Drag subjects from the left list and drop them here to allocate them to this grade level.
                          </p>
                        )}
                      </>
                    ) : (
                      droppedSubjects.map((sub) => (
                        <div
                          key={sub.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between shadow-sm ${
                            sub.is_core 
                              ? 'bg-blue-50 bg-opacity-20 border-blue-200' 
                              : 'bg-yellow-50 bg-opacity-20 border-yellow-200'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="font-bold text-gray-900 text-sm truncate">{sub.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{sub.code}</p>
                          </div>
                          {!isAllocReadOnly && (
                            <button
                              type="button"
                              onClick={() => removeDroppedSubject(sub.id)}
                              className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // STEP 2: Elective-Student Drag and Drop Mapping Selection
              (() => {
                const gradeSections = sections.filter(s => s.grade_name === selectedAllocGrade.grade_name);
                const gradeSectionIds = gradeSections.map(s => s.id);

                const currentGradeStudents = allStudents.filter((st: any) => {
                  if (st.current_section && gradeSectionIds.includes(st.current_section.id || st.current_section)) return true;
                  if (st.current_class && st.current_class.startsWith(`${selectedAllocGrade.grade_name}-`)) return true;
                  if (st.grade_config && (st.grade_config.grade_name === selectedAllocGrade.grade_name || st.grade_config.id === selectedAllocGrade.id)) return true;
                  return false;
                });

                const filteredGradeStudents = currentGradeStudents.filter((st: any) => {
                  const sName = (st.user?.full_name || st.full_name || `${st.first_name || ''} ${st.last_name || ''}`).toLowerCase();
                  const suid = (st.suid || '').toLowerCase();
                  const matchesSearch = !searchStudentQuery || sName.includes(searchStudentQuery.toLowerCase()) || suid.includes(searchStudentQuery.toLowerCase());
                  const matchesSection = !filterStudentSection || st.current_class?.endsWith(`-${filterStudentSection}`) || st.current_section?.section_letter === filterStudentSection;
                  return matchesSearch && matchesSection;
                });

                const electiveSubjects = droppedSubjects.filter(s => !s.is_core);

                return (
                  <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex gap-3 items-start">
                      <Check className="text-purple-600 mt-0.5 shrink-0" size={20} />
                      <div>
                        <h4 className="font-bold text-purple-900 text-sm">Core subjects automatically allocated</h4>
                        <p className="text-xs text-purple-700 mt-0.5">
                          Core subjects ({droppedSubjects.filter(s => s.is_core).map(s => s.name).join(', ') || 'None'}) automatically apply to all students in Grade {selectedAllocGrade.grade_name}.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-gray-900">Map Elective Subjects to Students</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Drag and drop students into an Elective Subject card to map them. Subject Limit constraints are enforced automatically.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Student Pool Column (5 cols) */}
                        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col h-[460px]">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                              <span>👨‍🎓 Grade {selectedAllocGrade.grade_name} Students</span>
                              <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                {currentGradeStudents.length}
                              </span>
                            </h4>
                          </div>

                          {/* Student Pool Filters */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Search student..."
                              value={searchStudentQuery}
                              onChange={(e) => setSearchStudentQuery(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                            <select
                              value={filterStudentSection}
                              onChange={(e) => setFilterStudentSection(e.target.value)}
                              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white font-semibold"
                            >
                              <option value="">All Sections</option>
                              {gradeSections.map(s => (
                                <option key={s.id} value={s.section_letter}>Section {s.section_letter}</option>
                              ))}
                            </select>
                          </div>

                          {/* Student Pool Items */}
                          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {filteredGradeStudents.length === 0 ? (
                              <div className="p-8 text-center text-xs text-gray-400 italic">
                                No students found matching search.
                              </div>
                            ) : (
                              filteredGradeStudents.map(student => {
                                const isDragged = draggedStudentId === student.id;
                                const studentName = student.user?.full_name || student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                                const sectionLabel = student.current_class || (student.current_section?.section_letter ? `Sec ${student.current_section.section_letter}` : `Grade ${selectedAllocGrade.grade_name}`);

                                return (
                                  <div
                                    key={student.id}
                                    draggable={!isAllocReadOnly}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', student.id);
                                      setDraggedStudentId(student.id);
                                    }}
                                    onDragEnd={() => setDraggedStudentId(null)}
                                    className={`p-2.5 bg-white border border-gray-200 rounded-xl shadow-xs flex items-center justify-between gap-2 select-none transition ${
                                      isAllocReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:border-purple-300 hover:shadow-sm'
                                    } ${isDragged ? 'opacity-40 border-purple-500' : ''}`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-gray-800 text-xs truncate">{studentName}</p>
                                      <p className="text-[10px] text-gray-500 truncate">SUID: {student.suid || 'N/A'}</p>
                                    </div>
                                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md shrink-0">
                                      {sectionLabel}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Elective Subject Cards Column (7 cols) */}
                        <div className="lg:col-span-7 space-y-4 h-[460px] overflow-y-auto pr-1">
                          {electiveSubjects.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400">
                              <p className="font-bold text-sm">No Elective Subjects Selected</p>
                              <p className="text-xs mt-1">Go back to step 1 and drop elective subjects for this grade.</p>
                            </div>
                          ) : (
                            electiveSubjects.map(elecSub => {
                              const mappedStudentIds = studentElectiveMappings[elecSub.id] || [];
                              const limit = getSubjectLimit(elecSub);
                              const isFull = mappedStudentIds.length >= limit;
                              const mappedStudents = currentGradeStudents.filter(st => mappedStudentIds.includes(st.id));

                              return (
                                <div
                                  key={elecSub.id}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const studentId = e.dataTransfer.getData('text/plain') || draggedStudentId;
                                    if (studentId) {
                                      mapStudentToElective(elecSub, studentId);
                                    }
                                  }}
                                  className={`p-4 border rounded-2xl bg-white shadow-sm transition-all duration-200 ${
                                    isFull ? 'border-amber-300 bg-amber-50/20' : 'border-purple-200 hover:border-purple-400'
                                  }`}
                                >
                                  {/* Subject Card Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                                    <div>
                                      <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                                        <span>📘 {elecSub.name}</span>
                                        <span className="text-xs text-gray-500 font-mono">({elecSub.code})</span>
                                      </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                        isFull 
                                          ? 'bg-red-100 text-red-700 border-red-200' 
                                          : 'bg-purple-50 text-purple-700 border-purple-200'
                                      }`}>
                                        Mapped: {mappedStudentIds.length} / {limit} (Limit: {limit})
                                      </span>
                                    </div>
                                  </div>

                                  {/* Drag & Drop Target Zone */}
                                  <div className="mt-3 min-h-[90px] p-3 rounded-xl border-2 border-dashed border-purple-100 bg-purple-50/20 flex flex-wrap gap-2 items-center">
                                    {mappedStudents.length === 0 ? (
                                      <div className="w-full text-center text-xs text-purple-400 font-medium py-4">
                                        ⬇️ Drag & Drop students here to map them to {elecSub.name} (Max {limit})
                                      </div>
                                    ) : (
                                      mappedStudents.map(student => {
                                        const sName = student.user?.full_name || student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
                                        const sClass = student.current_class || (student.current_section?.section_letter ? `Sec ${student.current_section.section_letter}` : `Grade ${selectedAllocGrade.grade_name}`);

                                        return (
                                          <div
                                            key={student.id}
                                            className="bg-white border border-purple-200 text-purple-900 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
                                          >
                                            <span>{sName}</span>
                                            <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded">
                                              {sClass}
                                            </span>
                                            {!isAllocReadOnly && (
                                              <button
                                                type="button"
                                                onClick={() => unmapStudentFromElective(elecSub.id, student.id)}
                                                className="text-purple-400 hover:text-red-600 transition"
                                                title="Remove student"
                                              >
                                                <X size={13} />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-5 border-t border-gray-100 mt-6">
              <div>
                {allocStep === 2 && (
                  <button
                    type="button"
                    onClick={() => setAllocStep(1)}
                    className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition"
                  >
                    <ArrowLeft size={16} /> Back to allocation
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAllocModal(false); setSelectedAllocGrade(null); }}
                  className="px-5 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-bold"
                >
                  {isAllocReadOnly && allocStep === 2 ? 'Close' : 'Cancel'}
                </button>
                {isAllocReadOnly ? (
                  allocStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => setAllocStep(2)}
                      className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold"
                    >
                      View Elective Mappings
                    </button>
                  ) : null
                ) : allocStep === 1 ? (
                  <button
                    type="button"
                    disabled={droppedSubjects.length === 0}
                    onClick={() => setAllocStep(2)}
                    className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Allocate core subjects
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={allocSubmitting}
                    onClick={handleAllocateSubmit}
                    className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold disabled:bg-gray-250 flex items-center gap-2"
                  >
                    {allocSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Allocating...
                      </>
                    ) : (
                      'Allocate'
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {loadingAllocModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-[60] backdrop-blur-[2px]">
          <div className="bg-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-gray-700">
            <Loader2 className="animate-spin text-purple-600" size={24} />
            Loading latest subjects...
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
