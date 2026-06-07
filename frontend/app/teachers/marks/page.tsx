'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { 
  BookOpen, Calendar, Users, CheckCircle, Clock, 
  AlertCircle, FileText, Save, Send, Download, Upload,
  Edit3, Lock, Eye, Filter, Search, ChevronDown
} from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  subject: string;
  subject_code: string;
  class: string;
  exam_date: string;
  max_marks: number;
  passing_marks: number;
  total_students: number;
  marks_entered: number;
  completion_percentage: number;
  status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED';
  can_edit: boolean;
}

interface GroupedExams {
  unit_tests: Exam[];
  midterms: Exam[];
  finals: Exam[];
  periodic: Exam[];
}

export default function MarksManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [groupedExams, setGroupedExams] = useState<GroupedExams | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'unit_tests' | 'midterms' | 'finals'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        'http://localhost:8000/api/v1/academics/teacher/exams/',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExams(response.data.exams);
      setGroupedExams(response.data.grouped);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch exams', error);
      alert('Failed to load exams');
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'NOT_STARTED': { color: 'bg-gray-100 text-gray-700', icon: Clock, text: 'Not Started' },
      'DRAFT': { color: 'bg-yellow-100 text-yellow-700', icon: Edit3, text: 'Draft' },
      'SUBMITTED': { color: 'bg-blue-100 text-blue-700', icon: Send, text: 'Submitted' },
      'APPROVED': { color: 'bg-green-100 text-green-700', icon: CheckCircle, text: 'Approved' },
      'LOCKED': { color: 'bg-red-100 text-red-700', icon: Lock, text: 'Locked' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.NOT_STARTED;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {badge.text}
      </span>
    );
  };

  const getExamTypeLabel = (type: string) => {
    const labels = {
      'UNIT_TEST': 'Unit Test',
      'MIDTERM': 'Mid-Term Exam',
      'FINALS': 'Final Exam',
      'PERIODIC': 'Periodic Assessment',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage > 0) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const filteredExams = exams.filter(exam => {
    // Filter by type
    if (filterType !== 'all') {
      const typeMap = {
        'unit_tests': 'UNIT_TEST',
        'midterms': 'MIDTERM',
        'finals': 'FINALS',
      };
      if (exam.exam_type !== typeMap[filterType as keyof typeof typeMap]) return false;
    }
    
    // Filter by status
    if (filterStatus !== 'all' && exam.status !== filterStatus) return false;
    
    // Search query
    if (searchQuery && !exam.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exam.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !exam.class.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Group exams by class for better organization
  const examsByClass = filteredExams.reduce((acc, exam) => {
    if (!acc[exam.class]) {
      acc[exam.class] = [];
    }
    acc[exam.class].push(exam);
    return acc;
  }, {} as Record<string, Exam[]>);

  // Sort exams within each class by date
  Object.keys(examsByClass).forEach(classKey => {
    examsByClass[classKey].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  });

  const stats = {
    total: exams.length,
    not_started: exams.filter(e => e.status === 'NOT_STARTED').length,
    draft: exams.filter(e => e.status === 'DRAFT').length,
    submitted: exams.filter(e => e.status === 'SUBMITTED').length,
    approved: exams.filter(e => e.status === 'APPROVED' || e.status === 'LOCKED').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading exams...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Marks Management</h1>
        <p className="text-gray-600 mt-1">Enter and manage examination marks for your subjects</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="text-sm text-gray-600">Total Exams</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <div className="text-sm text-gray-600">Not Started</div>
          <div className="text-2xl font-bold text-gray-600">{stats.not_started}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600">Draft</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600">Submitted</div>
          <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search exams, subjects, classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          {/* Exam Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Exam Types</option>
            <option value="unit_tests">Unit Tests</option>
            <option value="midterms">Mid-Terms</option>
            <option value="finals">Finals</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
      </div>

      {/* Exams List */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Exam Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject & Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Max Marks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <div className="text-gray-500">No exams found</div>
                    <div className="text-sm text-gray-400 mt-1">
                      {searchQuery || filterType !== 'all' || filterStatus !== 'all' 
                        ? 'Try adjusting your filters' 
                        : 'Exams will appear here once admin creates them'}
                    </div>
                  </td>
                </tr>
              ) : (
                Object.keys(examsByClass).sort().map(classKey => [
                  <tr key={`header-${classKey}`} className="bg-gray-100">
                    <td colSpan={7} className="px-6 py-3">
                      <div className="font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Class {classKey} - {examsByClass[classKey].length} exams
                      </div>
                    </td>
                  </tr>,
                  ...examsByClass[classKey].map((exam) => (
                    <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{exam.name}</div>
                      <div className="text-sm text-gray-500">{getExamTypeLabel(exam.exam_type)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{exam.subject}</div>
                      <div className="text-sm text-gray-500">Class {exam.class}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {new Date(exam.exam_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{exam.max_marks}</div>
                      <div className="text-xs text-gray-500">Pass: {exam.passing_marks}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${getProgressColor(exam.completion_percentage)}`}
                            style={{ width: `${exam.completion_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-gray-600 min-w-[3rem]">
                          {exam.marks_entered}/{exam.total_students}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(exam.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/teachers/marks/entry?exam=${exam.id}`)}
                        disabled={!exam.can_edit && exam.status !== 'APPROVED' && exam.status !== 'LOCKED'}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          exam.can_edit
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : exam.status === 'APPROVED' || exam.status === 'LOCKED'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {exam.can_edit ? (
                          <>
                            <Edit3 className="h-4 w-4" />
                            Enter Marks
                          </>
                        ) : exam.status === 'APPROVED' || exam.status === 'LOCKED' ? (
                          <>
                            <Eye className="h-4 w-4" />
                            View
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4" />
                            Pending Approval
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                  ))
                ]).flat()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900">How Marks Entry Works</div>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
              <li><strong>Draft:</strong> Save your work in progress. You can edit anytime.</li>
              <li><strong>Submit:</strong> Send marks for review. No further edits allowed.</li>
              <li><strong>Approved:</strong> Marks verified by HOD/Principal. Visible to students.</li>
              <li><strong>Locked:</strong> Final marks locked by admin. No changes possible.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
