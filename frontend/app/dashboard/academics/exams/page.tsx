'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { usePermissionContext } from '@/lib/rbac-context';
import { useSettings } from '@/lib/SettingsContext';
import { Plus, Loader2, Search, Calendar, Users, CheckCircle, X, Layers, ClipboardList, Trash2, AlertTriangle, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface Grade {
  id: string;
  grade_name: string;
  grade_number: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  exam_type_display?: string;
  grade_name?: string;
  subject_name?: string;
  section_name?: string;
  exam_date: string;
  max_marks: number;
  passing_marks: number;
  academic_year: string;
  invigilator_names?: string[];
  assessment_category?: string;
}

interface SubjectMapping {
  id: string;
  subject: string;
  subject_name: string;
  section: string;
  section_id: string;
  section_name: string;
}

export default function ExamsPage() {
  const { permissions } = usePermissionContext();
  const { settings } = useSettings();
  const currentAcademicYear = settings?.current_academic_year || '';
  const [exams, setExams] = useState<Exam[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<SubjectMapping[]>([]);
  const [invigilators, setInvigilators] = useState<{ id: number; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [sectionsForGrade, setSectionsForGrade] = useState<any[]>([]);
  const [sectionInvigilators, setSectionInvigilators] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    exam_type: 'UNIT_TEST',
    grade: '',
    subject: '',
    exam_date: '',
    max_marks: '100',
    passing_marks: '33',
    academic_year: currentAcademicYear,
    invigilator_id: '',
    section_id: '',
    is_practical: false,
  });

  // Quick templates
  const examTemplates = [
    { name: 'Unit Test 1', type: 'UNIT_TEST', marks: 20, pass: 7 },
    { name: 'Unit Test 2', type: 'UNIT_TEST', marks: 20, pass: 7 },
    { name: 'Mid Term', type: 'MIDTERM', marks: 80, pass: 27 },
    { name: 'Term 1 Final', type: 'FINALS', marks: 100, pass: 33 },
    { name: 'Term 2 Final', type: 'FINALS', marks: 100, pass: 33 },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.grade) {
      fetchSectionsForGrade(formData.grade);
    } else {
      setSectionsForGrade([]);
    }
  }, [formData.grade]);

  const fetchSectionsForGrade = async (gradeId: string) => {
    try {
      const response = await api.get(`/academics/sections/?grade=${gradeId}`);
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setSectionsForGrade(data);
    } catch (err) {
      console.error('Failed to load sections for grade', err);
    }
  };

  const handleOpenCreateExam = () => {
    const defaultExamType = availableExamTypes[0]?.id || 'UNIT_TEST';
    setCreationStep(1);
    setFormData({
      name: '',
      exam_type: defaultExamType,
      grade: '',
      subject: '',
      exam_date: '',
      max_marks: '100',
      passing_marks: '33',
      academic_year: currentAcademicYear,
      invigilator_id: '',
      section_id: '',
      is_practical: false,
    });
    setSectionsForGrade([]);
    setSectionInvigilators({});
    setShowModal(true);
  };

  const handleCloseCreateExam = () => {
    setShowModal(false);
    setCreationStep(1);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsRes, gradesRes, subjectsRes, mappingsRes, invigilatorsRes] = await Promise.all([
        api.get('/academics/exams/'),
        api.get('/academics/grades/'),
        api.get('/academics/subjects/'),
        api.get('/academics/subject-mappings/?purpose=exams'),
        api.get('/teachers/assignments/?role=EXAM_INVIGILATOR&is_active=true')
      ]);
      setExams(Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || []);
      setGrades(Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || []);
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : subjectsRes.data.results || []);
      setSubjectMappings(Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || []);
      
      const assignments = Array.isArray(invigilatorsRes.data) ? invigilatorsRes.data : invigilatorsRes.data.results || [];
      const uniqueInvigilators = Array.from(
        new Map<number, { id: number; name: string }>(
          assignments.map((a: any) => [a.teacher, { id: a.teacher, name: a.teacher_name }])
        ).values()
      );
      setInvigilators(uniqueInvigilators);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  // Get exams scheduled for a specific date (for conflict detection)
  const getExamsOnDate = (date: string) => {
    return exams.filter(e => e.exam_date === date);
  };

  // Filter grades to show only those present in subject mappings
  const filteredGrades = useMemo(() => {
    if (subjectMappings.length === 0) return grades;
    const activeGradeNames = new Set(
      subjectMappings
        .map(sm => sm.section_name?.split('-')[0])
        .filter(Boolean)
    );
    if (activeGradeNames.size === 0) return grades;
    return grades.filter(g => activeGradeNames.has(g.grade_name));
  }, [grades, subjectMappings]);

  // Filter exam types based on role scopes
  const availableExamTypes = useMemo(() => {
    const defaultTypes = [
      { id: 'UNIT_TEST', name: 'Unit Test' },
      { id: 'MIDTERM', name: 'Mid Term' },
      { id: 'FINALS', name: 'Final Exam' },
      { id: 'PERIODIC', name: 'Periodic Assessment' },
    ];
    if (!permissions || permissions.is_admin || !permissions.exam_type_scopes || permissions.exam_type_scopes.length === 0) {
      return defaultTypes;
    }
    const scopes = new Set(permissions.exam_type_scopes);
    return defaultTypes.filter(t => scopes.has(t.id));
  }, [permissions]);

  // Get available subjects for selected grade (from subject mappings)
  const availableSubjects = useMemo(() => {
    if (!formData.grade) return subjects;
    
    // Get all subject IDs that are mapped to sections in selected grade
    const gradeObj = grades.find(g => g.id === formData.grade);
    if (!gradeObj) return subjects;
    
    const mappedSubjectIds = new Set(
      subjectMappings
        .filter(sm => sm.section && grades.some(g => g.id === formData.grade))
        .map(sm => sm.subject)
    );
    
    // If no mappings found, return all subjects
    if (mappedSubjectIds.size === 0) return subjects;
    
    return subjects.filter(s => mappedSubjectIds.has(s.id));
  }, [formData.grade, subjects, subjectMappings, grades]);

  // Check if selected date has conflict
  const dateConflicts = useMemo(() => {
    if (!formData.exam_date || !formData.grade) return [];
    const examsOnDate = getExamsOnDate(formData.exam_date);
    // Filter to same grade
    return examsOnDate.filter(e => {
      const gradeName = grades.find(g => g.id === formData.grade)?.grade_name;
      return e.grade_name?.includes(gradeName || '') || e.section_name?.includes(gradeName || '');
    });
  }, [formData.exam_date, formData.grade, exams, grades]);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Previous month days
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month days to complete the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const formatDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check for conflicts
    if (dateConflicts.length > 0) {
      const conflictSubjects = dateConflicts.map(e => e.subject_name).join(', ');
      if (!confirm(`Warning: ${conflictSubjects} exam(s) already scheduled on this date for this grade. Continue anyway?`)) {
        return;
      }
    }

    // If All Sections (no section_id) is selected and we are in Step 1, move to Step 2
    if (creationStep === 1 && !formData.section_id) {
      if (sectionsForGrade.length === 0) {
        setError('No sections found for this grade');
        return;
      }
      const initialMap: Record<string, string> = {};
      sectionsForGrade.forEach(sec => {
        initialMap[sec.id] = '';
      });
      setSectionInvigilators(initialMap);
      setCreationStep(2);
      return;
    }

    setSubmitting(true);

    try {
      const createdExams = [];
      const isPractical = formData.is_practical;

      if (formData.section_id) {
        // Create for single section
        const section = sectionsForGrade.find(s => s.id === formData.section_id);
        if (!section) {
          setError('Selected section not found');
          setSubmitting(false);
          return;
        }

        const mappingsRes = await api.get(`/academics/subject-mappings/?section=${section.id}&subject=${formData.subject}&purpose=exams`);
        const mappings = Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || [];

        if (mappings.length === 0) {
          setError(`No subject mapping found for section ${section.section_letter}`);
          setSubmitting(false);
          return;
        }

        const payload: any = {
          section_id: section.id,
          subject_mapping_id: mappings[0].id,
          name: formData.name,
          exam_type: formData.exam_type,
          exam_date: formData.exam_date,
          max_marks: parseInt(formData.max_marks),
          passing_marks: parseInt(formData.passing_marks),
          academic_year: formData.academic_year,
          duration_minutes: 60,
          min_attendance_percentage: 75,
          assessment_category: isPractical ? 'PRACTICAL' : 'INTERNAL',
        };

        if (formData.invigilator_id) {
          payload.invigilator_ids = [parseInt(formData.invigilator_id)];
        }

        await api.post('/academics/exams/', payload);
        createdExams.push(section.section_letter);
      } else {
        // Create for all sections of the grade
        for (const section of sectionsForGrade) {
          try {
            const mappingsRes = await api.get(`/academics/subject-mappings/?section=${section.id}&subject=${formData.subject}&purpose=exams`);
            const mappings = Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || [];

            if (mappings.length > 0) {
              const payload: any = {
                section_id: section.id,
                subject_mapping_id: mappings[0].id,
                name: formData.name,
                exam_type: formData.exam_type,
                exam_date: formData.exam_date,
                max_marks: parseInt(formData.max_marks),
                passing_marks: parseInt(formData.passing_marks),
                academic_year: formData.academic_year,
                duration_minutes: 60,
                min_attendance_percentage: 75,
                assessment_category: isPractical ? 'PRACTICAL' : 'INTERNAL',
              };

              const selectedInvigilator = sectionInvigilators[section.id];
              if (selectedInvigilator) {
                payload.invigilator_ids = [parseInt(selectedInvigilator)];
              }

              await api.post('/academics/exams/', payload);
              createdExams.push(section.section_letter);
            }
          } catch (err) {
            console.error(`Failed to create exam for section ${section.id}`, err);
          }
        }
      }

      if (createdExams.length > 0) {
        setSuccess(`✓ Created exam for section(s): ${createdExams.join(', ')}!`);
        setShowModal(false);
        setCreationStep(1);
        setFormData({
          name: '',
          exam_type: 'UNIT_TEST',
          grade: '',
          subject: '',
          exam_date: '',
          max_marks: '100',
          passing_marks: '33',
          academic_year: currentAcademicYear,
          invigilator_id: '',
          section_id: '',
          is_practical: false,
        });
        setSectionsForGrade([]);
        setSectionInvigilators({});
        fetchData();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError('Could not create exam. Make sure subject is assigned to sections in this grade.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (template: typeof examTemplates[0]) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      exam_type: template.type,
      max_marks: template.marks.toString(),
      passing_marks: template.pass.toString(),
    }));
  };

  const handleDelete = async (examId: string) => {
    if (!confirm('Delete this exam?')) return;
    try {
      await api.delete(`/academics/exams/${examId}/`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete exam', err);
    }
  };

  const filteredExams = exams.filter(e => {
    const matchesSearch = 
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.subject_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesGrade = !filterGrade || (e.grade_name?.includes(filterGrade) || e.section_name?.includes(filterGrade));
    return matchesSearch && matchesGrade;
  });

  // Group exams by name+date for better display
  const groupedExams = filteredExams.reduce((acc, exam) => {
    const key = `${exam.name}-${exam.exam_date}-${exam.subject_name}`;
    if (!acc[key]) {
      acc[key] = {
        name: exam.name,
        exam_type: exam.exam_type_display || exam.exam_type,
        subject_name: exam.subject_name,
        exam_date: exam.exam_date,
        max_marks: exam.max_marks,
        passing_marks: exam.passing_marks,
        sections: [],
        invigilator_names: exam.invigilator_names || []
      };
    }
    acc[key].sections.push({
      id: exam.id,
      section_name: exam.section_name,
    });
    return acc;
  }, {} as Record<string, any>);

  const todayStr = useMemo(() => {
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const { upcomingGroupedExams, pastGroupedExams } = useMemo(() => {
    const upcoming: Record<string, any> = {};
    const past: Record<string, any> = {};

    Object.entries(groupedExams).forEach(([key, group]: [string, any]) => {
      if (group.exam_date >= todayStr) {
        upcoming[key] = group;
      } else {
        past[key] = group;
      }
    });

    return { upcomingGroupedExams: upcoming, pastGroupedExams: past };
  }, [groupedExams, todayStr]);

  const activeGroupedExams = activeTab === 'upcoming' ? upcomingGroupedExams : pastGroupedExams;
  const upcomingCount = Object.keys(upcomingGroupedExams).length;
  const pastCount = Object.keys(pastGroupedExams).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-3">
              <ClipboardList size={28} /> Exams
            </h1>
            <p className="text-blue-100">Create exams for grades • Automatically applies to all sections</p>
          </div>
          <button
            onClick={handleOpenCreateExam}
            className="bg-white text-blue-600 px-5 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2"
          >
            <Plus size={20} /> Create Exam
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search exams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">All Grades</option>
          {grades.map(g => (
            <option key={g.id} value={g.grade_name}>{g.grade_name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-6 mt-4">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'upcoming'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Upcoming Exams ({upcomingCount})
          {activeTab === 'upcoming' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`pb-3 font-semibold text-sm transition-all relative ${
            activeTab === 'past'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Past Exams ({pastCount})
          {activeTab === 'past' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Exams List */}
      {Object.keys(activeGroupedExams).length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 p-12 rounded-xl text-center">
          <ClipboardList size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {activeTab === 'upcoming' ? 'No upcoming exams scheduled' : 'No past exams found'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'upcoming' ? 'Create a new exam to get started' : ''}
          </p>
          {activeTab === 'upcoming' && (
            <button
              onClick={handleOpenCreateExam}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Exam
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(activeGroupedExams).map((group: any, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{group.subject_name}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                      {group.exam_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{group.max_marks} marks</p>
                    <p className="text-xs text-gray-500">Pass: {group.passing_marks}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar size={16} className="text-gray-400" />
                  <span>{group.exam_date ? new Date(group.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Users size={16} className="text-gray-400" />
                  <span>{group.sections.length} section(s)</span>
                </div>
                {group.invigilator_names && group.invigilator_names.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <User size={16} className="text-gray-400" />
                    <span>Invigilator: {group.invigilator_names.join(', ')}</span>
                  </div>
                )}
                
                <div className="mt-3 flex flex-wrap gap-1">
                  {group.sections.slice(0, 4).map((s: any, i: number) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                      {s.section_name}
                    </span>
                  ))}
                  {group.sections.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-600">
                      +{group.sections.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Exam Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-xl">
              <h2 className="text-lg font-semibold">
                {creationStep === 2 ? 'Assign Invigilators to Sections' : 'Create Exam'}
              </h2>
              <button onClick={handleCloseCreateExam} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {creationStep === 2 ? (
              <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
                <p className="text-sm text-gray-650 dark:text-gray-300">
                  Assign available invigilators to each section for grade <strong>{grades.find(g => g.id === formData.grade)?.grade_name}</strong>:
                </p>

                <div className="space-y-3">
                  {sectionsForGrade.map(section => (
                    <div key={section.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                      <span className="font-bold text-gray-900 dark:text-white">
                        Section {section.section_letter}
                      </span>
                      <select
                        value={sectionInvigilators[section.id] || ''}
                        onChange={(e) => setSectionInvigilators(prev => ({ ...prev, [section.id]: e.target.value }))}
                        className="w-2/3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white"
                      >
                        <option value="">No Invigilator</option>
                        {invigilators.map(inv => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <X className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-750">
                  <button
                    type="button"
                    onClick={() => setCreationStep(1)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Exams'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Quick Templates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quick Templates
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {examTemplates.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                          formData.name === t.name 
                            ? 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Exam Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      placeholder="e.g., Unit Test 1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Grade *
                    </label>
                    <select
                      value={formData.grade}
                      onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value, subject: '', section_id: '' }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white"
                    >
                      <option value="">Select Grade</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.grade_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Section
                    </label>
                    <select
                      value={formData.section_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                      disabled={!formData.grade}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">All Sections</option>
                      {sectionsForGrade.map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.section_letter}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subject *
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white"
                    >
                      <option value="">Select Subject</option>
                      {availableSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {subjects.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No subjects found. Create subjects first.</p>
                    )}
                    {(() => {
                      const selSub: any = availableSubjects.find((s: any) => s.id === formData.subject);
                      const isElective = selSub && (!selSub.is_core || (selSub.subject_type || '').toUpperCase() === 'ELECTIVE');
                      if (isElective) {
                        return (
                          <div className="p-2.5 mt-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-center gap-2 font-semibold">
                            <span>⚡ Elective Subject: Exam applies strictly to students who opted for {selSub.name}.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Exam Type *
                    </label>
                    <select
                      value={formData.exam_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, exam_type: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white"
                    >
                      {availableExamTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Exam Category *
                    </label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-350 cursor-pointer">
                        <input
                          type="radio"
                          name="exam_category"
                          checked={!formData.is_practical}
                          onChange={() => setFormData(prev => ({ ...prev, is_practical: false }))}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        Theory Exam
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-350 cursor-pointer">
                        <input
                          type="radio"
                          name="exam_category"
                          checked={formData.is_practical}
                          onChange={() => setFormData(prev => ({ ...prev, is_practical: true }))}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        Practical Exam
                      </label>
                    </div>
                  </div>

                  {formData.section_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Assign Invigilator
                      </label>
                      <select
                        value={formData.invigilator_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, invigilator_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-905 dark:text-white"
                      >
                        <option value="">No Invigilator</option>
                        {invigilators.map(inv => (
                          <option key={inv.id} value={inv.id}>{inv.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Maximum Marks *
                    </label>
                    <input
                      type="number"
                      value={formData.max_marks}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_marks: e.target.value }))}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Passing Marks *
                    </label>
                    <input
                      type="number"
                      value={formData.passing_marks}
                      onChange={(e) => setFormData(prev => ({ ...prev, passing_marks: e.target.value }))}
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Select Exam Date * {formData.exam_date && <span className="text-blue-600 ml-2">(Selected: {new Date(formData.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})</span>}
                    </label>

                    {/* Mini Calendar */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      {/* Calendar Header */}
                      <div className="flex justify-between items-center mb-3">
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="font-semibold text-gray-950 dark:text-white">
                          {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>

                      {/* Weekday Headers */}
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(calendarMonth).map((day, idx) => {
                          const dateStr = formatDateStr(day.date);
                          const examsOnDay = getExamsOnDate(dateStr);
                          const isSelected = formData.exam_date === dateStr;
                          const isToday = formatDateStr(new Date()) === dateStr;
                          const hasExams = examsOnDay.length > 0;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, exam_date: dateStr }))}
                              className={`relative p-1.5 text-sm rounded transition ${
                                !day.isCurrentMonth ? 'text-gray-300 dark:text-gray-605' :
                                isSelected ? 'bg-blue-600 text-white' :
                                isToday ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold' :
                                hasExams ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                              }`}
                              title={hasExams ? `Exams: ${examsOnDay.map(e => e.subject_name).join(', ')}` : ''}
                            >
                              {day.date.getDate()}
                              {hasExams && !isSelected && (
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full"></span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span>
                          <span className="text-gray-600 dark:text-gray-400">Has Exams</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-blue-600 rounded"></span>
                          <span className="text-gray-600 dark:text-gray-400">Selected</span>
                        </span>
                      </div>
                    </div>

                    {/* Date Conflict Warning */}
                    {dateConflicts.length > 0 && (
                      <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          <strong>Warning:</strong> {dateConflicts.map(e => e.subject_name).join(', ')} exam(s) already scheduled on this date.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
                  <Layers className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {formData.section_id ? (
                      <span><strong>Single Section Create:</strong> This exam will be created exclusively for Section {sectionsForGrade.find(s => s.id === formData.section_id)?.section_letter}.</span>
                    ) : (
                      <span><strong>Bulk Create:</strong> No section selected. This exam will automatically be created for ALL sections in the selected grade, and you can assign invigilators on the next step.</span>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <X className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseCreateExam}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.exam_date}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {!formData.section_id ? 'Next' : (
                      submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Exam'
                      )
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
