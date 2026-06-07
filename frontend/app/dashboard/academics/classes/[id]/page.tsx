'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, Users, BookOpen, User } from 'lucide-react';

interface Section {
  id: string;
  full_name: string;
  grade_name: string;
  class_teacher_name: string | null;
  student_count: number;
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
  
  const [section, setSection] = useState<Section | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<SubjectMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sectionId) {
      fetchSectionDetails();
      fetchStudents();
      fetchSubjects();
    }
  }, [sectionId]);

  const fetchSectionDetails = async () => {
    try {
      const response = await api.get(`/academics/sections/${sectionId}/`);
      setSection(response.data);
    } catch (error) {
      console.error('Failed to load section', error);
      setError('Failed to load section details');
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/academics/enrollments/?section=${sectionId}`);
      setStudents(response.data);
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

  if (loading && !section) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-blue-600" size={40} />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 text-gray-900 font-medium">{student.roll_number || '-'}</td>
                    <td className="py-3 px-4 text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="py-3 px-4 text-gray-600">{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
