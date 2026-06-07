'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Plus, X, Loader2, Clock, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';

interface Period {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  teacher_name: string | null;
}

interface Timetable {
  id: string;
  section_name: string;
  section_id: string;
  created_at: string;
}

interface Subject {
  id: string;
  name: string;
}

export default function TimetableDetailPage() {
  const params = useParams();
  const timetableId = params?.id as string;
  
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    day: 'MON',
    period_number: '1',
    start_time: '09:00',
    end_time: '10:00',
    subject_id: '',
  });

  useEffect(() => {
    if (timetableId) {
      fetchTimetableDetails();
      fetchPeriods();
    }
  }, [timetableId]);

  const fetchTimetableDetails = async () => {
    try {
      const response = await api.get(`/academics/timetables/${timetableId}/`);
      setTimetable(response.data);
      if (response.data.section_id) {
        fetchSubjects();
      }
    } catch (error) {
      console.error('Failed to load timetable', error);
      setError('Failed to load timetable details');
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.get(`/academics/subjects/`);
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to load subjects', error);
    }
  };

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/academics/periods/?timetable=${timetableId}`);
      setPeriods(response.data);
    } catch (error) {
      console.error('Failed to load periods', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/academics/periods/${editingId}/`, {
          timetable_id: timetableId,
          day: data.day,
          period_number: parseInt(data.period_number as string),
          start_time: data.start_time,
          end_time: data.end_time,
          subject_id: data.subject_id,
        });
      } else {
        await api.post('/academics/periods/', {
          timetable_id: timetableId,
          day: data.day,
          period_number: parseInt(data.period_number as string),
          start_time: data.start_time,
          end_time: data.end_time,
          subject_id: data.subject_id,
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({
        day: 'MON',
        period_number: '1',
        start_time: '09:00',
        end_time: '10:00',
        subject_id: '',
      });
      fetchPeriods();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save period');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (periodId: string) => {
    if (confirm('Are you sure you want to delete this period?')) {
      try {
        await api.delete(`/academics/periods/${periodId}/`);
        fetchPeriods();
      } catch (error) {
        setError('Failed to delete period');
      }
    }
  };

  const handleEdit = (period: Period) => {
    setEditingId(period.id);
    setFormData({
      day: period.day_of_week,
      period_number: period.period_number.toString(),
      start_time: period.start_time,
      end_time: period.end_time,
      subject_id: '',
    });
    setShowModal(true);
  };

  const fields = [
    {
      name: 'day',
      label: 'Day of Week',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'MON', label: 'Monday' },
        { value: 'TUE', label: 'Tuesday' },
        { value: 'WED', label: 'Wednesday' },
        { value: 'THU', label: 'Thursday' },
        { value: 'FRI', label: 'Friday' },
        { value: 'SAT', label: 'Saturday' },
      ],
    },
    {
      name: 'period_number',
      label: 'Period Number',
      type: 'number' as const,
      required: true,
      min: 1,
    },
    {
      name: 'start_time',
      label: 'Start Time (HH:MM)',
      type: 'text' as const,
      required: true,
      placeholder: '09:00',
    },
    {
      name: 'end_time',
      label: 'End Time (HH:MM)',
      type: 'text' as const,
      required: true,
      placeholder: '10:00',
    },
    {
      name: 'subject_id',
      label: 'Subject',
      type: 'select' as const,
      required: true,
      options: subjects.map(s => ({ value: s.id, label: s.name })),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-green-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/timetable" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Periods</h1>
          <p className="text-gray-600 mt-1">{timetable?.section_name}</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
        <p className="text-sm text-green-800">
          <strong>Tip:</strong> Create periods for each day and time slot. Assign subjects to make the schedule complete.
        </p>
      </div>

      {/* Add Button */}
      <button
        onClick={() => {
          setEditingId(null);
          setFormData({
            day: 'MON',
            period_number: '1',
            start_time: '09:00',
            end_time: '10:00',
            subject_id: '',
          });
          setShowModal(true);
        }}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
      >
        <Plus size={20} /> Add Period
      </button>

      {/* Periods List */}
      {periods.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <Clock size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No periods defined yet</p>
          <p className="text-sm mt-2">Add periods to create the daily schedule</p>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => (
            <div key={period.id} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="font-bold text-lg text-gray-900">Period {period.period_number}</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                      {period.day_of_week}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-600">{period.start_time} - {period.end_time}</span>
                    </div>
                    {period.subject_name && (
                      <div>
                        <span className="text-gray-600">{period.subject_name}</span>
                        {period.teacher_name && (
                          <span className="text-gray-500 ml-2">({period.teacher_name})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(period)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(period.id)}
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
        title={editingId ? 'Edit Period' : 'Add Period'}
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText={editingId ? 'Update Period' : 'Add Period'}
        color="green"
      />
    </div>
  );
}
