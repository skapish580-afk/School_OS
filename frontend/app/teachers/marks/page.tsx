'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Plus, 
  PenTool, 
  Loader2, 
  Search, 
  BookMarked,
  GraduationCap,
  BookOpen,
  Award,
  MessageSquare,
  ClipboardCheck,
  ArrowLeft,
  ChevronRight,
  Users,
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  subject_name: string;
  section_name: string;
  max_marks: number;
  passing_marks: number;
  exam_date: string;
  invigilator_names?: string[];
  assessment_category?: string;
  section_id_display?: string;
  subject_id?: string;
  marks_locked?: boolean;
}

interface Section {
  id: string;
  full_name: string;
  grade_name: string;
  grade_order: number;
  section_letter: string;
  capacity: number;
  class_teacher_name: string | null;
  student_count: number;
  is_active: boolean;
}

interface Grade {
  id: string;
  grade_number: number;
  grade_name: string;
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

export default function TeacherPortalMarksPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<any[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'INTERNAL' | 'PRACTICAL' | 'FINAL'>('INTERNAL');

  // Navigation states for Internal Marks
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);

  // Student assessments for direct evaluation categories
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assessmentGrades, setAssessmentGrades] = useState<Record<string, { score: string; remarks: string }>>({});
  const [categoryConfigState, setCategoryConfigState] = useState<{ type: string; maxMarks?: number; gradesList?: string[] }>({ type: 'MARKS', maxMarks: 100 });
  const [successMessage, setSuccessMessage] = useState('');

  // Lock State (Controlled strictly by School Admin)
  const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);

  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, any>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);

  const isGrade11or12 = (g: string) => {
    const clean = g.toLowerCase().replace('grade', '').trim();
    return clean === '11' || clean === '12';
  };

  const normalizeGrade = (g: string) => {
    if (!g) return '';
    return g.toLowerCase().replace('grade', '').trim();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsRes, sectionsRes, mappingsRes, gradesRes, assignmentsRes] = await Promise.all([
        api.get('/academics/exams/?purpose=marks'),
        api.get('/academics/sections/'),
        api.get('/academics/subject-mappings/?purpose=marks'),
        api.get('/academics/grades/'),
        api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] }))
      ]);
      setExams(Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || []);
      setSections(Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || []);
      setSubjectMappings(Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || []);
      setGrades(Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || []);
      
      const assignList = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || [];
      setTeacherAssignments(assignList);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (category: 'INTERNAL' | 'PRACTICAL' | 'FINAL') => {
    setActiveCategory(category);
    setSelectedSection(null);
    setSelectedSubject(null);
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const getCategoryConfig = () => {
    return categoryConfigState || { type: 'MARKS', maxMarks: 100, gradesList: ['A', 'B', 'C', 'D'] };
  };

  const handleSelectCategory = async (category: any) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setAttendanceSummary({});

    if (category.id !== 'cap') {
      setStudentsLoading(true);
      try {
        const response = await api.get(`/students/?current_section=${selectedSection?.id}&status=ACTIVE`);
        let studentData = Array.isArray(response.data) ? response.data : response.data.results || [];

        // If selectedSubject is an elective subject, filter to only students who opted for it
        const isElective = selectedSubject && (
          selectedSubject.subject_type === 'ELECTIVE' ||
          !selectedSubject.is_core ||
          selectedSubject.is_elective
        );
        if (isElective && selectedSection?.grade_name) {
          const targetSubId = selectedSubject.subject_id || selectedSubject.subject?.id || selectedSubject.id;
          try {
            const norm = (selectedSection.grade_name || '').toLowerCase().replace(/grade/g, '').trim();
            let electiveMap: Record<string, string[]> = {};
            
            const savedRaw = localStorage.getItem(`student_elective_mappings_grade_${selectedSection.grade_name}`);
            if (savedRaw) {
              electiveMap = JSON.parse(savedRaw);
            } else {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('student_elective_mappings_grade_')) {
                  const kGrade = key.replace('student_elective_mappings_grade_', '').toLowerCase().replace(/grade/g, '').trim();
                  if (kGrade === norm) {
                    const val = localStorage.getItem(key);
                    if (val) {
                      electiveMap = JSON.parse(val);
                      break;
                    }
                  }
                }
              }
            }

            const mappedIds = (electiveMap[targetSubId] || []).map((id: any) => String(id));
            if (mappedIds.length > 0) {
              studentData = studentData.filter((st: any) => {
                const stId = String(st.id || '');
                const stSuid = String(st.suid || '');
                return mappedIds.includes(stId) || (stSuid && mappedIds.includes(stSuid));
              });
            }
          } catch (e) {}
        }

        setStudents(studentData);

        // Fetch Attendance Summary if category is 'dc' (Discipline & Consistency)
        if (category.id === 'dc') {
          setAttendanceLoading(true);
          try {
            const isHighSchool = isGrade11or12(selectedSection?.grade_name || '');
            let url = `/attendance/section_summary/?grade=${selectedSection?.grade_name}&section=${selectedSection?.section_letter}`;
            if (isHighSchool && selectedSubject) {
              url += `&subject=${selectedSubject.subject_id}`;
            }
            const attResponse = await api.get(url);
            setAttendanceSummary(attResponse.data || {});
          } catch (err) {
            console.error('Failed to load attendance summary', err);
          } finally {
            setAttendanceLoading(false);
          }
        }
        
        // Fetch from backend DirectEvaluation model (created / managed by school admin)
        let evalData: any = null;
        try {
          const evalResponse = await api.get(
            `/academics/direct-evaluations/?section=${selectedSection?.id}&subject_mapping=${selectedSubject?.id}&category_id=${category.id}`
          );
          evalData = evalResponse.data?.results?.[0] || evalResponse.data?.[0] || null;
        } catch (err) {
          console.error("Failed to load direct evaluation configuration", err);
        }

        // Set lock state strictly from backend database
        if (evalData) {
          setIsAssessmentLocked(!!evalData.is_locked);
        } else {
          setIsAssessmentLocked(false);
        }

        // Get active system config for this grade and category (configured by school admin)
        let configObj = { type: 'MARKS', maxMarks: 100, gradesList: ['A', 'B', 'C', 'D'] };
        if (evalData && evalData.config && Object.keys(evalData.config).length > 0) {
          configObj = evalData.config;
          const configKey = `system_config_${selectedSection?.grade_name}_${category.id}`;
          localStorage.setItem(configKey, JSON.stringify(configObj));
        } else {
          const configKey = `system_config_${selectedSection?.grade_name}_${category.id}`;
          const savedConfigStr = localStorage.getItem(configKey);
          if (savedConfigStr) {
            try {
              configObj = JSON.parse(savedConfigStr);
            } catch(e) {}
          }
        }
        setCategoryConfigState(configObj);
        
        // Load saved grades
        let savedGrades: Record<string, { score: string; remarks: string }> | null = null;
        if (evalData && evalData.grades && Object.keys(evalData.grades).length > 0) {
          savedGrades = evalData.grades;
          const storageKey = `assessment_${selectedSection?.id}_${selectedSubject?.id}_${category.id}`;
          localStorage.setItem(storageKey, JSON.stringify(savedGrades));
        } else {
          const storageKey = `assessment_${selectedSection?.id}_${selectedSubject?.id}_${category.id}`;
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            try {
              savedGrades = JSON.parse(savedData);
            } catch(e) {}
          }
        }

        if (savedGrades) {
          const migrated: Record<string, { score: string; remarks: string }> = {};
          studentData.forEach((s: any) => {
            const existing = savedGrades![s.id] || { score: '', remarks: '' };
            let score = existing.score;
            if (configObj.type === 'GRADES') {
              const gradesList = (configObj as any).gradesList || [];
              if (score && !gradesList.includes(score.toUpperCase())) {
                score = '';
              }
            } else {
              const max = (configObj as any).maxMarks || 100;
              const val = parseFloat(score);
              if (!isNaN(val)) {
                if (val > max) {
                  score = max.toString();
                }
              } else {
                score = '';
              }
            }
            migrated[s.id] = { score, remarks: existing.remarks };
          });
          setAssessmentGrades(migrated);
        } else {
          const defaults: Record<string, { score: string; remarks: string }> = {};
          studentData.forEach((s: any) => {
            if (configObj.type === 'GRADES') {
              defaults[s.id] = { score: (configObj as any).gradesList?.[0] || '', remarks: '' };
            } else {
              const max = (configObj as any).maxMarks || 100;
              defaults[s.id] = { score: Math.round(max * 0.8).toString(), remarks: '' };
            }
          });
          setAssessmentGrades(defaults);
        }
      } catch (error) {
        console.error('Failed to load students for assessment', error);
      } finally {
        setStudentsLoading(false);
      }
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedSection || !selectedSubject || !selectedCategory) return;
    if (isAssessmentLocked) {
      alert('This assessment has been locked by the school admin and cannot be edited.');
      return;
    }

    const storageKey = `assessment_${selectedSection.id}_${selectedSubject.id}_${selectedCategory.id}`;
    localStorage.setItem(storageKey, JSON.stringify(assessmentGrades));
    
    try {
      const configObj = getCategoryConfig();
      await api.post('/academics/direct-evaluations/', {
        section: selectedSection.id,
        subject_mapping: selectedSubject.id,
        category_id: selectedCategory.id,
        config: configObj,
        grades: assessmentGrades,
        is_locked: false
      });
      setSuccessMessage(`Assessment saved successfully for ${selectedCategory.name}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to save assessment to backend database');
    }
  };

  const calculateGradeForMax = (score: string, maxMarks: number): string => {
    if (!score) return '-';
    const num = parseFloat(score);
    if (isNaN(num)) return '-';
    const pct = (num / maxMarks) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
  };

  // Internal Categories exactly matching Admin
  const internalCategories = [
    { 
      id: 'cap', 
      name: 'Continuous Academic Performance', 
      description: 'Academic progress and periodic evaluations', 
      icon: Award, 
      color: 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
    },
    { 
      id: 'sa', 
      name: 'Subject Application', 
      description: 'Practical application of concepts and assignments', 
      icon: PenTool, 
      color: 'bg-green-50 text-green-800 border border-green-200' 
    },
    { 
      id: 'ssc', 
      name: 'Soft Skills & Communication', 
      description: 'Class interaction, presentation, and teamwork', 
      icon: MessageSquare, 
      color: 'bg-teal-50 text-teal-800 border border-teal-200' 
    },
    { 
      id: 'dc', 
      name: 'Discipline & Consistency', 
      description: 'Regularity, homework submission, and behavior', 
      icon: ClipboardCheck, 
      color: 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
    }
  ];

  // Subject Teacher assignments scoping (strictly subject-assigned roles)
  const assignedSubjectAssignments = teacherAssignments.filter(
    (ta: any) => (ta.role === 'SUBJECT_TEACHER' || ta.role === 'SUBSTITUTE') && ta.subject
  );

  const filteredSections = sections.filter((sec) => {
    const matchesQuery = 
      sec.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.grade_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.section_letter.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesQuery) return false;

    // Check if teacher has subject mapping for this section
    const hasSubjectMapping = subjectMappings.some(
      sm => sm.section_id === sec.id || sm.section_name === `${sec.grade_name}-${sec.section_letter}`
    );

    // Or check if teacher has teacher assignment for this grade and section
    const hasTeacherAssignment = assignedSubjectAssignments.some((ta: any) => {
      const matchesG = normalizeGrade(ta.grade) === normalizeGrade(sec.grade_name);
      const matchesS = !ta.section || ta.section?.trim().toUpperCase() === sec.section_letter?.trim().toUpperCase();
      return matchesG && matchesS;
    });

    return hasSubjectMapping || hasTeacherAssignment;
  });

  const filteredAllocatedSubjects = subjectMappings.filter((sm) => {
    const matchesSection = sm.section_id === selectedSection?.id || sm.section_name === `${selectedSection?.grade_name}-${selectedSection?.section_letter}`;
    if (!matchesSection) return false;

    const matchesQuery = 
      sm.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sm.subject_code && sm.subject_code.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesQuery) return false;

    if (assignedSubjectAssignments.length === 0) return true;

    return assignedSubjectAssignments.some((ta: any) => {
      const matchesG = normalizeGrade(ta.grade) === normalizeGrade(selectedSection?.grade_name || '');
      const matchesS = !ta.section || ta.section?.trim().toUpperCase() === selectedSection?.section_letter?.trim().toUpperCase();
      const matchesSub = !ta.subject || sm.subject_name?.toLowerCase().includes(ta.subject.toLowerCase()) || ta.subject.toLowerCase().includes(sm.subject_name?.toLowerCase());
      return matchesG && matchesS && matchesSub;
    });
  });

  const internalExams = exams.filter(e => {
    const matchesSection = e.section_id_display === selectedSection?.id || e.section_name === `${selectedSection?.grade_name}-${selectedSection?.section_letter}`;
    const matchesSubject = e.subject_id === selectedSubject?.subject_id || e.subject_name === selectedSubject?.subject_name;
    const isInternal = e.exam_type !== 'FINALS' && e.exam_type !== 'FINAL' && (e.assessment_category || 'INTERNAL') === 'INTERNAL';
    return matchesSection && matchesSubject && isInternal;
  });

  const practicalExams = exams.filter(e => {
    return (e.assessment_category === 'PRACTICAL' || e.exam_type === 'PRACTICAL');
  });

  const finalExams = exams.filter(e => {
    return e.exam_type === 'FINALS' || e.exam_type === 'FINAL' || e.exam_type === 'FINAL_EXAM' || e.assessment_category === 'FINAL';
  });

  const internalCount = filteredSections.length;
  const practicalCount = practicalExams.length;
  const finalCount = finalExams.length;

  const filteredExams = (activeCategory === 'PRACTICAL' ? practicalExams : finalExams).filter(e => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(search) ||
      e.subject_name.toLowerCase().includes(search) ||
      e.section_name.toLowerCase().includes(search) ||
      (e.invigilator_names || []).some(name => name.toLowerCase().includes(search))
    );
  });

  const filteredStudents = students.filter(student => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const fullName = (student.full_name || `${student.first_name} ${student.last_name}`).toLowerCase();
    const rollNo = (student.roll_number || '').toString().toLowerCase();
    return fullName.includes(search) || rollNo.includes(search);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner - Teacher Portal Green Gradient Design */}
      <div className="bg-gradient-to-r from-green-700 via-green-800 to-emerald-900 text-white p-6 rounded-2xl shadow-md border border-green-600/30">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-green-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles size={14} /> Teacher Marks Management
            </div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3">
              <PenTool size={32} /> Student Marks & Evaluations
            </h1>
            <p className="text-green-100 text-sm mt-1">Record and manage student academic marks, practical scores, and term evaluations</p>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={
              activeCategory === 'INTERNAL'
                ? !selectedSection
                  ? "Search by grade or section..."
                  : !selectedSubject
                    ? "Search by subject name or code..."
                    : !selectedCategory
                      ? "Search by assessment category..."
                      : selectedCategory.id === 'cap'
                        ? "Search by exam name..."
                        : "Search by student name or roll number..."
                : "Search by exam name, subject, or section..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 text-sm"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl shadow-sm p-1.5 gap-2">
        <button
          onClick={() => handleTabChange('INTERNAL')}
          className={`flex-1 py-3 px-4 font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeCategory === 'INTERNAL'
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <BookMarked size={18} /> Internal Marks
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'INTERNAL' ? 'bg-green-900 text-green-100' : 'bg-gray-200 text-gray-700'
          }`}>
            {internalCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('PRACTICAL')}
          className={`flex-1 py-3 px-4 font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeCategory === 'PRACTICAL'
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <PenTool size={18} /> Practical / Lab Marks
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'PRACTICAL' ? 'bg-green-900 text-green-100' : 'bg-gray-200 text-gray-700'
          }`}>
            {practicalCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('FINAL')}
          className={`flex-1 py-3 px-4 font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeCategory === 'FINAL'
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Award size={18} /> Final Exams
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'FINAL' ? 'bg-green-900 text-green-100' : 'bg-gray-200 text-gray-700'
          }`}>
            {finalCount}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-green-700" size={40} />
        </div>
      ) : activeCategory === 'INTERNAL' ? (
        /* Internal Marks Section */
        <div>
          {!selectedSection ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Select Grade & Section</h2>
                <span className="text-sm text-gray-500">{filteredSections.length} Sections active</span>
              </div>
              
              {filteredSections.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500 border border-gray-200">
                  <GraduationCap size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold">No grades or sections found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSections.map((section) => (
                    <div 
                      key={section.id} 
                      onClick={() => {
                        setSelectedSection(section);
                        setSearchQuery('');
                      }}
                      className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-600 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-green-50 text-green-700 rounded-lg">
                            <GraduationCap size={24} />
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                            {section.student_count} Students
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-green-700 transition">
                          {section.full_name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Grade: {section.grade_name}</p>
                      </div>
                      <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-sm">
                        <span className="text-gray-600 truncate max-w-[180px]">
                          👤 Teacher: {section.class_teacher_name || 'Not assigned'}
                        </span>
                        <span className="text-green-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          View Subjects <ChevronRight size={16} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !selectedSubject ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setSelectedSection(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Grades & Sections
                </button>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">
                    Subjects for {selectedSection.full_name}
                  </h2>
                  <span className="text-sm text-gray-500">{filteredAllocatedSubjects.length} Subjects</span>
                </div>
              </div>

              {filteredAllocatedSubjects.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500 border border-gray-200">
                  <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold">No subjects allocated to this section</p>
                  <p className="text-sm mt-2">Go to subjects mapping to allocate subjects</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAllocatedSubjects.map((mapping) => (
                    <div 
                      key={mapping.id} 
                      onClick={() => {
                        setSelectedSubject(mapping);
                        setSearchQuery('');
                      }}
                      className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-600 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-green-50 text-green-700 rounded-lg">
                            <BookOpen size={24} />
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                            {mapping.periods_per_week} Periods/wk
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-green-700 transition">
                          {mapping.subject_name}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Code: {mapping.subject_code || 'N/A'}</p>
                      </div>
                      <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-sm">
                        <span className="text-gray-600 truncate max-w-[180px]">
                          👤 Teacher: {mapping.teacher_name || 'Not assigned'}
                        </span>
                        <span className="text-green-700 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Assessments <ChevronRight size={16} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !selectedCategory ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setSelectedSubject(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Subjects
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedSubject.subject_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Internal Marks entry for <strong className="text-gray-700">{selectedSection.full_name}</strong>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {internalCategories.map((category) => {
                  const CategoryIcon = category.icon;
                  return (
                    <div 
                      key={category.id} 
                      onClick={() => handleSelectCategory(category)}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-green-600 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-3 rounded-xl ${category.color}`}>
                            <CategoryIcon size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition">{category.name}</h3>
                            <p className="text-xs text-gray-500">{category.description}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          {category.id === 'cap' ? (
                            <div className="text-sm text-gray-500">
                              Contains all scheduled theory examinations. ({internalExams.length} Exams)
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Assess student behaviors, application skills, and soft capabilities.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-4 mt-6 flex justify-end">
                        <span className="text-green-700 font-bold text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          {category.id === 'cap' ? 'View Exams' : 'Evaluate Students'} <ChevronRight size={16} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : selectedCategory.id === 'cap' ? (
            /* Continuous Academic Performance view: shows exams list */
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedCategory.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    View scheduled exams of <strong className="text-gray-700">{selectedSection.full_name}</strong> for <strong className="text-gray-700">{selectedSubject.subject_name}</strong>
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {internalExams.length === 0 ? (
                  <div className="p-8 bg-white rounded-xl text-center text-sm text-gray-500 border border-gray-200">
                    No internal theory exams found for this subject.
                  </div>
                ) : (
                  internalExams.map((exam) => (
                    <div key={exam.id} className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-green-600 transition">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">{exam.name}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                          <span>📅 {new Date(exam.exam_date).toLocaleDateString()}</span>
                          <span>Max: {exam.max_marks} | Pass: {exam.passing_marks}</span>
                          {exam.invigilator_names && exam.invigilator_names.length > 0 && (
                            <span>👤 Invigilator: {exam.invigilator_names.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/teachers/marks/${exam.id}`)}
                        className="bg-green-700 hover:bg-green-800 text-white text-sm px-6 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 self-start md:self-auto shadow-sm"
                      >
                        <PenTool size={16} /> Enter Marks
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Direct evaluations (Subject Application, Soft Skills, Discipline): shows students table */
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedCategory.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Assess students of <strong className="text-gray-700">{selectedSection.full_name}</strong> for <strong className="text-gray-700">{selectedSubject.subject_name}</strong>
                    </p>
                  </div>
                  {!isAssessmentLocked && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveAssessment}
                        className="bg-green-700 hover:bg-green-800 text-white py-2.5 px-6 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm shadow-sm"
                      >
                        <ClipboardCheck size={20} /> Save Assessment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isAssessmentLocked && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-center font-bold text-lg shadow-sm">
                  🔒 Marks Locked by Admin (Uneditable)
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" /> {successMessage}
                </div>
              )}

              {studentsLoading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="animate-spin text-green-700" size={40} />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500 border border-gray-200">
                  <Users size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold">No students found matching search query</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                          <th className="px-6 py-4 text-left font-bold">Roll No</th>
                          <th className="px-6 py-4 text-left font-bold">Student Name</th>
                          {selectedCategory.id === 'dc' && (
                            <th className="px-6 py-4 text-center font-bold">
                              <span className="flex items-center justify-center gap-1">
                                Attendance
                                {attendanceLoading && <Loader2 className="animate-spin text-green-600" size={14} />}
                              </span>
                            </th>
                          )}
                          <th className="px-6 py-4 text-center font-bold">
                            {getCategoryConfig().type === 'GRADES' 
                              ? 'Grade' 
                              : `Performance Score (0-${getCategoryConfig().maxMarks || 100})`}
                          </th>
                          <th className="px-6 py-4 text-left font-bold">Remarks / Qualitative Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => {
                          const configObj = getCategoryConfig();
                          return (
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-green-50/30 transition">
                              <td className="px-6 py-4 font-semibold text-gray-900">{student.roll_number || '-'}</td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">
                                  {student.full_name || `${student.first_name} ${student.last_name}`}
                                </div>
                                <div className="text-xs text-gray-400">ID: {student.suid || student.id}</div>
                              </td>
                              {selectedCategory.id === 'dc' && (
                                <td className="px-6 py-4 text-center text-gray-900 font-semibold">
                                  {attendanceLoading ? (
                                    <Loader2 className="animate-spin mx-auto text-gray-400" size={16} />
                                  ) : attendanceSummary[student.id] ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-bold text-gray-900">
                                        {attendanceSummary[student.id].percentage}%
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        ({attendanceSummary[student.id].present}/{attendanceSummary[student.id].total})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                              <td className="px-6 py-4">
                                {configObj.type === 'GRADES' ? (
                                  <div className="flex justify-center">
                                    <select
                                      value={assessmentGrades[student.id]?.score || ''}
                                      disabled={isAssessmentLocked}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAssessmentGrades(prev => ({
                                          ...prev,
                                          [student.id]: {
                                            ...prev[student.id] || { score: '', remarks: '' },
                                            score: val
                                          }
                                        }));
                                      }}
                                      className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100 text-sm"
                                    >
                                      <option value="">Select Grade</option>
                                      {(configObj.gradesList || []).map((grade: string) => (
                                        <option key={grade} value={grade}>{grade}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-3">
                                    <input
                                      type="number"
                                      min="0"
                                      max={configObj.maxMarks || 100}
                                      disabled={isAssessmentLocked}
                                      value={assessmentGrades[student.id]?.score || ''}
                                      onChange={(e) => {
                                        const max = configObj.maxMarks || 100;
                                        const val = e.target.value === '' ? '' : Math.min(parseFloat(e.target.value), max).toString();
                                        setAssessmentGrades(prev => ({
                                          ...prev,
                                          [student.id]: {
                                            ...prev[student.id] || { score: '', remarks: '' },
                                            score: val
                                          }
                                        }));
                                      }}
                                      className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                                      placeholder="0"
                                    />
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.9 ? 'bg-emerald-100 text-emerald-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.8 ? 'bg-green-100 text-green-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.7 ? 'bg-teal-100 text-teal-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.6 ? 'bg-amber-100 text-amber-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.5 ? 'bg-orange-100 text-orange-800' :
                                      'bg-rose-100 text-rose-800'
                                    }`}>
                                      {calculateGradeForMax(assessmentGrades[student.id]?.score || '', configObj.maxMarks || 100)}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <input
                                  type="text"
                                  placeholder="Enter remarks (e.g. participation, work quality)..."
                                  disabled={isAssessmentLocked}
                                  value={assessmentGrades[student.id]?.remarks || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAssessmentGrades(prev => ({
                                      ...prev,
                                      [student.id]: {
                                        ...prev[student.id] || { score: '', remarks: '' },
                                        remarks: val
                                      }
                                    }));
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-100"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500 border border-gray-200">
          <BookMarked size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No exams found</p>
          <p className="text-sm mt-2">Create exams first to record marks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredExams.map((exam) => (
            <div key={exam.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-600 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">{exam.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                    <span>📚 {exam.subject_name}</span>
                    <span>👥 {exam.section_name}</span>
                    <span>📅 {new Date(exam.exam_date).toLocaleDateString()}</span>
                    {exam.invigilator_names && exam.invigilator_names.length > 0 && (
                      <span>👤 Invigilator: {exam.invigilator_names.join(', ')}</span>
                    )}
                  </div>
                </div>
                <span className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-sm">
                  {exam.exam_type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-600 font-semibold">Total Marks</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.max_marks}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-600 font-semibold">Passing Marks</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.passing_marks}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-600 font-semibold">Exam Type</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{exam.exam_type}</p>
                </div>
              </div>

              <button
                onClick={() => router.push(`/teachers/marks/${exam.id}`)}
                className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-sm"
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
