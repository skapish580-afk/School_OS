'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Loader2, AlertCircle, TrendingUp, Star, Award } from 'lucide-react';
import Modal from '@/components/Modal';
import { useResourcePermissions } from '@/lib/rbac-context';

export default function DisciplinePage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [karmaHistory, setKarmaHistory] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incidents');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showKarmaModal, setShowKarmaModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // RBAC Permissions
  const { canCreate: canReportIncident } = useResourcePermissions('discipline', 'incident');
  const { canCreate: canAwardKarma } = useResourcePermissions('discipline', 'karma');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incidentsRes, karmaRes, studentsRes] = await Promise.all([
        api.get('/discipline/'),
        api.get('/discipline/karma_history/'),
        api.get('/students/')
      ]);
      setIncidents(incidentsRes.data);
      setKarmaHistory(karmaRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIncidentSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/discipline/', {
        student: data.student,
        incident_type: data.incident_type,
        description: data.description,
        severity: data.severity,
        action_taken: data.action_taken || ''
      });
      setShowIncidentModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKarmaSubmit = async (data: Record<string, string | number | boolean>) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/discipline/award_karma/', {
        student: data.student,
        points: data.points,
        reason: data.reason
      });
      setShowKarmaModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to award karma');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      LOW: 'bg-yellow-100 text-yellow-800',
      MEDIUM: 'bg-orange-100 text-orange-800',
      HIGH: 'bg-red-100 text-red-800'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getActionBadge = (action: string) => {
    const colors = {
      WARNING: 'bg-yellow-100 text-yellow-800',
      DETENTION: 'bg-orange-100 text-orange-800',
      SUSPENSION: 'bg-red-100 text-red-800',
      EXPULSION: 'bg-red-200 text-red-900',
      NONE: 'bg-gray-100 text-gray-800'
    };
    return colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Discipline & Karma</h1>
          <p className="text-gray-600 mt-1">Track behavior incidents and award positive karma points</p>
        </div>
        <div className="flex gap-3">
          {canReportIncident && (
            <button
              onClick={() => setShowIncidentModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
            >
              <AlertCircle size={18} />
              Report Incident
            </button>
          )}
          {canAwardKarma && (
            <button
              onClick={() => setShowKarmaModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Star size={18} />
              Award Karma
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {['incidents', 'karma'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="grid gap-4">
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No incidents reported yet</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {incident.student_name || `Student ID: ${incident.student}`}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityBadge(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getActionBadge(incident.action_taken)}`}>
                        {incident.action_taken}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Type:</span> {incident.incident_type}
                    </p>
                    <p className="text-sm text-gray-700">{incident.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(incident.date_occurred).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Karma Tab */}
      {activeTab === 'karma' && (
        <div className="grid gap-4">
          {karmaHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Star size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No karma points awarded yet</p>
            </div>
          ) : (
            karmaHistory.map((karma) => (
              <div key={karma.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Star size={24} className="text-yellow-600" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {karma.student_name || `Student ID: ${karma.student}`}
                      </h3>
                      <p className="text-sm text-gray-700">{karma.reason}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(karma.date_awarded).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">+{karma.points}</div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Incident Modal */}
      {showIncidentModal && (
        <Modal
          title="Report Behavior Incident"
          onClose={() => setShowIncidentModal(false)}
          fields={[
            {
              name: 'student',
              label: 'Student',
              type: 'select',
              required: true,
              options: students.map(s => ({
                value: s.id,
                label: s.full_name || `${s.first_name} ${s.last_name}`
              }))
            },
            {
              name: 'incident_type',
              label: 'Incident Type',
              type: 'select',
              required: true,
              options: [
                { value: 'FIGHTING', label: 'Fighting' },
                { value: 'BULLYING', label: 'Bullying' },
                { value: 'DISRUPTIVE', label: 'Disruptive Behavior' },
                { value: 'TRUANCY', label: 'Truancy' },
                { value: 'VANDALISM', label: 'Vandalism' },
                { value: 'OTHER', label: 'Other' }
              ]
            },
            {
              name: 'severity',
              label: 'Severity',
              type: 'select',
              required: true,
              options: [
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' }
              ]
            },
            {
              name: 'description',
              label: 'Description',
              type: 'textarea',
              required: true,
              placeholder: 'Describe what happened...'
            },
            {
              name: 'action_taken',
              label: 'Action Taken',
              type: 'select',
              required: false,
              options: [
                { value: 'NONE', label: 'None' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'DETENTION', label: 'Detention' },
                { value: 'SUSPENSION', label: 'Suspension' },
                { value: 'EXPULSION', label: 'Expulsion' }
              ]
            }
          ]}
          onSubmit={handleIncidentSubmit}
          submitLabel="Report Incident"
          loading={submitting}
          error={error}
        />
      )}

      {/* Karma Modal */}
      {showKarmaModal && (
        <Modal
          title="Award Karma Points"
          onClose={() => setShowKarmaModal(false)}
          fields={[
            {
              name: 'student',
              label: 'Student',
              type: 'select',
              required: true,
              options: students.map(s => ({
                value: s.id,
                label: s.full_name || `${s.first_name} ${s.last_name}`
              }))
            },
            {
              name: 'points',
              label: 'Points',
              type: 'number',
              required: true,
              placeholder: '10'
            },
            {
              name: 'reason',
              label: 'Reason',
              type: 'textarea',
              required: true,
              placeholder: 'Why are you awarding these points?'
            }
          ]}
          onSubmit={handleKarmaSubmit}
          submitLabel="Award Karma"
          loading={submitting}
          error={error}
        />
      )}
    </div>
  );
}
