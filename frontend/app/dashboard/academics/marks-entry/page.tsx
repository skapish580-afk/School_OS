'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, PenTool, Loader2, Search, BookMarked } from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  subject_name: string;
  section_name: string;
  max_marks: number;
  passing_marks: number;
  exam_date: string;
}

interface MarksStatus {
  total_students: number;
  marks_recorded: number;
  pending: number;
  percentage: number;
}

interface ExamWithStatus extends Exam {
  status?: MarksStatus;
}

export default function MarksEntryPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');

  useEffect(() => {
    fetchSchoolId();
    fetchExams();
  }, []);

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

  const fetchExams = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/exams/');
      setExams(response.data);
    } catch (error) {
      console.error('Failed to load exams', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.section_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <PenTool size={32} /> Marks Entry
            </h1>
            <p className="text-blue-100">Record and manage student exam marks</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by exam name, subject, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <BookMarked size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No exams found</p>
          <p className="text-sm mt-2">Create exams first to record marks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredExams.map((exam) => (
            <div key={exam.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{exam.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>📚 {exam.subject_name}</span>
                    <span>👥 {exam.section_name}</span>
                    <span>📅 {new Date(exam.exam_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">
                  {exam.exam_type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Total Marks</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.max_marks}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Passing Marks</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.passing_marks}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">Exam Type</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.exam_type}</p>
                </div>
              </div>

              <button
                onClick={() => router.push(`/dashboard/academics/marks-entry/${exam.id}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
              >
                <PenTool size={20} /> Enter Marks
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
