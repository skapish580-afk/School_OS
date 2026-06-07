'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Loader2, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import Modal from '@/components/Modal';

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, rejected, completed

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transfersRes, studentsRes, schoolsRes] = await Promise.all([
        api.get('/transfers/'),
        api.get('/students/'),
        api.get('/schools/')
      ]);
      setTransfers(transfersRes.data);
      setStudents(studentsRes.data);
      setSchools(schoolsRes.data);
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
      // Find student's active enrollment
      const enrollmentRes = await api.get(`/enrollments/?student=${data.student}&status=ACTIVE`);
      if (!enrollmentRes.data.length) {
        setError('No active enrollment found for student');
        return;
      }

      await api.post('/transfers/', {
        student_enrollment: enrollmentRes.data[0].id,
        target_school: data.target_school,
        reason: data.reason,
        status: 'PENDING',
      });
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create transfer request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (transferId: string, newStatus: string, remarks?: string) => {
    try {
      await api.patch(`/transfers/${transferId}/`, {
        status: newStatus,
        admin_remarks: remarks || '',
        resolution_date: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (err: any) {
      alert('Failed to update transfer status');
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
      name: 'target_school',
      label: 'Transfer To School',
      type: 'select' as const,
      required: true,
      options: schools.map(sch => ({
        value: sch.id.toString(),
        label: sch.name
      })),
    },
    {
      name: 'reason',
      label: 'Reason for Transfer',
      type: 'textarea' as const,
      required: true,
      placeholder: 'Parent relocation, Better facilities, etc.',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const pendingTransfers = transfers.filter(t => t.status === 'PENDING');
  const approvedTransfers = transfers.filter(t => t.status === 'APPROVED');
  const rejectedTransfers = transfers.filter(t => t.status === 'REJECTED');
  const completedTransfers = transfers.filter(t => t.status === 'COMPLETED');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="text-yellow-600" size={20} />;
      case 'APPROVED': return <CheckCircle className="text-green-600" size={20} />;
      case 'REJECTED': return <XCircle className="text-red-600" size={20} />;
      case 'COMPLETED': return <CheckCircle className="text-blue-600" size={20} />;
      default: return <AlertTriangle className="text-gray-600" size={20} />;
    }
  };

  const renderTransfers = (transferList: any[]) => {
    if (transferList.length === 0) {
      return (
        <div className="text-center py-12 text-gray-400">
          <ArrowRightLeft size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No transfers in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {transferList.map((transfer) => (
          <div
            key={transfer.id}
            className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 transition"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center">
                  <ArrowRightLeft className="text-white" size={24} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {transfer.student_details?.student_name || 'Student'}
                    </h3>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      transfer.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      transfer.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      transfer.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {transfer.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <strong>From:</strong> {transfer.student_details?.school_name || 'Current School'}
                    </div>
                    <div>
                      <strong>To:</strong> {transfer.target_school_name}
                    </div>
                    <div>
                      <strong>Reason:</strong> {transfer.reason}
                    </div>
                    {transfer.admin_remarks && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <strong>Admin Remarks:</strong> {transfer.admin_remarks}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Requested on {new Date(transfer.request_date).toLocaleDateString()}
                      {transfer.resolution_date && ` • Resolved on ${new Date(transfer.resolution_date).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              </div>

              {transfer.status === 'PENDING' && (
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      const remarks = prompt('Add remarks (optional):');
                      handleUpdateStatus(transfer.id, 'APPROVED', remarks || '');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const remarks = prompt('Reason for rejection:');
                      if (remarks) handleUpdateStatus(transfer.id, 'REJECTED', remarks);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}

              {transfer.status === 'APPROVED' && (
                <button
                  onClick={() => handleUpdateStatus(transfer.id, 'COMPLETED', 'Transfer completed')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm ml-4"
                >
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">↔️ Transfer Requests</h1>
          <p className="text-gray-600 mt-1">Inter-school transfer management with approval workflow</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Plus size={20} /> New Transfer Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingTransfers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{approvedTransfers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">{rejectedTransfers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{completedTransfers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-2 font-medium transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={16} /> Pending ({pendingTransfers.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`pb-3 px-2 font-medium transition flex items-center gap-2 ${
              activeTab === 'approved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle size={16} /> Approved ({approvedTransfers.length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`pb-3 px-2 font-medium transition flex items-center gap-2 ${
              activeTab === 'rejected'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <XCircle size={16} /> Rejected ({rejectedTransfers.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-2 font-medium transition flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle size={16} /> Completed ({completedTransfers.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'pending' && renderTransfers(pendingTransfers)}
        {activeTab === 'approved' && renderTransfers(approvedTransfers)}
        {activeTab === 'rejected' && renderTransfers(rejectedTransfers)}
        {activeTab === 'completed' && renderTransfers(completedTransfers)}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Transfer Request"
        fields={fields}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Submit Request"
        color="orange"
      />
    </div>
  );
}
