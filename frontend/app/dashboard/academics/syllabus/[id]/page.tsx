'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, BookOpen, Plus, Trash2, Edit2, CheckCircle } from 'lucide-react';
import Modal from '@/components/Modal';

interface Syllabus {
  id: string;
  subject_name: string;
  section_name: string;
  academic_year: string;
  description: string;
}

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  description: string;
  status: string;
}

export default function SyllabusDetailPage() {
  const params = useParams();
  const { formatAcademicYear } = useSettings();
  const syllabusId = params?.id as string;
  
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    chapter_number: '1',
    title: '',
    description: '',
    status: 'NOT_STARTED',
  });

  useEffect(() => {
    if (syllabusId) {
      fetchSyllabusDetails();
      fetchChapters();
    }
  }, [syllabusId]);

  const fetchSyllabusDetails = async () => {
    try {
      const response = await api.get(`/academics/syllabuses/${syllabusId}/`);
      setSyllabus(response.data);
    } catch (error) {
      console.error('Failed to load syllabus', error);
      setError('Failed to load syllabus details');
    }
  };

  const fetchChapters = async () => {
    setLoading(false);
    try {
      const response = await api.get(`/academics/chapters/?syllabus=${syllabusId}`);
      setChapters(response.data);
    } catch (error) {
      console.error('Failed to load chapters', error);
    }
  };

  const handleSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        syllabus: syllabusId,
        chapter_number: parseInt(data.chapter_number as string),
        title: data.title as string,
        description: data.description as string,
        status: data.status as string,
      };
      
      if (editingId) {
        await api.put(`/academics/chapters/${editingId}/`, payload);
      } else {
        await api.post('/academics/chapters/', payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({
        chapter_number: '1',
        title: '',
        description: '',
        status: 'NOT_STARTED',
      });
      fetchChapters();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save chapter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (chapterId: string) => {
    if (confirm('Are you sure you want to delete this chapter?')) {
      try {
        await api.delete(`/academics/chapters/${chapterId}/`);
        fetchChapters();
      } catch (error) {
        setError('Failed to delete chapter');
      }
    }
  };

  const handleEdit = (chapter: Chapter) => {
    setEditingId(chapter.id);
    setFormData({
      chapter_number: chapter.chapter_number.toString(),
      title: chapter.title || '',
      description: chapter.description || '',
      status: chapter.status,
    });
    setShowModal(true);
  };

  const handleToggleCompletion = async (chapter: Chapter) => {
    try {
      await api.patch(`/academics/chapters/${chapter.id}/`, {
        status: chapter.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED',
      });
      fetchChapters();
    } catch (error) {
      setError('Failed to update chapter');
    }
  };

  if (loading || !syllabus) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-purple-600" size={40} />
      </div>
    );
  }

  const completedChapters = chapters.filter(c => c.status === 'COMPLETED').length;
  const completionPercentage = chapters.length > 0 ? Math.round((completedChapters / chapters.length) * 100) : 0;

  const fields = [
    {
      name: 'chapter_number',
      label: 'Chapter Number',
      type: 'number' as const,
      required: true,
      min: 1,
    },
    {
      name: 'title',
      label: 'Chapter Title',
      type: 'text' as const,
      required: true,
      placeholder: 'e.g., Introduction to Algebra',
    },
    {
      name: 'description',
      label: 'Description / Topics',
      type: 'textarea' as const,
      required: false,
      placeholder: 'List topics separated by commas',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: [
        { label: 'Not Started', value: 'NOT_STARTED' },
        { label: 'In Progress', value: 'IN_PROGRESS' },
        { label: 'Completed', value: 'COMPLETED' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/syllabus" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{syllabus.subject_name}</h1>
          <p className="text-gray-600 mt-1">{syllabus.section_name} • {formatAcademicYear(syllabus.academic_year)}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Curriculum Progress</h2>
          <span className="text-2xl font-bold text-purple-600">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-purple-500 to-purple-600 h-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-3">{completedChapters} of {chapters.length} chapters completed</p>
      </div>

      {/* Add Button */}
      <button
        onClick={() => {
          setEditingId(null);
          setFormData({
            chapter_number: (chapters.length + 1).toString(),
            title: '',
            description: '',
            status: 'NOT_STARTED',
          });
          setShowModal(true);
        }}
        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
      >
        <Plus size={20} /> Add Chapter
      </button>

      {/* Chapters List */}
      {chapters.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No chapters added yet</p>
          <p className="text-sm mt-2">Add chapters to organize your course curriculum</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chapters.map((chapter) => (
            <div 
              key={chapter.id} 
              className={`p-6 rounded-xl border transition ${
                chapter.status === 'COMPLETED'
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-white border-gray-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-lg text-gray-900">Chapter {chapter.chapter_number}</span>
                    <h3 className="text-lg font-semibold text-gray-900">{chapter.title}</h3>
                    {chapter.status === 'COMPLETED' && (
                      <CheckCircle size={20} className="text-green-600" />
                    )}
                  </div>
                  {chapter.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Topics:</strong> {chapter.description}
                    </p>
                  )}
                  <p className="text-sm font-medium">
                    Status: <span className={
                      chapter.status === 'COMPLETED' ? 'text-green-600' :
                      chapter.status === 'IN_PROGRESS' ? 'text-blue-600' : 'text-gray-500'
                    }>{chapter.status.replace('_', ' ')}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleCompletion(chapter)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      chapter.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {chapter.status === 'COMPLETED' ? 'Mark Not Started' : 'Mark Complete'}
                  </button>
                  <button
                    onClick={() => handleEdit(chapter)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(chapter.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Chapter' : 'Add Chapter'}
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText={editingId ? 'Update Chapter' : 'Add Chapter'}
        color="purple"
      />
    </div>
  );
}
