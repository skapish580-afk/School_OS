'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, Search, Filter, Users, X } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

interface Section {
  id: string;
  full_name: string;
  grade_name: string;
  section_letter: string;
  capacity: number;
  class_teacher_name: string | null;
  student_count: number;
  is_active: boolean;
}

interface Grade {
  id: string;
  grade_name: string;
  grade_order: number;
}

interface FormData {
  grade_id: string;
  section_letter: string;
  capacity: string;
  room_number: string;
}

export default function ClassesPage() {
  const router = useRouter();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();

  const canView = isAdmin || hasPermission('academics.view_class');
  const canAddDelete = isAdmin || hasPermission('academics.manage_class');
  const canEdit = isAdmin || hasPermission('academics.edit_class');

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    grade_id: '',
    section_letter: '',
    capacity: '50',
    room_number: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [gradeNumberInput, setGradeNumberInput] = useState(''); // raw typed value for Add form

  // Edit states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    grade_id: '',
    section_letter: '',
    class_teacher_id: '',
    capacity: '50',
    room_number: '',
    is_active: true,
    move_students: false,
  });
  const [originalClassAndSection, setOriginalClassAndSection] = useState({ grade_name: '', section_letter: '' });
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [editGradeNumberInput, setEditGradeNumberInput] = useState(''); // raw typed value for Edit form

  // Delete & Reallocate states
  const [showDeleteReallocateModal, setShowDeleteReallocateModal] = useState(false);
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);
  const [unallocatedStudents, setUnallocatedStudents] = useState<any[]>([]);
  const [reallocations, setReallocations] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (!permissionsLoading && canView) {
      fetchGrades();
      fetchSchoolId();
    }
  }, [permissionsLoading, canView]);

  useEffect(() => {
    if (!permissionsLoading && canView) {
      fetchSections();
    }
  }, [selectedGrade, permissionsLoading, canView]);

  const fetchGrades = async () => {
    try {
      const response = await api.get('/academics/grades/');
      const data = response.data;
      setGrades(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load grades', error);
    }
  };

  const fetchSchoolId = async () => {
    try {
      const response = await api.get('/schools/');
      if (response.data && response.data.length > 0) {
        setSchoolId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load school', error);
    }
  };

  const fetchSections = async () => {
    setLoading(true);
    try {
      let url = '/academics/sections/';
      if (selectedGrade) {
        url += `?grade=${selectedGrade}`;
      }
      const response = await api.get(url);
      const data = response.data;
      setSections(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load sections', error);
    } finally {
      setLoading(false);
    }
  };

  const startDeleteSection = async (section: Section) => {
    if (section.student_count === 0) {
      if (!confirm(`Are you sure you want to delete section "${section.full_name}"? This action cannot be undone.`)) {
        return;
      }
      try {
        await api.delete(`/academics/sections/${section.id}/`);
        fetchSections();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to delete section.');
      }
    } else {
      setDeletingSection(section);
      setShowDeleteReallocateModal(true);
      setLoadingStudents(true);
      setUnallocatedStudents([]);
      setReallocations({});
      try {
        const response = await api.get(`/students/?current_section=${section.id}&status=ACTIVE`);
        const data = response.data;
        setUnallocatedStudents(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error("Failed to fetch students for reallocation", err);
        alert("Failed to load students in this section.");
      } finally {
        setLoadingStudents(false);
      }
    }
  };

  const handleAllocate = (studentId: string, sectionId: string) => {
    if (!sectionId) {
      const updated = { ...reallocations };
      delete updated[studentId];
      setReallocations(updated);
    } else {
      setReallocations(prev => ({ ...prev, [studentId]: sectionId }));
    }
  };

  const handleUnallocate = (studentId: string) => {
    const updated = { ...reallocations };
    delete updated[studentId];
    setReallocations(updated);
  };

  const handleConfirmDeleteWithReallocation = async () => {
    if (!deletingSection) return;
    
    const payload = Object.entries(reallocations).map(([studentId, newSectionId]) => ({
      student_id: studentId,
      new_section_id: newSectionId
    }));
    
    setSubmitting(true);
    try {
      await api.post(`/academics/sections/${deletingSection.id}/reallocate_and_delete/`, {
        reallocations: payload
      });
      setShowDeleteReallocateModal(false);
      setDeletingSection(null);
      fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reallocate and delete section.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.grade_id || !formData.section_letter) {
      setError('Grade and Section Letter are required');
      return;
    }
    
    if (!schoolId) {
      setError('School not found');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/academics/sections/', {
        grade_id: formData.grade_id,
        section_letter: formData.section_letter.toUpperCase(),
        capacity: parseInt(formData.capacity),
        room_number: formData.room_number,
        is_active: true,
      });
      setShowModal(false);
      setFormData({ grade_id: '', section_letter: '', capacity: '50', room_number: '' });
      setGradeNumberInput('');
      fetchSections();
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = data?.detail || 
                       (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : data?.non_field_errors) ||
                       data?.grade_id?.[0] || 
                       data?.section_letter?.[0] || 
                       'Failed to create section';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = async (section: any) => {
    const gradeObj = grades.find(g => g.grade_name === section.grade_name);
    setError('');
    try {
      const response = await api.get(`/academics/sections/${section.id}/`);
      const details = response.data;
      
      setEditFormData({
        grade_id: details.grade_info?.id || gradeObj?.id || '',
        section_letter: details.section_letter || section.section_letter || '',
        class_teacher_id: details.class_teacher_info?.id || '',
        capacity: details.capacity?.toString() || '50',
        room_number: details.room_number || '',
        is_active: details.is_active !== undefined ? details.is_active : section.is_active,
        move_students: false,
      });
      setOriginalClassAndSection({
        grade_name: details.grade_name || section.grade_name || '',
        section_letter: details.section_letter || section.section_letter || '',
      });
      // Pre-fill the numeric grade input for the Edit form
      const resolvedGradeId = details.grade_info?.id || gradeObj?.id || '';
      const resolvedGrade = grades.find(g => g.id === resolvedGradeId);
      // grade_name is text like "1", "2"... parse it as the display number
      setEditGradeNumberInput(resolvedGrade ? resolvedGrade.grade_name : '');
      
      setEditingSectionId(section.id);
      
      // Fetch available teachers
      const teachersRes = await api.get(`/teachers/?available_as_class_teacher=true&exclude_section=${section.id}`);
      const teachersData = teachersRes.data;
      setAvailableTeachers(Array.isArray(teachersData) ? teachersData : teachersData.results || []);
      
      setShowEditModal(true);
    } catch (err) {
      console.error('Failed to load edit details', err);
      alert('Failed to load section details for editing.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.grade_id || !editFormData.section_letter) {
      setError('Grade and Section Letter are required');
      return;
    }
    
    if (!schoolId) {
      setError('School not found');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/academics/sections/${editingSectionId}/`, {
        grade_id: editFormData.grade_id,
        section_letter: editFormData.section_letter.toUpperCase(),
        capacity: parseInt(editFormData.capacity),
        room_number: editFormData.room_number || null,
        move_students: editFormData.move_students,
      });
      setShowEditModal(false);
      setEditingSectionId(null);
      setEditGradeNumberInput('');
      fetchSections();
    } catch (err: any) {
      const data = err.response?.data;
      const errorMsg = data?.detail || 
                       (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : data?.non_field_errors) ||
                       data?.grade_id?.[0] || 
                       data?.section_letter?.[0] || 
                       'Failed to update section';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSections = sections.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.grade_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100 max-w-md mx-auto mt-12">
        Access Denied. You do not have permission to view classes and sections.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Classes & Sections</h1>
            <p className="text-blue-100">Manage grade levels and class sections</p>
          </div>
          {canAddDelete && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition flex items-center gap-2"
            >
              <Plus size={20} /> Add Section
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">All Grades</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.grade_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sections Grid */}
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <p className="text-lg">No sections found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSections.map((section) => (
            <div key={section.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{section.full_name}</h3>
                  <p className="text-sm text-gray-500">{section.grade_name}</p>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button 
                      onClick={() => handleEditClick(section)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit2 size={18} className="text-blue-600" />
                    </button>
                  )}
                  {canAddDelete && (
                    <button 
                      onClick={() => startDeleteSection(section)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Trash2 size={18} className="text-red-600" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Class Teacher:</span>
                  <span className="font-medium">{section.class_teacher_name || 'Not Assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Students:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Users size={16} /> {section.student_count}/{section.capacity}
                  </span>
                </div>
              </div>

              <button onClick={() => router.push(`/dashboard/academics/classes/${section.id}`)} className="w-full mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add New Section</h2>
              <button
                onClick={() => setShowModal(false)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (1–12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Enter class number (1-12)"
                  value={gradeNumberInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Allow clearing the field
                    if (raw === '') {
                      setGradeNumberInput('');
                      setFormData({ ...formData, grade_id: '' });
                      return;
                    }
                    const num = parseInt(raw, 10);
                    // Block anything outside 1-12
                    if (isNaN(num) || num < 1 || num > 12) return;
                    setGradeNumberInput(String(num));
                    const matched = grades.find(g => g.grade_name === String(num));
                    setFormData({ ...formData, grade_id: matched?.id ?? String(num) });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (A, B, C...)</label>
                <input
                  type="text"
                  maxLength={1}
                  placeholder="A, B, C..."
                  value={formData.section_letter}
                  onChange={(e) => setFormData({ ...formData, section_letter: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Max Students)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., 10-A, Lab-1"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400"
                >
                  {submitting ? <Loader2 className="inline animate-spin" size={16} /> : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Section</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingSectionId(null); }}
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

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (1–12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  placeholder="Enter class number (1-12)"
                  value={editGradeNumberInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setEditGradeNumberInput('');
                      setEditFormData({ ...editFormData, grade_id: '' });
                      return;
                    }
                    const num = parseInt(raw, 10);
                    if (isNaN(num) || num < 1 || num > 12) return;
                    setEditGradeNumberInput(String(num));
                    const matched = grades.find(g => g.grade_name === String(num));
                    setEditFormData({ ...editFormData, grade_id: matched?.id ?? String(num) });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (A, B, C...)</label>
                <input
                  type="text"
                  maxLength={1}
                  placeholder="A, B, C..."
                  value={editFormData.section_letter}
                  onChange={(e) => setEditFormData({ ...editFormData, section_letter: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Max Students)</label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.capacity}
                  onChange={(e) => setEditFormData({ ...editFormData, capacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., 10-A, Lab-1"
                  value={editFormData.room_number}
                  onChange={(e) => setEditFormData({ ...editFormData, room_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="move_students"
                  checked={editFormData.move_students}
                  onChange={(e) => setEditFormData({ ...editFormData, move_students: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1 cursor-pointer"
                />
                <label htmlFor="move_students" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Add the students in {originalClassAndSection.grade_name}-{originalClassAndSection.section_letter} to {grades.find((g: any) => g.id === editFormData.grade_id)?.grade_name || '?'}/{editFormData.section_letter || '?'}
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingSectionId(null); }}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400"
                >
                  {submitting ? <Loader2 className="inline animate-spin" size={16} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete & Reallocate Modal */}
      {showDeleteReallocateModal && deletingSection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 flex flex-col h-[80vh] max-h-[700px] border border-gray-100">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
              <div className="border-l-4 border-red-500 pl-4 py-1">
                <h2 className="text-2xl font-bold text-gray-950 flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  Warning: The class being deleted has students assigned to it
                </h2>
                <p className="text-sm text-gray-600 mt-1 font-medium">Please Allocate new class to the students</p>
              </div>
              <button
                onClick={() => { setShowDeleteReallocateModal(false); setDeletingSection(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-gray-800"
              >
                <X size={22} />
              </button>
            </div>

            {loadingStudents ? (
              <div className="flex flex-col items-center justify-center py-20 flex-1 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={44} />
                <p className="text-sm text-gray-500 font-medium">Loading students...</p>
              </div>
            ) : (
              <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Left Column: Unallocated Students */}
                <div className="w-1/3 flex flex-col h-full border-r border-gray-100 pr-6 min-h-0">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      Unallocated Students
                      <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full">
                        {unallocatedStudents.filter(s => !reallocations[s.id]).length}
                      </span>
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {unallocatedStudents.filter(s => !reallocations[s.id]).length === 0 ? (
                      <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center text-sm font-medium animate-pulse">
                        ✨ All students allocated!
                      </div>
                    ) : (
                      unallocatedStudents.filter(s => !reallocations[s.id]).map((student) => {
                        const otherSections = sections.filter(s => s.id !== deletingSection.id);
                        return (
                          <div
                            key={student.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', student.id);
                            }}
                            className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl cursor-grab active:cursor-grabbing hover:bg-gray-100/70 hover:border-gray-300 transition flex flex-col gap-2.5 shadow-sm"
                          >
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{student.first_name} {student.last_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{student.email}</p>
                              <p className="text-xs text-blue-600 font-semibold mt-1">
                                {student.roll_number ? `Roll: ${student.roll_number}` : `SUID: ${student.suid || student.id.substring(0,8)}`}
                              </p>
                            </div>
                            
                            {/* Fallback Dropdown */}
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Move to:</span>
                              <select
                                onChange={(e) => handleAllocate(student.id, e.target.value)}
                                value={reallocations[student.id] || ''}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 cursor-pointer font-medium"
                              >
                                <option value="">Select class...</option>
                                {otherSections.map((sec) => (
                                  <option key={sec.id} value={sec.id}>{sec.full_name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Available Classes Grid */}
                <div className="w-2/3 flex flex-col h-full pl-2 min-h-0">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    Available Classes
                    <span className="text-xs text-gray-500 font-normal">(Drag and drop students here)</span>
                  </h3>

                  <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pr-1 pb-4">
                    {sections.filter(s => s.id !== deletingSection.id).map((sec) => {
                      const allocatedToThisSec = unallocatedStudents.filter(s => reallocations[s.id] === sec.id);
                      return (
                        <div
                          key={sec.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const studentId = e.dataTransfer.getData('text/plain');
                            if (studentId) {
                              handleAllocate(studentId, sec.id);
                            }
                          }}
                          className={`p-4 border-2 rounded-xl transition flex flex-col min-h-[140px] ${
                            allocatedToThisSec.length > 0 
                              ? 'border-blue-500 bg-blue-50/20' 
                              : 'border-dashed border-gray-200 hover:border-blue-400 hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-gray-900">{sec.full_name}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">{sec.grade_name}</p>
                            </div>
                            <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              {sec.student_count + allocatedToThisSec.length}/{sec.capacity} Capacity
                            </span>
                          </div>

                          <div className="flex-1 space-y-1.5 mt-3 overflow-y-auto max-h-[120px] pr-1">
                            {allocatedToThisSec.length === 0 ? (
                              <p className="text-xs text-gray-400 italic mt-4 text-center">Drag students here</p>
                            ) : (
                              allocatedToThisSec.map((student) => (
                                <div
                                  key={student.id}
                                  className="flex justify-between items-center text-xs bg-white text-blue-900 px-2.5 py-1.5 rounded-lg border border-blue-100 shadow-sm"
                                >
                                  <span className="font-semibold truncate max-w-[80%]">{student.first_name} {student.last_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUnallocate(student.id)}
                                    className="text-red-500 hover:bg-red-50 p-0.5 rounded transition"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-6">
              <button
                type="button"
                onClick={() => { setShowDeleteReallocateModal(false); setDeletingSection(null); }}
                className="px-5 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || unallocatedStudents.length === 0 || unallocatedStudents.filter(s => !reallocations[s.id]).length > 0}
                onClick={handleConfirmDeleteWithReallocation}
                className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold disabled:bg-gray-200 disabled:text-gray-400 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Reallocating...
                  </>
                ) : (
                  'Confirm & Delete Class'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
