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
  Users
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

export default function MarksEntryPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamWithStatus[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjectMappings, setSubjectMappings] = useState<any[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [activeCategory, setActiveCategory] = useState<'INTERNAL' | 'PRACTICAL' | 'FINAL'>('INTERNAL');

  // Navigation states for Internal Marks
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);

  // Student assessments for direct evaluation categories
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assessmentGrades, setAssessmentGrades] = useState<Record<string, { score: string; remarks: string }>>({});
  const [successMessage, setSuccessMessage] = useState('');

  // Lock and Config States for direct evaluations
  const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSystemType, setConfigSystemType] = useState<'MARKS' | 'GRADES'>('MARKS');
  const [configMaxMarks, setConfigMaxMarks] = useState<number>(100);
  const [configGrades, setConfigGrades] = useState<string[]>(['A', 'B', 'C', 'D']);

  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, any>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const isGrade11or12 = (g: string) => {
    const clean = g.toLowerCase().replace('grade', '').trim();
    return clean === '11' || clean === '12';
  };

  useEffect(() => {
    fetchSchoolId();
    fetchData();
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [examsRes, sectionsRes, mappingsRes, gradesRes] = await Promise.all([
        api.get('/academics/exams/?purpose=marks'),
        api.get('/academics/sections/'),
        api.get('/academics/subject-mappings/?purpose=marks'),
        api.get('/academics/grades/')
      ]);
      setExams(Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || []);
      setSections(Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || []);
      setSubjectMappings(Array.isArray(mappingsRes.data) ? mappingsRes.data : mappingsRes.data.results || []);
      setGrades(Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || []);
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
        
        // Fetch from backend DirectEvaluation model
        let evalData: any = null;
        try {
          const evalResponse = await api.get(
            `/academics/direct-evaluations/?section=${selectedSection?.id}&subject_mapping=${selectedSubject?.id}&category_id=${category.id}`
          );
          evalData = evalResponse.data?.results?.[0] || evalResponse.data?.[0] || null;
        } catch (err) {
          console.error("Failed to load direct evaluation configuration", err);
        }

        // Set lock state from backend database (fallback to localStorage/false)
        if (evalData) {
          setIsAssessmentLocked(evalData.is_locked);
        } else {
          const lockKey = `assessment_locked_${selectedSection?.id}_${selectedSubject?.id}_${category.id}`;
          setIsAssessmentLocked(localStorage.getItem(lockKey) === 'true');
        }

        // Get active system config for this grade and category
        let configObj = { type: 'MARKS', maxMarks: 100 };
        if (evalData && evalData.config && Object.keys(evalData.config).length > 0) {
          configObj = evalData.config;
          // Sync back to localStorage for consistency with any helper reading it
          const configKey = `system_config_${selectedSection?.grade_name}_${category.id}`;
          localStorage.setItem(configKey, JSON.stringify(configObj));
        } else {
          const configKey = `system_config_${selectedSection?.grade_name}_${category.id}`;
          const savedConfigStr = localStorage.getItem(configKey);
          if (savedConfigStr) {
            configObj = JSON.parse(savedConfigStr);
          }
        }
        
        // Load saved grades
        let savedGrades: Record<string, { score: string; remarks: string }> | null = null;
        if (evalData && evalData.grades && Object.keys(evalData.grades).length > 0) {
          savedGrades = evalData.grades;
          // Sync back to localStorage for consistency with any helper reading it
          const storageKey = `assessment_${selectedSection?.id}_${selectedSubject?.id}_${category.id}`;
          localStorage.setItem(storageKey, JSON.stringify(savedGrades));
        } else {
          const storageKey = `assessment_${selectedSection?.id}_${selectedSubject?.id}_${category.id}`;
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            savedGrades = JSON.parse(savedData);
          }
        }

        if (savedGrades) {
          // Migrate values to ensure they comply with the current config
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
          // Initialize default values
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

  const handleLockAssessment = async () => {
    if (!confirm('Are you sure you want to lock the assessment? Once locked, the marks entry will be permanent and cannot be edited.')) {
      return;
    }
    if (!selectedSection || !selectedSubject || !selectedCategory) return;
    const lockKey = `assessment_locked_${selectedSection.id}_${selectedSubject.id}_${selectedCategory.id}`;
    localStorage.setItem(lockKey, 'true');

    try {
      const configObj = getCategoryConfig();
      await api.post('/academics/direct-evaluations/', {
        section: selectedSection.id,
        subject_mapping: selectedSubject.id,
        category_id: selectedCategory.id,
        config: configObj,
        grades: assessmentGrades,
        is_locked: true
      });
      setIsAssessmentLocked(true);
      setSuccessMessage('Assessment locked successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to lock assessment');
    }
  };

  const handleUnlockAssessment = async () => {
    if (!confirm('Are you sure you want to unlock the assessment? Once unlocked, you will be able to edit and re-save marks.')) {
      return;
    }
    if (!selectedSection || !selectedSubject || !selectedCategory) return;
    const lockKey = `assessment_locked_${selectedSection.id}_${selectedSubject.id}_${selectedCategory.id}`;
    localStorage.setItem(lockKey, 'false');

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
      setIsAssessmentLocked(false);
      setSuccessMessage('Assessment unlocked successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to unlock assessment');
    }
  };

  const openConfigModal = () => {
    if (!selectedSection || !selectedCategory) return;
    const configKey = `system_config_${selectedSection.grade_name}_${selectedCategory.id}`;
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfigSystemType(parsed.type);
      setConfigMaxMarks(parsed.maxMarks || 100);
      setConfigGrades(parsed.gradesList || ['A', 'B', 'C', 'D']);
    } else {
      setConfigSystemType('MARKS');
      setConfigMaxMarks(100);
      setConfigGrades(['A', 'B', 'C', 'D']);
    }
    setIsConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedSection || !selectedCategory) return;
    
    let configObj: any = { type: 'MARKS', maxMarks: 100 };
    if (configSystemType === 'GRADES') {
      const cleanedGrades = configGrades.map(g => g.trim().toUpperCase()).filter(g => g !== '');
      if (cleanedGrades.length === 0) {
        alert('Please define at least one grade.');
        return;
      }
      const uniqueGrades = Array.from(new Set(cleanedGrades));
      if (uniqueGrades.length !== cleanedGrades.length) {
        alert('Duplicate grades are not allowed.');
        return;
      }
      
      const configKey = `system_config_${selectedSection.grade_name}_${selectedCategory.id}`;
      configObj = {
        type: 'GRADES',
        gradesList: uniqueGrades
      };
      localStorage.setItem(configKey, JSON.stringify(configObj));
    } else {
      if (configMaxMarks <= 0) {
        alert('Maximum marks must be greater than 0.');
        return;
      }
      const configKey = `system_config_${selectedSection.grade_name}_${selectedCategory.id}`;
      configObj = {
        type: 'MARKS',
        maxMarks: configMaxMarks
      };
      localStorage.setItem(configKey, JSON.stringify(configObj));
    }
    
    // Send updated config to backend database if subject is selected
    if (selectedSubject) {
      try {
        await api.post('/academics/direct-evaluations/', {
          section: selectedSection.id,
          subject_mapping: selectedSubject.id,
          category_id: selectedCategory.id,
          config: configObj,
          grades: assessmentGrades,
          is_locked: isAssessmentLocked
        });
      } catch (err) {
        console.error("Failed to sync new config with backend database", err);
      }
    }
    
    setIsConfigOpen(false);
    handleSelectCategory(selectedCategory);
    setSuccessMessage('System configuration saved successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const getCategoryConfig = () => {
    if (!selectedSection || !selectedCategory) return { type: 'MARKS', maxMarks: 100 };
    const configKey = `system_config_${selectedSection.grade_name}_${selectedCategory.id}`;
    const savedConfig = localStorage.getItem(configKey);
    return savedConfig ? JSON.parse(savedConfig) : { type: 'MARKS', maxMarks: 100 };
  };

  const calculateGradeForMax = (scoreStr: string, maxMarks: number): string => {
    if (scoreStr === '') return '-';
    const score = parseFloat(scoreStr);
    if (isNaN(score) || maxMarks <= 0) return '-';
    const percentage = (score / maxMarks) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const calculateGrade = (scoreStr: string): string => {
    return calculateGradeForMax(scoreStr, 100);
  };

  const internalCount = exams.filter(e => e.exam_type !== 'FINALS' && (e.assessment_category || 'INTERNAL') === 'INTERNAL').length;
  const practicalCount = exams.filter(e => e.assessment_category === 'PRACTICAL').length;
  const finalCount = exams.filter(e => e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL').length;

  const filteredExams = exams.filter(e => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.section_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = false;
    if (activeCategory === 'PRACTICAL') {
      matchesCategory = e.assessment_category === 'PRACTICAL';
    } else if (activeCategory === 'FINAL') {
      matchesCategory = e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL';
    } else {
      matchesCategory = e.exam_type !== 'FINALS' && (e.assessment_category || 'INTERNAL') === 'INTERNAL';
    }
    return matchesSearch && matchesCategory;
  });

  // Internal Marks selection filtering
  const filteredSections = sections.filter(section => {
    if (!section.is_active) return false;
    
    // Filter sections based on allowed subject mappings
    if (subjectMappings.length > 0 && !subjectMappings.some(sm => sm.section_id === section.id)) {
      return false;
    }
    
    const search = searchQuery.toLowerCase();
    return (
      section.full_name.toLowerCase().includes(search) ||
      (section.class_teacher_name || '').toLowerCase().includes(search) ||
      section.grade_name.toLowerCase().includes(search)
    );
  });

  const allocatedSubjects = subjectMappings.filter(sm => 
    sm.is_active && (sm.section_id === selectedSection?.id || sm.section_name === selectedSection?.full_name)
  );

  const filteredAllocatedSubjects = allocatedSubjects.filter(sm => {
    const search = searchQuery.toLowerCase();
    return (
      sm.subject_name.toLowerCase().includes(search) ||
      (sm.subject_code || '').toLowerCase().includes(search) ||
      (sm.teacher_name || '').toLowerCase().includes(search)
    );
  });

  const internalExams = exams.filter(e => {
    const matchesSection = e.section_id_display === selectedSection?.id || e.section_name === selectedSection?.full_name;
    const matchesSubject = e.subject_id === selectedSubject?.subject_id || e.subject_name === selectedSubject?.subject_name;
    const isInternal = e.exam_type !== 'FINALS' && (e.assessment_category || 'INTERNAL') === 'INTERNAL';
    
    if (!matchesSection || !matchesSubject || !isInternal) return false;
    
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(search) ||
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

  const internalCategories = [
    { 
      id: 'cap', 
      name: 'Continuous Academic Performance', 
      description: 'Academic progress and periodic evaluations', 
      icon: Award, 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-250' 
    },
    { 
      id: 'sa', 
      name: 'Subject Application', 
      description: 'Practical application of concepts and assignments', 
      icon: PenTool, 
      color: 'bg-indigo-50 text-indigo-700 border-indigo-250' 
    },
    { 
      id: 'ssc', 
      name: 'Soft Skills & Communication', 
      description: 'Class interaction, presentation, and teamwork', 
      icon: MessageSquare, 
      color: 'bg-amber-50 text-amber-700 border-amber-250' 
    },
    { 
      id: 'dc', 
      name: 'Discipline & Consistency', 
      description: 'Regularity, homework submission, and behavior', 
      icon: ClipboardCheck, 
      color: 'bg-rose-50 text-rose-700 border-rose-250' 
    }
  ];

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
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => handleTabChange('INTERNAL')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeCategory === 'INTERNAL'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📝 Internal Marks
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'INTERNAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {internalCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('PRACTICAL')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeCategory === 'PRACTICAL'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          🔬 Practicals/Practical Exams
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'PRACTICAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {practicalCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('FINAL')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeCategory === 'FINAL'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          🏆 Final Exams
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            activeCategory === 'FINAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {finalCount}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : activeCategory === 'INTERNAL' ? (
        /* Internal Marks Section */
        <div>
          {!selectedSection ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Select Grade & Section</h2>
                <span className="text-sm text-gray-500">{filteredSections.length} Sections active</span>
              </div>
              
              {filteredSections.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500">
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
                      className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
                            <GraduationCap size={24} />
                          </div>
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                            {section.student_count} Students
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{section.full_name}</h3>
                        <p className="text-sm text-gray-500 mb-4">Grade: {section.grade_name}</p>
                      </div>
                      <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-sm">
                        <span className="text-gray-600 truncate max-w-[180px]">
                          👤 Teacher: {section.class_teacher_name || 'Not assigned'}
                        </span>
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
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
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Grades & Sections
                </button>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                    Subjects for {selectedSection.full_name}
                  </h2>
                  <span className="text-sm text-gray-500">{filteredAllocatedSubjects.length} Subjects</span>
                </div>
              </div>

              {filteredAllocatedSubjects.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500">
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
                      className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg">
                            <BookOpen size={24} />
                          </div>
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                            {mapping.periods_per_week} Periods/wk
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{mapping.subject_name}</h3>
                        <p className="text-sm text-gray-500 mb-4">Code: {mapping.subject_code || 'N/A'}</p>
                      </div>
                      <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-sm">
                        <span className="text-gray-600 truncate max-w-[180px]">
                          👤 Teacher: {mapping.teacher_name || 'Not assigned'}
                        </span>
                        <span className="text-blue-600 font-semibold flex items-center gap-1">
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
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Subjects
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-250">
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
                      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-3 rounded-xl ${category.color} bg-opacity-20`}>
                            <CategoryIcon size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-950">{category.name}</h3>
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

                      <div className="border-t border-gray-150 pt-4 mt-6 flex justify-end">
                        <span className="text-blue-600 font-semibold text-sm flex items-center gap-1">
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
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-250">
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
                    No internal exams found for this subject.
                  </div>
                ) : (
                  internalExams.map((exam) => (
                    <div key={exam.id} className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                        onClick={() => router.push(`/dashboard/academics/marks-entry/${exam.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 self-start md:self-auto"
                      >
                        <PenTool size={16} /> Enter Marks
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Other three assessment views: shows students list */
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold w-fit"
                >
                  <ArrowLeft size={16} /> Back to Categories
                </button>
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-250">
                      {selectedCategory.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Assess students of <strong className="text-gray-700">{selectedSection.full_name}</strong> for <strong className="text-gray-700">{selectedSubject.subject_name}</strong>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={openConfigModal}
                      disabled={isAssessmentLocked}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 px-4 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm"
                    >
                      🔧 Assign marks/grade system
                    </button>
                    {!isAssessmentLocked ? (
                      <>
                        <button
                          onClick={handleSaveAssessment}
                          className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-6 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm"
                        >
                          <ClipboardCheck size={20} /> Save Assessment
                        </button>
                        <button
                          onClick={handleLockAssessment}
                          className="bg-red-600 hover:bg-red-700 text-white py-2.5 px-6 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm"
                        >
                          🔒 Lock Marks
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleUnlockAssessment}
                        className="bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-6 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm"
                      >
                        🔓 Unlock Marks
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isAssessmentLocked && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-center font-bold text-lg shadow-sm">
                  🔒 Marks Locked (Uneditable)
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-green-700 font-semibold flex items-center gap-2">
                  <ClipboardCheck size={20} /> {successMessage}
                </div>
              )}

              {studentsLoading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500">
                  <Users size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-semibold">No students found matching search query</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-750">
                          <th className="px-6 py-4 text-left font-bold">Roll No</th>
                          <th className="px-6 py-4 text-left font-bold">Student Name</th>
                          {selectedCategory.id === 'dc' && (
                            <th className="px-6 py-4 text-center font-bold">
                              <span className="flex items-center justify-center gap-1">
                                Attendance
                                {attendanceLoading && <Loader2 className="animate-spin text-blue-500" size={14} />}
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
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                              <td className="px-6 py-4 font-semibold text-gray-900">{student.roll_number || '-'}</td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-955">
                                  {student.full_name || `${student.first_name} ${student.last_name}`}
                                </div>
                                <div className="text-xs text-gray-400">ID: {student.suid || student.id}</div>
                              </td>
                              {selectedCategory.id === 'dc' && (
                                <td className="px-6 py-4 text-center text-gray-900 font-semibold">
                                  {attendanceLoading ? (
                                    <Loader2 className="animate-spin mx-auto text-gray-450" size={16} />
                                  ) : attendanceSummary[student.id] ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-bold text-gray-955">
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
                                      className="w-32 px-3 py-1.5 border border-gray-250 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
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
                                      className="w-20 px-3 py-1.5 border border-gray-250 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-105 disabled:text-gray-500 text-sm"
                                      placeholder="0"
                                    />
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.9 ? 'bg-emerald-100 text-emerald-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.8 ? 'bg-green-100 text-green-800' :
                                      parseFloat(assessmentGrades[student.id]?.score || '0') >= (configObj.maxMarks || 100) * 0.7 ? 'bg-blue-100 text-blue-800' :
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
                                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                    <span>📚 {exam.subject_name}</span>
                    <span>👥 {exam.section_name}</span>
                    <span>📅 {new Date(exam.exam_date).toLocaleDateString()}</span>
                    {exam.invigilator_names && exam.invigilator_names.length > 0 && (
                      <span>👤 Invigilator: {exam.invigilator_names.join(', ')}</span>
                    )}
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

      {/* Assign Marks/Grade System Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-150">
              <h3 className="text-xl font-bold text-gray-900">Assign Marks/Grade System</h3>
              <p className="text-xs text-gray-500 mt-1">
                Configure evaluation system for category <strong className="text-gray-700">{selectedCategory?.name}</strong>. Applicable to all sections of Grade <strong className="text-gray-700">{selectedSection?.grade_name}</strong>.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Radio Buttons */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Select System Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-800">
                    <input
                      type="radio"
                      name="configSystemType"
                      checked={configSystemType === 'MARKS'}
                      onChange={() => setConfigSystemType('MARKS')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    Assign Marks System
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-800">
                    <input
                      type="radio"
                      name="configSystemType"
                      checked={configSystemType === 'GRADES'}
                      onChange={() => setConfigSystemType('GRADES')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    Assign Grading System
                  </label>
                </div>
              </div>

              {/* Marks Input */}
              {configSystemType === 'MARKS' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700">Maximum Marks</label>
                  <input
                    type="number"
                    min="1"
                    value={configMaxMarks}
                    onChange={(e) => setConfigMaxMarks(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Grades Input */}
              {configSystemType === 'GRADES' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700">Define Grades Hierarchy</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {configGrades.map((grade, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={grade}
                          placeholder={`Grade ${idx + 1} (e.g., ${['A+', 'A', 'B', 'C', 'D'][idx] || 'E'})`}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newGrades = [...configGrades];
                            newGrades[idx] = val;
                            setConfigGrades(newGrades);
                          }}
                          className="flex-grow px-3 py-1.5 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        {configGrades.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newGrades = configGrades.filter((_, i) => i !== idx);
                              setConfigGrades(newGrades);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition text-xs font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfigGrades([...configGrades, ''])}
                    className="w-full py-2 bg-gray-50 hover:bg-gray-150 border border-gray-250 border-dashed text-gray-650 rounded-lg font-semibold text-xs transition"
                  >
                    + Add Grade Option
                  </button>
                </div>
              )}
            </div>
            
            {/* Modal Actions */}
            <div className="p-6 bg-gray-50 border-t border-gray-150 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 border border-gray-350 text-gray-700 bg-white hover:bg-gray-100 rounded-lg text-sm font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
