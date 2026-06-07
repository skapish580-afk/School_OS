'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Loader2, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface Result {
  id: string;
  student_name: string;
  exam_name: string;
  subject_name: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  status: 'PASSED' | 'FAILED' | 'ABSENT';
  remarks: string | null;
  created_at: string;
}

export default function ResultDetailPage() {
  const params = useParams();
  const resultId = params?.id as string;
  
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resultId) {
      fetchResultDetails();
    }
  }, [resultId]);

  const fetchResultDetails = async () => {
    try {
      const response = await api.get(`/academics/results/${resultId}/`);
      setResult(response.data);
    } catch (error) {
      console.error('Failed to load result', error);
      setError('Failed to load result details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-red-50 p-12 rounded-xl text-center text-red-600">
        <AlertCircle size={48} className="mx-auto mb-4" />
        <p className="text-lg">Result not found</p>
      </div>
    );
  }

  const isPassed = result.status === 'PASSED';
  const isAbsent = result.status === 'ABSENT';
  const gradeColor = 
    result.grade === 'A' ? 'from-green-500 to-green-600' :
    result.grade === 'B' ? 'from-blue-500 to-blue-600' :
    result.grade === 'C' ? 'from-yellow-500 to-yellow-600' :
    'from-red-500 to-red-600';

  const gradeTextColor =
    result.grade === 'A' ? '#166534' :
    result.grade === 'B' ? '#1e40af' :
    result.grade === 'C' ? '#b45309' : '#991b1b';

  const gradeBgColor =
    result.grade === 'A' ? '#dcfce7' :
    result.grade === 'B' ? '#dbeafe' :
    result.grade === 'C' ? '#fef3c7' : '#fee2e2';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/results" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{result.student_name}</h1>
          <p className="text-gray-600 mt-1">{result.exam_name} • {result.subject_name}</p>
        </div>
      </div>

      {/* Main Result Card */}
      <div className={`relative overflow-hidden p-8 rounded-2xl text-white shadow-lg ${
        isAbsent ? 'bg-gray-400' : isPassed ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-lg mb-2 opacity-90">{isAbsent ? 'ABSENT' : isPassed ? 'PASSED' : 'FAILED'}</p>
            {!isAbsent && (
              <>
                <p className="text-6xl font-bold mb-2">{result.marks_obtained}/{result.total_marks}</p>
                <p className="text-2xl opacity-90">{result.percentage}%</p>
              </>
            )}
          </div>
          <div className={`text-8xl font-bold opacity-20`}>
            {isAbsent ? '—' : result.grade}
          </div>
        </div>
      </div>

      {/* Grade and Status */}
      {!isAbsent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Grade</p>
                <p className="text-3xl font-bold mt-2" style={{ color: gradeTextColor }}>
                  {result.grade}
                </p>
              </div>
              <Award size={48} style={{ color: gradeTextColor }} className="opacity-20" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Percentage</p>
                <p className="text-3xl font-bold mt-2 text-blue-600">{result.percentage}%</p>
              </div>
              <TrendingUp size={48} className="text-blue-400 opacity-20" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block mt-2 px-4 py-2 rounded-full font-bold text-sm ${
                result.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>
                {result.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Exam Details</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Exam Name</p>
              <p className="font-semibold text-gray-900">{result.exam_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Subject</p>
              <p className="font-semibold text-gray-900">{result.subject_name}</p>
            </div>
            {!isAbsent && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Total Marks</p>
                  <p className="font-semibold text-gray-900">{result.total_marks}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Marks Obtained</p>
                  <p className="font-semibold text-gray-900">{result.marks_obtained}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {result.remarks && (
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Remarks</h2>
            <p className="text-gray-700 leading-relaxed">{result.remarks}</p>
          </div>
        )}
      </div>

      {/* Marks Breakdown */}
      {!isAbsent && (
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Performance Analysis</h2>
          <div className="space-y-6">
            {/* Marks Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Marks Obtained</span>
                <span className="font-bold text-gray-900">{result.marks_obtained}/{result.total_marks}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
                  style={{ width: `${(result.marks_obtained / result.total_marks) * 100}%` }}
                />
              </div>
            </div>

            {/* Percentage Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Percentage Achieved</span>
                <span className="font-bold text-gray-900">{result.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className={`bg-gradient-to-r ${gradeColor} h-full transition-all duration-500`}
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-center text-sm text-gray-600 p-4 bg-gray-50 rounded-xl">
        <p>Result recorded on {new Date(result.created_at).toLocaleDateString()} at {new Date(result.created_at).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
