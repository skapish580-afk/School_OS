'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  subject_name: string;
  section_name: string;
  max_marks: number;
  passing_marks: number;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
}

interface StudentMarks {
  student_id: string;
  marks_obtained: number | '';
  is_absent: boolean;
}

interface ExistingResult {
  student_id: string;
  marks_obtained: number;
  is_absent: boolean;
}

export default function MarksEntryDetailPage() {
  const params = useParams();
  const examId = params?.id as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksData, setMarksData] = useState<Map<string, StudentMarks>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (examId) {
      fetchExamDetails();
      fetchStudents();
    }
  }, [examId]);

  const fetchExamDetails = async () => {
    try {
      const response = await api.get(`/academics/exams/${examId}/`);
      setExam(response.data);
    } catch (error) {
      console.error('Failed to load exam', error);
      setError('Failed to load exam details');
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Fetch all students first
      const studentsResponse = await api.get('/students/');
      setStudents(studentsResponse.data);

      // Fetch existing results for this exam
      const resultsResponse = await api.get(`/academics/results/?exam=${examId}`);
      const existingResults = resultsResponse.data;

      // Initialize marks data with existing results
      const initialMarks = new Map<string, StudentMarks>();
      studentsResponse.data.forEach((student: Student) => {
        const existing = existingResults.find(
          (r: ExistingResult) => r.student_id === student.id
        );
        initialMarks.set(student.id, {
          student_id: student.id,
          marks_obtained: existing?.marks_obtained || '',
          is_absent: existing?.is_absent || false,
        });
      });
      setMarksData(initialMarks);
    } catch (error) {
      console.error('Failed to load students', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    const numValue = value === '' ? '' : Math.min(parseFloat(value), exam?.max_marks || 0);
    const current = marksData.get(studentId) || { student_id: studentId, marks_obtained: '', is_absent: false };
    setMarksData(new Map(marksData).set(studentId, { ...current, marks_obtained: numValue }));
  };

  const handleAbsentToggle = (studentId: string) => {
    const current = marksData.get(studentId) || { student_id: studentId, marks_obtained: '', is_absent: false };
    setMarksData(new Map(marksData).set(studentId, { ...current, is_absent: !current.is_absent, marks_obtained: '' }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const results = Array.from(marksData.values()).map(marks => ({
        exam_id: examId,
        student_id: marks.student_id,
        marks_obtained: marks.is_absent ? 0 : marks.marks_obtained,
        is_absent: marks.is_absent,
      }));

      for (const result of results) {
        try {
          // Check if result exists
          const existingResponse = await api.get(`/academics/results/?exam=${examId}&student=${result.student_id}`);
          if (existingResponse.data && existingResponse.data.length > 0) {
            // Update existing
            await api.put(`/academics/results/${existingResponse.data[0].id}/`, result);
          } else {
            // Create new
            await api.post('/academics/results/', result);
          }
        } catch (err) {
          console.error(`Failed to save marks for student`, err);
        }
      }
      setSuccess('Marks saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save marks');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateGrade = (marks: number | string, maxMarks: number): string => {
    if (marks === '' || marks === undefined) return '-';
    const numMarks = typeof marks === 'string' ? parseFloat(marks) : marks;
    const percentage = (numMarks / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  if (loading || !exam) {
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
        <a href="/dashboard/academics/marks-entry" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enter Marks</h1>
          <p className="text-gray-600 mt-1">{exam.name} • {exam.subject_name} • {exam.section_name}</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
        <div className="flex gap-3">
          <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Max Marks: {exam.max_marks} | Passing Marks: {exam.passing_marks}</p>
            <p className="mt-1">Enter marks for each student. Mark as Absent to skip marks entry.</p>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-green-700 flex items-center gap-2">
          <CheckCircle size={20} /> {success}
        </div>
      )}

      {/* Marks Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left font-bold text-gray-900">Roll No</th>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Student Name</th>
                <th className="px-6 py-4 text-center font-bold text-gray-900">Marks ({exam.max_marks})</th>
                <th className="px-6 py-4 text-center font-bold text-gray-900">Grade</th>
                <th className="px-6 py-4 text-center font-bold text-gray-900">Absent</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const marks = marksData.get(student.id);
                const isAbsent = marks?.is_absent || false;
                const marksValue = marks?.marks_obtained || '';

                return (
                  <tr key={student.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{student.roll_number || '-'}</td>
                    <td className="px-6 py-4 text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        max={exam.max_marks}
                        value={isAbsent ? '' : marksValue}
                        onChange={(e) => handleMarksChange(student.id, e.target.value)}
                        disabled={isAbsent}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                        isAbsent ? 'bg-gray-100 text-gray-600' :
                        ['A+', 'A'].includes(calculateGrade(marksValue, exam.max_marks)) ? 'bg-green-100 text-green-700' :
                        ['B', 'C'].includes(calculateGrade(marksValue, exam.max_marks)) ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {isAbsent ? 'AB' : calculateGrade(marksValue, exam.max_marks)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleAbsentToggle(student.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          isAbsent
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {isAbsent ? 'AB' : 'Present'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {submitting ? 'Saving...' : 'Save All Marks'}
        </button>
        <a
          href="/dashboard/academics/marks-entry"
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 py-3 rounded-lg font-bold transition text-center"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
