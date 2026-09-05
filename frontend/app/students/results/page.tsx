'use client';

import { useState, useEffect } from 'react';
import { 
  Award, BookOpen, ShieldCheck, Lock, Info
} from 'lucide-react';
import api from '@/lib/api';

interface ExamItem {
  id: string;
  exam_name: string;
  subject_name: string;
  exam_type: string;
  exam_type_display: string;
  exam_category: string;
  exam_category_display: string;
  max_marks: number;
  passing_marks: number;
  marks_obtained: string;
  status: string;
  grade: string;
  exam_date: string;
}

export default function StudentResultsPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/academics/exams/student_marks_and_results/');
      setExams(res.data?.exams || []);
    } catch (err) {
      console.error('Failed to load student marks & results', err);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall statistics across evaluated exams
  const evaluatedExams = exams.filter((e) => e.marks_obtained !== '-' && e.marks_obtained !== 'AB');
  const totalMaxMarks = evaluatedExams.reduce((acc, curr) => acc + (curr.max_marks || 0), 0);
  const totalObtainedMarks = evaluatedExams.reduce((acc, curr) => acc + (parseFloat(curr.marks_obtained) || 0), 0);
  const overallPercentage = totalMaxMarks > 0 ? ((totalObtainedMarks / totalMaxMarks) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-purple-600" /> View-Only Access
            </span>
            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-extrabold flex items-center gap-1">
              <Lock size={11} /> School Admin Synced
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Award size={24} />
            </div>
            Marks & Academic Results
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official examination scores and marks entry evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-purple-50 border border-purple-100 px-5 py-2.5 rounded-2xl text-right">
            <span className="text-xs text-purple-700 font-bold block">Evaluated Average</span>
            <span className="text-xl font-black text-purple-800">
              {overallPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* EXAMS TABLE (Connected to Exams & Marks Entry) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen size={20} className="text-purple-600" /> Examinations & Evaluation Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exams configured in School Admin Exams section with scores fetched from Marks Entry.
            </p>
          </div>
          <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
            {exams.length} {exams.length === 1 ? 'Exam' : 'Exams'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-semibold text-sm">
            Fetching exam schedules & marks entry records...
          </div>
        ) : exams.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Info size={28} className="mx-auto text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">No Exams Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No examination records have been created by School Admin for your grade & section yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Exam Name</th>
                  <th className="py-3.5 px-4">Exam Type</th>
                  <th className="py-3.5 px-4">Exam Category</th>
                  <th className="py-3.5 px-4">Maximum Marks</th>
                  <th className="py-3.5 px-4">Passing Marks</th>
                  <th className="py-3.5 px-4">Marks Obtained</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900">
                      <div>{ex.exam_name}</div>
                      <div className="text-xs text-slate-400 font-normal">{ex.subject_name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                        {ex.exam_type_display}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-100">
                        {ex.exam_category_display}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-slate-900">{ex.max_marks}</td>
                    <td className="py-4 px-4 font-bold text-slate-500">{ex.passing_marks}</td>
                    <td className="py-4 px-4">
                      {ex.marks_obtained === 'AB' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-full border border-rose-200">
                          AB (Absent)
                        </span>
                      ) : ex.marks_obtained === '-' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 font-semibold text-xs rounded-full">
                          Pending Entry
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">
                            {ex.marks_obtained}
                          </span>
                          <span className="text-xs font-bold text-slate-400">/ {ex.max_marks}</span>
                          {ex.status === 'PASS' && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-md border border-emerald-200">
                              PASS
                            </span>
                          )}
                          {ex.status === 'FAIL' && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-[11px] rounded-md border border-rose-200">
                              FAIL
                            </span>
                          )}
                        </div>
                      )}
                    </td>
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
