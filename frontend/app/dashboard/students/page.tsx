'use client';

import { useEffect, useState } from 'react';
import api, { getMediaUrl } from '@/lib/api';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus, Search, User, ChevronRight, Loader2,
  Mail, Phone, GraduationCap
} from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function StudentListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // RBAC Permissions
  const { hasPermission, isAdmin } = usePermissionContext();
  const canAddStudent = isAdmin || hasPermission('students.add_student');
  const canViewAny = isAdmin || 
    hasPermission('students.view_student_only') || 
    hasPermission('students.view_profile') || 
    hasPermission('students.view_journey') || 
    hasPermission('students.view_health') ||
    hasPermission('teachers.view_teaching') ||
    hasPermission('academics.view_class');

  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  const normalizeGrade = (g: string) => {
    if (!g) return '';
    return g.toLowerCase().replace('grade', '').trim();
  };

  const matchesGrade = (g1: string, g2: string) => {
    return normalizeGrade(g1) === normalizeGrade(g2);
  };

  useEffect(() => {
    if (canViewAny) {
      fetchStudents();
    } else {
      setLoading(false);
    }
  }, [canViewAny]);

  const fetchStudents = async () => {
    try {
      const [response, assignmentsRes] = await Promise.all([
        api.get('/students/?status=ACTIVE'),
        api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] }))
      ]);

      const studentData = Array.isArray(response.data) ? response.data : response.data.results || [];
      const assignList = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || [];
      
      setTeacherAssignments(assignList);
      setStudents(studentData);
      setError(null);
    } catch (error: any) {
      console.error("Failed to fetch students:", error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to load students';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Safe Name Getter (uses the serializer's full_name field)
  const getStudentName = (s: any) => s.full_name || "Unknown Student";

  const filteredStudents = students.filter(s => {
    // 1. Teacher Assignment Scoping (only for non-admin teaching staff)
    if (!isAdmin && teacherAssignments.length > 0) {
      const studentClass = (s.current_class || s.grade_name || s.section_name || '').toLowerCase();
      const hasAssignment = teacherAssignments.some((ta: any) => {
        if (!ta.grade) return true;
        const taGrade = normalizeGrade(ta.grade);
        const taSection = (ta.section || '').trim().toLowerCase();
        
        const matchFull = studentClass.includes(`${taGrade}-${taSection}`);
        const matchGradeSection = matchesGrade(s.grade_name || '', taGrade) && (s.section_letter || s.section_name || '').trim().toLowerCase() === taSection;
        return matchFull || matchGradeSection;
      });

      if (!hasAssignment) return false;
    }

    // 2. Search Query Filter
    const name = getStudentName(s).toLowerCase();
    const suid = (s.suid || '').toLowerCase();
    const roll = (s.roll_number || '').toLowerCase();
    const query = search.toLowerCase();
    return name.includes(query) || suid.includes(query) || roll.includes(query);
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-500 bg-gray-50">
      <Loader2 className="animate-spin mr-2" /> Loading Directory...
    </div>
  );

  if (!canViewAny) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">You do not have permission to view the student directory.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm max-w-md">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error Loading Students</h2>
          <p className="text-sm text-gray-600 mb-2">{error}</p>
          <p className="text-xs text-gray-400 mb-4">Check browser console for more details</p>
          <button onClick={() => fetchStudents()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-8">

        {/* HEADER & ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Directory</h1>
            <p className="text-gray-500 text-sm mt-1">Total Students: {students.length} • New students auto-enrolled in assigned class</p>
          </div>
          <div className="flex gap-3">
            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search name, ID or roll..."
                className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64 shadow-sm text-sm transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Add Button - Only show if user has create permission */}
            {canAddStudent && (
              <Link href="/dashboard/students/add">
                <button className="bg-black text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-800 transition-all flex items-center gap-2 shadow-sm">
                  <Plus size={16} /> Add Student
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* TABLE LAYOUT */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {filteredStudents.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                <User size={24} />
              </div>
              <p className="text-gray-500 text-sm">No students found matching "{search}"</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Roll / SUID</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => {
                  const displayName = getStudentName(student);
                  const displayEmail = student.email;
                  const displayPhone = student.phone_number;
                  const currentClass = student.current_class || (student.grade_name && student.section_letter ? `${student.grade_name}-${student.section_letter}` : student.grade_name || "Unassigned");
                  const isTeacherPortal = (pathname && pathname.startsWith('/teachers')) || (typeof window !== 'undefined' && window.location.pathname.startsWith('/teachers'));
                  const studentDetailUrl = isTeacherPortal ? `/teachers/remarks/${student.id}` : `/dashboard/students/${student.id}`;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => router.push(studentDetailUrl)} // Handles detailed view per portal
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 text-gray-400 font-bold">
                            {student.profile_photo ? (
                              <img src={getMediaUrl(student.profile_photo)!} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">{displayName[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-2">
                              {displayName}
                              {student.status === 'TEMPORARY' && (
                                <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 select-none">
                                  Temporary
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 capitalize">Student</div>
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 w-max">
                            {student.suid}
                          </span>
                          {student.roll_number && (
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded w-max">
                              Roll: {student.roll_number}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {displayEmail ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Mail size={12} /> {displayEmail}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">No Email</span>
                          )}

                          {displayPhone ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Phone size={12} /> {displayPhone}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="px-6 py-4">
                        {currentClass !== "Unassigned" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <GraduationCap size={12} />
                            Class {currentClass}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            No Class
                          </span>
                        )}
                      </td>

                      {/* Action Arrow / Confirm Button */}
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {student.status === 'TEMPORARY' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const hasDetails = !!(
                                  student.first_name &&
                                  student.email &&
                                  student.date_of_birth &&
                                  (student.address || student.address_line1) &&
                                  student.latitude !== null &&
                                  student.latitude !== undefined &&
                                  student.longitude !== null &&
                                  student.longitude !== undefined
                                );
                                if (!hasDetails) {
                                  alert("Cannot confirm admission. Please fill in all required details (Name, Email, DOB, Address, Latitude, Longitude) by editing the student profile first.");
                                  return;
                                }
                                try {
                                  const res = await api.post(`/students/${student.id}/confirm_admission/`);
                                  if (res.data?.success) {
                                    alert("Admission confirmed successfully!");
                                    fetchStudents();
                                  }
                                } catch (err: any) {
                                  alert(err.response?.data?.error || "Failed to confirm admission.");
                                }
                              }}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm mr-2 active:scale-95 whitespace-nowrap"
                            >
                              Confirm Admission
                            </button>
                          )}
                          <ChevronRight 
                            size={18} 
                            className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0"
                            onClick={() => router.push(studentDetailUrl)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
}