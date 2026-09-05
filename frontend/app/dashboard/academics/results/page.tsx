'use client';

import { useState, useEffect, useMemo } from 'react';
import api, { getMediaUrl } from '@/lib/api';
import {
  FileText, Loader2, Search, Award, AlertCircle, ArrowLeft,
  BookOpen, Users, ClipboardCheck, Settings, Plus, Minus,
  Info, ShieldAlert, Sparkles, X
} from 'lucide-react';
import FeatureGuard from '@/components/FeatureGuard';
import { usePermissionContext } from '@/lib/rbac-context';
import PermissionDenied from '@/components/PermissionDenied';
import { useSettings } from '@/lib/SettingsContext';

// Interfaces
interface Section {
  id: string;
  full_name: string;
  grade_name: string;
  section_letter: string;
}

interface SubjectMapping {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  section_id: string;
  section_name: string;
  is_active: boolean;
}

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  max_marks: number;
  passing_marks: number;
  assessment_category: 'INTERNAL' | 'PRACTICAL';
  section_id_display?: string;
  subject_id?: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number?: string;
  suid?: string;
}

interface ResultRecord {
  id: string;
  student_name: string;
  student_suid: string;
  marks_obtained: number;
  percentage: number;
  grade: string;
  is_absent: boolean;
  aggregated_internal_marks: number | null;
  aggregated_practical_marks: number | null;
}

interface EntityConfig {
  id: string; // exam ID or direct assessment ID (sa, ssc, dc)
  name: string;
  type: 'EXAM' | 'DIRECT';
  alias: string;
  scaleTo: string; // numeric string or empty
  maxMarks: number;
}

// Math Formula Parser (BODMAS compliant)
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

export default function ResultsPage() {
  const { hasPermission, loading: rbacLoading } = usePermissionContext();
  const { settings } = useSettings();
  const currentAcademicYear = settings?.current_academic_year || '';

  // Navigation & Hierarchy State
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  
  const [subjectMappings, setSubjectMappings] = useState<SubjectMapping[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectMapping | null>(null);
  
  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'PRACTICAL' | 'FINALS'>('INTERNAL');

  // Roster & Mark Entries Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<Record<string, Record<string, ResultRecord>>>({}); // examId -> studentId -> ResultRecord
  
  // PDF Generation State
  const [generatedPDFs, setGeneratedPDFs] = useState<{
    studentId: string;
    studentName: string;
    rollNumber: string;
    pdfUrl: string;
    fileName: string;
  }[]>([]);
  const [isGeneratingPDFs, setIsGeneratingPDFs] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);


  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Formula Panel State
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [formulaEntities, setFormulaEntities] = useState<EntityConfig[]>([]);
  const [formulaString, setFormulaString] = useState('');
  const [formulaError, setFormulaError] = useState('');

  // Available Grades (memoized to avoid recalculation on every render)
  const availableGrades = useMemo(() => {
    return Array.from(new Set(sections.map(s => s.grade_name))).sort((a, b) => {
      const na = parseInt(a);
      const nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [sections]);

  // User Context
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // School Settings Context
  const [schoolSettings, setSchoolSettings] = useState<any>(null);

  // Report Card Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewExams, setPreviewExams] = useState<Exam[]>([]);
  const [previewResults, setPreviewResults] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Promotion & Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, { grade: string, section: string }>>({});

  // Fetch initial data (Grades and Sections)
  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      try {
        const [secRes, subMapRes, settingsRes] = await Promise.all([
          api.get('/academics/sections/'),
          api.get('/academics/subject-mappings/'),
          api.get('/schools/settings/my_settings/').catch(() => null)
        ]);
        setSections(Array.isArray(secRes.data) ? secRes.data : secRes.data.results || []);
        setSubjectMappings(Array.isArray(subMapRes.data) ? subMapRes.data : subMapRes.data.results || []);
        if (settingsRes) {
          setSchoolSettings(settingsRes.data);
        }
      } catch (err) {
        console.error('Failed to load classes or mappings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  // Reset selected subject when section changes
  useEffect(() => {
    setSelectedSubject(null);
  }, [selectedSection]);

  // Fetch students for the selected section
  useEffect(() => {
    if (!selectedSection) {
      setStudents([]);
      return;
    }

    const fetchSectionDetails = async () => {
      setLoading(true);
      try {
        const studRes = await api.get(`/students/?current_section=${selectedSection.id}&status=ACTIVE`);
        const sData = studRes.data.results || studRes.data || [];
        setStudents(Array.isArray(sData) ? sData : []);
      } catch (err) {
        console.error('Failed to fetch section details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSectionDetails();
  }, [selectedSection]);

  // Fetch saved report cards when selectedSection and students change
  useEffect(() => {
    if (!selectedSection || students.length === 0) {
      setGeneratedPDFs([]);
      return;
    }

    const fetchSavedReportCards = async () => {
      try {
        const res = await api.get(`/academics/report-cards/?section=${selectedSection.id}`);
        const cards = res.data.results || res.data || [];
        
        const mappedPDFs = cards
          .filter((card: any) => card.file_path)
          .map((card: any) => {
            const studentObj = students.find(s => s.id === card.student);
            const studentName = studentObj ? `${studentObj.first_name} ${studentObj.last_name}` : card.student_name;
            const rollNumber = studentObj?.roll_number || '-';
            const cleanFirstName = (studentObj?.first_name || card.student_name || '').replace(/\s+/g, '_');
            const cleanLastName = (studentObj?.last_name || '').replace(/\s+/g, '_');
            const fileName = `Report_Card_${cleanFirstName}_${cleanLastName}_${rollNumber || card.student}.pdf`;
            
            return {
              studentId: card.student,
              studentName,
              rollNumber,
              pdfUrl: getMediaUrl(card.file_path) || card.file_path,
              fileName
            };
          });
        setGeneratedPDFs(mappedPDFs);
      } catch (err) {
        console.error('Failed to fetch saved report cards', err);
      }
    };
    fetchSavedReportCards();
  }, [selectedSection, students]);

  // Fetch exams specifically for the selected section and subject mapping
  useEffect(() => {
    if (!selectedSection || !selectedSubject) {
      setExams([]);
      return;
    }

    const fetchExamsForSubject = async () => {
      setLoading(true);
      try {
        const examRes = await api.get(
          `/academics/exams/?section=${selectedSection.id}&subject_mapping=${selectedSubject.id}`
        );
        setExams(Array.isArray(examRes.data) ? examRes.data : examRes.data.results || []);
      } catch (err) {
        console.error('Failed to fetch exams for subject', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExamsForSubject();
  }, [selectedSection, selectedSubject]);

  // Load Exam results when section/subject changes
  useEffect(() => {
    if (!selectedSection || !selectedSubject) return;

    const fetchAllExamResults = async () => {
      setLoading(true);
      try {
        const resultsMap: Record<string, Record<string, ResultRecord>> = {};
        const subjectExams = exams.filter(e => 
          e.exam_type !== 'FINALS' && 
          (e.assessment_category === 'INTERNAL' || e.assessment_category === 'PRACTICAL')
        );

        await Promise.all(
          subjectExams.map(async (exam) => {
            try {
              const res = await api.get(`/academics/results/for_exam/?exam_id=${exam.id}`);
              const recordsList = res.data.results || res.data || [];
              const studentRecs: Record<string, ResultRecord> = {};
              recordsList.forEach((r: any) => {
                studentRecs[r.student_id || r.student] = r;
              });
              resultsMap[exam.id] = studentRecs;
            } catch (err) {
              console.error(`Failed to fetch results for exam ${exam.id}`, err);
            }
          })
        );

        // Fetch finals results if exist
        const finalsExams = exams.filter(e => e.exam_type === 'FINALS');
        await Promise.all(
          finalsExams.map(async (exam) => {
            try {
              const res = await api.get(`/academics/results/for_exam/?exam_id=${exam.id}`);
              const recordsList = res.data.results || res.data || [];
              const studentRecs: Record<string, ResultRecord> = {};
              recordsList.forEach((r: any) => {
                studentRecs[r.student_id || r.student] = r;
              });
              resultsMap[exam.id] = studentRecs;
            } catch (err) {
              console.error(`Failed to fetch results for final exam ${exam.id}`, err);
            }
          })
        );

        setExamResults(resultsMap);
      } catch (err) {
        console.error('Failed to gather exam results', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllExamResults();
  }, [selectedSection, selectedSubject, exams]);

  // Filters
  const allocatedSubjects = subjectMappings.filter(sm => 
    sm.is_active && (sm.section_id === selectedSection?.id || sm.section_name === selectedSection?.full_name)
  );

  // Filter exams based on current activeTab (Internals vs Practicals vs Finals)
  const currentTabExams = exams.filter(e => {
    // Client-side filtering by section and subject as a secondary guard
    const matchesSection = !e.section_id_display || e.section_id_display === selectedSection?.id;
    const matchesSubject = !e.subject_id || (selectedSubject && e.subject_id === selectedSubject.subject_id);
    if (!matchesSection || !matchesSubject) return false;
    
    if (activeTab === 'INTERNAL') {
      return e.exam_type !== 'FINALS' && e.assessment_category === 'INTERNAL';
    } else if (activeTab === 'PRACTICAL') {
      return e.assessment_category === 'PRACTICAL';
    } else {
      return e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL';
    }
  });

  // Direct assessment scores helpers
  const getDirectAssessmentScore = (studentId: string, categoryId: string): number => {
    if (!selectedSection || !selectedSubject) return 0;
    const storageKey = `assessment_${selectedSection.id}_${selectedSubject.id}_${categoryId}`;
    const dataStr = localStorage.getItem(storageKey);
    if (!dataStr) return 0;
    try {
      const parsed = JSON.parse(dataStr);
      const scoreStr = parsed[studentId]?.score || '0';
      const scoreVal = parseFloat(scoreStr);
      return isNaN(scoreVal) ? 0 : scoreVal;
    } catch (e) {
      return 0;
    }
  };

  const getDirectAssessmentMaxMarks = (categoryId: string): number => {
    if (!selectedSection) return 100;
    const configKey = `system_config_${selectedSection.grade_name}_${categoryId}`;
    const configStr = localStorage.getItem(configKey);
    if (!configStr) return 100;
    try {
      const parsed = JSON.parse(configStr);
      if (parsed.type === 'GRADES') return 0; // Graded category (cannot participate in numeric formulas)
      return parseFloat(parsed.maxMarks) || 100;
    } catch (e) {
      return 100;
    }
  };

  // Check if a direct assessment category is marks-based and available
  const isDirectAssessmentNumeric = (categoryId: string): boolean => {
    if (!selectedSection) return false;
    const configKey = `system_config_${selectedSection.grade_name}_${categoryId}`;
    const configStr = localStorage.getItem(configKey);
    if (!configStr) return true; // Default is Marks System (0-100)
    try {
      const parsed = JSON.parse(configStr);
      return parsed.type === 'MARKS';
    } catch (e) {
      return true;
    }
  };

  // Open Formula panel and load configuration from local storage
  const openFormulaPanel = () => {
    if (!selectedSection || !selectedSubject) return;

    // Load saved formula configs
    const configKey = `formula_config_${selectedSection.id}_${selectedSubject.id}_${activeTab}`;
    const savedConfigStr = localStorage.getItem(configKey);

    const entities: EntityConfig[] = [];
    
    // Add current exams
    currentTabExams.forEach((exam, idx) => {
      entities.push({
        id: exam.id,
        name: exam.name,
        type: 'EXAM',
        alias: `E${idx + 1}`,
        scaleTo: '',
        maxMarks: exam.max_marks
      });
    });

    // Add Direct Assessments (only if marks-based and activeTab is INTERNAL)
    if (activeTab === 'INTERNAL') {
      const directCats = [
        { id: 'sa', name: 'Subject Application' },
        { id: 'ssc', name: 'Soft Skills & Communication' },
        { id: 'dc', name: 'Discipline & Consistency' }
      ];

      directCats.forEach(cat => {
        if (isDirectAssessmentNumeric(cat.id)) {
          entities.push({
            id: cat.id,
            name: cat.name,
            type: 'DIRECT',
            alias: cat.id.toUpperCase(),
            scaleTo: '',
            maxMarks: getDirectAssessmentMaxMarks(cat.id)
          });
        }
      });
    }

    // If config was saved previously, restore it
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        setFormulaString(parsed.formula || '');
        const mappedEntities = entities.map(ent => {
          const savedEnt = (parsed.entities || []).find((se: any) => se.id === ent.id);
          if (savedEnt) {
            return {
              ...ent,
              alias: savedEnt.alias || ent.alias,
              scaleTo: savedEnt.scaleTo || ''
            };
          }
          return ent;
        });
        setFormulaEntities(mappedEntities);
      } catch (e) {
        setFormulaEntities(entities);
        setFormulaString('');
      }
    } else {
      setFormulaEntities(entities);
      setFormulaString('');
    }

    setFormulaError('');
    setIsFormulaOpen(true);
  };

  // Calculate aggregation results for every student
  const calculateAggregation = (isSubmitting: boolean = false) => {
    setFormulaError('');
    if (!formulaString.trim()) {
      setFormulaError('Please enter a formula.');
      return null;
    }

    const calculatedScores: Record<string, number> = {};

    try {
      // Validate aliases are unique
      const aliases = formulaEntities.map(e => e.alias.trim());
      const duplicates = aliases.filter((item, index) => aliases.indexOf(item) !== index);
      if (duplicates.length > 0) {
        throw new Error(`Duplicate alias found: ${duplicates.join(', ')}`);
      }

      // Check if formula refers only to valid aliases
      const aliasRegex = /[A-Za-z_][A-Za-z0-9_]*/g; // Check valid syntax
      const tokens: string[] = [];
      const tokenRegex = /\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[\+\-\*\/\^\(\)])\s*/g;
      
      // Clean formula check
      let testTokens;
      const testRegex = /[A-Za-z_][A-Za-z0-9_]*/g;
      const parsedAliases = new Set<string>();
      while ((testTokens = testRegex.exec(formulaString)) !== null) {
        parsedAliases.add(testTokens[0]);
      }

      parsedAliases.forEach(alias => {
        if (!formulaEntities.some(ent => ent.alias === alias)) {
          throw new Error(`Formula contains invalid alias: "${alias}"`);
        }
      });

      // Loop through all students to evaluate marks
      students.forEach(student => {
        const variables: Record<string, number> = {};

        formulaEntities.forEach(ent => {
          let score = 0;
          if (ent.type === 'EXAM') {
            const studentRecord = examResults[ent.id]?.[student.id];
            score = studentRecord ? (studentRecord.is_absent ? 0 : parseFloat(studentRecord.marks_obtained as any)) : 0;
          } else {
            score = getDirectAssessmentScore(student.id, ent.id);
          }

          // Apply scaling down if requested
          if (ent.scaleTo && ent.scaleTo.trim() !== '') {
            const scaleDownVal = parseFloat(ent.scaleTo);
            if (isNaN(scaleDownVal)) {
              throw new Error(`Scaling down value for ${ent.name} must be a number.`);
            }
            score = (score / ent.maxMarks) * scaleDownVal;
          }

          variables[ent.alias] = score;
        });

        const studentTotal = evaluateFormula(formulaString, variables);
        calculatedScores[student.id] = isNaN(studentTotal) ? 0 : parseFloat(studentTotal.toFixed(2));
      });

      return calculatedScores;
    } catch (err: any) {
      setFormulaError(err.message || 'Invalid formula layout or calculation error.');
      return null;
    }
  };

  // Submit and save aggregated marks to backend database
  const handleSaveAggregation = async () => {
    const scores = calculateAggregation(true);
    if (!scores || !selectedSection || !selectedSubject) return;

    setSubmitting(true);
    try {
      await api.post('/academics/results/save_aggregation/', {
        category: activeTab,
        section_id: selectedSection.id,
        subject_id: selectedSubject.subject_id,
        scores: scores
      });

      // Save the formula panel settings locally
      const configKey = `formula_config_${selectedSection.id}_${selectedSubject.id}_${activeTab}`;
      localStorage.setItem(configKey, JSON.stringify({
        formula: formulaString,
        entities: formulaEntities.map(e => ({ id: e.id, alias: e.alias, scaleTo: e.scaleTo, maxMarks: e.maxMarks }))
      }));

      // Reload results
      setSuccessMessage('Aggregated marks saved successfully to backend database!');
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsFormulaOpen(false);

      // Refresh Results
      const examRes = await api.get(`/academics/exams/?section=${selectedSection.id}&subject_mapping=${selectedSubject.id}`);
      setExams(Array.isArray(examRes.data) ? examRes.data : examRes.data.results || []);
    } catch (err) {
      console.error('Failed to save aggregation', err);
      setFormulaError('Failed to save marks to database.');
    } finally {
      setSubmitting(false);
    }
  };

  // Clear/undo aggregated marks in backend database
  const handleUndoAggregation = async () => {
    if (!selectedSection || !selectedSubject) return;

    const confirmClear = window.confirm(
      "Are you sure you want to undo and clear all aggregated marks for this subject? This cannot be undone."
    );
    if (!confirmClear) return;

    setSubmitting(true);
    try {
      await api.post('/academics/results/undo_aggregation/', {
        category: activeTab,
        section_id: selectedSection.id,
        subject_id: selectedSubject.subject_id,
      });

      setSuccessMessage('Aggregated marks cleared successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
      setIsFormulaOpen(false);

      // Refresh Results
      const examRes = await api.get(`/academics/exams/?section=${selectedSection.id}&subject_mapping=${selectedSubject.id}`);
      setExams(Array.isArray(examRes.data) ? examRes.data : examRes.data.results || []);
    } catch (err) {
      console.error('Failed to undo aggregation', err);
      setFormulaError('Failed to clear aggregated marks from database.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSubjectDirectAssessmentScore = (studentId: string, subjectId: string, categoryId: string): string | number => {
    if (!selectedSection) return '-';
    const storageKey = `assessment_${selectedSection.id}_${subjectId}_${categoryId}`;
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

  const getSubjectAggregatedMaxMarks = (subject: SubjectMapping, tab: 'INTERNAL' | 'PRACTICAL'): number => {
    const configKey = `formula_config_${selectedSection?.id}_${subject.id}_${tab}`;
    const savedConfigStr = localStorage.getItem(configKey);
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        const formula = parsed.formula;
        if (formula && formula.trim()) {
          const maxVariables: Record<string, number> = {};
          let sumMax = 0;
          
          // Get all exams of this subject mapping to check matched ones
          const subExams = previewExams.filter(ex => ex.subject_id === subject.subject_id);
          
          (parsed.entities || []).forEach((ent: any) => {
            const aliasRegex = new RegExp(`\\b${ent.alias}\\b`);
            if (aliasRegex.test(formula)) {
              let maxVal = ent.maxMarks;
              if (maxVal === undefined || maxVal === null) {
                const matchedExam = subExams.find(ex => ex.id === ent.id);
                if (matchedExam) {
                  maxVal = matchedExam.max_marks;
                } else {
                  maxVal = getDirectAssessmentMaxMarks(ent.id);
                }
              }
              if (ent.scaleTo && ent.scaleTo.toString().trim() !== '') {
                const scaleDownVal = parseFloat(ent.scaleTo);
                if (!isNaN(scaleDownVal)) {
                  maxVal = scaleDownVal;
                }
              }
              const finalMax = maxVal || 100;
              maxVariables[ent.alias] = finalMax;
              sumMax += finalMax;
            }
          });
          
          try {
            const evaluatedMax = evaluateFormula(formula, maxVariables);
            if (!isNaN(evaluatedMax) && evaluatedMax > 0) {
              return parseFloat(evaluatedMax.toFixed(2));
            }
          } catch (err) {}
          return sumMax || 100;
        }
      } catch (e) {
        console.error('Failed to calculate preview aggregated max marks', e);
      }
    }
    
    // Fallback: sum up max marks of exams for this subject and tab
    const filteredExams = previewExams.filter(ex => 
      ex.subject_id === subject.subject_id &&
      (tab === 'INTERNAL' ? (ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS') : (ex.assessment_category === 'PRACTICAL'))
    );
    const sum = filteredExams.reduce((acc, ex) => acc + ex.max_marks, 0);
    return sum || 100;
  };

  const getContinuousAssessmentMaxMarks = () => {
    const sum = previewExams
      .filter(exam => exam.exam_type !== 'PRACTICAL')
      .reduce((acc, exam) => acc + Number(exam.max_marks), 0);
    return sum || 100;
  };

  // Load html2pdf dynamically from CDN
  const loadHtml2Pdf = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve((window as any).html2pdf);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const handleGenerateSeparatePDFs = async () => {
    if (students.length === 0 || !selectedSection) return;
    setIsGeneratingPDFs(true);
    setPdfProgress({ current: 0, total: students.length });

    // Store original scroll position
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    try {
      const html2pdf = await loadHtml2Pdf();
      
      // Revoke old URLs to prevent memory leak
      generatedPDFs.forEach(pdf => {
        if (pdf.pdfUrl && pdf.pdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pdf.pdfUrl);
        }
      });

      const newPDFs: {
        studentId: string;
        studentName: string;
        rollNumber: string;
        pdfUrl: string;
        fileName: string;
      }[] = [];

      // Temporarily scroll to (0,0) to normalize coordinate calculations in html2canvas
      window.scrollTo(0, 0);

      // Measure target pixel sizes for A4 Portrait (210mm x 297mm) and Landscape (297mm x 210mm) on screen
      const tempDivPortrait = document.createElement('div');
      tempDivPortrait.style.width = '210mm';
      tempDivPortrait.style.height = '297mm';
      tempDivPortrait.style.position = 'absolute';
      tempDivPortrait.style.visibility = 'hidden';
      document.body.appendChild(tempDivPortrait);
      const a4PortraitWidthPx = tempDivPortrait.offsetWidth || 794;
      const a4PortraitHeightPx = tempDivPortrait.offsetHeight || 1120;
      document.body.removeChild(tempDivPortrait);

      const tempDivLandscape = document.createElement('div');
      tempDivLandscape.style.width = '297mm';
      tempDivLandscape.style.height = '210mm';
      tempDivLandscape.style.position = 'absolute';
      tempDivLandscape.style.visibility = 'hidden';
      document.body.appendChild(tempDivLandscape);
      const a4LandscapeWidthPx = tempDivLandscape.offsetWidth || 1120;
      const a4LandscapeHeightPx = tempDivLandscape.offsetHeight || 794;
      document.body.removeChild(tempDivLandscape);

      // Measure target pixel size for 15mm margin on screen
      const tempDivMargin = document.createElement('div');
      tempDivMargin.style.width = '15mm';
      tempDivMargin.style.position = 'absolute';
      tempDivMargin.style.visibility = 'hidden';
      document.body.appendChild(tempDivMargin);
      const marginPx = tempDivMargin.offsetWidth || 56;
      document.body.removeChild(tempDivMargin);

      const { internalCols, practicalCols, finalCols } = getPreviewColumns();
      const totalColumns = 1 + internalCols.length + practicalCols.length + finalCols.length;

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        setPdfProgress(prev => ({ ...prev, current: i + 1 }));

        const originalElement = document.getElementById(`report-card-${student.id}`);
        if (!originalElement) {
          console.warn(`Report card element for student ${student.id} not found`);
          continue;
        }

        // Determine if this report needs horizontal (landscape) or vertical (portrait) layout.
        // It needs a horizontal layout if it requires horizontal scrolling or has > 6 columns in total.
        const tableWrapper = originalElement.querySelector('.overflow-x-auto');
        const hasScroller = tableWrapper 
          ? (tableWrapper.scrollWidth > tableWrapper.clientWidth)
          : false;
        
        const isLandscape = hasScroller || (totalColumns > 6);

        // Clone the element to avoid mutating the visible DOM inside the modal
        const clone = originalElement.cloneNode(true) as HTMLElement;
        clone.id = `pdf-capture-clone-${student.id}`;
        
        // Remove print stylesheet classes to avoid !important style overrides in CSS
        clone.classList.remove('report-card-print-page');

        // Apply compact styling to table cell elements inside clone to optimize space and font size
        const cloneCells = clone.querySelectorAll('th, td');
        cloneCells.forEach(cell => {
          const c = cell as HTMLElement;
          c.style.padding = '6px 8px'; // compact cell padding
          c.style.fontSize = '11px'; // clean compact table text
        });

        // Adjust student details grid spacing and sizing inside clone
        const detailsGrid = clone.querySelector('.grid-cols-2') as HTMLElement;
        if (detailsGrid) {
          detailsGrid.style.padding = '12px';
          detailsGrid.style.gap = '8px';
          detailsGrid.style.fontSize = '12px';
        }

        // Adjust header spacing inside clone
        const schoolHeader = clone.querySelector('.border-b') as HTMLElement;
        if (schoolHeader) {
          schoolHeader.style.paddingBottom = '12px';
        }

        // Adjust footer signature spacing inside clone
        const signatures = clone.querySelector('.pt-12') as HTMLElement;
        if (signatures) {
          signatures.style.paddingTop = '24px';
        }

        // Force table wrapper in clone to have visible overflow and natural width
        const clonedTableWrapper = clone.querySelector('.overflow-x-auto') as HTMLElement;
        if (clonedTableWrapper) {
          clonedTableWrapper.style.overflow = 'visible';
          clonedTableWrapper.style.overflowX = 'visible';
          clonedTableWrapper.style.width = 'auto';
          clonedTableWrapper.style.minWidth = '100%';
        }
        
        // Create wrapper to structure elements inside the page
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.justifyContent = 'space-between';
        wrapper.style.boxSizing = 'border-box';

        // Move all children of the clone into the wrapper
        while (clone.firstChild) {
          wrapper.appendChild(clone.firstChild);
        }
        clone.appendChild(wrapper);
        
        document.body.appendChild(clone);
        
        // Measure natural dimensions in unconstrained layout
        clone.style.position = 'absolute';
        clone.style.left = '0px';
        clone.style.top = '0px';
        clone.style.width = 'auto';
        clone.style.height = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.minHeight = 'none';
        clone.style.maxWidth = 'none';
        clone.style.padding = '0px';
        wrapper.style.width = 'auto';
        wrapper.style.height = 'auto';
        wrapper.style.maxWidth = 'none';
        
        const naturalWidth = wrapper.offsetWidth || clone.offsetWidth;
        const naturalHeight = wrapper.offsetHeight || clone.offsetHeight;
        
        // Restore target physical size on clone (no padding on clone to avoid offset calculations)
        clone.style.width = isLandscape ? '297mm' : '210mm';
        clone.style.height = isLandscape ? '210mm' : '297mm';
        clone.style.maxHeight = isLandscape ? '210mm' : '297mm';
        clone.style.minHeight = isLandscape ? '210mm' : '297mm';
        clone.style.zIndex = '99999';
        clone.style.background = 'white';
        clone.style.margin = '0px';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0px';
        clone.style.border = 'none';
        clone.style.boxSizing = 'border-box';
        clone.style.overflow = 'hidden';

        // Structure the page margins and center positioning using a pageContainer
        clone.removeChild(wrapper);

        const targetWidth = (isLandscape ? a4LandscapeWidthPx : a4PortraitWidthPx) - 2 * marginPx;
        const targetHeight = (isLandscape ? a4LandscapeHeightPx : a4PortraitHeightPx) - 2 * marginPx;

        const pageContainer = document.createElement('div');
        pageContainer.style.position = 'absolute';
        pageContainer.style.left = `${marginPx}px`;
        pageContainer.style.top = `${marginPx}px`;
        pageContainer.style.width = `${targetWidth}px`;
        pageContainer.style.height = `${targetHeight}px`;
        pageContainer.style.boxSizing = 'border-box';
        pageContainer.style.overflow = 'visible';

        pageContainer.appendChild(wrapper);
        clone.appendChild(pageContainer);

        // Apply scale factor based on BOTH width and height to fit on a single page
        const scaleX = targetWidth / naturalWidth;
        const scaleY = targetHeight / naturalHeight;
        
        // We take the minimum of scaleX and scaleY to ensure it fits in both dimensions
        let scaleFactor = Math.min(scaleX, scaleY);
        if (scaleFactor > 1) {
          scaleFactor = 1; // Do not scale up
        }

        const translateX = (targetWidth - naturalWidth * scaleFactor) / 2;

        wrapper.style.width = `${naturalWidth}px`;
        wrapper.style.height = `${naturalHeight}px`;
        wrapper.style.transform = `translate(${translateX}px, 0px) scale(${scaleFactor})`;
        wrapper.style.transformOrigin = 'top left';

        const cleanFirstName = student.first_name.replace(/\s+/g, '_');
        const cleanLastName = student.last_name.replace(/\s+/g, '_');
        const fileName = `Report_Card_${cleanFirstName}_${cleanLastName}_${student.roll_number || student.id}.pdf`;

        const opt = {
          margin:       0,
          filename:     fileName,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            scrollX: 0,
            scrollY: 0,
            width: clone.offsetWidth,
            height: clone.offsetHeight
          },
          jsPDF:        { 
            unit: 'mm', 
            format: 'a4', 
            orientation: isLandscape ? 'landscape' : 'portrait' 
          }
        };

        // Allow browser layout reflows to settle before capture
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        // Ensure scroll is still at origin (may drift between iterations)
        window.scrollTo(0, 0);

        const blob = await html2pdf().from(clone).set(opt).output('blob');
        
        let pdfUrl = URL.createObjectURL(blob);
        try {
          // Compute total marks obtained and possible from FINALS exams for this student
          const finalExams = previewExams.filter(e => e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL');
          let totalObtained = 0;
          let totalPossible = 0;
          finalExams.forEach(exam => {
            const record = previewResults.find(r => r.student_id === student.id && r.exam_id === exam.id);
            if (record && !record.is_absent) {
              const obtained = parseFloat(record.marks_obtained) || 0;
              const possible = parseFloat(String(exam.max_marks)) || 0;
              totalObtained += obtained;
              totalPossible += possible;
            } else if (record && record.is_absent) {
              // Count max marks in denominator even for absent (so percentage reflects overall)
              const possible = parseFloat(String(exam.max_marks)) || 0;
              totalPossible += possible;
            }
          });
          const computedPercentage = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 10000) / 100 : 0;

          const formData = new FormData();
          formData.append('student_id', student.id);
          formData.append('section_id', selectedSection.id);
          formData.append('academic_year', currentAcademicYear);
          formData.append('term_name', currentAcademicYear);
          formData.append('file', blob, fileName);
          formData.append('total_marks_obtained', String(totalObtained));
          formData.append('total_marks_possible', String(totalPossible));
          formData.append('percentage', String(computedPercentage));

          const uploadRes = await api.post('/academics/report-cards/upload_pdf/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          if (uploadRes.data && uploadRes.data.file_path) {
            pdfUrl = getMediaUrl(uploadRes.data.file_path) || uploadRes.data.file_path;
          }
        } catch (uploadErr) {
          console.error(`Failed to upload report card PDF for student ${student.id}:`, uploadErr);
        }

        newPDFs.push({
          studentId: student.id,
          studentName: `${student.first_name} ${student.last_name}`,
          rollNumber: student.roll_number || '-',
          pdfUrl,
          fileName
        });

        // Clean up clone
        document.body.removeChild(clone);
      }

      setGeneratedPDFs(newPDFs);
      setIsPreviewOpen(false); // Close preview modal
      setSuccessMessage("Successfully generated separate PDFs for all student report cards!");
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("An error occurred while generating PDFs. Please try again.");
    } finally {
      setIsGeneratingPDFs(false);
      window.scrollTo(originalScrollX, originalScrollY);
    }
  };

  // Clean up Object URLs when component unmounts
  useEffect(() => {
    return () => {
      generatedPDFs.forEach(pdf => {
        if (pdf.pdfUrl && pdf.pdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(pdf.pdfUrl);
        }
      });
    };
  }, [generatedPDFs]);

  // Load jszip dynamically from CDN
  const loadJsZip = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).JSZip) {
        resolve((window as any).JSZip);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve((window as any).JSZip);
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  const handleBulkDownloadZIP = async () => {
    if (generatedPDFs.length === 0 || !selectedSection) return;
    setIsDownloadingZip(true);

    try {
      const JSZip = await loadJsZip();
      const zip = new JSZip();

      for (let i = 0; i < generatedPDFs.length; i++) {
        const pdf = generatedPDFs[i];
        
        // Fetch the local PDF blob
        const res = await fetch(pdf.pdfUrl);
        const blob = await res.blob();
        
        zip.file(pdf.fileName, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `Report_Cards_Grade_${selectedSection.full_name.replace(/\s+/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);

      setSuccessMessage("Successfully downloaded all report cards as a ZIP archive!");
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error) {
      console.error("ZIP creation failed:", error);
      alert("An error occurred while creating the ZIP archive. Please try again.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleOpenAssignModal = () => {
    if (!selectedSection) return;
    
    const currentGrade = selectedSection.grade_name;
    const currentSecLetter = selectedSection.section_letter;
    
    const currentGradeNum = parseInt(currentGrade);
    let defaultTargetGrade = currentGrade;
    if (!isNaN(currentGradeNum)) {
      defaultTargetGrade = String(currentGradeNum + 1);
    }
    
    const initialAssignments: Record<string, { grade: string, section: string }> = {};
    students.forEach(student => {
      initialAssignments[student.id] = {
        grade: defaultTargetGrade,
        section: currentSecLetter
      };
    });
    
    setStudentAssignments(initialAssignments);
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAssignModalOpen(false);
    handleOpenReportCardPreview();
  };

  const handleOpenReportCardPreview = async () => {
    if (!selectedSection) return;
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    try {
      // 1. Fetch all exams for this section
      const examsRes = await api.get(`/academics/exams/?section=${selectedSection.id}`);
      const allExams: Exam[] = Array.isArray(examsRes.data) ? examsRes.data : examsRes.data.results || [];
      setPreviewExams(allExams);

      // 2. Fetch results for each exam in parallel
      const resultsMap: any[] = [];
      await Promise.all(
        allExams.map(async (exam) => {
          try {
            const res = await api.get(`/academics/results/for_exam/?exam_id=${exam.id}`);
            const recordsList = res.data.results || res.data || [];
            recordsList.forEach((r: any) => {
              resultsMap.push({
                exam_id: exam.id,
                student_id: r.student_id || r.student,
                marks_obtained: r.marks_obtained,
                is_absent: r.is_absent,
                aggregated_internal_marks: r.aggregated_internal_marks,
                aggregated_practical_marks: r.aggregated_practical_marks,
                max_marks: exam.max_marks
              });
            });
          } catch (err) {
            console.error(`Failed to fetch preview results for exam ${exam.id}`, err);
          }
        })
      );
      setPreviewResults(resultsMap);
    } catch (err) {
      console.error('Failed to load report cards preview data', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const renderPreviewCell = (student: Student, subject: SubjectMapping, category: 'INTERNAL' | 'PRACTICAL' | 'FINALS', col: any) => {
    if (col.isDummy) return <span className="text-gray-300">-</span>;

    if (col.isDirect) {
      const score = getSubjectDirectAssessmentScore(student.id, subject.id, col.id);
      if (score === '-') return <span className="text-gray-300">-</span>;
      if (isDirectAssessmentNumeric(col.id)) {
        const maxMarks = getDirectAssessmentMaxMarks(col.id);
        return <span className="text-gray-800">{score} / {maxMarks}</span>;
      } else {
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase text-center min-w-[30px] inline-block">{score}</span>;
      }
    }
    
    if (category === 'INTERNAL' && col.isAggregated) {
      const subExams = previewExams.filter(ex => ex.subject_id === subject.subject_id);
      const record = previewResults.find(r => 
        r.student_id === student.id && 
        subExams.some(ex => ex.id === r.exam_id) && 
        r.aggregated_internal_marks !== null
      );
      
      const maxVal = getSubjectAggregatedMaxMarks(subject, 'INTERNAL');
      if (record) {
        return <span className="text-indigo-700 font-bold">{record.aggregated_internal_marks} / {maxVal}</span>;
      }
      
      // Fallback: sum raw marks if not aggregated but column is aggregated
      const internalExams = previewExams.filter(ex => ex.subject_id === subject.subject_id && ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS');
      let sumObtained = 0;
      let sumMax = 0;
      let hasAny = false;
      internalExams.forEach(ex => {
        const r = previewResults.find(res => res.student_id === student.id && res.exam_id === ex.id);
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
      const subExams = previewExams.filter(ex => ex.subject_id === subject.subject_id);
      const record = previewResults.find(r => 
        r.student_id === student.id && 
        subExams.some(ex => ex.id === r.exam_id) && 
        r.aggregated_practical_marks !== null
      );
      
      const maxVal = getSubjectAggregatedMaxMarks(subject, 'PRACTICAL');
      if (record) {
        return <span className="text-indigo-700 font-bold">{record.aggregated_practical_marks} / {maxVal}</span>;
      }
      
      // Fallback: sum raw practical marks
      const practicalExams = previewExams.filter(ex => ex.subject_id === subject.subject_id && ex.assessment_category === 'PRACTICAL');
      let sumObtained = 0;
      let sumMax = 0;
      let hasAny = false;
      practicalExams.forEach(ex => {
        const r = previewResults.find(res => res.student_id === student.id && res.exam_id === ex.id);
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
    
    // Non-aggregated exam cell
    const matchedExam = previewExams.find(ex => 
      ex.subject_id === subject.subject_id && 
      ex.name === col.name && 
      (
        category === 'INTERNAL' ? (ex.assessment_category === 'INTERNAL' && ex.exam_type !== 'FINALS') :
        category === 'PRACTICAL' ? (ex.assessment_category === 'PRACTICAL') :
        (ex.exam_type === 'FINALS' && ex.assessment_category !== 'PRACTICAL')
      )
    );
    if (!matchedExam) return <span className="text-gray-300">-</span>;
    
    const record = previewResults.find(r => r.student_id === student.id && r.exam_id === matchedExam.id);
    if (!record) return <span className="text-gray-300">-</span>;
    if (record.is_absent) return <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs">AB</span>;
    return <span className="text-gray-800">{record.marks_obtained} / {matchedExam.max_marks}</span>;
  };

  // Report Card column structure computation
  const getPreviewColumns = () => {
    const hasInternalAggregation = allocatedSubjects.some(sub => {
      const subExams = previewExams.filter(ex => ex.subject_id === sub.subject_id);
      return previewResults.some(r => 
        subExams.some(ex => ex.id === r.exam_id) && r.aggregated_internal_marks !== null
      );
    });

    const hasPracticalAggregation = allocatedSubjects.some(sub => {
      const subExams = previewExams.filter(ex => ex.subject_id === sub.subject_id);
      return previewResults.some(r => 
        subExams.some(ex => ex.id === r.exam_id) && r.aggregated_practical_marks !== null
      );
    });

    // 1. Internals columns
    let internalCols: any[] = [];
    if (hasInternalAggregation) {
      internalCols = [{ id: 'aggregated', name: 'Aggregated Results', isAggregated: true }];
    } else {
      const names = Array.from(new Set(
        previewExams.filter(e => e.assessment_category === 'INTERNAL' && e.exam_type !== 'FINALS').map(e => e.name)
      ));
      internalCols = names.map(name => ({ id: name, name, isAggregated: false }));
      if (internalCols.length === 0) {
        internalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
      }
    }

    // Always append the three direct assessment columns to Internals
    internalCols.push(
      { id: 'sa', name: 'Subject Application', isDirect: true },
      { id: 'ssc', name: 'Soft Skills & Comm.', isDirect: true },
      { id: 'dc', name: 'Discipline & Cons.', isDirect: true }
    );

    // 2. Practicals columns
    let practicalCols: any[] = [];
    if (hasPracticalAggregation) {
      practicalCols = [{ id: 'aggregated', name: 'Aggregated Results', isAggregated: true }];
    } else {
      const names = Array.from(new Set(
        previewExams.filter(e => e.assessment_category === 'PRACTICAL').map(e => e.name)
      ));
      practicalCols = names.map(name => ({ id: name, name, isAggregated: false }));
      if (practicalCols.length === 0) {
        practicalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
      }
    }

    // 3. Final Exams columns
    const finalNames = Array.from(new Set(
      previewExams.filter(e => e.exam_type === 'FINALS' && e.assessment_category !== 'PRACTICAL').map(e => e.name)
    ));
    let finalCols: any[] = finalNames.map(name => ({ id: name, name, isAggregated: false }));
    if (finalCols.length === 0) {
      finalCols = [{ id: 'none', name: 'No Exams', isDummy: true }];
    }

    return { hasInternalAggregation, hasPracticalAggregation, internalCols, practicalCols, finalCols };
  };

  if (rbacLoading) {
    return (
      <div className="flex justify-center items-center py-40">
        <Loader2 className="animate-spin text-blue-600" size={50} />
      </div>
    );
  }

  if (!hasPermission('academics.view_results')) {
    return <PermissionDenied title="Access Denied" message="You do not have permission to view results and report cards." />;
  }

  return (
    <FeatureGuard feature="RESULTS">
      <div className="space-y-6">
        <style dangerouslySetInnerHTML={{__html: `
          /* A4 Portrait size matching 210mm x 297mm exactly for screen preview and PDF capture */
          .report-card-print-page {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            margin: 20px auto !important;
            padding: 20mm 20mm !important;
            background: white !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
            border-radius: 12px !important;
            border: 1px solid #e5e7eb !important;
          }

          @media print {
            /* Hide the root sidebar, navbar, buttons, and screen-only elements */
            aside, nav, .sidebar, [class*="sidebar"], [class*="Navbar"], [class*="navbar"], button, .no-print, header, footer {
              display: none !important;
            }
            /* Reset the parent layout flex and margin wrappers for full-page A4 print flow */
            html, body, .min-h-screen, main, [class*="ml-64"], [class*="mt-16"], [class*="p-8"] {
              margin: 0 !important;
              padding: 0 !important;
              margin-left: 0 !important;
              margin-top: 0 !important;
              position: static !important;
              overflow: visible !important;
              height: auto !important;
              width: 100% !important;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
            }
            /* Explicit page setup for standard borderless A4 printing */
            @page {
              size: A4 portrait;
              margin: 0;
            }
            .print-modal-overlay {
              position: static !important;
              background: none !important;
              padding: 0 !important;
              box-shadow: none !important;
              overflow: visible !important;
              height: auto !important;
            }
            .print-modal-content {
              box-shadow: none !important;
              border: none !important;
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
            }
            .report-card-print-page {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin: 0 !important;
              padding: 20mm 20mm !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          }
        `}} />
        
        {/* Title Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden no-print">
          <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10">
            <Sparkles size={160} />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Award size={32} /> Results & Performance Center
            </h1>
            <p className="text-indigo-100">Configure aggregation formulas and record results for grades/sections</p>
          </div>
        </div>

        {/* Dynamic Success Alert */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3.5 rounded-xl flex items-center gap-2 shadow-sm font-semibold no-print">
            <ClipboardCheck size={20} className="text-emerald-500" />
            {successMessage}
          </div>
        )}

        {/* Phase 1: Section cards selection */}
        {!selectedSection && (
          <div className="space-y-6 no-print">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Select Grade & Section</h2>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search grade or section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sections
                  .filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedSection(s);
                        setSearchQuery('');
                      }}
                      className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-pointer transform hover:-translate-y-1 flex flex-col justify-between group"
                    >
                      <div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          {s.grade_name}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">Grade {s.grade_name}</h3>
                        <p className="text-gray-400 text-sm mt-1">Section {s.section_letter}</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-indigo-600 font-semibold text-sm">
                        <span>View Subjects</span>
                        <ArrowLeft size={16} className="rotate-180 transition transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Allocated Subject selection */}
        {selectedSection && !selectedSubject && (
          <div className="space-y-6 no-print">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedSection(null)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Subjects for Grade {selectedSection.full_name}</h2>
                  <p className="text-sm text-gray-400">Choose a subject to aggregate or record marks</p>
                </div>
              </div>

              {hasPermission('academics.generate_report_card') && (
                <button
                  onClick={handleOpenAssignModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center gap-2"
                >
                  <FileText size={16} />
                  Generate Report cards
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
              </div>
            ) : (
              <div className="space-y-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
                  {allocatedSubjects.map(sub => (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubject(sub)}
                      className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-pointer transform hover:-translate-y-1 flex flex-col justify-between group"
                    >
                      <div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                          <BookOpen size={22} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">{sub.subject_name}</h3>
                        <p className="text-gray-400 text-xs mt-1">{sub.subject_code}</p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-indigo-600 font-semibold text-sm">
                        <span>Enter Results</span>
                        <ArrowLeft size={16} className="rotate-180 transition transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Generated Report Cards Section */}
                {generatedPDFs.length > 0 && (
                  <div className="bg-white border border-gray-150 p-8 rounded-3xl shadow-sm space-y-6 font-sans no-print">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                          <FileText className="text-indigo-600" size={24} />
                          Generated Report Cards ({generatedPDFs.length})
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Individual PDF files generated for Grade {selectedSection.full_name}.
                        </p>
                      </div>
                      {hasPermission('academics.download_report_card') && (
                        <button
                          onClick={handleBulkDownloadZIP}
                          disabled={isDownloadingZip}
                          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2"
                        >
                          {isDownloadingZip ? (
                            <>
                              <Loader2 className="animate-spin" size={16} />
                              Zipping...
                            </>
                          ) : (
                            <>
                              <FileText size={16} />
                              Bulk Download
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {generatedPDFs.map(pdf => (
                        <div
                          key={pdf.studentId}
                          className="bg-gray-50 border border-gray-100 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-200 transition"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-xl flex items-center justify-center font-bold">
                              <FileText size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-850 text-sm truncate max-w-[180px]">
                                {pdf.studentName}
                              </h4>
                              <p className="text-gray-400 text-xs mt-0.5 font-mono">Roll: #{pdf.rollNumber}</p>
                            </div>
                          </div>

                          <div className="mt-6 flex items-center gap-3">
                            <a
                              href={pdf.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 text-center py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition border border-gray-200"
                            >
                              View PDF
                            </a>
                            {hasPermission('academics.download_report_card') && (
                              <a
                                href={pdf.pdfUrl}
                                download={pdf.fileName}
                                className="flex-1 text-center py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition border border-indigo-100/50"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Subject Performance Center (Tabs: Internals, Practicals, Finals) */}
        {selectedSection && selectedSubject && (
          <div className="space-y-6 no-print">
            
            {/* Subject Info bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedSubject(null)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedSubject.subject_name}</h2>
                  <p className="text-xs text-gray-400">Section {selectedSection.full_name} • {selectedSubject.subject_code}</p>
                </div>
              </div>

              {/* Tabs selector */}
              <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-full sm:w-auto">
                {(['INTERNAL', 'PRACTICAL', 'FINALS'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {tab === 'INTERNAL' ? 'Internals' : tab === 'PRACTICAL' ? 'Practicals' : 'Final Exams'}
                  </button>
                ))}
              </div>
            </div>

            {/* Displaying Student Table */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                
                {/* Header info actions */}
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-gray-50 to-white">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {activeTab === 'INTERNAL' ? 'Continuous Assessment Summary' : activeTab === 'PRACTICAL' ? 'Practical Evaluation Summary' : 'Term-End Results'}
                    </h3>
                    <p className="text-xs text-gray-500">Record and review performance totals</p>
                  </div>

                  {activeTab !== 'FINALS' && (
                    <button
                      onClick={openFormulaPanel}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    >
                      <Settings size={18} /> Aggregate Marks
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50/70 text-gray-700 font-bold border-b border-gray-200">
                        <th className="px-6 py-4 border-r border-gray-200 text-center w-20" rowSpan={2}>Roll No</th>
                        <th className="px-6 py-4 border-r border-gray-200" rowSpan={2}>Student Name</th>
                        
                        {/* Exams ever taken */}
                        {currentTabExams.length > 0 ? (
                          <th className="px-6 py-3 border-b border-r border-gray-200 text-center bg-indigo-50/30 text-indigo-850" colSpan={currentTabExams.length}>
                            Continuous Academic Performance (Exams)
                          </th>
                        ) : (
                          <th className="px-6 py-3 border-b border-r border-gray-200 text-center text-gray-400 italic" rowSpan={2}>
                            No Exams Taught
                          </th>
                        )}

                        {activeTab === 'INTERNAL' && (
                          <>
                            <th className="px-6 py-4 border-r border-gray-200 text-center bg-blue-50/20" rowSpan={2}>Subject Application</th>
                            <th className="px-6 py-4 border-r border-gray-200 text-center bg-amber-50/20" rowSpan={2}>Soft Skills & Comm.</th>
                            <th className="px-6 py-4 border-r border-gray-200 text-center bg-rose-50/20" rowSpan={2}>Discipline & Cons.</th>
                            <th className="px-6 py-4 text-center bg-indigo-50 text-indigo-850" rowSpan={2}>Aggregated Result</th>
                          </>
                        )}

                        {activeTab === 'PRACTICAL' && (
                          <th className="px-6 py-4 text-center bg-indigo-50 text-indigo-850" rowSpan={2}>Aggregated Result</th>
                        )}

                        {activeTab === 'FINALS' && (
                          <th className="px-6 py-4 text-center bg-indigo-50 text-indigo-850" rowSpan={2}>Final Marks</th>
                        )}
                      </tr>

                      {/* Second header row for individual exams */}
                      {currentTabExams.length > 0 && (
                        <tr className="bg-gray-50/40 text-gray-600 text-xs border-b border-gray-200">
                          {currentTabExams.map(exam => (
                            <th key={exam.id} className="px-4 py-2 border-r border-gray-200 text-center font-semibold">
                              <div className="truncate max-w-[120px] mx-auto">{exam.name}</div>
                              <span className="text-gray-400 text-[10px]">(Max: {exam.max_marks})</span>
                            </th>
                          ))}
                        </tr>
                      )}
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {students.map(student => {
                        // Gather Aggregated score from first available result
                        let aggregatedMark: number | null = null;
                        
                        // We check all exam results for this student
                        exams.forEach(exam => {
                          const record = examResults[exam.id]?.[student.id];
                          if (record) {
                            const val = activeTab === 'INTERNAL' 
                              ? record.aggregated_internal_marks 
                              : record.aggregated_practical_marks;
                            if (val !== null && val !== undefined) {
                              aggregatedMark = typeof val === 'string' ? parseFloat(val) : val;
                            }
                          }
                        });

                        // Calculate total aggregated mark (out of)
                        let totalAggregatedMark: number | null = null;
                        const savedConfigKey = `formula_config_${selectedSection.id}_${selectedSubject.id}_${activeTab}`;
                        const savedConfigStr = localStorage.getItem(savedConfigKey);
                        if (savedConfigStr) {
                          try {
                            const parsed = JSON.parse(savedConfigStr);
                            const formula = parsed.formula;
                            if (formula && formula.trim()) {
                              const maxVariables: Record<string, number> = {};
                              let sumMax = 0;
                              (parsed.entities || []).forEach((ent: any) => {
                                // Check if alias is referenced in the formula
                                const aliasRegex = new RegExp(`\\b${ent.alias}\\b`);
                                if (aliasRegex.test(formula)) {
                                  let maxVal = ent.maxMarks;
                                  if (maxVal === undefined || maxVal === null) {
                                    const matchedExam = exams.find(ex => ex.id === ent.id);
                                    if (matchedExam) {
                                      maxVal = matchedExam.max_marks;
                                    } else {
                                      maxVal = getDirectAssessmentMaxMarks(ent.id);
                                    }
                                  }

                                  // Apply scaling down if requested
                                  if (ent.scaleTo && ent.scaleTo.toString().trim() !== '') {
                                    const scaleDownVal = parseFloat(ent.scaleTo);
                                    if (!isNaN(scaleDownVal)) {
                                      maxVal = scaleDownVal;
                                    }
                                  }

                                  const finalMax = maxVal || 100;
                                  maxVariables[ent.alias] = finalMax;
                                  sumMax += finalMax;
                                }
                              });

                              try {
                                const evaluatedMax = evaluateFormula(formula, maxVariables);
                                if (!isNaN(evaluatedMax) && evaluatedMax > 0) {
                                  totalAggregatedMark = parseFloat(evaluatedMax.toFixed(2));
                                } else if (sumMax > 0) {
                                  totalAggregatedMark = sumMax;
                                }
                              } catch (err) {
                                if (sumMax > 0) {
                                  totalAggregatedMark = sumMax;
                                }
                              }
                            }
                          } catch (e) {
                            console.error('Failed to calculate total aggregated mark', e);
                          }
                        }

                        return (
                          <tr key={student.id} className="hover:bg-gray-50/50 transition duration-150">
                            <td className="px-6 py-4 border-r border-gray-200 font-bold font-mono text-center text-gray-500">
                              #{student.roll_number || '-'}
                            </td>
                            <td className="px-6 py-4 border-r border-gray-200">
                              <div className="font-semibold text-gray-900">{student.first_name} {student.last_name}</div>
                              <span className="text-xs text-gray-400 font-mono">ID: {student.suid || student.id}</span>
                            </td>

                            {/* Render Marks for each exam */}
                            {currentTabExams.map(exam => {
                              const record = examResults[exam.id]?.[student.id];
                              return (
                                <td key={exam.id} className="px-4 py-4 border-r border-gray-200 text-center font-mono font-bold">
                                  {record ? (
                                    record.is_absent ? (
                                      <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs">AB</span>
                                    ) : (
                                      <span className="text-gray-800">{record.marks_obtained}</span>
                                    )
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}

                            {activeTab === 'INTERNAL' && (
                              <>
                                {/* Subject Application (SA) */}
                                <td className="px-6 py-4 border-r border-gray-200 text-center font-semibold text-gray-700 bg-blue-50/10">
                                  {isDirectAssessmentNumeric('sa') ? (
                                    <span>{getDirectAssessmentScore(student.id, 'sa')} / {getDirectAssessmentMaxMarks('sa')}</span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-gray-150 text-gray-605 rounded-full text-xs font-bold uppercase">
                                      {localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_sa`) 
                                        ? JSON.parse(localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_sa`) || '{}')[student.id]?.score || 'Ungraded'
                                        : 'Ungraded'}
                                    </span>
                                  )}
                                </td>

                                {/* Soft Skills & Communication (SSC) */}
                                <td className="px-6 py-4 border-r border-gray-200 text-center font-semibold text-gray-700 bg-amber-50/10">
                                  {isDirectAssessmentNumeric('ssc') ? (
                                    <span>{getDirectAssessmentScore(student.id, 'ssc')} / {getDirectAssessmentMaxMarks('ssc')}</span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-gray-150 text-gray-605 rounded-full text-xs font-bold uppercase">
                                      {localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_ssc`) 
                                        ? JSON.parse(localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_ssc`) || '{}')[student.id]?.score || 'Ungraded'
                                        : 'Ungraded'}
                                    </span>
                                  )}
                                </td>

                                {/* Discipline & Consistency (DC) */}
                                <td className="px-6 py-4 border-r border-gray-200 text-center font-semibold text-gray-700 bg-rose-50/10">
                                  {isDirectAssessmentNumeric('dc') ? (
                                    <span>{getDirectAssessmentScore(student.id, 'dc')} / {getDirectAssessmentMaxMarks('dc')}</span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-gray-150 text-gray-605 rounded-full text-xs font-bold uppercase">
                                      {localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_dc`) 
                                        ? JSON.parse(localStorage.getItem(`assessment_${selectedSection.id}_${selectedSubject.id}_dc`) || '{}')[student.id]?.score || 'Ungraded'
                                        : 'Ungraded'}
                                    </span>
                                  )}
                                </td>

                                {/* Aggregated mark from database */}
                                <td className="px-6 py-4 text-center font-bold text-base text-indigo-700 bg-indigo-50/30">
                                  {aggregatedMark !== null ? (
                                    totalAggregatedMark !== null ? `${aggregatedMark} / ${totalAggregatedMark}` : `${aggregatedMark}`
                                  ) : (
                                    <span className="text-gray-300 font-normal">-</span>
                                  )}
                                </td>
                              </>
                            )}

                            {activeTab === 'PRACTICAL' && (
                              <td className="px-6 py-4 text-center font-bold text-base text-indigo-700 bg-indigo-50/30">
                                {aggregatedMark !== null ? (
                                  totalAggregatedMark !== null ? `${aggregatedMark} / ${totalAggregatedMark}` : `${aggregatedMark}`
                                ) : (
                                  <span className="text-gray-300 font-normal">-</span>
                                )}
                              </td>
                            )}

                            {activeTab === 'FINALS' && (
                              <td className="px-6 py-4 text-center font-bold text-base text-indigo-700 bg-indigo-50/30">
                                {currentTabExams.map(exam => {
                                  const record = examResults[exam.id]?.[student.id];
                                  return record ? (
                                    record.is_absent ? (
                                      <span key={exam.id} className="text-red-500">ABSENT</span>
                                    ) : (
                                      <span key={exam.id}>{record.marks_obtained} <span className="text-xs text-gray-400">/ {exam.max_marks}</span></span>
                                    )
                                  ) : (
                                    <span key={exam.id} className="text-gray-300 font-normal">-</span>
                                  );
                                })}
                              </td>
                            )}
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

        {/* Promotion & Assignment Modal Overlay */}
        {isAssignModalOpen && selectedSection && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
                {/* Modal header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Assign Promotion / Detainment</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Select target grade and section for each student. This will be reflected in their report cards.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAssignModalOpen(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="p-6 overflow-y-auto flex-1">
                  <form onSubmit={handleAssignSubmit} className="space-y-6">
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-150 text-xs uppercase text-gray-500 font-bold tracking-wider">
                            <th className="px-6 py-4 text-left">Student Name</th>
                            <th className="px-6 py-4 text-left">Target Grade</th>
                            <th className="px-6 py-4 text-left">Target Section</th>
                            <th className="px-6 py-4 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {students.map(student => {
                            const assignment = studentAssignments[student.id] || { grade: selectedSection.grade_name, section: selectedSection.section_letter };
                            const curG = selectedSection.grade_name;
                            const tgtG = assignment.grade;
                            
                            const isSuccessor = (() => {
                              const curNum = parseInt(curG);
                              const tgtNum = parseInt(tgtG);
                              if (!isNaN(curNum) && !isNaN(tgtNum)) {
                                return tgtNum > curNum;
                              }
                              return tgtG !== curG;
                            })();

                            return (
                              <tr key={student.id} className="hover:bg-gray-50/30 text-sm">
                                <td className="px-6 py-4 font-bold text-gray-800">
                                  {student.first_name} {student.last_name}
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={tgtG}
                                    onChange={(e) => {
                                      setStudentAssignments(prev => ({
                                        ...prev,
                                        [student.id]: { ...prev[student.id], grade: e.target.value }
                                      }));
                                    }}
                                    className="p-2 border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                                  >
                                    {availableGrades.map(g => (
                                      <option key={g} value={g}>Grade {g}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    value={assignment.section}
                                    onChange={(e) => {
                                      setStudentAssignments(prev => {
                                        const current = prev[student.id] || { grade: selectedSection.grade_name, section: selectedSection.section_letter };
                                        return {
                                          ...prev,
                                          [student.id]: { ...current, section: e.target.value.toUpperCase() }
                                        };
                                      });
                                    }}
                                    className="p-2 border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold w-24"
                                    placeholder="e.g. A"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  {isSuccessor ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-green-50 text-green-700">
                                      Promoted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-orange-50 text-orange-700">
                                      Detained
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Modal footer inside form */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-150">
                      <button
                        type="button"
                        onClick={() => setIsAssignModalOpen(false)}
                        className="px-5 py-2.5 border border-gray-250 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-sm"
                      >
                        Generate Preview
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
        )}

        {/* Formula panel Modal overlay */}
        {isFormulaOpen && selectedSection && selectedSubject && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col">
              
              {/* Modal header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-indigo-100/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Formula Panel - {activeTab === 'INTERNAL' ? 'Internals' : 'Practicals'}</h3>
                    <p className="text-xs text-gray-500">Define aliases, scale values down, and build calculation formula</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormulaOpen(false)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-500 transition font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6 flex-1">
                
                {/* Entities scale configuration */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                    <Info size={16} className="text-indigo-500" /> Define Exam/Assessment Aliases & Scaling
                  </h4>
                  <p className="text-xs text-gray-500">Set unique aliases and numeric limits to represent exam scores inside the mathematical equation.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formulaEntities.map((ent, idx) => (
                      <div key={ent.id} className="bg-white p-4 rounded-xl border border-gray-100 space-y-3 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm text-gray-800 truncate max-w-[200px]">{ent.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ent.type === 'EXAM' ? 'bg-indigo-50 text-indigo-700' : 'bg-green-50 text-green-700'}`}>
                              {ent.type === 'EXAM' ? 'Exam' : 'Direct Assessment'}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 block font-mono">Max Marks: {ent.maxMarks}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Specify an Alias</label>
                            <input
                              type="text"
                              value={ent.alias}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^A-Za-z0-9_]/g, '');
                                setFormulaEntities(prev => prev.map((item, i) => i === idx ? { ...item, alias: val } : item));
                              }}
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                              placeholder="e.g. E1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 block mb-1">Scale marks to:</label>
                            <input
                              type="number"
                              min="1"
                              value={ent.scaleTo}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormulaEntities(prev => prev.map((item, i) => i === idx ? { ...item, scaleTo: val } : item));
                              }}
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                              placeholder="Scale Max"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formula Text area */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-gray-800 text-sm block">Aggregation Formula</label>
                    <span className="text-xs text-gray-400 font-mono">Allowed: + - * / ( ) ^</span>
                  </div>
                  <input
                    type="text"
                    value={formulaString}
                    onChange={(e) => setFormulaString(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                    placeholder="e.g. (E1 + E2) * 0.4 + SA + SSC"
                  />
                  <p className="text-xs text-gray-400">
                    <strong>Note:</strong> Scaled scores are calculated as: <code>(marks_scored / total_marks) * scale_limit</code>. If no scaling is configured, the raw score is used.
                  </p>
                </div>

                {/* Formula calculation error banner */}
                {formulaError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-2.5 font-medium text-sm">
                    <ShieldAlert className="text-rose-500 flex-shrink-0 mt-0.5" size={18} />
                    <div>{formulaError}</div>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/70">
                <button
                  onClick={handleUndoAggregation}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-sm transition disabled:opacity-50 mr-auto"
                >
                  Undo Aggregation
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsFormulaOpen(false)}
                    className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAggregation}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={16} />}
                    Aggregate & Save results
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Report Cards Print/Preview Modal Overlay */}
        {isPreviewOpen && selectedSection && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print-modal-overlay">
            <div className="bg-white rounded-3xl w-full max-w-7xl h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col print-modal-content">
              
              {/* Modal header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-indigo-100/30 no-print">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Report Cards Print Preview</h3>
                    <p className="text-xs text-gray-500">Previewing report cards for all students in Grade {selectedSection.full_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateSeparatePDFs}
                    disabled={isGeneratingPDFs}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center gap-2"
                  >
                    {isGeneratingPDFs ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Generating ({pdfProgress.current}/{pdfProgress.total})...
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        Generate Separate PDFs
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-8 flex-1">
                {previewLoading ? (
                  <div className="flex flex-col justify-center items-center py-40 gap-4">
                    <Loader2 className="animate-spin text-indigo-600" size={50} />
                    <span className="text-gray-500 font-medium">Generating report cards...</span>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    No active students found in this section.
                  </div>
                ) : (() => {
                  const { hasInternalAggregation, hasPracticalAggregation, internalCols, practicalCols, finalCols } = getPreviewColumns();
                  
                  return (
                    <div className="space-y-12">
                      {students.map(student => (
                        <div 
                          key={student.id} 
                          id={`report-card-${student.id}`}
                          className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm report-card-print-page max-w-5xl mx-auto space-y-6"
                        >
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
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-150 text-sm">
                            <div>
                              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Student Name</span>
                              <span className="font-bold text-gray-800">{student.first_name} {student.last_name}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Student ID (SUID)</span>
                              <span className="font-mono font-bold text-gray-800">{student.suid || student.id}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Grade & Section</span>
                              <span className="font-bold text-gray-800">{selectedSection.full_name}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Roll Number</span>
                              <span className="font-mono font-bold text-gray-800">#{student.roll_number || '-'}</span>
                            </div>
                          </div>

                          {/* Report Table */}
                          <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                            <table className="min-w-full border-collapse">
                              <thead>
                                <tr className="bg-gray-100/80 text-gray-700 text-xs font-bold uppercase tracking-wider">
                                  <th className="border-r border-gray-200 px-4 py-3 text-left font-semibold align-middle whitespace-nowrap min-w-[150px]" rowSpan={2}>Subject</th>
                                  <th className="border-r border-b border-gray-200 px-4 py-3 text-center font-semibold align-middle" colSpan={internalCols.length}>Internals</th>
                                  <th className="border-r border-b border-gray-200 px-4 py-3 text-center font-semibold align-middle" colSpan={practicalCols.length}>Practicals</th>
                                  <th className="border-b border-gray-200 px-4 py-3 text-center font-semibold align-middle" colSpan={finalCols.length}>Final Exams</th>
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
                                {allocatedSubjects.map(sub => (
                                  <tr key={sub.id} className="hover:bg-gray-50/30">
                                    <td className="border-r border-gray-200 px-4 py-3 font-semibold text-gray-800 whitespace-nowrap min-w-[150px]">
                                      {sub.subject_name}
                                    </td>
                                    {/* Render Internals */}
                                    {internalCols.map(col => (
                                      <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                        {renderPreviewCell(student, sub, 'INTERNAL', col)}
                                      </td>
                                    ))}
                                    {/* Render Practicals */}
                                    {practicalCols.map(col => (
                                      <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                        {renderPreviewCell(student, sub, 'PRACTICAL', col)}
                                      </td>
                                    ))}
                                    {/* Render Finals */}
                                    {finalCols.map(col => (
                                      <td key={col.id} className="px-3 py-3 text-center font-mono font-bold text-gray-700">
                                        {renderPreviewCell(student, sub, 'FINALS', col)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Promotion / Detainment Status */}
                          {(() => {
                            const assignment = studentAssignments[student.id];
                            if (!assignment) return null;
                            const curG = selectedSection.grade_name;
                            const tgtG = assignment.grade;
                            const tgtS = assignment.section;
                            
                            const isSuccessor = (() => {
                              const curNum = parseInt(curG);
                              const tgtNum = parseInt(tgtG);
                              if (!isNaN(curNum) && !isNaN(tgtNum)) {
                                return tgtNum > curNum;
                              }
                              return tgtG !== curG;
                            })();

                            return (
                              <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                                <p className="text-sm font-bold text-gray-800 font-sans tracking-wide">
                                  {isSuccessor ? (
                                    <span>Result Status: <strong className="text-green-700 font-black">Promoted to: {tgtG}-{tgtS}</strong></span>
                                  ) : (
                                    <span>Result Status: <strong className="text-orange-700 font-black">Detained to: {tgtG}-{tgtS}</strong></span>
                                  )}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Footer Signatures */}
                          <div className="pt-12 flex justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                            <div className="border-t border-gray-300 pt-2 px-6 text-center">Class Teacher</div>
                            <div className="border-t border-gray-300 pt-2 px-6 text-center">Principal Signature</div>
                          </div>

                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Modal footer */}
              <div className="p-6 border-t border-gray-100 flex justify-end bg-gray-50/70 no-print">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl text-sm transition shadow-sm"
                >
                  Close Preview
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Hidden Print Container for Bulk Print (Only rendered if print preview modal is closed and we have students) */}
        {!isPreviewOpen && selectedSection && students.length > 0 && (() => {
          const { hasInternalAggregation, hasPracticalAggregation, internalCols, practicalCols, finalCols } = getPreviewColumns();
          return (
            <div className="hidden print:block">
              {students.map(student => (
                <div 
                  key={student.id} 
                  className="bg-white p-8 report-card-print-page space-y-6"
                >
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
                      <h1 className="text-3xl font-extrabold tracking-tight text-indigo-900 uppercase font-sans">
                        {schoolSettings?.school_name || user?.school_name || 'New Horizons Scholastic School'}
                      </h1>
                      <p className="text-sm font-bold text-gray-500 tracking-widest uppercase font-sans">Student Progress Report Card</p>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-150 text-sm font-sans">
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider font-sans">Student Name</span>
                      <span className="font-bold text-gray-800">{student.first_name} {student.last_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider font-sans">Student ID (SUID)</span>
                      <span className="font-mono font-bold text-gray-800">{student.suid || student.id}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider font-sans">Grade & Section</span>
                      <span className="font-bold text-gray-800">{selectedSection.full_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider font-sans">Roll Number</span>
                      <span className="font-mono font-bold text-gray-800">#{student.roll_number || '-'}</span>
                    </div>
                  </div>

                  {/* Report Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl font-sans">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100/80 text-gray-700 text-xs font-bold uppercase tracking-wider font-sans">
                          <th className="border-r border-gray-200 px-4 py-3 text-left font-sans font-bold align-middle whitespace-nowrap min-w-[150px]" rowSpan={2}>Subject</th>
                          <th className="border-r border-b border-gray-200 px-4 py-3 text-center font-sans font-bold align-middle" colSpan={internalCols.length}>Internals</th>
                          <th className="border-r border-b border-gray-200 px-4 py-3 text-center font-sans font-bold align-middle" colSpan={practicalCols.length}>Practicals</th>
                          <th className="border-b border-gray-200 px-4 py-3 text-center font-sans font-bold align-middle" colSpan={finalCols.length}>Final Exams</th>
                        </tr>
                        <tr className="bg-gray-50 text-gray-600 text-[10px] font-bold border-b border-gray-200 uppercase font-sans">
                          {internalCols.map(col => (
                            <th key={col.id} className="border-r border-gray-200 px-3 py-2 text-center font-semibold font-sans">
                              {col.name}
                            </th>
                          ))}
                          {practicalCols.map(col => (
                            <th key={col.id} className="border-r border-gray-200 px-3 py-2 text-center font-semibold font-sans">
                              {col.name}
                            </th>
                          ))}
                          {finalCols.map(col => (
                            <th key={col.id} className="px-3 py-2 text-center font-semibold font-sans font-bold">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 text-sm">
                        {allocatedSubjects.map(sub => (
                          <tr key={sub.id} className="hover:bg-gray-50/30">
                            <td className="border-r border-gray-200 px-4 py-3 font-semibold text-gray-800 font-sans whitespace-nowrap min-w-[150px]">
                              {sub.subject_name}
                            </td>
                            {internalCols.map(col => (
                              <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderPreviewCell(student, sub, 'INTERNAL', col)}
                              </td>
                            ))}
                            {practicalCols.map(col => (
                              <td key={col.id} className="border-r border-gray-200 px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderPreviewCell(student, sub, 'PRACTICAL', col)}
                              </td>
                            ))}
                            {finalCols.map(col => (
                              <td key={col.id} className="px-3 py-3 text-center font-mono font-bold text-gray-700">
                                {renderPreviewCell(student, sub, 'FINALS', col)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Promotion / Detainment Status */}
                  {(() => {
                    const assignment = studentAssignments[student.id];
                    if (!assignment) return null;
                    const curG = selectedSection.grade_name;
                    const tgtG = assignment.grade;
                    const tgtS = assignment.section;
                    
                    const isSuccessor = (() => {
                      const curNum = parseInt(curG);
                      const tgtNum = parseInt(tgtG);
                      if (!isNaN(curNum) && !isNaN(tgtNum)) {
                        return tgtNum > curNum;
                      }
                      return tgtG !== curG;
                    })();

                    return (
                      <div className="mt-6 pt-4 border-t border-dashed border-gray-200 font-sans">
                        <p className="text-sm font-bold text-gray-800 font-sans tracking-wide">
                          {isSuccessor ? (
                            <span>Result Status: <strong className="text-green-700 font-black">Promoted to: {tgtG}-{tgtS}</strong></span>
                          ) : (
                            <span>Result Status: <strong className="text-orange-700 font-black">Detained to: {tgtG}-{tgtS}</strong></span>
                          )}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Footer Signatures */}
                  <div className="pt-12 flex justify-between text-xs text-gray-400 font-bold uppercase tracking-wider font-sans">
                    <div className="border-t border-gray-300 pt-2 px-6 text-center">Class Teacher</div>
                    <div className="border-t border-gray-300 pt-2 px-6 text-center">Principal Signature</div>
                  </div>

                </div>
              ))}
            </div>
          );
        })()}

        {isGeneratingPDFs && (
          <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-md z-[100000] flex flex-col items-center justify-center space-y-4 no-print animate-fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm w-full text-center mx-4 animate-scale-in">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <h3 className="text-xl font-bold text-gray-900">Generating Report Cards</h3>
              <p className="text-sm text-gray-500">
                Compiling and formatting separate PDF files for student report cards. Please wait...
              </p>
              <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Progress: {pdfProgress.current} / {pdfProgress.total} Students
              </span>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
