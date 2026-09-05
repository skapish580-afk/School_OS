'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Calendar, CheckCircle, XCircle, Clock,
  Save, Search, Filter, Loader2, Lock, Eye, EyeOff,
  AlertCircle, Users, Unlock, Sparkles, Check, X, ShieldAlert
} from 'lucide-react';
import { useResourcePermissions } from '@/lib/rbac-context';
import FeatureGuard from '@/components/FeatureGuard';
import PermissionDenied from '@/components/PermissionDenied';

export default function TeacherPortalAttendancePage() {
  // Controls
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Class Teacher assignment status & All assigned classes
  const [isClassTeacher, setIsClassTeacher] = useState<boolean | null>(null);
  const [classTeacherRoleInfo, setClassTeacherRoleInfo] = useState<string>('');
  const [teacherClasses, setTeacherClasses] = useState<Array<{ grade: string; section: string; role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER'; label: string }>>([]);

  // Data State
  const [session, setSession] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [subjectMappings, setSubjectMappings] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // RBAC Permissions
  const { canView: canViewAttendance, canCreate: canMarkAttendance, canEdit: canEditAttendance, loading: rbacLoading } = useResourcePermissions('attendance', 'attendance');

  // Status Colors Helper matching Green/Emerald Teacher theme
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'ABSENT':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300';
      case 'OUT':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return <CheckCircle size={16} className="text-emerald-600" />;
      case 'ABSENT': return <XCircle size={16} className="text-rose-600" />;
      case 'LATE': return <Clock size={16} className="text-amber-600" />;
      case 'OUT': return <AlertCircle size={16} className="text-purple-600" />;
      default: return null;
    }
  };

  const normalizeGrade = (g: string) => {
    if (!g) return '';
    return g.toLowerCase().replace('grade', '').trim();
  };

  // Fetch Teacher's Assigned Classes
  useEffect(() => {
    const initAssignments = async () => {
      try {
        const [meRes, response, sectionsRes] = await Promise.all([
          api.get('/auth/me/').catch(() => ({ data: null })),
          api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] })),
          api.get('/academics/sections/').catch(() => ({ data: [] }))
        ]);

        const meUser = meRes.data;
        const assignments = Array.isArray(response.data) ? response.data : response.data.results || [];
        const sectionsData = Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || [];

        const classList: Array<{ grade: string; section: string; role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER'; label: string }> = [];

        // 1. Class Teacher sections from sectionsData (strictly match teacher_profile ID)
        if (meUser && meUser.teacher_profile) {
          const myTeacherId = String(meUser.teacher_profile.id);
          sectionsData.forEach((s: any) => {
            const ctId = s.class_teacher_info?.id || s.class_teacher_id || s.class_teacher;
            if (ctId && String(ctId) === myTeacherId) {
              const rawG = (s.grade_name || '').toString().trim();
              const rawS = (s.section_letter || '').toString().trim().toUpperCase();
              if (rawG && rawS) {
                classList.push({
                  grade: rawG,
                  section: rawS,
                  role: 'CLASS_TEACHER',
                  label: `Grade ${rawG} - Section ${rawS} (Class Teacher - Full Access)`
                });
              }
            }
          });
        }

        // 2. Add classes from Teacher assignments
        assignments.forEach((a: any) => {
          if (a.grade && a.section) {
            const rawG = a.grade.toString().trim();
            const rawS = a.section.toString().trim().toUpperCase();
            const isCT = a.role === 'CLASS_TEACHER';
            const roleStr: 'CLASS_TEACHER' | 'SUBJECT_TEACHER' = isCT ? 'CLASS_TEACHER' : 'SUBJECT_TEACHER';

            const existingIdx = classList.findIndex(c => c.grade === rawG && c.section === rawS);
            if (existingIdx === -1) {
              classList.push({
                grade: rawG,
                section: rawS,
                role: roleStr,
                label: `Grade ${rawG} - Section ${rawS} (${isCT ? 'Class Teacher - Full Access' : 'Subject Teacher - Read Only'})`
              });
            } else if (isCT) {
              classList[existingIdx].role = 'CLASS_TEACHER';
              classList[existingIdx].label = `Grade ${rawG} - Section ${rawS} (Class Teacher - Full Access)`;
            }
          }
        });

        setTeacherClasses(classList);

        // Select initial class: Class Teacher class first, or fallback to first assigned class
        const defaultClass = classList.find(c => c.role === 'CLASS_TEACHER') || classList[0];
        if (defaultClass) {
          setGrade(defaultClass.grade);
          setSection(defaultClass.section);
          setIsClassTeacher(defaultClass.role === 'CLASS_TEACHER');
          setClassTeacherRoleInfo(`Grade ${defaultClass.grade} - Section ${defaultClass.section}`);
        } else {
          setIsClassTeacher(false);
        }
      } catch (error) {
        console.error('Failed to load teacher assignments', error);
        setIsClassTeacher(false);
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

    initAssignments();
    fetchSubjectMappings();
  }, []);

  const isGrade11or12 = (g: string) => {
    const clean = normalizeGrade(g);
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

  const allocatedSubjects = subjectMappings.filter((sm) => 
    sm.is_active && 
    (sm.section_name === `${grade}-${section}` || sm.section_name === `Grade ${grade}-${section}`)
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
    if (!grade || !section) return;
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
    } finally {
      setLoading(false);
    }
  };

  // Load automatically when filters change
  useEffect(() => {
    if (grade && section) {
      const isHighSchool = isGrade11or12(grade);
      if (!isHighSchool || (isHighSchool && selectedSubjectId)) {
        fetchRegister();
      }
    }
  }, [grade, section, date, selectedSubjectId]);

  // Filter students by search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredStudents(
        students.filter(
          (s) =>
            s.student_name.toLowerCase().includes(q) ||
            s.suid.toLowerCase().includes(q) ||
            (s.roll_number && s.roll_number.toString().includes(q))
        )
      );
    }
  }, [searchQuery, students]);

  // Quick Action Handlers
  const handleMarkAllPresent = () => {
    if (session?.is_locked) return;
    setStudents((prev) =>
      prev.map((s) => ({ ...s, status: 'PRESENT' }))
    );
  };

  const handleMarkAllAbsent = () => {
    if (session?.is_locked) return;
    setStudents((prev) =>
      prev.map((s) => ({ ...s, status: 'ABSENT' }))
    );
  };

  const handleStatusChange = (studentId: string, newStatus: string) => {
    if (session?.is_locked) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: newStatus } : s))
    );
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    if (session?.is_locked) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, remarks: remark } : s))
    );
  };

  const handleSaveRegister = async () => {
    if (isFutureDate(date)) {
      alert("Cannot mark attendance for future dates.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        session_id: session.id,
        records: students.map((s) => ({
          id: s.id,
          status: s.status,
          remarks: s.remarks || ''
        }))
      };

      await api.post('/attendance/batch_update/', payload);
      fetchRegister();
      alert("Attendance register saved successfully!");
    } catch (error) {
      console.error("Save failed", error);
      alert("Failed to save attendance register.");
    } finally {
      setSaving(false);
    }
  };

  const handleLockSession = async () => {
    if (isFutureDate(date)) {
      alert("Cannot lock attendance for future dates.");
      return;
    }

    if (!confirm('Are you sure you want to lock the attendance register? Once locked, entries cannot be modified without unlocking.')) {
      return;
    }

    try {
      await api.post(`/attendance/${session.id}/lock_session/`);
      fetchRegister();
      alert("Attendance register locked successfully");
    } catch (error) {
      console.error("Lock failed", error);
      alert("Failed to lock register.");
    }
  };

  const handleUnlockSession = async () => {
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
        <Loader2 className="animate-spin text-green-700" size={48} />
      </div>
    );
  }

  if (!canViewAttendance) {
    return <PermissionDenied title="Access Denied" message="You do not have permission to view attendance registers." />;
  }

  return (
    <FeatureGuard feature="ATTENDANCE">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Section - Custom Teacher Portal Green Design */}
        <div className="bg-gradient-to-r from-green-700 via-green-800 to-emerald-900 text-white p-6 rounded-2xl shadow-md border border-green-600/30">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 text-green-200 text-xs font-semibold uppercase tracking-wider mb-1">
                <Sparkles size={14} /> Teacher Attendance Register
              </div>
              <h1 className="text-3xl font-extrabold flex items-center gap-2">
                Daily Class Attendance
              </h1>
              <p className="text-green-100 text-sm mt-1">
                {isClassTeacher ? `Class Teacher Register for ${classTeacherRoleInfo}` : `Manage daily attendance entries for ${date}`}
              </p>
            </div>

            <div className="flex gap-2">
              {session?.is_locked ? (
                <button
                  onClick={handleUnlockSession}
                  disabled={!isUnlockAllowed(date)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-xl font-semibold text-sm transition"
                >
                  <Unlock size={18} /> Unlock Register
                </button>
              ) : (
                <button
                  onClick={handleLockSession}
                  disabled={isFutureDate(date) || !isClassTeacher}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-xl font-semibold text-sm transition"
                >
                  <Lock size={18} /> Lock Register
                </button>
              )}
            </div>
          </div>
        </div>

        {isFutureDate(date) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center font-bold text-sm shadow-sm">
            ⚠️ Attendance cannot be marked for future dates.
          </div>
        )}

        {teacherClasses.length === 0 && (
          <div className="p-8 bg-white border border-amber-200 rounded-2xl shadow-sm text-center text-amber-900 space-y-2">
            <ShieldAlert size={40} className="mx-auto text-amber-600 mb-2" />
            <h3 className="text-lg font-bold">Class Assignment Required</h3>
            <p className="text-sm text-amber-700 max-w-md mx-auto">
              You are not assigned to any grade or section in the Teachers module of School Admin.
            </p>
          </div>
        )}

        {teacherClasses.length > 0 && (
          <>
            {/* Quick Stats - Custom Teacher Color Tokens */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Total Students" value={stats.total} color="bg-emerald-600" />
              <StatBox label="Present" value={stats.present} color="bg-green-600" />
              <StatBox label="Absent" value={stats.absent} color="bg-rose-600" />
              <StatBox label="Out / Gatepass" value={stats.out} color="bg-purple-600" />
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-3 flex-1 items-center">
                  {teacherClasses.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">Class Register:</span>
                      <select
                        value={`${grade}-${section}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selectedClass = teacherClasses.find(c => `${c.grade}-${c.section}` === val);
                          if (selectedClass) {
                            setGrade(selectedClass.grade);
                            setSection(selectedClass.section);
                            setIsClassTeacher(selectedClass.role === 'CLASS_TEACHER');
                            setClassTeacherRoleInfo(`Grade ${selectedClass.grade} - Section ${selectedClass.section}`);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-50 border border-emerald-300 focus:ring-2 focus:ring-emerald-600 outline-none font-extrabold text-sm text-emerald-900 rounded-xl shadow-sm"
                      >
                        {teacherClasses.map((c) => (
                          <option key={`${c.grade}-${c.section}`} value={`${c.grade}-${c.section}`}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={`px-4 py-2 border rounded-xl font-extrabold text-sm flex items-center gap-2 ${
                      isClassTeacher ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <Users size={16} className={isClassTeacher ? 'text-emerald-700' : 'text-amber-700'} />
                      {isClassTeacher ? `Class Teacher: ${classTeacherRoleInfo} (Full Access)` : `Subject Teacher: Grade ${grade} - Section ${section} (Read Only)`}
                    </div>
                  )}

                  {isClassTeacher ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <Sparkles size={12} /> Class Teacher (Full Access)
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                      <Eye size={12} /> Subject Teacher (View Only)
                    </span>
                  )}

                  {isGrade11or12(grade) && allocatedSubjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">Subject:</span>
                      <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none font-medium text-sm text-gray-900"
                      >
                        {allocatedSubjects.map((s) => (
                          <option key={s.id} value={s.subject_id}>
                            {s.subject_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Date:</span>
                    <input
                      type="date"
                      value={date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDate(e.target.value)}
                      className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none font-medium text-sm text-gray-900"
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                {!session?.is_locked && canMarkAttendance && isClassTeacher && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkAllPresent}
                      disabled={isFutureDate(date)}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs transition"
                    >
                      ✓ All Present
                    </button>
                    <button
                      onClick={handleMarkAllAbsent}
                      disabled={isFutureDate(date)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs transition"
                    >
                      ✕ All Absent
                    </button>
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter student list by name or roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600 text-sm text-gray-900"
                />
              </div>
            </div>

            {/* Attendance Register Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-12 flex flex-col justify-center items-center gap-3 text-gray-500">
                  <Loader2 className="animate-spin text-green-700" size={36} />
                  <p className="font-semibold text-sm">Loading attendance register...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-12 flex flex-col justify-center items-center gap-3 text-gray-500">
                  <Users size={40} className="text-gray-300" />
                  <p className="font-semibold text-sm">No students found for this class register.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-6 py-4">Roll No</th>
                        <th className="px-6 py-4">Student Name</th>
                        <th className="px-6 py-4">SUID</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-green-50/30 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-gray-700">
                            #{student.roll_number || '-'}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {student.student_name}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-500">
                            {student.suid}
                          </td>
                          <td className="px-6 py-4">
                            {session?.is_locked || !canMarkAttendance || !isClassTeacher ? (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(student.status)}`}>
                                {getStatusIcon(student.status)}
                                {student.status}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStatusChange(student.id, 'PRESENT')}
                                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                                    student.status === 'PRESENT'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => handleStatusChange(student.id, 'ABSENT')}
                                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                                    student.status === 'ABSENT'
                                      ? 'bg-rose-600 text-white shadow-sm'
                                      : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              disabled={session?.is_locked || !canMarkAttendance || !isClassTeacher}
                              value={student.remarks || ''}
                              onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                              placeholder={isClassTeacher ? "Optional remark..." : "View only"}
                              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 outline-none text-xs text-gray-700 w-full disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Floating Save Button */}
            {!session?.is_locked && canMarkAttendance && isClassTeacher && (
              <div className="fixed bottom-6 right-6 z-30">
                <button
                  onClick={handleSaveRegister}
                  disabled={saving || isFutureDate(date)}
                  className="bg-gradient-to-r from-green-700 to-emerald-800 hover:from-green-800 hover:to-emerald-900 disabled:opacity-50 text-white px-8 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm transition-all hover:scale-105 border border-green-600/30"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {saving ? 'Saving...' : 'Save Attendance Entries'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </FeatureGuard>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
      <div className={`w-3 h-10 rounded-full ${color}`} />
      <div>
        <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        <div className="text-xs font-bold text-gray-500 uppercase">{label}</div>
      </div>
    </div>
  );
}
