'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Calendar, Loader2, Search, Clock } from 'lucide-react';
import Modal from '@/components/Modal';

interface Timetable {
  id: string;
  section_name: string;
  created_at: string;
}

interface Section {
  id: string;
  full_name: string;
  grade_name: string;
}

export default function TimetablePage() {
  const router = useRouter();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    section_id: '',
  });

  useEffect(() => {
    fetchSchoolId();
    fetchTimetables();
    fetchSections();
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

  const fetchTimetables = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/timetables/');
      setTimetables(response.data);
    } catch (error) {
      console.error('Failed to load timetables', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get('/academics/sections/');
      setSections(response.data);
    } catch (error) {
      console.error('Failed to load sections', error);
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
      
      await api.post('/academics/timetables/', {
        section_id_write: data.section_id,
      });
      setShowModal(false);
      setFormData({ section_id: '' });
      fetchTimetables();
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData) {
        const errorMessages = Object.values(errorData).flat().join(', ');
        setError(errorMessages || 'Failed to create timetable');
      } else {
        setError('Failed to create timetable');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTimetables = timetables.filter(t =>
    t.section_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fields = [
    {
      name: 'section_id',
      label: 'Section',
      type: 'select' as const,
      required: true,
      options: sections.map(s => ({ value: s.id, label: `${s.grade_name} - ${s.full_name}` })),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Calendar size={32} /> Timetable Management
            </h1>
            <p className="text-green-100">Create and manage class schedules and periods</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-green-600 px-6 py-2 rounded-lg font-bold hover:bg-green-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Add Timetable
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search timetables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-green-600" size={40} />
        </div>
      ) : filteredTimetables.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No timetables found</p>
          <p className="text-sm mt-2">Create your first timetable to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTimetables.map((timetable) => (
            <div key={timetable.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition transform hover:scale-105">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{timetable.section_name}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-2">
                    <Clock size={16} className="text-green-500" /> Created {new Date(timetable.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-gray-600 mb-1">Schedule Status</p>
                <p className="text-sm font-semibold text-green-700">Ready to Manage</p>
              </div>
              <button className="w-full text-sm font-medium text-green-600 hover:text-white bg-green-50 hover:bg-green-600 py-2 border border-green-200 rounded-lg transition duration-200" onClick={() => router.push(`/dashboard/academics/timetable/${timetable.id}`)}>
                Manage Periods
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Timetable"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Create Timetable"
        color="green"
      />
    </div>
  );
}
