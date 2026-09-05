'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, Save, AlertCircle, CheckCircle, PenTool, Sparkles } from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  subject_name: string;
  section_name: string;
  max_marks: number;
  passing_marks: number;
  section_id_display?: string;
  marks_locked?: boolean;
  assessment_category?: string;
  exam_type?: string;
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

export default function TeacherMarksEntryDetailPage({ params: propParams }: { params?: { id: string } }) {
  const routeParams = useParams();
  const router = useRouter();
  const rawId = propParams?.id || routeParams?.id;
  const examId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksData, setMarksData] = useState<Map<string, StudentMarks>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (examId) {
      fetchExamAndStudents();
    }
  }, [examId]);

  const fetchExamAndStudents = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Exam Details
      const examResponse = await api.get(`/academics/exams/${examId}/`);
      const examData = examResponse.data;
      setExam(examData);

      const sectionId = examData.section_id_display;
      if (!sectionId) {
        throw new Error('Section ID not found for this exam');
      }

      // 2. Fetch active students in section
      const studentsResponse = await api.get(`/students/?current_section=${sectionId}&status=ACTIVE`);
      let studentList = Array.isArray(studentsResponse.data) ? studentsResponse.data : studentsResponse.data.results || [];

      // If exam is for an elective subject, filter to only students who opted for it
      const subjectId = String(examData.subject_id || examData.subject || examData.subject_mapping?.subject?.id || examData.subject_mapping?.subject || '');
      const gradeName = examData.grade_name || (examData.section_name ? examData.section_name.split('-')[0].replace(/grade/i, '').trim() : '');

      if (gradeName && subjectId) {
        try {
          const norm = (gradeName || '').toLowerCase().replace(/grade/g, '').trim();
          let electiveMap: Record<string, string[]> = {};

          const savedRaw = localStorage.getItem(`student_elective_mappings_grade_${gradeName}`);
          if (savedRaw) {
            electiveMap = JSON.parse(savedRaw);
          } else {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('student_elective_mappings_grade_')) {
                const kGrade = key.replace('student_elective_mappings_grade_', '').toLowerCase().replace(/grade/g, '').trim();
                if (kGrade === norm) {
                  const val = localStorage.getItem(key);
                  if (val) {
                    electiveMap = JSON.parse(val);
                    break;
                  }
                }
              }
            }
          }

          const mappedIds = (electiveMap[subjectId] || []).map((id: any) => String(id));
          if (mappedIds.length > 0) {
            studentList = studentList.filter((st: any) => {
              const stId = String(st.id || '');
              const stSuid = String(st.suid || '');
              return mappedIds.includes(stId) || (stSuid && mappedIds.includes(stSuid));
            });
          }
        } catch (e) {}
      }

      setStudents(studentList);

      // 3. Fetch existing results
      const resultsResponse = await api.get(`/academics/results/?exam=${examId}`);
      const existingResults = resultsResponse.data;

      // 4. Initialize marks data
      const initialMarks = new Map<string, StudentMarks>();
      studentList.forEach((student: Student) => {
        const existing = existingResults.find(
          (r: ExistingResult) => String(r.student_id) === String(student.id)
        );
        initialMarks.set(student.id, {
          student_id: student.id,
          marks_obtained: existing?.marks_obtained !== undefined ? existing.marks_obtained : '',
          is_absent: existing?.is_absent || false,
        });
      });
      setMarksData(initialMarks);
    } catch (error: any) {
      console.error('Failed to load exam or students', error);
      const msg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || 'You do not have permission to view or enter marks for this exam.';
      setError(msg);
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
    if (exam?.marks_locked) {
      setError('Cannot save marks. This exam has been locked by the school admin.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    let hasError = false;
    let errorMessage = '';

    try {
      const results = Array.from(marksData.values()).map(marks => ({
        exam_id: examId,
        student_id: marks.student_id,
        marks_obtained: marks.is_absent ? 0 : marks.marks_obtained,
        is_absent: marks.is_absent,
      }));

      for (const result of results) {
        try {
          const existingResponse = await api.get(`/academics/results/?exam=${examId}&student=${result.student_id}`);
          const hasExisting = existingResponse.data && existingResponse.data.length > 0;
          const isBlank = result.marks_obtained === '' && !result.is_absent;

          if (isBlank) {
            if (hasExisting) {
              await api.delete(`/academics/results/${existingResponse.data[0].id}/`);
            }
          } else {
            if (hasExisting) {
              await api.put(`/academics/results/${existingResponse.data[0].id}/`, result);
            } else {
              await api.post('/academics/results/', result);
            }
          }
        } catch (err: any) {
          console.error(`Failed to save marks for student ${result.student_id}`, err);
          hasError = true;
          errorMessage = err.response?.data?.detail || 
                         err.response?.data?.exam_id?.[0] || 
                         err.response?.data?.marks_obtained?.[0] || 
                         err.response?.data?.non_field_errors?.[0] ||
                         'Some changes could not be saved. Please verify entry rules.';
        }
      }

      if (hasError) {
        setError(errorMessage);
      } else {
        setSuccess('Marks saved successfully!');
        await fetchExamAndStudents();
        setTimeout(() => setSuccess(''), 3000);
      }
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
        <Loader2 className="animate-spin text-green-700" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-green-700 via-green-800 to-emerald-900 text-white p-6 rounded-2xl shadow-md border border-green-600/30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/teachers/marks')}
            className="p-2 hover:bg-white/20 rounded-xl transition text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-green-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles size={14} /> Teacher Marks Entry
            </div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <PenTool size={28} /> {exam.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-green-100 text-sm">{exam.subject_name} • {exam.section_name}</span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                exam.assessment_category === 'PRACTICAL'
                  ? 'bg-purple-900/50 text-purple-200 border border-purple-400/40'
                  : exam.exam_type === 'FINALS'
                    ? 'bg-amber-900/50 text-amber-200 border border-amber-400/40'
                    : 'bg-emerald-900/50 text-emerald-200 border border-emerald-400/40'
              }`}>
                {exam.assessment_category === 'PRACTICAL'
                  ? 'Practicals/Practical Exams'
                  : exam.exam_type === 'FINALS'
                    ? 'Final Exams'
                    : 'Internal Marks'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
        <div className="flex gap-3">
          <AlertCircle className="text-emerald-700 flex-shrink-0" size={20} />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Max Marks: {exam.max_marks} | Passing Marks: {exam.passing_marks}</p>
            <p className="mt-1">Enter marks for each student. Mark as Absent to record as absent.</p>
          </div>
        </div>
      </div>

      {/* Locked Banner if exam marks locked by Admin */}
      {exam.marks_locked && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-center font-bold text-lg shadow-sm">
          🔒 Marks Locked by Admin (Uneditable)
        </div>
      )}

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 flex items-center gap-2 font-medium">
          <CheckCircle size={20} className="text-emerald-600" /> {success}
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
                  <tr key={student.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50/30 transition`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{student.roll_number || '-'}</td>
                    <td className="px-6 py-4 text-gray-900">{student.first_name} {student.last_name}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min="0"
                        max={exam.max_marks}
                        value={isAbsent ? '' : marksValue}
                        onChange={(e) => handleMarksChange(student.id, e.target.value)}
                        disabled={isAbsent || exam.marks_locked}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100 disabled:text-gray-500 font-semibold mx-auto block"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full font-bold text-sm ${
                        isAbsent ? 'bg-gray-100 text-gray-600' :
                        ['A+', 'A'].includes(calculateGrade(marksValue, exam.max_marks)) ? 'bg-emerald-100 text-emerald-800' :
                        ['B', 'C'].includes(calculateGrade(marksValue, exam.max_marks)) ? 'bg-teal-100 text-teal-800' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {isAbsent ? 'AB' : calculateGrade(marksValue, exam.max_marks)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleAbsentToggle(student.id)}
                        disabled={exam.marks_locked}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          isAbsent
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
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

      {/* Action Buttons */}
      {exam.marks_locked ? (
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.push('/teachers/marks')}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-bold transition"
          >
            Back to Marks
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.push('/teachers/marks')}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {submitting ? 'Saving...' : 'Save All Marks'}
          </button>
        </div>
      )}
    </div>
  );
}
