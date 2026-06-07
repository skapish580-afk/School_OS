'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Loader2, Search, BookOpen, X } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  subject_type?: string;
  passing_marks?: number;
  is_active: boolean;
}

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  subject_type: string;
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
    passing_marks: '40',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
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

  const handleEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setFormData({
      name: subject.name,
      code: subject.code,
      description: subject.description || '',
      subject_type: subject.subject_type || (subject.is_core ? 'CORE' : 'ELECTIVE'),
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
    setFormData({ name: '', code: '', description: '', subject_type: 'CORE', passing_marks: '40' });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      setError('Subject Name and Code are required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description,
        subject_type: formData.subject_type,
        is_core: formData.subject_type === 'CORE',
        passing_marks: parseInt(formData.passing_marks),
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
      setError(err.response?.data?.detail || 'Failed to create subject');
    } finally {
      setSubmitting(false);
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
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BookOpen size={32} /> Subjects Management
            </h1>
          {/* Modal */}
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
            <p className="text-purple-100">Create and manage subjects across grades</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-bold hover:bg-purple-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Add Subject
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
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubjects.map((subject) => (
                <tr key={subject.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-bold text-gray-900">{subject.name}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{subject.code}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${subject.is_core ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {subject.is_core ? 'Core' : 'Elective'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{subject.description || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${subject.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {subject.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center flex justify-center gap-2">
                    <button onClick={() => handleEdit(subject)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                      <Edit2 size={18} className="text-blue-600" />
                    </button>
                    <button onClick={() => handleDelete(subject.id)} className="p-2 hover:bg-gray-200 rounded-lg transition">
                      <Trash2 size={18} className="text-red-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
