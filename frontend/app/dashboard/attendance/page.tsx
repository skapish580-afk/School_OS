'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Calendar, CheckCircle, XCircle, Clock,
  Save, Search, Filter, Loader2, Lock, Eye, EyeOff,
  AlertCircle, TrendingDown, Users, Unlock
} from 'lucide-react';
import { useResourcePermissions } from '@/lib/rbac-context';
import FeatureGuard from '@/components/FeatureGuard';
import PermissionDenied from '@/components/PermissionDenied';

export default function AttendancePage() {
  // Controls
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Data State
  const [session, setSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // RBAC Permissions
  const { canView: canViewAttendance, canCreate: canMarkAttendance, canEdit: canEditAttendance, loading: rbacLoading } = useResourcePermissions('attendance', 'attendance');

  // Status Colors Helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'bg-green-100 text-green-700 border-green-200';
      case 'ABSENT': return 'bg-red-100 text-red-700 border-red-200';
      case 'OUT': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return <CheckCircle size={16} />;
      case 'ABSENT': return <XCircle size={16} />;
      case 'LATE': return <Clock size={16} />;
      case 'OUT': return <AlertCircle size={16} />;
      default: return null;
    }
  };

  // Get user role and fetch initial data
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await api.get('/auth/me/');
        setUserRole(response.data.user_type);
      } catch (error) {
        console.error('Failed to fetch user role', error);
      }
    };

    const fetchGrades = async () => {
      try {
        const response = await api.get('/academics/grades/');
        const data = response.data.results || response.data;
        setGrades(data);
        if (data.length > 0) {
          setGrade(data[0].grade_name);
        }
      } catch (error) {
        console.error('Failed to fetch grades', error);
      }
    };

    const fetchSections = async () => {
      try {
        const response = await api.get('/academics/sections/');
        const data = response.data.results || response.data;
        setSections(data);
        if (data.length > 0) {
          setSection(data[0].section_letter);
        }
      } catch (error) {
        console.error('Failed to fetch sections', error);
      }
    };

    const fetchSubjectMappings = async () => {
      try {
        const response = await api.get('/academics/subject-mappings/');
        const data = response.data.results || response.data;
        setSubjectMappings(data);
      } catch (error) {
        console.error('Failed to fetch subject mappings', error);
      }
    };

    fetchUserRole();
    fetchGrades();
    fetchSections();
    fetchSubjectMappings();
  }, []);

  const isGrade11or12 = (g: string) => {
    const clean = g.toLowerCase().replace('grade', '').trim();
    return clean === '11' || clean === '12';
  };

  const isFutureDate = (d: string) => {
    if (!d) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return d > todayStr;
  };

  const isUnlockAllowed = (d: string) => {
    if (!d) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() - 2);
    limitDate.setHours(0,0,0,0);
    const sDate = new Date(d);
    sDate.setHours(0,0,0,0);
    return sDate >= limitDate;
  };

  const sectionObj = sections.find(
    (s) => s.grade_name === grade && s.section_letter === section
  );

  const allocatedSubjects = subjectMappings.filter((sm) => 
    sm.is_active && 
    (sm.section_id === sectionObj?.id || sm.section_name === `${grade}-${section}`)
  );

  // Auto-select first subject for grade 11/12
  useEffect(() => {
    if (isGrade11or12(grade) && allocatedSubjects.length > 0) {
      const exists = allocatedSubjects.some(s => s.subject_id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId(allocatedSubjects[0].subject_id);
      }
    } else {
      setSelectedSubjectId('');
    }
  }, [grade, section, subjectMappings, selectedSubjectId]);

  // Fetch Register
  const fetchRegister = async () => {
    setLoading(true);
    try {
      let url = `/attendance/daily_register/?grade=${grade}&section=${section}&date=${date}`;
      if (isGrade11or12(grade) && selectedSubjectId) {
        url += `&subject=${selectedSubjectId}`;
      }
      const response = await api.get(url);
      setSession(response.data);
      setStudents(response.data.records || []);
      setFilteredStudents(response.data.records || []);
    } catch (error) {
      console.error("Failed to load register", error);
      alert("Failed to load attendance register.");
    } finally {
      setLoading(false);
    }
  };

  // Load automatically when filters change
  useEffect(() => {
    if (grade && section) {
      const isHighSchool = isGrade11or12(grade);
      if (isHighSchool && !selectedSubjectId) {
        return;
      }
      fetchRegister();
    }
  }, [grade, section, date, selectedSubjectId]);

  // Filter students based on search query
  useEffect(() => {
    const filtered = students.filter(s =>
      s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_suid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.roll_number && s.roll_number.toString().includes(searchQuery))
    );
    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  // Toggle Status
  const toggleStatus = (studentId: number, currentStatus: string) => {
    if (session?.is_locked || isFutureDate(date)) return;
    if (!canMarkAttendance && !canEditAttendance) return; // RBAC check

    const statusCycle = ['PRESENT', 'ABSENT', 'OUT'];
    const nextIndex = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    setStudents(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, status: nextStatus } : s
    ));
  };

  // Handle remarks update
  const updateRemarks = (studentId: number, remarks: string) => {
    setStudents(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, remarks } : s
    ));
  };

  // Save Changes
  const handleSave = async () => {
    if (!session) return;
    setSaving(true);

    const updates = students.map(s => ({
      student_id: s.student_id,
      status: s.status,
      remarks: s.remarks,
      force_edit: userRole === 'ADMIN'
    }));

    try {
      await api.post(`/attendance/${session.id}/mark_bulk/`, { updates });
      alert("Attendance Saved Successfully!");
      fetchRegister(); // Refresh to confirm
    } catch (error) {
      console.error("Save failed", error);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleLockSession = async () => {
    if (!canMarkAttendance && !canEditAttendance) {
      alert("You do not have permission to lock attendance registers.");
      return;
    }

    try {
      await api.post(`/attendance/${session.id}/lock_session/`);
      fetchRegister();
      alert("Attendance register locked successfully");
    } catch (error) {
      console.error("Lock failed", error);
    }
  };

  const handleUnlockSession = async () => {
    if (!canMarkAttendance && !canEditAttendance) {
      alert("You do not have permission to unlock attendance registers.");
      return;
    }

    if (!isUnlockAllowed(date)) {
      alert("Unlocking is only allowed for the past 2 days' attendance.");
      return;
    }

    try {
      await api.post(`/attendance/${session.id}/unlock_session/`);
      fetchRegister();
      alert("Attendance register unlocked successfully");
    } catch (error) {
      console.error("Unlock failed", error);
      const errMsg = (error as any).response?.data?.error || "Unlock failed.";
      alert(errMsg);
    }
  };

  // Calculate stats
  const stats = {
    total: session?.total_students || 0,
    present: session?.present_count || 0,
    absent: session?.absent_count || 0,
    late: session?.late_count || 0,
    out: session?.out_count || 0
  };

  if (rbacLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="animate-spin text-blue-600" size={50} />
      </div>
    );
  }

  if (!canViewAttendance) {
    return <PermissionDenied title="Access Denied" message="You do not have permission to view attendance registers." />;
  }

  return (
    <FeatureGuard feature="ATTENDANCE">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
                <CheckCircle size={32} /> Daily Attendance Register
              </h1>
              <p className="text-blue-100">Manage attendance for {date}</p>
            </div>

            <div className="flex gap-2">
              {session?.is_locked ? (
                <button
                  onClick={handleUnlockSession}
                  disabled={(!canMarkAttendance && !canEditAttendance) || !isUnlockAllowed(date)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-lg font-semibold transition"
                >
                  <Unlock size={18} /> Unlock
                </button>
              ) : (
                <button
                  onClick={handleLockSession}
                  disabled={(!canMarkAttendance && !canEditAttendance) || isFutureDate(date)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-lg font-semibold transition"
                >
                  <Lock size={18} /> Lock Register
                </button>
              )}
            </div>
          </div>
        </div>

        {isFutureDate(date) && (
          <div className="p-4 bg-amber-50 border border-amber-250 rounded-xl text-amber-800 text-center font-bold text-lg shadow-sm">
            ⚠️ Attendance cannot be marked for future dates.
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Total" value={stats.total} color="bg-blue-500" />
          <StatBox label="Present" value={stats.present} color="bg-green-500" />
          <StatBox label="Absent" value={stats.absent} color="bg-red-500" />
          <StatBox label="Out" value={stats.out} color="bg-purple-500" />
        </div>

        {/* Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex gap-3 flex-1">
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.grade_name}>
                    {g.grade_name}
                  </option>
                ))}
              </select>

              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {Array.from(new Set(sections.map(s => s.section_letter))).map((letter) => (
                  <option key={letter} value={letter}>
                    Section {letter}
                  </option>
                ))}
              </select>

              {isGrade11or12(grade) && (
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">Select Subject</option>
                  {allocatedSubjects.map((sm) => (
                    <option key={sm.id} value={sm.subject_id}>
                      {sm.subject_name} ({sm.subject_code})
                    </option>
                  ))}
                </select>
              )}

              {isGrade11or12(grade) && allocatedSubjects.length === 0 && (
                <span className="text-xs text-red-500 flex items-center gap-1 font-semibold self-center">
                  ⚠️ No subjects allocated
                </span>
              )}

              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
            >
              {showDetails ? <EyeOff size={18} /> : <Eye size={18} />}
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SUID, or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center gap-6 text-sm font-semibold">
              <span className="flex items-center gap-2 text-green-700">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Present: {stats.present}
              </span>
              <span className="flex items-center gap-2 text-red-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Absent: {stats.absent}
              </span>
            </div>

            {session?.is_locked && (
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
                <Lock size={16} /> Register Locked
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="p-12 flex justify-center items-center flex-col gap-3 text-gray-500">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="font-semibold">Generating Attendance Register...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 flex justify-center items-center flex-col gap-3 text-gray-500">
              <Users size={40} className="text-gray-300" />
              <p className="font-semibold">No students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-6 py-4">Roll No</th>
                    <th className="px-6 py-4">Name</th>
                    {showDetails && <th className="px-6 py-4">SUID</th>}
                    {showDetails && <th className="px-6 py-4">Email</th>}
                    <th className="px-6 py-4 text-center">Status</th>
                    {showDetails && <th className="px-6 py-4">Remarks</th>}
                    {showDetails && <th className="px-6 py-4">Marked By</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.map((record) => (
                    <tr key={record.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-600">
                        #{record.roll_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{record.student_name}</div>
                      </td>
                      {showDetails && (
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          {record.student_suid}
                        </td>
                      )}
                      {showDetails && (
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {record.student?.email || '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleStatus(record.student_id, record.status)}
                          disabled={session?.is_locked || isFutureDate(date)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${getStatusColor(record.status)} ${session?.is_locked || isFutureDate(date) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md active:scale-95'}`}
                        >
                          {getStatusIcon(record.status)}
                          {record.status}
                        </button>
                      </td>
                      {showDetails && (
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            placeholder="Add note..."
                            value={record.remarks || ''}
                            onChange={(e) => updateRemarks(record.student_id, e.target.value)}
                            disabled={session?.is_locked || isFutureDate(date)}
                            className="text-xs bg-transparent border-b border-transparent focus:border-blue-400 outline-none w-full text-gray-600 placeholder-gray-300 disabled:opacity-50"
                          />
                        </td>
                      )}
                      {showDetails && (
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {record.marked_by_name || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Floating Save Bar */}
        <div className="fixed bottom-6 right-6 flex gap-3">
          {isFutureDate(date) ? (
            <div className="bg-amber-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold opacity-75">
              ⚠️ Future Date
            </div>
          ) : session?.is_locked ? (
            <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold">
              <Lock size={18} /> Register Locked
            </div>
          ) : canMarkAttendance || canEditAttendance ? (
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold transition-all hover:scale-105 disabled:opacity-70 disabled:scale-100"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          ) : (
            <div className="bg-gray-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold opacity-75">
              <Lock size={18} /> View Only
            </div>
          )}
        </div>
      </div>
    </FeatureGuard>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} text-white rounded-xl p-4 shadow-md`}>
      <div className="text-sm font-semibold opacity-90">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}