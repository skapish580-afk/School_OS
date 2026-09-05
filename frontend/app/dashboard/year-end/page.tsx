'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Calendar, Users, GraduationCap, CheckCircle, Search, Loader2, FileText } from 'lucide-react';
import Modal from '@/components/Modal';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import { useSettings } from '@/lib/SettingsContext';
import { usePermissionContext } from '@/lib/rbac-context';
import PermissionDenied from '@/components/PermissionDenied';

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

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  const tokenRegex = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[\+\-\*\/\^\(\)])\s*/g;
  let match;
  const tokens: string[] = [];
  while ((match = tokenRegex.exec(formula)) !== null) {
    tokens.push(match[1]);
  }

  let index = 0;

  function parsePrimary(): number {
    if (index >= tokens.length) throw new Error("Unexpected end of expression");
    const token = tokens[index];
    if (token === '(') {
      index++; // consume '('
      const val = parseExpression();
      if (index >= tokens.length || tokens[index] !== ')') {
        throw new Error("Missing closing parenthesis");
      }
      index++; // consume ')'
      return val;
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      index++;
      return parseFloat(token);
    }
    if (token in variables) {
      index++;
      return variables[token];
    }
    throw new Error(`Invalid token: ${token}`);
  }

  // Right-associative exponentiation parser
  function parseExponent(): number {
    let left = parsePrimary();
    while (index < tokens.length && tokens[index] === '^') {
      index++;
      const right = parsePrimary();
      left = Math.pow(left, right);
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parseExponent();
    while (index < tokens.length && (tokens[index] === '*' || tokens[index] === '/')) {
      const op = tokens[index];
      index++;
      const right = parseExponent();
      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) throw new Error("Division by zero");
        left = left / right;
      }
    }
    return left;
  }

  function parseExpression(): number {
    let left = parseMulDiv();
    while (index < tokens.length && (tokens[index] === '+' || tokens[index] === '-')) {
      const op = tokens[index];
      index++;
      const right = parseMulDiv();
      if (op === '+') {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    return left;
  }

  const result = parseExpression();
  if (index < tokens.length) {
    throw new Error(`Extra tokens: ${tokens.slice(index).join(' ')}`);
  }
  return result;
}

export default function PromotionsPage() {
  const { hasPermission, loading: rbacLoading } = usePermissionContext();
  const router = useRouter();
  const { formatAcademicYear } = useSettings();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearCode, setSelectedYearCode] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);

  // Promotion Modal State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [promoteFormData, setPromoteFormData] = useState({
    new_section: '',
    remarks: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Report Card Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStudent, setReportStudent] = useState<Enrollment | null>(null);
  const [reportExams, setReportExams] = useState<any[]>([]);
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [reportSubjects, setReportSubjects] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const isDirectAssessmentNumeric = (id: string) => {
    return id === 'sa'; // Subject Application is out of 20
  };

  const getDirectAssessmentMaxMarks = (id: string) => {
    if (id === 'sa') return 20;
    return 100;
  };

  const getSubjectDirectAssessmentScore = (sectionId: string | number, studentId: string, subjectId: string, categoryId: string): string | number => {
    const storageKey = `assessment_${sectionId}_${subjectId}_${categoryId}`;
    const dataStr = localStorage.getItem(storageKey);
    if (!dataStr) return '-';
    try {
      const parsed = JSON.parse(dataStr);
      const val = parsed[studentId]?.score;
      if (val === undefined || val === null) return '-';
      return val;
    } catch (e) {
      return '-';
    }
  };

  const getSubjectAggregatedMaxMarks = (subject: any, tab: 'INTERNAL' | 'PRACTICAL'): number => {
    const sectionObj = sections.find(s => 
      (s.grade_name === reportStudent?.grade_name || s.grade_name === reportStudent?.grade) && 
      (s.section_letter === reportStudent?.section_name || s.section_letter === reportStudent?.section)
    );
    if (!sectionObj) return 100;

    const configKey = `formula_config_${sectionObj.id}_${subject.id}_${tab}`;
    const savedConfigStr = localStorage.getItem(configKey);
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        const formula = parsed.formula;
        if (formula && formula.trim()) {
          const maxVariables: Record<string, number> = {};
          
          (parsed.entities || []).forEach((ent: any) => {
            const aliasRegex = new RegExp(`\\b${ent.alias}\\b`);
            if (aliasRegex.test(formula)) {
              const scaleDownVal = parseFloat(ent.scaleTo);
              maxVariables[ent.alias] = !isNaN(scaleDownVal) ? scaleDownVal : ent.maxMarks;
            }
          });

          const maxVal = evaluateFormula(formula, maxVariables);
          if (!isNaN(maxVal) && maxVal > 0) {
            return parseFloat(maxVal.toFixed(2));
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    const filtered = reportExams.filter(ex => 
      ex.subject_id === subject.subject_id && 
      (tab === 'INTERNAL' ? (ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS') : ex.assessment_category === 'PRACTICAL')
    );
    const sum = filtered.reduce((acc, curr) => acc + curr.max_marks, 0);
    return sum > 0 ? sum : 100;
  };

  const getReportColumns = () => {
    const hasInternalAggregation = reportSubjects.some(sub => {
      const subExams = reportExams.filter(ex => ex.subject_id === sub.subject_id);
      return reportResults.some(r => 
        subExams.some(ex => ex.id === r.exam_id) && r.aggregated_internal_marks !== null
      );
    });

    const hasPracticalAggregation = reportSubjects.some(sub => {
      const subExams = reportExams.filter(ex => ex.subject_id === sub.subject_id);
      return reportResults.some(r => 
        subExams.some(ex => ex.id === r.exam_id) && r.aggregated_practical_marks !== null
      );
    });

    let internalCols: any[] = [];
    if (hasInternalAggregation) {
      internalCols = [{ id: 'aggregated', name: 'Aggregated Results', isAggregated: true }];
    } else {
      const names = Array.from(new Set(
        reportExams.filter(e => e.assessment_category === 'INTERNAL' && e.exam_type !== 'FINALS').map(e => e.name)
      ));
      internalCols = names.map(name => ({ id: name, name, isAggregated: false }));
      if (internalCols.length === 0) {
        internalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
      }
    }

    internalCols.push(
      { id: 'sa', name: 'Subject Application', isDirect: true },
      { id: 'ssc', name: 'Soft Skills & Comm.', isDirect: true },
      { id: 'dc', name: 'Discipline & Cons.', isDirect: true }
    );

    let practicalCols: any[] = [];
    if (hasPracticalAggregation) {
      practicalCols = [{ id: 'aggregated', name: 'Aggregated Results', isAggregated: true }];
    } else {
      const names = Array.from(new Set(
        reportExams.filter(e => e.assessment_category === 'PRACTICAL').map(e => e.name)
      ));
      practicalCols = names.map(name => ({ id: name, name, isAggregated: false }));
      if (practicalCols.length === 0) {
        practicalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
      }
    }

    const finalNames = Array.from(new Set(
      reportExams.filter(e => e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL').map(e => e.name)
    ));
    let finalCols: any[] = finalNames.map(name => ({ id: name, name, isAggregated: false }));
    if (finalCols.length === 0) {
      finalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
    }

    return { hasInternalAggregation, hasPracticalAggregation, internalCols, practicalCols, finalCols };
  };

  const renderReportCell = (subject: any, category: string, col: any) => {
    if (!reportStudent) return <span className="text-gray-300">-</span>;

    if (col.isDirect) {
      const sectionObj = sections.find(s => 
        (s.grade_name === reportStudent.grade_name || s.grade_name === reportStudent.grade) && 
        (s.section_letter === reportStudent.section_name || s.section_letter === reportStudent.section)
      );
      if (!sectionObj) return <span className="text-gray-300">-</span>;

      const score = getSubjectDirectAssessmentScore(sectionObj.id, reportStudent.student, subject.id, col.id);
      if (score === '-') return <span className="text-gray-300">-</span>;
      if (isDirectAssessmentNumeric(col.id)) {
        const maxMarks = getDirectAssessmentMaxMarks(col.id);
        return <span className="text-gray-800">{score} / {maxMarks}</span>;
      } else {
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase text-center min-w-[30px] inline-block">{score}</span>;
      }
    }
    
    if (category === 'INTERNAL' && col.isAggregated) {
      const subExams = reportExams.filter(ex => ex.subject_id === subject.subject_id);
      const record = reportResults.find(r => 
        r.student_id === reportStudent.student && 
        subExams.some(ex => ex.id === r.exam_id) && 
        r.aggregated_internal_marks !== null
      );
      
      const maxVal = getSubjectAggregatedMaxMarks(subject, 'INTERNAL');
      if (record) {
        return <span className="text-indigo-700 font-bold">{record.aggregated_internal_marks} / {maxVal}</span>;
      }
      
      const internalExams = reportExams.filter(ex => ex.subject_id === subject.subject_id && ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS');
      let sumObtained = 0;
      let sumMax = 0;
      let hasAny = false;
      internalExams.forEach(ex => {
        const r = reportResults.find(res => res.student_id === reportStudent.student && res.exam_id === ex.id);
        if (r) {
          hasAny = true;
          if (!r.is_absent) {
            sumObtained += parseFloat(r.marks_obtained);
          }
          sumMax += ex.max_marks;
        }
      });
      if (hasAny) {
        return <span className="text-gray-700 font-semibold">{sumObtained} / {sumMax}</span>;
      }
      return <span className="text-gray-300">-</span>;
    }
    
    if (category === 'PRACTICAL' && col.isAggregated) {
      const subExams = reportExams.filter(ex => ex.subject_id === subject.subject_id);
      const record = reportResults.find(r => 
        r.student_id === reportStudent.student && 
        subExams.some(ex => ex.id === r.exam_id) && 
        r.aggregated_practical_marks !== null
      );
      
      const maxVal = getSubjectAggregatedMaxMarks(subject, 'PRACTICAL');
      if (record) {
        return <span className="text-indigo-700 font-bold">{record.aggregated_practical_marks} / {maxVal}</span>;
      }
      
      const practicalExams = reportExams.filter(ex => ex.subject_id === subject.subject_id && ex.assessment_category === 'PRACTICAL');
      let sumObtained = 0;
      let sumMax = 0;
      let hasAny = false;
      practicalExams.forEach(ex => {
        const r = reportResults.find(res => res.student_id === reportStudent.student && res.exam_id === ex.id);
        if (r) {
          hasAny = true;
          if (!r.is_absent) {
            sumObtained += parseFloat(r.marks_obtained);
          }
          sumMax += ex.max_marks;
        }
      });
      if (hasAny) {
        return <span className="text-gray-750 font-semibold">{sumObtained} / {sumMax}</span>;
      }
      return <span className="text-gray-300">-</span>;
    }
    
    const matchedExam = reportExams.find(ex => 
      ex.subject_id === subject.subject_id && 
      ex.name === col.name && 
      (
        category === 'INTERNAL' ? (ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS') :
        category === 'PRACTICAL' ? (ex.assessment_category === 'PRACTICAL') :
        (ex.exam_type === 'FINALS' && ex.assessment_category !== 'PRACTICAL')
      )
    );
    if (!matchedExam) return <span className="text-gray-300">-</span>;
    
    const record = reportResults.find(r => r.student_id === reportStudent.student && r.exam_id === matchedExam.id);
    if (!record) return <span className="text-gray-300">-</span>;
    if (record.is_absent) return <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs font-bold">AB</span>;
    return <span className="text-gray-800">{record.marks_obtained} / {matchedExam.max_marks}</span>;
  };

  const handleViewReport = async (enrollment: Enrollment) => {
    const sectionObj = sections.find(s => 
      (s.grade_name === enrollment.grade_name || s.grade_name === enrollment.grade) && 
      (s.section_letter === enrollment.section_name || s.section_letter === enrollment.section)
    );

    if (!sectionObj) {
      toast.error("Could not find section information for this student.");
      return;
    }

    setReportLoading(true);
    setReportStudent(enrollment);
    setShowReportModal(true);

    try {
      const [examsRes, resultsRes, mappingsRes] = await Promise.all([
        api.get(`/academics/exams/?section=${sectionObj.id}`),
        api.get(`/academics/results/?exam__section=${sectionObj.id}`),
        api.get(`/academics/subject-mappings/`)
      ]);

      const fetchedExams = examsRes.data.results || examsRes.data || [];
      const fetchedResults = resultsRes.data.results || resultsRes.data || [];
      const fetchedMappings = mappingsRes.data.results || mappingsRes.data || [];

      const sectionMappings = fetchedMappings.filter((sm: any) => sm.section_id === sectionObj.id);

      setReportExams(fetchedExams);
      setReportResults(fetchedResults);
      setReportSubjects(sectionMappings);
    } catch (error) {
      console.error("Error loading report card:", error);
      toast.error("Failed to load student report card.");
      setShowReportModal(false);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const schoolRes = await api.get('/schools/settings/my_settings/');
        setSchoolId(schoolRes.data.school);
        setSchoolSettings(schoolRes.data);
        
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
      remarks: ''
    });
    setShowPromoteModal(true);
  };

  const handlePromoteSubmit = async () => {
    if (!selectedEnrollment) return;
    if (!promoteFormData.new_section) {
      toast.error('Target Section is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/enrollments/student-enrollments/${selectedEnrollment.id}/promote/`, {
        new_section: promoteFormData.new_section,
        remarks: promoteFormData.remarks
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

  const handleDetainSubmit = async () => {
    if (!selectedEnrollment) return;
    if (!promoteFormData.new_section) {
      toast.error('Target Section is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/enrollments/student-enrollments/${selectedEnrollment.id}/detain/`, {
        new_section: promoteFormData.new_section,
        remarks: promoteFormData.remarks
      });
      toast.success('Student detained successfully!');
      setShowPromoteModal(false);
      fetchEnrollments(); // Refresh list
    } catch (error: any) {
      console.error('Detention error:', error);
      toast.error(error.response?.data?.error || 'Failed to detain student');
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

  if (rbacLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="animate-spin text-blue-600" size={50} />
      </div>
    );
  }

  if (!hasPermission('enrollments.promote_students')) {
    return <PermissionDenied title="Access Denied" message="You do not have permission to manage promotions." />;
  }

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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewReport(enrollment)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-all"
                          >
                            <FileText size={14} />
                            View Report
                          </button>
                          <button
                            onClick={() => handlePromoteClick(enrollment)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95 transition-all"
                          >
                            <GraduationCap size={14} />
                            Promote Student
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Promote Modal with custom children */}
      {showPromoteModal && selectedEnrollment && (
        <Modal
          title={`Promote/Detain: ${selectedEnrollment.student_name}`}
          onClose={() => setShowPromoteModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Section <span className="text-red-500">*</span>
              </label>
              <select
                value={promoteFormData.new_section}
                onChange={(e) => setPromoteFormData(prev => ({ ...prev, new_section: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Target Section</option>
                {sectionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                value={promoteFormData.remarks}
                onChange={(e) => setPromoteFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional promotion or detention remarks..."
                className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                rows={3}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-center flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDetainSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium text-center flex-1 disabled:bg-gray-400"
              >
                {submitting ? <Loader2 className="inline animate-spin mr-2" size={16} /> : "Detain"}
              </button>
              <button
                type="button"
                onClick={handlePromoteSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-center flex-1 disabled:bg-gray-400"
              >
                {submitting ? <Loader2 className="inline animate-spin mr-2" size={16} /> : "Promote"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Report Card Modal */}
      {showReportModal && reportStudent && (
        <Modal
          title={`Report Card: ${reportStudent.student_name}`}
          onClose={() => setShowReportModal(false)}
          size="5xl"
        >
          {reportLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-blue-600" size={50} />
              <span className="text-gray-500 font-medium">Generating student report card...</span>
            </div>
          ) : reportSubjects.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              No subjects or exams allocated for this student's grade/section.
            </div>
          ) : (() => {
            const { hasInternalAggregation, hasPracticalAggregation, internalCols, practicalCols, finalCols } = getReportColumns();
            
            return (
              <div className="space-y-6 max-h-[75vh] overflow-y-auto p-2">
                <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm space-y-6 max-w-4xl mx-auto">
                  {/* School Header */}
                  <div className="flex items-center justify-center gap-4 border-b pb-6">
                    {schoolSettings?.school_logo && (
                      <img 
                        src={schoolSettings.school_logo} 
                        alt="School Logo" 
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    <div className="text-center md:text-left space-y-1">
                      <h1 className="text-3xl font-extrabold tracking-tight text-indigo-900 uppercase">
                        {schoolSettings?.school_name || user?.school_name || 'New Horizons Scholastic School'}
                      </h1>
                      <p className="text-sm font-bold text-gray-500 tracking-widest uppercase font-sans">Student Progress Report Card</p>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-150 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Student Name</span>
                      <span className="font-bold text-gray-800">{reportStudent.student_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Student ID (SUID)</span>
                      <span className="font-mono font-bold text-gray-800">{reportStudent.student_suid}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Grade & Section</span>
                      <span className="font-bold text-gray-800">Grade {reportStudent.grade_name || reportStudent.grade} - Section {reportStudent.section_name || reportStudent.section}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Academic Year</span>
                      <span className="font-mono font-bold text-gray-800">{formatAcademicYear(reportStudent.academic_year)}</span>
                    </div>
                  </div>

                  {/* Report Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100/80 text-gray-700 text-xs font-bold border-b border-gray-200 uppercase tracking-wider">
                          <th className="border-r border-gray-200 px-4 py-3 text-left" rowSpan={2}>Subject</th>
                          <th className="border-r border-gray-200 px-4 py-3 text-center" colSpan={internalCols.length}>Internals</th>
                          <th className="border-r border-gray-200 px-4 py-3 text-center" colSpan={practicalCols.length}>Practicals</th>
                          <th className="px-4 py-3 text-center" colSpan={finalCols.length}>Final Exams</th>
                        </tr>
                        <tr className="bg-gray-50 text-gray-600 text-[10px] font-bold border-b border-gray-200 uppercase">
                          {internalCols.map(col => (
                            <th key={col.id} className="border-r border-gray-200 px-3 py-2 text-center font-semibold">
                              {col.name}
                            </th>
                          ))}
                          {practicalCols.map(col => (
                            <th key={col.id} className="border-r border-gray-200 px-3 py-2 text-center font-semibold">
                              {col.name}
                            </th>
                          ))}
                          {finalCols.map(col => (
                            <th key={col.id} className="px-3 py-2 text-center font-semibold">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 text-sm">
                        {reportSubjects.map(sub => (
                          <tr key={sub.id} className="hover:bg-gray-50/30">
                            <td className="border-r border-gray-200 px-4 py-3 font-semibold text-gray-800">
                              {sub.subject_name}
                            </td>
                            {/* Render Internals */}
                            {internalCols.map(col => (
                              <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderReportCell(sub, 'INTERNAL', col)}
                              </td>
                            ))}
                            {/* Render Practicals */}
                            {practicalCols.map(col => (
                              <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderReportCell(sub, 'PRACTICAL', col)}
                              </td>
                            ))}
                            {/* Render Finals */}
                            {finalCols.map(col => (
                              <td key={col.id} className="px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderReportCell(sub, 'FINALS', col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Signatures */}
                  <div className="pt-12 flex justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <div className="border-t border-gray-300 pt-2 px-6 text-center">Class Teacher</div>
                    <div className="border-t border-gray-300 pt-2 px-6 text-center">Principal Signature</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
