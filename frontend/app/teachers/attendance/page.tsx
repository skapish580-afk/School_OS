'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Users, Check, X, Clock, Save, AlertTriangle,
  Search, Filter, CheckCircle, Eye
} from 'lucide-react';
import { useNotification } from '@/lib/NotificationContext';

interface Student {
  id: string;
  suid: string;
  name: string;
  roll_number: string;
  photo?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

interface ClassInfo {
  id: string;
  subject: string;
  grade: string;
  section: string;
  period: number;
  date: string;
}

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get('class');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL');
  const { showNotification } = useNotification();

  useEffect(() => {
    if (classId) {
      fetchClassData();
    } else {
      setLoading(false);
    }
  }, [classId]);

  const fetchClassData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');

      if (classId) {
        // Parse classId format: "assignmentId_period" or just "assignmentId"
        const parts = classId.includes('_') ? classId.split('_') : [classId, '1'];
        const [assignmentId, period] = parts;

        const response = await axios.get(
          `http://localhost:8000/api/v1/attendance/class/${assignmentId}/period/${period}/students/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setClassInfo(response.data.class_info);
        setStudents(response.data.students);
      } else {
        // No class selected, show message
        setClassInfo(null);
        setStudents([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch class data', error);
      if (error.response?.status === 404) {
        const errorMsg = error.response?.data?.error || 'Class has no students enrolled';
        showNotification(`${errorMsg}. This class assignment exists but has no students. Please check with admin.`, 'error');
      } else if (error.response?.status === 401) {
        showNotification('Session expired. Please login again.', 'error');
        window.location.href = '/login';
      } else {
        showNotification('Failed to load students. Please try again.', 'error');
      }
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentStatus = (studentId: string, newStatus: 'PRESENT' | 'ABSENT' | 'LATE') => {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, status: newStatus } : s)
    );
  };

  const handleSave = async () => {
    if (!classInfo) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');

      const attendanceData = students.map(student => ({
        student_id: parseInt(student.id),
        status: student.status,
        marked_at: new Date().toISOString()
      }));

      await axios.post(
        'http://localhost:8000/api/v1/attendance/mark-bulk/',
        {
          assignment_id: classInfo.id,
          period: classInfo.period,
          attendance: attendanceData
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Attendance saved successfully!', 'success');
      window.history.back();
    } catch (error: any) {
      console.error('Failed to save attendance', error);
      showNotification(`Failed to save attendance: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.suid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.includes(searchTerm);
    const matchesFilter = filterStatus === 'ALL' || s.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    present: students.filter(s => s.status === 'PRESENT').length,
    absent: students.filter(s => s.status === 'ABSENT').length,
    late: students.filter(s => s.status === 'LATE').length,
    total: students.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md w-full px-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-6"></div>
          <div className="text-gray-900 text-xl font-semibold mb-3">Loading students...</div>
          <div className="text-gray-600 mb-6">Fetching class data and student list</div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-green-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!classId || !classInfo) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Class Selected</h2>
          <p className="text-gray-600 mb-4">Please select a class from the dashboard to mark attendance.</p>
          <button
            onClick={() => window.location.href = '/teachers'}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-600">Class not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mark Attendance</h1>
          <p className="text-gray-600 mt-1">
            {classInfo.subject} • Grade {classInfo.grade}{classInfo.section} • Period {classInfo.period}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-3xl font-bold text-blue-700">{stats.total}</div>
          <div className="text-blue-600 text-sm">Total Students</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-3xl font-bold text-green-700">{stats.present}</div>
          <div className="text-green-600 text-sm">Present</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-3xl font-bold text-red-700">{stats.absent}</div>
          <div className="text-red-600 text-sm">Absent</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-3xl font-bold text-orange-700">{stats.late}</div>
          <div className="text-orange-600 text-sm">Late</div>
        </div>
      </div>

      {/* One-Tap Concept Explanation */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-green-900">Smart Default: All Present ✨</div>
            <div className="text-sm text-green-700 mt-1">
              All students are marked PRESENT by default. Only tap those who are ABSENT or LATE. This saves 90% of your time!
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SUID, or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="ALL">All Students</option>
            <option value="PRESENT">Present Only</option>
            <option value="ABSENT">Absent Only</option>
            <option value="LATE">Late Only</option>
          </select>
        </div>
      </div>

      {/* Student Grid - ONE-TAP INTERFACE */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {filteredStudents.map((student, index) => (
            <div
              key={student.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${student.status === 'PRESENT' ? 'bg-white' :
                  student.status === 'ABSENT' ? 'bg-red-50' :
                    'bg-orange-50'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                    {student.roll_number}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{student.name}</div>
                    <div className="text-xs text-gray-500">{student.suid}</div>
                  </div>
                  <button
                    onClick={() => {
                      console.log('Navigating to student profile:', student);
                      router.push(`/teachers/student?id=${student.id}&name=${encodeURIComponent(student.name)}`);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                    title="View profile"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleStudentStatus(student.id, 'PRESENT')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${student.status === 'PRESENT'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <Check className="inline h-4 w-4 mr-1" />
                  Present
                </button>
                <button
                  onClick={() => toggleStudentStatus(student.id, 'ABSENT')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${student.status === 'ABSENT'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <X className="inline h-4 w-4 mr-1" />
                  Absent
                </button>
                <button
                  onClick={() => toggleStudentStatus(student.id, 'LATE')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${student.status === 'LATE'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <Clock className="inline h-4 w-4 mr-1" />
                  Late
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button - Bottom */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}
