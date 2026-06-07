'use client';

import { useState, useEffect } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, BookMarked, Loader2, Search, TrendingUp } from 'lucide-react';
import Modal from '@/components/Modal';

interface Syllabus {
  id: string;
  subject_name: string;
  section_name: string;
  teacher_name: string | null;
  total_chapters: number;
  academic_year: string;
  progress_percentage: number;
}

interface SubjectMapping {
  id: string;
  subject_name: string;
  section_name: string;
  teacher_name: string | null;
}

export default function SyllabusPage() {
  const router = useRouter();
  const { formatAcademicYear } = useSettings();
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<SubjectMapping[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    subject_mapping_id: '',
    academic_year: '2025-2026',
    total_chapters: '10',
  });

  useEffect(() => {
    fetchSchoolId();
    fetchSyllabuses();
    fetchSubjectMappings();
  }, []);

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

  const fetchSyllabuses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/syllabuses/');
      setSyllabuses(response.data);
    } catch (error) {
      console.error('Failed to load syllabuses', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectMappings = async () => {
    try {
      const response = await api.get('/academics/subject-mappings/');
      setSubjectMappings(response.data);
    } catch (error) {
      console.error('Failed to load subject mappings', error);
    }
  };

  const handleSubmit = async (data: Record<string, string | number>) => {
    setSubmitting(true);
    setError('');
    try {
      if (!schoolId) {
        setError('School not found');
        setSubmitting(false);
        return;
      }
      
      await api.post('/academics/syllabuses/', {
        school_id: schoolId,
        subject_mapping_id: data.subject_mapping_id,
        academic_year: data.academic_year,
        total_chapters: parseInt(data.total_chapters as string),
      });
      setShowModal(false);
      setFormData({ subject_mapping_id: '', academic_year: '2025-2026', total_chapters: '10' });
      fetchSyllabuses();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.subject_mapping_id?.[0] || 'Failed to create syllabus');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSyllabuses = syllabuses.filter(s =>
    s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.section_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fields = [
    {
      name: 'subject_mapping_id',
      label: 'Subject & Section',
      type: 'select' as const,
      required: true,
      options: subjectMappings.map(sm => ({ 
        value: sm.id, 
        label: `${sm.subject_name} - ${sm.section_name}` 
      })),
    },
    {
      name: 'academic_year',
      label: 'Academic Year',
      type: 'text' as const,
      required: true,
      placeholder: '2025-2026',
    },
    {
      name: 'total_chapters',
      label: 'Total Chapters',
      type: 'number' as const,
      required: true,
      min: 1,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <BookMarked size={32} /> Syllabus Tracking
            </h1>
            <p className="text-orange-100">Track chapter progress and academic planning</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-orange-600 px-6 py-2 rounded-lg font-bold hover:bg-orange-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Add Syllabus
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search syllabuses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-orange-600" size={40} />
        </div>
      ) : filteredSyllabuses.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <BookMarked size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No syllabuses found</p>
          <p className="text-sm mt-2">Create your first syllabus to track progress</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSyllabuses.map((syllabus) => (
            <div key={syllabus.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition transform hover:scale-105">
              <div className="mb-4 pb-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">{syllabus.subject_name}</h3>
                <p className="text-sm text-gray-600 mt-1">{syllabus.section_name}</p>
                <p className="text-xs text-gray-500 mt-1">{syllabus.teacher_name || 'No teacher assigned'}</p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">Chapters</p>
                    <p className="text-2xl font-bold text-orange-600">{syllabus.total_chapters}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">Year</p>
                    <p className="text-sm font-bold text-blue-600 truncate">{formatAcademicYear(syllabus.academic_year)}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">Progress</span>
                    <span className="text-xs font-bold text-orange-600">{syllabus.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-orange-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${syllabus.progress_percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <button onClick={() => router.push(`/dashboard/academics/syllabus/${syllabus.id}`)} className="w-full mt-4 text-sm font-medium text-orange-600 hover:text-white bg-orange-50 hover:bg-orange-600 py-2 border border-orange-200 rounded-lg transition duration-200 flex items-center justify-center gap-2">
                <TrendingUp size={16} /> Track Progress
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Syllabus"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Create Syllabus"
        color="orange"
      />
    </div>
  );
}
