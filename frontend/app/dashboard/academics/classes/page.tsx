'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, Search, Filter, Users, X } from 'lucide-react';

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
  grade_number: number;
  grade_name: string;
}

interface FormData {
  grade_id: string;
  section_letter: string;
  capacity: string;
  room_number: string;
}

export default function ClassesPage() {
  const router = useRouter();
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

  useEffect(() => {
    fetchGrades();
    fetchSchoolId();
  }, []);

  useEffect(() => {
    fetchSections();
  }, [selectedGrade]);

  const fetchGrades = async () => {
    try {
      const response = await api.get('/academics/grades/');
      setGrades(response.data);
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
      setSections(response.data);
    } catch (error) {
      console.error('Failed to load sections', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sectionId: string, sectionName: string) => {
    if (!confirm(`Are you sure you want to delete section "${sectionName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/academics/sections/${sectionId}/`);
      fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete section. It may have students enrolled.');
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
        school_id: schoolId,
        grade_id: formData.grade_id,
        section_letter: formData.section_letter.toUpperCase(),
        capacity: parseInt(formData.capacity),
        room_number: formData.room_number,
        is_active: true,
      });
      setShowModal(false);
      setFormData({ grade_id: '', section_letter: '', capacity: '50', room_number: '' });
      fetchSections();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.grade_id?.[0] || 'Failed to create section');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSections = sections.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.grade_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Classes & Sections</h1>
            <p className="text-blue-100">Manage grade levels and class sections</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Add Section
          </button>
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
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                    <Edit2 size={18} className="text-blue-600" />
                  </button>
                  <button 
                    onClick={() => handleDelete(section.id, section.full_name)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${section.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {section.is_active ? 'Active' : 'Inactive'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (1-12)</label>
                <select
                  value={formData.grade_id}
                  onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Class</option>
                  {grades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.grade_name}
                    </option>
                  ))}
                </select>
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
    </div>
  );
}
