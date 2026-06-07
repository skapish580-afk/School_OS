'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { 
  ArrowLeft, User, GraduationCap, TrendingUp, Award, 
  Calendar, AlertCircle, CheckCircle, Clock, BookOpen,
  BarChart3, Target, Trophy
} from 'lucide-react';

interface StudentProfile {
  id: string;
  full_name: string;
  suid: string;
  email: string;
  grade: string;
  section: string;
  roll_number: string;
  photo?: string;
}

interface AttendanceData {
  total_days: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
}

interface KarmaData {
  positive_total: number;
  negative_total: number;
  net_score: number;
  recent_records: Array<{
    type: string;
    category: string;
    points: number;
    remark: string;
    date: string;
  }>;
}

interface AcademicRecord {
  subject: string;
  marks_obtained: number;
  total_marks: number;
  grade: string;
  percentage: number;
}

interface AcademicData {
  rank: number | null;
  percentage: number;
  total_marks: number | null;
}

export default function StudentDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [karma, setKarma] = useState<KarmaData | null>(null);
  const [academics, setAcademics] = useState<AcademicRecord[]>([]);
  const [academicData, setAcademicData] = useState<AcademicData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'karma' | 'academics'>('overview');

  useEffect(() => {
    if (studentId) {
      fetchStudentDetails();
    }
  }, [studentId]);

  const fetchStudentDetails = async () => {
    if (!studentId) {
      console.error('No student ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      console.log('Fetching student details for ID:', studentId);
      
      const response = await axios.get(
        `http://localhost:8000/api/v1/teachers/students/${studentId}/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Student details received:', response.data);
      
      setStudent(response.data.student);
      setAttendance(response.data.attendance);
      setKarma(response.data.karma);
      setAcademicData(response.data.academic);
      
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch student details', error);
      console.error('Error response:', error.response?.data);
      alert(`Failed to load student profile: ${error.response?.data?.error || error.message}`);
      setLoading(false);
    }
  };

  if (!studentId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <div className="text-xl font-semibold text-gray-900 mb-2">No Student Selected</div>
          <div className="text-gray-600 mb-4">Please select a student to view their profile</div>
          <button
            onClick={() => router.back()}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading student details...</div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">Student not found</div>
      </div>
    );
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
          Back
        </button>
      </div>

      {/* Student Header Card */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start gap-6">
          <div className="h-24 w-24 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold">
            {student.photo ? (
              <img src={student.photo} alt={student.full_name} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              student.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{student.full_name}</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-green-100">Student ID</div>
                <div className="font-semibold">{student.suid}</div>
              </div>
              <div>
                <div className="text-green-100">Class</div>
                <div className="font-semibold">Grade {student.grade}{student.section}</div>
              </div>
              <div>
                <div className="text-green-100">Roll No.</div>
                <div className="font-semibold">{student.roll_number}</div>
              </div>
              <div>
                <div className="text-green-100">Email</div>
                <div className="font-semibold text-xs">{student.email}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Attendance</div>
              <div className={`text-2xl font-bold ${getAttendanceColor(attendance?.percentage || 0)}`}>
                {attendance?.percentage.toFixed(1)}%
              </div>
            </div>
            <Calendar className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Karma Score</div>
              <div className={`text-2xl font-bold ${karma && karma.net_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {karma?.net_score || 0}
              </div>
            </div>
            <Award className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Average Grade</div>
              <div className="text-2xl font-bold text-purple-600">
                {academicData?.percentage?.toFixed(1) || '0.0'}%
              </div>
            </div>
            <TrendingUp className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Class Rank</div>
              <div className="text-2xl font-bold text-yellow-600">#{academicData?.rank || '—'}</div>
            </div>
            <Trophy className="h-10 w-10 text-yellow-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex -mb-px">
            {[
              { key: 'overview', label: 'Overview', icon: User },
              { key: 'attendance', label: 'Attendance', icon: Calendar },
              { key: 'karma', label: 'Behavior', icon: Award },
              { key: 'academics', label: 'Academics', icon: GraduationCap },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attendance Summary */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Attendance This Month
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Days</span>
                      <span className="font-semibold">{attendance?.total_days}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Present
                      </span>
                      <span className="font-semibold text-green-600">{attendance?.present}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        Late
                      </span>
                      <span className="font-semibold text-yellow-600">{attendance?.late}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Absent
                      </span>
                      <span className="font-semibold text-red-600">{attendance?.absent}</span>
                    </div>
                  </div>
                </div>

                {/* Karma Summary */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-500" />
                    Behavior Score
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Positive Points</span>
                      <span className="font-semibold text-green-600">+{karma?.positive_total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Negative Points</span>
                      <span className="font-semibold text-red-600">-{karma?.negative_total}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Net Score</span>
                        <span className={`text-xl font-bold ${karma && karma.net_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {karma?.net_score}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Karma Activity */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">Recent Behavior Records</h3>
                <div className="space-y-2">
                  {karma?.recent_records.slice(0, 5).map((record, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        record.type === 'POSITIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {record.type === 'POSITIVE' ? '+' : '-'}{record.points}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{record.category.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-600">{record.remark}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Academics Tab */}
          {activeTab === 'academics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Academic Performance</h3>
                <div className="text-sm text-gray-600">
                  Overall Average: <span className="font-bold text-green-600">
                    {(academics.reduce((acc, a) => acc + a.percentage, 0) / academics.length).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                {academics.map((subject, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                        <h4 className="font-semibold">{subject.subject}</h4>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getGradeColor(subject.grade)}`}>
                        {subject.grade}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Marks</span>
                          <span className="font-semibold">{subject.marks_obtained} / {subject.total_marks}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${subject.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {subject.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div>
              <h3 className="font-semibold mb-4">Detailed Attendance History</h3>
              <div className="text-center text-gray-500 py-8">
                Attendance calendar view - Coming soon
              </div>
            </div>
          )}

          {/* Karma Tab */}
          {activeTab === 'karma' && (
            <div>
              <h3 className="font-semibold mb-4">Complete Behavior History</h3>
              <div className="space-y-2">
                {karma?.recent_records.map((record, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold ${
                      record.type === 'POSITIVE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {record.type === 'POSITIVE' ? '+' : '-'}{record.points}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold">{record.category.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(record.date).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="text-gray-600">{record.remark}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
