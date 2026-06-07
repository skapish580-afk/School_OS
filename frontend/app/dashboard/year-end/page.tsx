'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Calendar, Users, GraduationCap, CheckCircle, Search, Loader2 } from 'lucide-react';
import Modal from '@/components/Modal';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/SettingsContext';

interface AcademicYear {
  id: string | number;
  year_code: string;
  start_date: string;
  end_date: string;
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSING' | 'CLOSED';
}

interface Enrollment {
  id: string;
  student: string;
  student_name: string;
  student_suid: string;
  grade: string;
  grade_name: string;
  section: string;
  section_name: string;
  academic_year: string;
  status: string;
}

export default function PromotionsPage() {
  const router = useRouter();
  const { formatAcademicYear } = useSettings();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearCode, setSelectedYearCode] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Promotion Modal State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [promoteFormData, setPromoteFormData] = useState({
    new_section: '',
    percentage: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const schoolRes = await api.get('/schools/settings/my_settings/');
        setSchoolId(schoolRes.data.school);
        
        const yearsRes = await api.get('/enrollments/academic-years/');
        const years = yearsRes.data.results || yearsRes.data || [];
        
        // Fetch sections for the dropdown
        const sectionsRes = await api.get('/academics/sections/');
        const sectionsData = sectionsRes.data.results || sectionsRes.data || [];
        setSections(sectionsData);
        
        // Deduplicate and sort
        const uniq = new Map<string, AcademicYear>();
        years.forEach((y: AcademicYear) => {
          if (!uniq.has(y.year_code)) uniq.set(y.year_code, y);
        });
        const uniqueYears = Array.from(uniq.values());
        uniqueYears.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        setAcademicYears(uniqueYears);
        
        const active = uniqueYears.find(y => y.status === 'ACTIVE');
        if (active) setSelectedYearCode(active.year_code);
        else if (uniqueYears.length > 0) setSelectedYearCode(uniqueYears[0].year_code);
        
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYearCode) {
      fetchEnrollments();
    }
  }, [selectedYearCode]);

  const fetchEnrollments = async () => {
    if (!selectedYearCode) return;
    setLoading(true);
    try {
      const response = await api.get('/enrollments/student-enrollments/', {
        params: {
          academic_year: selectedYearCode,
          status: 'ACTIVE'
        }
      });
      const data = response.data.results || response.data || [];
      setEnrollments(data);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteClick = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setPromoteFormData({
      new_section: enrollment.section,
      percentage: ''
    });
    setShowPromoteModal(true);
  };

  const handlePromoteSubmit = async (data: any) => {
    if (!selectedEnrollment) return;
    setSubmitting(true);
    try {
      await api.post(`/enrollments/student-enrollments/${selectedEnrollment.id}/promote/`, {
        new_section: data.new_section,
        percentage: data.percentage
      });
      toast.success('Student promoted successfully!');
      setShowPromoteModal(false);
      fetchEnrollments(); // Refresh list
    } catch (error: any) {
      console.error('Promotion error:', error);
      toast.error(error.response?.data?.error || 'Failed to promote student');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEnrollments = enrollments.filter(e => 
    e.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.student_suid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.grade_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedYearObj = academicYears.find(y => y.year_code === selectedYearCode);

  // Prepare section options from the fetched sections
  const sectionOptions = Array.from(new Set(sections.map(s => s.section_letter || s.name?.split(' ')[1] || s.section)))
    .sort()
    .map(letter => ({
      value: letter,
      label: `Section ${letter}`
    }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <GraduationCap className="text-blue-600 w-8 h-8" />
                Student Promotions
              </h1>
              <p className="text-gray-600 mt-1">Manage grade progression and year-end transitions</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                  Academic Year
                </label>
                <select
                  value={selectedYearCode || ''}
                  onChange={(e) => setSelectedYearCode(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-700"
                >
                  {academicYears.map((year) => (
                    <option key={year.year_code} value={year.year_code}>
                      {formatAcademicYear(year.year_code)} ({year.status})
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedYearObj && (
                <div className="hidden lg:block border-l border-gray-200 pl-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedYearObj.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedYearObj.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by student name, SUID or grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} />
              <span className="font-medium">{filteredEnrollments.length} Students found</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Fetching student records...</p>
              </div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="text-gray-400 w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">No active students found</h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-1">
                  There are no active enrollments for the {formatAcademicYear(selectedYearCode)} academic year.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Grade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEnrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                            {enrollment.student_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {enrollment.student_name}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">{enrollment.student_suid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold">
                          Grade {enrollment.grade_name || enrollment.grade}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-700">Section {enrollment.section_name || enrollment.section}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle size={14} />
                          <span className="text-xs font-bold uppercase tracking-wide">Active</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePromoteClick(enrollment)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95 transition-all"
                        >
                          <GraduationCap size={14} />
                          Promote Student
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Promote Modal */}
      {showPromoteModal && selectedEnrollment && (
        <Modal
          title={`Promote: ${selectedEnrollment.student_name}`}
          onClose={() => setShowPromoteModal(false)}
          fields={[
            {
              name: 'new_section',
              label: 'Target Section',
              type: 'select',
              required: true,
              options: sectionOptions
            },
            {
              name: 'percentage',
              label: 'Percentage in Current Grade (%)',
              type: 'number',
              required: true,
              placeholder: 'e.g., 85.5'
            }
          ]}
          formData={promoteFormData}
          onFormChange={(field, value) => setPromoteFormData(prev => ({ ...prev, [field]: value }))}
          onSubmit={handlePromoteSubmit}
          submitLabel="Submit Promotion"
          loading={submitting}
        />
      )}
    </div>
  );
}
