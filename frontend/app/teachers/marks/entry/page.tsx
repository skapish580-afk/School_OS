'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { 
  ArrowLeft, Save, Send, UserX, CheckCircle, AlertCircle, 
  Download, Upload, Calculator, Trophy, TrendingDown
} from 'lucide-react';

interface Student {
  student_id: string;
  roll_number: string;
  name: string;
  suid: string;
  marks: number | null;
  is_absent: boolean;
  grade: string | null;
  remarks: string;
  status: string;
  can_edit: boolean;
}

interface ExamInfo {
  id: string;
  name: string;
  subject: string;
  class: string;
  exam_date: string;
  max_marks: number;
  passing_marks: number;
  status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED';
  can_edit: boolean;
}

function MarksEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('exam');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    if (examId) {
      fetchExamData();
    }
  }, [examId]);

  const fetchExamData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://localhost:8000/api/v1/academics/teacher/exams/${examId}/marks/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExam(response.data.exam);
      setStudents(response.data.students);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch exam data', error);
      console.error('Error response:', error.response?.data);
      alert(`Failed to load exam data: ${error.response?.data?.error || error.message}`);
      setLoading(false);
    }
  };

  const updateMarks = (studentId: string, field: 'marks' | 'is_absent' | 'remarks', value: any) => {
    setStudents(prev => prev.map(s => {
      if (s.student_id === studentId) {
        const updated = { ...s, [field]: value };
        // If marking absent, clear marks
        if (field === 'is_absent' && value === true) {
          updated.marks = null;
        }
        return updated;
      }
      return s;
    }));
    setUnsavedChanges(true);
  };

  const saveMarks = async (action: 'save_draft' | 'submit') => {
    if (!exam) return;

    // Validation
    const errors: string[] = [];
    students.forEach(student => {
      if (!student.is_absent && (student.marks === null || student.marks === undefined)) {
        errors.push(`Marks missing for ${student.name}`);
      }
      if (!student.is_absent && student.marks! > exam.max_marks) {
        errors.push(`Marks exceed maximum for ${student.name}`);
      }
    });

    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('access_token');
      
      const marksData = students.map(s => ({
        student_id: s.student_id,
        marks: s.marks,
        is_absent: s.is_absent,
        remarks: s.remarks || '',
      }));

      await axios.post(
        `http://localhost:8000/api/v1/academics/teacher/exams/${examId}/marks/`,
        {
          marks: marksData,
          action: action
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const actionText = action === 'submit' ? 'submitted for approval' : 'saved as draft';
      alert(`Marks ${actionText} successfully!`);
      setUnsavedChanges(false);
      
      if (action === 'submit') {
        router.back();
      } else {
        fetchExamData(); // Refresh to get updated status
      }
    } catch (error: any) {
      console.error('Failed to save marks', error);
      alert('Failed to save marks: ' + (error.response?.data?.errors?.[0] || error.message));
    } finally {
      setSaving(false);
    }
  };

  const calculateGrade = (marks: number, maxMarks: number): string => {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const stats = {
    total: students.length,
    entered: students.filter(s => s.marks !== null || s.is_absent).length,
    absent: students.filter(s => s.is_absent).length,
    passed: students.filter(s => s.marks && s.marks >= (exam?.passing_marks || 0)).length,
    failed: students.filter(s => s.marks && s.marks < (exam?.passing_marks || 0)).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading exam data...</div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return <div className="p-6">Exam not found</div>;
  }

  const canSaveDraft = exam.can_edit;
  const canSubmit = exam.can_edit && (exam.status === 'NOT_STARTED' || exam.status === 'DRAFT');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (unsavedChanges) {
                if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
                  router.back();
                }
              } else {
                router.back();
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exam.name}</h1>
            <p className="text-gray-600 mt-1">
              {exam.subject} • Class {exam.class} • Max Marks: {exam.max_marks}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => saveMarks('save_draft')}
            disabled={saving || !unsavedChanges || !canSaveDraft}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save Draft
          </button>
          
          <button
            onClick={() => {
              if (confirm('Once submitted, you cannot edit marks. Are you sure?')) {
                saveMarks('submit');
              }
            }}
            disabled={saving || !canSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            Submit for Approval
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Students</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Marks Entered</div>
          <div className="text-2xl font-bold text-blue-600">{stats.entered}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Absent</div>
          <div className="text-2xl font-bold text-orange-600">{stats.absent}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Passed</div>
          <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {unsavedChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div className="text-yellow-800">
            You have unsaved changes. Don't forget to save your work!
          </div>
        </div>
      )}

      {/* Marks Entry Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SUID</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Marks (out of {exam.max_marks})
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Absent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((student) => {
                const grade = student.marks !== null ? calculateGrade(student.marks, exam.max_marks) : '-';
                const isPassing = student.marks !== null && student.marks >= exam.passing_marks;
                
                return (
                  <tr key={student.student_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {student.roll_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {student.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {student.suid}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={exam.max_marks}
                        value={student.marks ?? ''}
                        onChange={(e) => updateMarks(student.student_id, 'marks', e.target.value ? parseFloat(e.target.value) : null)}
                        disabled={student.is_absent || !student.can_edit || !exam.can_edit}
                        className={`w-24 px-3 py-2 border rounded-lg text-center ${
                          student.is_absent 
                            ? 'bg-gray-100 cursor-not-allowed'
                            : student.marks !== null && student.marks >= exam.passing_marks
                            ? 'border-green-300 focus:ring-green-500'
                            : student.marks !== null
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        } focus:border-transparent focus:ring-2`}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.is_absent ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          AB
                        </span>
                      ) : student.marks !== null ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          isPassing ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {grade}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={student.is_absent}
                        onChange={(e) => updateMarks(student.student_id, 'is_absent', e.target.checked)}
                        disabled={!student.can_edit}
                        className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={student.remarks}
                        onChange={(e) => updateMarks(student.student_id, 'remarks', e.target.value)}
                        disabled={!student.can_edit}
                        placeholder="Optional remarks..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-700">
          <strong>Tips:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc">
            <li>Enter marks between 0 and {exam.max_marks}</li>
            <li>Check "Absent" box for students who were absent</li>
            <li>Grades are automatically calculated: A+ (90%+), A (80%+), B (70%+), C (60%+), D (50%+), F (&lt;50%)</li>
            <li>Passing marks: {exam.passing_marks}</li>
            <li>Save as draft to continue later, or submit when all marks are entered</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function MarksEntryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    }>
      <MarksEntryContent />
    </Suspense>
  );
}
