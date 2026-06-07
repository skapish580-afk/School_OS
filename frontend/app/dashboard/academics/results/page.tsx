'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, FileText, Loader2, Search, Award, AlertCircle } from 'lucide-react';
import Modal from '@/components/Modal';

interface Result {
  id: string;
  student_name: string;
  student_suid: string;
  exam_name: string;
  subject_name: string;
  marks_obtained: number;
  percentage: number;
  grade: string;
  is_absent: boolean;
}

interface Exam {
  id: string;
  name: string;
  subject_name: string;
  section_name: string;
  section_id_display: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number?: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<Result[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    exam_id: '',
    student_id: '',
    marks_obtained: '',
    is_absent: 'false',
    remarks: '',
  });
  const [sectionStudents, setSectionStudents] = useState<Student[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchSchoolId();
    fetchResults();
    fetchExams();
  }, []);

  useEffect(() => {
    if (formData.exam_id) {
      const selectedExam = exams.find(e => e.id === formData.exam_id);
      if (selectedExam?.section_id_display) {
        fetchStudentsBySection(selectedExam.section_id_display);
      }
    } else {
      setSectionStudents([]);
    }
  }, [formData.exam_id, exams]);

  const fetchSchoolId = async () => {
    try {
      const response = await api.get('/schools/');
      if (response.data && response.data.length > 0) {
        setSchoolId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load school', error);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/results/');
      setResults(response.data);
    } catch (error) {
      console.error('Failed to load results', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const response = await api.get('/academics/exams/');
      setExams(response.data);
    } catch (error) {
      console.error('Failed to load exams', error);
    }
  };

  const fetchStudentsBySection = async (sectionId: string) => {
    try {
      const response = await api.get(`/students/?current_section=${sectionId}&status=ACTIVE`);
      const data = response.data.results || response.data;
      setSectionStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load students', error);
      setSectionStudents([]);
    }
  };

  const handleSubmit = async (data: Record<string, string | number>) => {
    setSubmitting(true);
    setError('');

    if (!data.exam_id || !data.student_id) {
      setError('Please select both an exam and a student.');
      setSubmitting(false);
      return;
    }
    console.log('Submitting result payload:', {
      exam_id: data.exam_id,
      student_id: data.student_id,
      marks_obtained: data.is_absent === 'true' ? 0 : parseFloat(data.marks_obtained as string),
      is_absent: data.is_absent === 'true',
      remarks: data.remarks || undefined,
    });
    try {
      await api.post('/academics/results/', {
        exam_id: data.exam_id,
        student_id: data.student_id,
        marks_obtained: data.is_absent === 'true' ? 0 : parseFloat(data.marks_obtained as string),
        is_absent: data.is_absent === 'true',
        remarks: data.remarks || undefined,
      });
      setSuccessMessage('Result recorded successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowModal(false);
      setFormData({
        exam_id: '',
        student_id: '',
        marks_obtained: '',
        is_absent: 'false',
        remarks: '',
      });
      fetchResults();
    } catch (err: any) {
      const errMsg = err.response?.data?.detail 
        || err.response?.data?.non_field_errors?.[0] 
        || Object.values(err.response?.data || {})[0] 
        || 'Failed to record result';
      setError(Array.isArray(errMsg) ? errMsg[0] : errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredResults = results.filter(r =>
    r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.subject_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fields = [
    {
      name: 'exam_id',
      label: 'Exam',
      type: 'select' as const,
      required: true,
      options: exams.map(e => ({ 
        value: e.id, 
        label: `${e.name} - ${e.subject_name} (${e.section_name})` 
      })),
    },
    {
      name: 'student_id',
      label: 'Student',
      type: 'select' as const,
      required: true,
      disabled: !formData.exam_id,
      options: sectionStudents.map(s => ({ 
        value: s.id, 
        label: `${s.first_name} ${s.last_name} (${s.roll_number || s.id})` 
      })),
      placeholder: formData.exam_id ? 'Select a student' : 'Select an exam first',
    },
    {
      name: 'is_absent',
      label: 'Attendance Status',
      type: 'select' as const,
      required: true,
      options: [
        { value: 'false', label: 'Present' },
        { value: 'true', label: 'Absent' },
      ],
    },
    {
      name: 'marks_obtained',
      label: 'Marks Obtained',
      type: 'number' as const,
      required: true,
      min: 0,
      placeholder: 'Enter marks',
    },
    {
      name: 'remarks',
      label: 'Remarks (Optional)',
      type: 'textarea' as const,
      placeholder: 'Additional notes',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <FileText size={32} /> Results & Report Cards
            </h1>
            <p className="text-indigo-100">Record marks and generate report cards</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Add Result
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 flex items-start gap-3">
        <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> You can only enter results for active exams within the entry window. Contact admin if you need to modify locked results.
        </p>
      </div>

      {successMessage && (
        <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-bounce">
          <Award size={20} />
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No results found</p>
          <p className="text-sm mt-2">Record student results to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResults.map((result) => (
            <div key={result.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition transform hover:scale-105">
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{result.student_name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{result.student_suid}</p>
                  <p className="text-sm text-gray-600 mt-2">{result.exam_name}</p>
                </div>
                {result.is_absent && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-bold rounded">ABSENT</span>
                )}
              </div>
              
              {result.is_absent ? (
                <div className="text-center py-8">
                  <span className="inline-block px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-full">
                    NO MARKS (ABSENT)
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Marks Obtained</p>
                    <p className="text-3xl font-bold text-indigo-700">{result.marks_obtained}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">Percentage</p>
                      <p className="text-2xl font-bold text-blue-600">{result.percentage}%</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">Grade</p>
                      <p className="text-2xl font-bold text-purple-600">{result.grade}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">{result.subject_name}</p>
                </div>
              )}

              <button onClick={() => router.push(`/dashboard/academics/results/${result.id}`)} className="w-full mt-4 text-sm font-medium text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 py-2 border border-indigo-200 rounded-lg transition duration-200">
                View Full Details
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record Result"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Record Result"
        color="indigo"
      />
    </div>
  );
}
