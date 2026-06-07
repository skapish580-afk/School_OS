'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Loader2, Heart, Activity, Users, Calendar } from 'lucide-react';
import Modal from '@/components/Modal';

export default function HealthPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    student: '',
    symptom: '',
    treatment_given: '',
    sent_home: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, visitsRes] = await Promise.all([
        api.get('/students/'),
        api.get('/health/visits/')
      ]);
      setStudents(studentsRes.data);
      setVisits(visitsRes.data);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/health/visits/', {
        student: data.student,
        symptom: data.symptom,
        treatment_given: data.treatment_given,
        sent_home: data.sent_home,
      });
      setShowModal(false);
      setFormData({ student: '', symptom: '', treatment_given: '', sent_home: false });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to log visit');
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    {
      name: 'student',
      label: 'Student',
      type: 'select' as const,
      required: true,
      options: students.map(s => ({
        value: s.id.toString(),
        label: `${s.full_name || s.user?.full_name} (${s.suid})`
      })),
    },
    {
      name: 'symptom',
      label: 'Symptom/Complaint',
      type: 'text' as const,
      required: true,
      placeholder: 'Headache, Fever, Injury, etc.',
    },
    {
      name: 'treatment_given',
      label: 'Treatment Given',
      type: 'textarea' as const,
      required: true,
      placeholder: 'Paracetamol given, Ice pack applied, etc.',
    },
    {
      name: 'sent_home',
      label: 'Student Sent Home?',
      type: 'checkbox' as const,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-pink-600" size={40} />
      </div>
    );
  }

  // Stats
  const todayVisits = visits.filter(v => 
    new Date(v.visit_date).toDateString() === new Date().toDateString()
  );
  const sentHomeToday = todayVisits.filter(v => v.sent_home);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Health Center</h1>
          <p className="text-gray-600 mt-1">Student health records & clinic visits</p>
        </div>
        <button
          onClick={() => {
            setFormData({ student: '', symptom: '', treatment_given: '', sent_home: false });
            setShowModal(true);
          }}
          className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Plus size={20} /> Log Visit
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-gray-900">{visits.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Calendar size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Visits</p>
              <p className="text-2xl font-bold text-gray-900">{todayVisits.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Activity size={24} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sent Home Today</p>
              <p className="text-2xl font-bold text-gray-900">{sentHomeToday.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Clinic Visits</h2>
        {visits.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Heart size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No clinic visits recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.slice(0, 20).map((visit) => (
              <div key={visit.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                  <span className="font-bold text-lg leading-none text-pink-600">
                    {new Date(visit.visit_date).getDate()}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-pink-600">
                    {new Date(visit.visit_date).toLocaleString('default', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{visit.student_name}</span>
                    <span className="text-xs text-gray-500 font-mono">{visit.student_suid}</span>
                    {visit.sent_home && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">
                        Sent Home
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Symptom:</strong> {visit.symptom}
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>Treatment:</strong> {visit.treatment_given}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    By: {visit.nurse_name} • {new Date(visit.visit_date).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Log Clinic Visit"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Log Visit"
        color="red"
      />
    </div>
  );
}
