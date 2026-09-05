'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { BookOpen, Search, ArrowLeft, Loader2, Calendar, User, Book, Plus, Filter, X, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { usePermissionContext } from '@/lib/rbac-context';

export default function CirculationLogPage() {
  const { hasPermission, isAdmin } = usePermissionContext();
  const canView = isAdmin || hasPermission('library.view_circulation_log') || hasPermission('library.edit_circulation_log') || hasPermission('library.view_transactions') || hasPermission('library.issue_book');
  const canEdit = isAdmin || hasPermission('library.edit_circulation_log') || hasPermission('library.issue_book');

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Form State
  const [formData, setFormData] = useState({
    borrower_type: 'STUDENT',
    student: '',
    teacher: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    isbn: '',
    status: 'ISSUED'
  });
  
  // Filter State for Students
  const [studentFilters, setStudentFilters] = useState({
    grade: '',
    section: '',
    name: ''
  });
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  
  // Data for Dropdowns
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<any>(null);

  useEffect(() => {
    fetchLogs();
    fetchInitialData();
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/library/policy/current/');
      setPolicy(res.data);
    } catch (err) {
      console.error('Failed to fetch policy', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await api.get('/library/logs/');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [stuRes, teaRes, gradeRes, secRes] = await Promise.all([
        api.get('/students/'),
        api.get('/teachers/profiles/'),
        api.get('/academics/grades/'),
        api.get('/academics/sections/')
      ]);
      setStudents(stuRes.data);
      setTeachers(teaRes.data);
      setGrades(gradeRes.data);
      setSections(secRes.data);
    } catch (err) {
      console.error('Failed to fetch filter data', err);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesGrade = !studentFilters.grade || s.grade_config === studentFilters.grade;
      const matchesSection = !studentFilters.section || s.current_section === studentFilters.section;
      const matchesName = !studentFilters.name || 
        s.full_name.toLowerCase().includes(studentFilters.name.toLowerCase());
      return matchesGrade && matchesSection && matchesName;
    });
  }, [students, studentFilters]);

  const handleIssue = async () => {
    const borrowerId = formData.borrower_type === 'STUDENT' ? formData.student : formData.teacher;
    if (!borrowerId || !formData.due_date || !formData.isbn) {
      setError('Please fill all required fields.');
      return;
    }

    if (policy) {
      const maxDuration = formData.borrower_type === 'STUDENT' ? policy.max_duration_student : policy.max_duration_teacher;
      const issueDate = new Date(formData.issue_date);
      const dueDate = new Date(formData.due_date);
      const diffTime = Math.abs(dueDate.getTime() - issueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > maxDuration) {
        setError(`Maximum duration for ${formData.borrower_type.toLowerCase()}s is ${maxDuration} days.`);
        return;
      }
    }
    
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        student: formData.borrower_type === 'STUDENT' ? formData.student : null,
        teacher: formData.borrower_type === 'TEACHER' ? formData.teacher : null,
      };
      await api.post('/library/logs/', payload);
      setShowIssueModal(false);
      setFormData({
        borrower_type: 'STUDENT',
        student: '',
        teacher: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        isbn: '',
        status: 'ISSUED'
      });
      fetchLogs();
    } catch (err: any) {
      const msg = err.response?.data?.[0] || err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Failed to record transaction.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to update due date based on policy
  useEffect(() => {
    if (policy && formData.issue_date) {
      const duration = formData.borrower_type === 'STUDENT' ? policy.max_duration_student : policy.max_duration_teacher;
      const issueDate = new Date(formData.issue_date);
      const dueDate = new Date(issueDate);
      dueDate.setDate(issueDate.getDate() + parseInt(duration));
      
      setFormData(prev => ({
        ...prev,
        due_date: dueDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.issue_date, formData.borrower_type, policy]);

  const handleReturn = async () => {
    if (!selectedLog) return;
    setSubmitting(true);
    try {
      await api.patch(`/library/logs/${selectedLog.id}/`, {
        status: 'RETURNED',
        return_date: returnDate,
        return_condition: returnCondition
      });
      setShowReturnModal(false);
      setSelectedLog(null);
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.book_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/library" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">🔄 Circulation Log</h1>
            <p className="text-slate-500 font-medium">Issue and return history.</p>
          </div>
        </div>
        {canEdit && (
          <button 
            onClick={() => setShowIssueModal(true)}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={20} /> Issue book
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 ring-1 ring-slate-100">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by book or student..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.1em]">
            <tr>
              <th className="px-6 py-4">Transaction Details</th>
              <th className="px-6 py-4">Dates</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-10 text-center">
                  <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400 font-medium italic">
                  No records found.
                </td>
              </tr>
            ) : filteredLogs.map((log, i) => (
              <tr key={i} className="hover:bg-indigo-50/20 transition group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Book size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{log.book_title}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <User size={12} /> {log.borrower_type === 'STUDENT' ? log.student_name : log.teacher_name}
                        <span className="ml-1 text-[10px] bg-slate-100 px-1 rounded text-slate-400 font-bold uppercase">{log.borrower_type}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs space-y-1">
                    <p className="text-slate-600 flex items-center gap-2">
                      <span className="text-slate-400 w-12">Issued:</span>
                      <span className="font-semibold">{log.issue_date}</span>
                    </p>
                    <p className="text-slate-600 flex items-center gap-2">
                      <span className="text-slate-400 w-12">Due:</span>
                      <span className="font-semibold text-amber-600">{log.due_date}</span>
                    </p>
                    {log.return_date && (
                      <p className="text-slate-600 flex items-center gap-2">
                        <span className="text-slate-400 w-12">Returned:</span>
                        <span className="font-semibold text-green-600">{log.return_date}</span>
                      </p>
                    )}
                    {log.return_condition && (
                      <p className="text-slate-600 flex items-center gap-2">
                        <span className="text-slate-400 w-12">Cond:</span>
                        <span className="font-semibold text-indigo-600 uppercase">{log.return_condition}</span>
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight ${
                    log.status === 'RETURNED' ? 'bg-green-100 text-green-700' : 
                    log.status === 'ISSUED' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="📚 Issue Book"
      >
        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Borrower Type</label>
            <div className="flex gap-4 p-1 bg-slate-100 rounded-xl">
              <button 
                onClick={() => setFormData({...formData, borrower_type: 'STUDENT', teacher: ''})}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.borrower_type === 'STUDENT' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Student
              </button>
              <button 
                onClick={() => setFormData({...formData, borrower_type: 'TEACHER', student: ''})}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.borrower_type === 'TEACHER' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Teacher
              </button>
            </div>
            {policy && (
              <p className="text-[10px] text-indigo-600 font-bold px-1">
                Policy: Max {formData.borrower_type === 'STUDENT' ? policy.max_books_student : policy.max_books_teacher} books for {formData.borrower_type === 'STUDENT' ? policy.max_duration_student : policy.max_duration_teacher} days.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
              Borrower Name <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {formData.borrower_type === 'STUDENT' ? (
                <select 
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  value={formData.student}
                  onChange={(e) => setFormData({...formData, student: e.target.value})}
                >
                  <option value="">Select Student</option>
                  {filteredStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.suid})</option>
                  ))}
                </select>
              ) : (
                <select 
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  value={formData.teacher}
                  onChange={(e) => setFormData({...formData, teacher: e.target.value})}
                >
                  <option value="">Select Teacher</option>
                  {Array.isArray(teachers) && teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.full_name} ({t.tuid})</option>
                  ))}
                </select>
              )}
              {formData.borrower_type === 'STUDENT' && (
                <button 
                  onClick={() => setShowStudentFilters(!showStudentFilters)}
                  className={`p-2.5 rounded-xl border transition-all ${showStudentFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                >
                  <Filter size={18} />
                </button>
              )}
            </div>
          </div>

          {showStudentFilters && (
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase">Grade</label>
                  <select 
                    className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs font-medium"
                    value={studentFilters.grade}
                    onChange={(e) => setStudentFilters({...studentFilters, grade: e.target.value})}
                  >
                    <option value="">All Grades</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase">Division</label>
                  <select 
                    className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs font-medium"
                    value={studentFilters.section}
                    onChange={(e) => setStudentFilters({...studentFilters, section: e.target.value})}
                  >
                    <option value="">All Div</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-400 uppercase">Search Name</label>
                <input 
                  type="text"
                  placeholder="Type name..."
                  className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs font-medium"
                  value={studentFilters.name}
                  onChange={(e) => setStudentFilters({...studentFilters, name: e.target.value})}
                />
              </div>
              <button 
                onClick={() => setStudentFilters({grade: '', section: '', name: ''})}
                className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
              >
                Clear Filters
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Date Issued *</label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.issue_date}
                onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Return On *</label>
              <input 
                type="date" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase text-slate-500">ISBN Number *</label>
            <input 
              type="number" 
              placeholder="Enter ISBN..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={formData.isbn}
              onChange={(e) => setFormData({...formData, isbn: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => setShowIssueModal(false)}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleIssue}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:bg-indigo-300"
            >
              {submitting ? 'Recording...' : 'Record Issue'}
            </button>
          </div>
        </div>
      </Modal>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          📥 Return History (Active Issues)
        </h2>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.1em]">
              <tr>
                <th className="px-6 py-4">Book & Borrower</th>
                <th className="px-6 py-4">Issue Details</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.filter(l => l.status === 'ISSUED').length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-slate-400 font-medium italic">
                    No active issues found.
                  </td>
                </tr>
              ) : logs.filter(l => l.status === 'ISSUED').map((log, i) => (
                <tr key={i} className="hover:bg-indigo-50/20 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Book size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{log.book_title}</p>
                        <p className="text-xs text-slate-500">{log.borrower_type === 'STUDENT' ? log.student_name : log.teacher_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                      <p className="text-slate-600">Issued: <span className="font-bold">{log.issue_date}</span></p>
                      <p className="text-amber-600 font-bold">Due: {log.due_date}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                  {canEdit ? (
                    <button 
                      onClick={() => {
                        setSelectedLog(log);
                        setShowReturnModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-2"
                    >
                      <CheckCircle size={14} /> Collected
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight bg-blue-100 text-blue-700">
                      ISSUED
                    </span>
                  )}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Condition Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="📥 Mark as Collected"
      >
        <div className="space-y-4 py-2">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <p className="text-sm font-medium text-emerald-800">
              Returning: <span className="font-bold">{selectedLog?.book_title}</span>
            </p>
            <p className="text-xs text-emerald-600">
              Borrowed by: {selectedLog?.borrower_type === 'STUDENT' ? selectedLog?.student_name : selectedLog?.teacher_name}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Condition of Book</label>
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value)}
            >
              <option value="GOOD">Good</option>
              <option value="LOST">Lost</option>
              <option value="WORN">Worn</option>
              <option value="DAMAGED">Damaged</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Date of Return</label>
            <input 
              type="date" 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => setShowReturnModal(false)}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleReturn}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:bg-emerald-300"
            >
              {submitting ? 'Updating...' : 'Confirm Return'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

