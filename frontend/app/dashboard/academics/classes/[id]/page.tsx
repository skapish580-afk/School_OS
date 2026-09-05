'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, Users, BookOpen, User } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

interface Section {
  id: string;
  full_name: string;
  grade_name: string;
  class_teacher_name: string | null;
  student_count: number;
  room_number: string | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string | null;
}

interface SubjectMapping {
  id: string;
  subject_name: string;
}

export default function SectionDetailPage() {
  const params = useParams();
  const sectionId = params?.id as string;
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();
  const canView = isAdmin || hasPermission('academics.view_class');
  
  const [section, setSection] = useState<Section | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectMapping[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [electiveMapping, setElectiveMapping] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sectionId && !permissionsLoading && canView) {
      fetchSectionDetails();
      fetchStudents();
      fetchSubjects();
      fetchAllSubjects();
    }
  }, [sectionId, permissionsLoading, canView]);

  const normalizeGradeKey = (g: string) => (g || '').toLowerCase().replace(/grade/g, '').trim();

  const loadElectiveMappingsForGrade = (gradeName: string): Record<string, string[]> => {
    if (!gradeName || typeof window === 'undefined') return {};
    const norm = normalizeGradeKey(gradeName);
    try {
      const savedRaw = localStorage.getItem(`student_elective_mappings_grade_${gradeName}`);
      if (savedRaw) return JSON.parse(savedRaw);

      const savedNorm = localStorage.getItem(`student_elective_mappings_grade_${norm}`);
      if (savedNorm) return JSON.parse(savedNorm);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('student_elective_mappings_grade_')) {
          const kGrade = key.replace('student_elective_mappings_grade_', '');
          if (normalizeGradeKey(kGrade) === norm) {
            const val = localStorage.getItem(key);
            if (val) return JSON.parse(val);
          }
        }
      }
    } catch (e) {}
    return {};
  };

  const fetchSectionDetails = async () => {
    try {
      const response = await api.get(`/academics/sections/${sectionId}/`);
      const secData = response.data;
      setSection(secData);

      if (secData?.grade_name) {
        const mappings = loadElectiveMappingsForGrade(secData.grade_name);
        setElectiveMapping(mappings);
      }
    } catch (error) {
      console.error('Failed to load section', error);
      setError('Failed to load section details');
    }
  };

  const fetchAllSubjects = async () => {
    try {
      const res = await api.get('/academics/subjects/');
      setAllSubjects(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (e) {
      console.error('Failed to load all subjects', e);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/students/?current_section=${sectionId}&status=ACTIVE`);
      const data = response.data;
      setStudents(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Failed to load students', error);
    }
  };

  const fetchSubjects = async () => {
    setLoading(false);
    try {
      const response = await api.get(`/academics/subject-mappings/?section=${sectionId}`);
      setSubjects(response.data);
    } catch (error) {
      console.error('Failed to load subjects', error);
    }
  };

  if (permissionsLoading || (loading && !section)) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100 max-w-md mx-auto mt-12">
        Access Denied. You do not have permission to view class and section details.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/classes" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{section?.grade_name} - {section?.full_name}</h1>
          <p className="text-gray-600 mt-1">Section Details & Enrollment</p>
        </div>
      </div>

      {/* Section Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{students.length}</p>
            </div>
            <Users size={40} className="text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Subjects</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{subjects.length}</p>
            </div>
            <BookOpen size={40} className="text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Class Teacher</p>
            <p className="text-lg font-bold text-gray-900 mt-2">{section?.class_teacher_name || 'Not Assigned'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Room Number</p>
            <p className="text-lg font-bold text-gray-900 mt-2">{section?.room_number || 'Not Assigned'}</p>
          </div>
        </div>
      </div>

      {/* Subjects */}
      {subjects.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen size={20} /> Subjects Taught
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(new Map(subjects.map((s) => [s.subject_name, s])).values()).map((subject) => (
              <div key={subject.id} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="font-semibold text-purple-900">{subject.subject_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Students List */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} /> Enrolled Students
        </h2>
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users size={40} className="mx-auto mb-2 text-gray-300" />
            <p>No students enrolled yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Roll No</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Elective Subjects Opted</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student: any) => {
                  const optedElectives = allSubjects.filter(sub => {
                    const isElective = !sub.is_core || (sub.subject_type || '').toUpperCase() === 'ELECTIVE';
                    if (!isElective) return false;
                    const mappedIds = (electiveMapping[sub.id] || []).map((id: any) => String(id));
                    const stId = String(student.id || '');
                    const stSuid = String(student.suid || '');
                    return mappedIds.includes(stId) || (stSuid && mappedIds.includes(stSuid));
                  });

                  return (
                    <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-900 font-medium">{student.roll_number || '-'}</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">{student.first_name || student.full_name} {student.last_name || ''}</td>
                      <td className="py-3 px-4 text-gray-600">{student.email || student.user_email || '-'}</td>
                      <td className="py-3 px-4 text-gray-900">
                        {optedElectives.length === 0 ? (
                          <span className="text-gray-400 text-xs italic font-medium">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {optedElectives.map(sub => (
                              <span key={sub.id} className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-md border border-purple-200">
                                {sub.name} ({sub.code})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
