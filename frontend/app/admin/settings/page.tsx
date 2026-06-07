'use client';


import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import API_BASE_URL from '@/lib/api';

type ExamType = {
  id?: number;
  name: string;
  code: string;
  weightage_percent: number;
  max_marks: number;
  passing_marks_percent: number;
  category: string;
};

type SchoolSettings = {
  enable_gatepass_print?: boolean;
  [key: string]: any;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'exam-types' | 'create-exams' | 'gatepass-settings' | 'promotion-history'>('exam-types');
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ExamType>({
    id: undefined,
    name: '',
    code: '',
    weightage_percent: 0,
    max_marks: 100,
    passing_marks_percent: 33,
    category: 'EXAM',
  });
  const [promotionHistory, setPromotionHistory] = useState<{ year: string; fromGrade: string; fromSection: string; toGrade: string; toSection: string; }[]>([]);

  useEffect(() => {
    if (activeTab === 'exam-types') fetchExamTypes();
    if (activeTab === 'gatepass-settings') fetchSchoolSettings();
    if (activeTab === 'promotion-history') fetchPromotionHistory();
  }, [activeTab]);

  const fetchSchoolSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/schools/settings/my_settings/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch settings: ${response.status}`);
      const data = await response.json();
      setSchoolSettings(data);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleGatepassPrint = async (enabled: boolean) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/schools/settings/update_my_settings/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enable_gatepass_print: enabled })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || `Failed to update: ${response.status}`);
      }
      const data = await response.json();
      setSchoolSettings(data);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchExamTypes = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/schools/exam-types/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch exam types: ${response.status}`);
      }

      const data = await response.json();
      setExamTypes(Array.isArray(data) ? data : data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotionHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/students/academic-history/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch academic history: ${response.status}`);
      const data = await response.json();

      // Process data to calculate promotion history
      const processedHistory = data.map((record: any, index: number) => {
        if (index === 0) return null; // Skip the first record as it has no previous year

        const previousRecord = data[index - 1];
        if (record.grade < previousRecord.grade) {
          return {
            year: record.year,
            fromGrade: previousRecord.grade,
            fromSection: previousRecord.section,
            toGrade: record.grade,
            toSection: record.section,
          };
        }
        return null;
      }).filter((record: any) => record !== null); // Remove null values

      setPromotionHistory(processedHistory);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const url = formData.id
        ? `${API_BASE_URL}/schools/exam-types/${formData.id}/`
        : `${API_BASE_URL}/schools/exam-types/`;
      const response = await fetch(url, {
        method: formData.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          weightage_percent: Number(formData.weightage_percent),
          max_marks: Number(formData.max_marks),
          passing_marks_percent: Number(formData.passing_marks_percent),
          category: formData.category,
        }),
      });
      if (!response.ok) {
        const error_data = await response.json();
        throw new Error(error_data.detail || `Failed to save: ${response.status}`);
      }
      setFormData({
        id: undefined,
        name: '',
        code: '',
        weightage_percent: 0,
        max_marks: 100,
        passing_marks_percent: 33,
        category: 'EXAM',
      });
      setShowForm(false);
      fetchExamTypes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exam type?')) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/schools/exam-types/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.status}`);
      }

      fetchExamTypes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (exam: ExamType) => {
    setFormData({ ...exam });
    setShowForm(true);
  };

  const handleCancel = () => {
    setFormData({
      id: undefined,
      name: '',
      code: '',
      weightage_percent: 0,
      max_marks: 100,
      passing_marks_percent: 33,
      category: 'EXAM',
    });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700">Settings</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">School Settings</h1>

        {/* Tabs */}
        <div className="bg-white border-b rounded-t-lg">
          <div className="flex">
            <button
              onClick={() => setActiveTab('exam-types')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'exam-types'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Exam Types
            </button>
            <button
              onClick={() => setActiveTab('create-exams')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'create-exams'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Exams (Bulk)
            </button>
            <button
              onClick={() => setActiveTab('gatepass-settings')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'gatepass-settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Gate Pass
            </button>
            <button
              onClick={() => setActiveTab('promotion-history')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'promotion-history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Promotion History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-lg p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {activeTab === 'exam-types' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Exam Types Configuration</h2>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Exam Type
                  </button>
                )}
              </div>

              {showForm && (
                <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
                  <h3 className="text-xl font-semibold mb-4">
                    {formData.id ? 'Edit Exam Type' : 'New Exam Type'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Final Exam, Mid-term, Unit Test"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., FE, MT, UT"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Marks
                        </label>
                        <input
                          type="number"
                          value={formData.max_marks}
                          onChange={(e) => setFormData({ ...formData, max_marks: Number(e.target.value) })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Passing Marks % 
                        </label>
                        <input
                          type="number"
                          value={formData.passing_marks_percent}
                          onChange={(e) => setFormData({ ...formData, passing_marks_percent: Number(e.target.value) })}
                          min="0"
                          max="100"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weightage %
                        </label>
                        <input
                          type="number"
                          value={formData.weightage_percent}
                          onChange={(e) => setFormData({ ...formData, weightage_percent: Number(e.target.value) })}
                          min="0"
                          max="100"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="EXAM">Exam</option>
                          <option value="QUIZ">Quiz</option>
                          <option value="TEST">Test</option>
                          <option value="ASSIGNMENT">Assignment</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : formData.id ? 'Update' : 'Create'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {loading && !showForm && (
                <div className="text-center py-8 text-gray-600">Loading exam types...</div>
              )}

              {!loading && examTypes.length === 0 && !showForm && (
                <div className="text-center py-8 text-gray-600">
                  No exam types configured yet. Create one to get started!
                </div>
              )}

              {examTypes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Max Marks</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Pass %</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Weight %</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examTypes.map((exam) => (
                        <tr key={exam.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{exam.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{exam.code}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{exam.max_marks}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{exam.passing_marks_percent}%</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{exam.weightage_percent}%</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {exam.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm space-x-2">
                            <button
                              onClick={() => handleEdit(exam)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => exam.id !== undefined && handleDelete(exam.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'gatepass-settings' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Gate Pass Settings</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
              {!schoolSettings && (
                <div className="py-6 text-gray-600">Loading settings...</div>
              )}
              {schoolSettings && (
                <div className="p-4 bg-gray-50 rounded border">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!schoolSettings.enable_gatepass_print}
                      onChange={(e) => toggleGatepassPrint(e.target.checked)}
                    />
                    <span className="text-sm">Enable Print Button on Digital Pass QR</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">When enabled, a print icon appears when hovering the QR code on the student profile and gatepass pages.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'create-exams' && (
            <BulkExamCreation />
          )}

          {activeTab === 'promotion-history' && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Promotion History</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
              {loading && (
                <div className="py-6 text-gray-600">Loading promotion history...</div>
              )}
              {!loading && promotionHistory.length === 0 && (
                <div className="py-6 text-gray-600">No promotion history available.</div>
              )}
              {!loading && promotionHistory.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Year</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">From</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promotionHistory.map((record, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{record.year}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.fromGrade} - {record.fromSection}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.toGrade} - {record.toSection}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkExamCreation() {
  type BulkExamFormData = {
    exam_type_id: string;
    grade_id: string;
    subject_ids: number[];
    academic_year: string;
  };
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState<BulkExamFormData>({
    exam_type_id: '',
    grade_id: '',
    subject_ids: [],
    academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdExams, setCreatedExams] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('access_token');

    try {
      // Fetch exam types
      const examRes = await fetch(`${API_BASE_URL}/schools/exam-types/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (examRes.ok) {
        const data = await examRes.json();
        setExamTypes(Array.isArray(data) ? data : data.results || []);
      }

      // Fetch grades
      const gradesRes = await fetch(`${API_BASE_URL}/academics/grades/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (gradesRes.ok) {
        const data = await gradesRes.json();
        setGrades(Array.isArray(data) ? data : data.results || []);
      }

      // Fetch subjects
      const subjectsRes = await fetch(`${API_BASE_URL}/academics/subjects/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        setSubjects(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectToggle = (subjectId: number) => {
    setFormData(prev => ({
      ...prev,
      subject_ids: prev.subject_ids.includes(subjectId)
        ? prev.subject_ids.filter(id => id !== subjectId)
        : [...prev.subject_ids, subjectId]
    }));
  };

  interface BulkCreateExamsResponse {
    message: string;
    created_exams: {
      id: number;
      name: string;
      subject: string;
      section: string;
      max_marks: number;
      [key: string]: any;
    }[];
  }

  interface BulkExamFormSubmitEvent extends React.FormEvent<HTMLFormElement> {}

  const handleSubmit = async (e: BulkExamFormSubmitEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setCreatedExams([]);

    if (!formData.exam_type_id || !formData.grade_id || formData.subject_ids.length === 0) {
      setError('Please select exam type, grade, and at least one subject');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/schools/exam-types/bulk-create-exams/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error || `Failed: ${response.status}`);
      }

      const data: BulkCreateExamsResponse = await response.json();
      setSuccess(data.message);
      setCreatedExams(data.created_exams || []);
      setFormData({
        exam_type_id: '',
        grade_id: '',
        subject_ids: [],
        academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating exams:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Exam Creation</h2>
      <p className="text-gray-600 mb-6">
        Create exams for all sections of a grade in a single operation. Select exam type, grade, and subjects.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg border mb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exam Type *
            </label>
            <select
              required
              value={formData.exam_type_id}
              onChange={(e) => setFormData({ ...formData, exam_type_id: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select an exam type</option>
              {examTypes.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade *
            </label>
            <select
              required
              value={formData.grade_id}
              onChange={(e) => setFormData({ ...formData, grade_id: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a grade</option>
              {grades.map(grade => (
                <option key={grade.id} value={grade.id}>
                  {grade.grade_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Subjects * ({formData.subject_ids.length} selected)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subjects.map(subject => (
              <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.subject_ids.includes(subject.id)}
                  onChange={() => handleSubjectToggle(subject.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">{subject.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Academic Year
          </label>
          <input
            type="text"
            value={formData.academic_year}
            onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="2025-2026"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Creating Exams...' : `Create Exams (${formData.subject_ids.length} subjects × all sections)`}
        </button>
      </form>

      {createdExams.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-green-900 mb-4">
            Successfully Created {createdExams.length} Exams
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-green-900">Name</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-green-900">Subject</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-green-900">Section</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-green-900">Max Marks</th>
                </tr>
              </thead>
              <tbody>
                {createdExams.map((exam) => (
                  <tr key={exam.id} className="border-b border-green-100">
                    <td className="px-4 py-2 text-sm text-green-900">{exam.name}</td>
                    <td className="px-4 py-2 text-sm text-green-700">{exam.subject}</td>
                    <td className="px-4 py-2 text-sm text-green-700">{exam.section}</td>
                    <td className="px-4 py-2 text-sm text-green-700">{exam.max_marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
