'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { FileDown, Loader2, FileText, Table, Calendar } from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('attendance');
  const [format, setFormat] = useState('csv');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const [gradesRes, sectionsRes] = await Promise.all([
        api.get('/academics/grades/'),
        api.get('/academics/sections/?is_active=true')
      ]);
      const gData = Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || [];
      const sData = Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || [];
      setGrades(gData);
      setSections(sData);
    } catch (err) {
      console.error("Failed to load filter options", err);
    }
  };

  const exportData = async (endpoint: string, filename: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        start_date: dateRange.start,
        end_date: dateRange.end
      });
      if (selectedGrade) {
        params.append('grade', selectedGrade);
      }
      if (selectedSection) {
        params.append('section', selectedSection);
      }

      const response = await api.get(`${endpoint}?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('Report exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const availableSections = selectedGrade
    ? sections.filter(s => s.grade_name === selectedGrade)
    : sections;

  const reports = [
    {
      id: 'students',
      title: 'Students List',
      description: 'Complete student directory with contact details',
      icon: <Table className="text-blue-600" />,
      endpoint: '/reports/students/'
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Attendance records by date range',
      icon: <Calendar className="text-green-600" />,
      endpoint: '/reports/attendance/'
    },
    {
      id: 'finance',
      title: 'Financial Report',
      description: 'Invoices, payments, and pending fees',
      icon: <FileText className="text-purple-600" />,
      endpoint: '/reports/finance/'
    },
    {
      id: 'achievements',
      title: 'Achievements Report',
      description: 'Student achievements and awards',
      icon: <FileText className="text-yellow-600" />,
      endpoint: '/reports/achievements/'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports & Export</h1>
        <p className="text-gray-600 mt-1">Generate and download various reports</p>
      </div>

      {/* Export Options */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Export Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="csv">CSV (Excel)</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedSection('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.grade_name}>
                  {g.grade_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec.id} value={sec.section_letter}>
                  Section {sec.section_letter}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div key={report.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  {report.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-600">{report.description}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => exportData(report.endpoint, report.id)}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <FileDown size={18} />
              )}
              Export {format.toUpperCase()}
            </button>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-2">💡 Pro Tip</h2>
        <p className="text-blue-100">
          CSV files open in Excel/Google Sheets. PDF files are best for printing.
          JSON files are for technical integrations.
        </p>
      </div>
    </div>
  );
}
