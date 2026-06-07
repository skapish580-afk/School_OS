'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, Calendar, BookOpen, Target } from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  start_date: string;
  end_date: string;
  passing_marks: number;
  total_marks: number;
  description: string;
  created_at: string;
}

interface Result {
  id: string;
  student_name: string;
  marks_obtained: number;
  percentage: number;
  grade: string;
  status: 'PASSED' | 'FAILED' | 'ABSENT';
  remarks: string | null;
}

export default function ExamDetailPage() {
  const params = useParams();
  const examId = params?.id as string;
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (examId) {
      fetchExamDetails();
      fetchResults();
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

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/academics/results/?exam=${examId}`);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to load results', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !exam) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );
  }

  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const absentCount = results.filter(r => r.status === 'ABSENT').length;
  const averageMarks = results.length > 0 
    ? (results.reduce((sum, r) => sum + r.marks_obtained, 0) / results.length).toFixed(2) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/exams" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{exam.name}</h1>
          <p className="text-gray-600 mt-1">{exam.exam_type} Exam</p>
        </div>
      </div>

      {/* Exam Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Exam Details</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-gray-900">{exam.description || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="font-semibold text-gray-900">{new Date(exam.start_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">End Date</p>
                <p className="font-semibold text-gray-900">{new Date(exam.end_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Marks</p>
                <p className="font-semibold text-gray-900">{exam.total_marks}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Passing Marks</p>
                <p className="font-semibold text-red-600">{exam.passing_marks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Passed</p>
                <p className="text-3xl font-bold">{passedCount}</p>
              </div>
              <div className="text-5xl opacity-20">✓</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Failed</p>
                <p className="text-3xl font-bold">{failedCount}</p>
              </div>
              <div className="text-5xl opacity-20">✗</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">Absent</p>
                <p className="text-3xl font-bold">{absentCount}</p>
              </div>
              <div className="text-5xl opacity-20">-</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Average Marks</p>
                <p className="text-3xl font-bold">{averageMarks}</p>
              </div>
              <div className="text-5xl opacity-20">📊</div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Student Results</h2>
        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen size={40} className="mx-auto mb-2 text-gray-300" />
            <p>No results recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Student Name</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Marks</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Percentage</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Grade</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 text-gray-900">{result.student_name}</td>
                    <td className="text-center py-3 px-4 font-semibold text-gray-900">
                      {result.status === 'ABSENT' ? '-' : result.marks_obtained}
                    </td>
                    <td className="text-center py-3 px-4 font-semibold text-gray-900">
                      {result.status === 'ABSENT' ? '-' : `${result.percentage}%`}
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="px-3 py-1 rounded-full font-semibold text-sm"
                        style={{
                          backgroundColor: result.grade === 'A' ? '#dcfce7' : 
                                         result.grade === 'B' ? '#dbeafe' :
                                         result.grade === 'C' ? '#fef3c7' : '#fee2e2',
                          color: result.grade === 'A' ? '#166534' :
                                result.grade === 'B' ? '#1e40af' :
                                result.grade === 'C' ? '#b45309' : '#991b1b'
                        }}
                      >
                        {result.grade}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                        result.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                        result.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {result.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{result.remarks || '-'}</td>
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
