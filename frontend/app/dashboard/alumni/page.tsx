'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  GraduationCap, Search, UserPlus, Calendar, Award, 
  TrendingUp, X, Loader2, BookOpen 
} from 'lucide-react';
import { useSettings } from '@/lib/SettingsContext';

interface AlumniStudent {
  id: string;
  student_name: string;
  student_suid: string;
  grade: string;
  section: string;
  academic_year: string;
  status: string;
  enrollment_date: string;
  student_status?: string;
}

export default function AlumniPage() {
  const { formatAcademicYear } = useSettings();
  const [alumni, setAlumni] = useState<AlumniStudent[]>([]);
  const [filteredAlumni, setFilteredAlumni] = useState<AlumniStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AlumniStudent | null>(null);
  const [selectedSection, setSelectedSection] = useState('');

  useEffect(() => {
    fetchAlumni();
  }, []);

  useEffect(() => {
    filterAlumni();
  }, [searchTerm, selectedYear, alumni]);

  const fetchAlumni = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Fetch enrollments with status GRADUATED.
      // Thanks to backend filtering, once student status changes to ACTIVE, they are omitted.
      const response = await axios.get(
        'http://localhost:8000/api/v1/enrollments/student-enrollments/?status=GRADUATED',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlumni(response.data);
      setFilteredAlumni(response.data);
    } catch (error) {
      console.error('Failed to fetch alumni', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAlumni = () => {
    let filtered = [...alumni];
    
    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.student_suid?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(a => a.academic_year === selectedYear);
    }
    
    setFilteredAlumni(filtered);
  };

  const handleOpenReEnrollModal = (student: AlumniStudent) => {
    setSelectedStudent(student);
    setSelectedSection('');
    setIsModalOpen(true);
  };

  const handleReEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedSection) return;
    
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/enrollments/student-enrollments/${selectedStudent.id}/re_enroll/`,
        { new_section: selectedSection },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`Student successfully readmitted to Grade 11 Section ${selectedSection}!`);
      setIsModalOpen(false);
      setSelectedStudent(null);
      fetchAlumni();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || 'Failed to re-enroll'}`);
    }
  };

  const handleConfirmAlumni = async (studentEnrollmentId: string) => {
    if (!window.confirm('Are you sure you want to make this student a confirmed alumni?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/enrollments/student-enrollments/${studentEnrollmentId}/confirm_alumni/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Student confirmed as alumni successfully!');
      fetchAlumni();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || 'Failed to confirm alumni'}`);
    }
  };

  const graduationYears = [...new Set(alumni.map(a => a.academic_year))].sort().reverse();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50/50">
        <Loader2 className="h-10 w-10 text-purple-600 animate-spin mb-4" />
        <div className="text-gray-500 font-medium">Retrieving alumni records...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50/30 min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 rounded-3xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-8">
          <GraduationCap className="h-64 w-64" />
        </div>
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Alumni Association</h1>
          </div>
          <p className="text-indigo-100/90 font-medium text-sm md:text-base max-w-xl">
            Promote outstanding graduates, manage Grade 10 continuations, and instantly readmit students back into academic rosters.
          </p>
        </div>
      </div>

      {/* Modern Dashboard Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" /> Active Journeys
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">{alumni.length}</div>
          <div className="text-slate-500 font-medium text-xs mt-1">Total Alumni Directory</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">{graduationYears.length}</div>
          <div className="text-slate-500 font-medium text-xs mt-1">Graduation Batches</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <Award className="h-6 w-6" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 truncate tracking-tight">
            {graduationYears.length > 0 ? formatAcademicYear(graduationYears[0]) : 'N/A'}
          </div>
          <div className="text-slate-500 font-medium text-xs mt-2">Latest Graduation Batch</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
              <UserPlus className="h-6 w-6" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {alumni.filter(a => a.student_status === 'PENDING_ALUMNI').length}
          </div>
          <div className="text-slate-500 font-medium text-xs mt-1">Pending Grade 10 Actions</div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or SUID identifier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-700 bg-slate-50/50 hover:bg-slate-50 transition-all font-medium placeholder-slate-400"
            />
          </div>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-5 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-purple-500 font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
          >
            <option value="all">📅 All Graduation Years</option>
            {graduationYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Premium Styled Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/70 text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Student Profile</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">SUID Reference</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Status Badge</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Exit Level</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Academic Year</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-slate-700">
              {filteredAlumni.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <GraduationCap className="h-12 w-12 text-slate-300" />
                      <div className="text-slate-500 font-semibold text-base">No alumni matching criteria found</div>
                      <div className="text-slate-400 text-sm">Clear your search filters or generate promotion previews.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlumni.map(alumnus => (
                  <tr key={alumnus.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Student Identity */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-inner">
                          <GraduationCap className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-3 font-semibold text-slate-800 hover:text-indigo-600 transition-colors">
                          {alumnus.student_name}
                        </div>
                      </div>
                    </td>
                    
                    {/* SUID */}
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl px-2 py-1 inline-block mt-3 ml-6">
                      {alumnus.student_suid}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {alumnus.student_status === 'PENDING_ALUMNI' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse">
                          Pending Grade 10 Decision
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                          Confirmed Alumni
                        </span>
                      )}
                    </td>

                    {/* Final Grade */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">
                      Grade {alumnus.grade} (Section {alumnus.section})
                    </td>

                    {/* Graduation Year */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-500">
                      {formatAcademicYear(alumnus.academic_year)}
                    </td>

                    {/* Action Panel */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                      {alumnus.student_status === 'PENDING_ALUMNI' ? (
                        <>
                          <button
                            onClick={() => handleConfirmAlumni(alumnus.id)}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            Confirm Alumni
                          </button>
                          <button
                            onClick={() => handleOpenReEnrollModal(alumnus)}
                            className="px-4 py-2 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            Re-Admit
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 font-bold text-xs bg-slate-100/60 px-3 py-1.5 rounded-xl border border-slate-200/50">
                          Journey Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Pop-up Section-Selector Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-opacity">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform scale-100 transition-all">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative">
              <button 
                onClick={() => { setIsModalOpen(false); setSelectedStudent(null); }}
                className="absolute right-4 top-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <UserPlus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">Re-Admit Student</h2>
                  <p className="text-teal-100 text-xs font-semibold mt-0.5">Readmitting to Grade 11 Class</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleReEnrollSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="text-slate-400 font-bold text-xs uppercase tracking-wider">Target Student</div>
                <div className="font-extrabold text-slate-800 text-base">{selectedStudent.student_name}</div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>SUID: {selectedStudent.student_suid}</span>
                  <span>Previous: Grade {selectedStudent.grade}-{selectedStudent.section}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-600 font-bold text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-emerald-600" /> Target Grade 11 Section
                </label>

                <input
                  type="text"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value.toUpperCase())}
                  placeholder="e.g. A, B, C, Science-1 …"
                  maxLength={20}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-700 font-bold bg-slate-50/50 hover:bg-slate-50 transition-all placeholder-slate-400 shadow-inner"
                />

                <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                  Type any section name. If it does not exist yet it will be <strong className="text-emerald-600 font-bold">created automatically</strong>. Upon submission the student is removed from the alumni registry and reinstated as an <strong className="text-emerald-600 font-bold">ACTIVE</strong> Grade 11 student.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setSelectedStudent(null); }}
                  className="flex-1 py-3 border-2 border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-bold rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 hover:shadow-xl transition-all"
                >
                  Confirm Re-Admit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
