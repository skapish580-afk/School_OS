'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  GraduationCap, Search, UserPlus, Calendar, Award, 
  TrendingUp, X, Loader2, BookOpen, Heart,
  User, FileText, Trophy, Thermometer
} from 'lucide-react';
import { useSettings } from '@/lib/SettingsContext';
import api from '@/lib/api';

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
  const { settings, formatAcademicYear } = useSettings();
  const [alumni, setAlumni] = useState<AlumniStudent[]>([]);
  const [filteredAlumni, setFilteredAlumni] = useState<AlumniStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AlumniStudent | null>(null);
  const [selectedSection, setSelectedSection] = useState('');

  // Details Modal and Timeline State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<AlumniStudent | null>(null);

  // Journey state variables
  const [studentObj, setStudentObj] = useState<any>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [crossSchoolHistory, setCrossSchoolHistory] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  
  const [selectedTenure, setSelectedTenure] = useState<any>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [dynamicAttendance, setDynamicAttendance] = useState<any>(null);
  
  const [timelineMarks, setTimelineMarks] = useState<any[]>([]);
  const [timelineRemarks, setTimelineRemarks] = useState<any[]>([]);
  const [timelineHealth, setTimelineHealth] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineTab, setTimelineTab] = useState<'marks' | 'remarks' | 'health'>('marks');
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlumni();
  }, []);

  useEffect(() => {
    filterAlumni();
  }, [searchTerm, selectedYear, alumni]);

  // Fetch live attendance stats from DB whenever the selected grade changes.
  // Alumni students retain their StudentAttendance rows even after graduating,
  // so this covers grades where StudentHistory.attendance_percentage was never filled in.
  useEffect(() => {
    const studentId = studentObj?.id;
    if (!studentId || !selectedGrade) {
      setDynamicAttendance(null);
      return;
    }
    const fetchDynamicAttendance = async () => {
      try {
        const res = await api.get(`/attendance/student_grade_stats/?student_id=${studentId}&grade=${selectedGrade}`);
        setDynamicAttendance(res.data);
      } catch (e) {
        console.warn('Failed to fetch dynamic attendance for alumni', e);
        setDynamicAttendance(null);
      }
    };
    fetchDynamicAttendance();
  }, [studentObj?.id, selectedGrade]);

  const fetchAlumni = async () => {
    try {
      const response = await api.get('/enrollments/student-enrollments/?status=GRADUATED');
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
      await api.post(
        `/enrollments/student-enrollments/${selectedStudent.id}/re_enroll/`,
        { new_section: selectedSection }
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
      await api.post(`/enrollments/student-enrollments/${studentEnrollmentId}/confirm_alumni/`);
      alert('Student confirmed as alumni successfully!');
      fetchAlumni();
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || 'Failed to confirm alumni'}`);
    }
  };

  const handleOpenDetail = async (alumnus: AlumniStudent) => {
    const studentId = (alumnus as any).student || alumnus.id;
    setDetailStudent(alumnus);
    setIsDetailOpen(true);
    setTimelineLoading(true);
    setTimelineTab('marks');
    setDynamicAttendance(null);
    try {
      const [
        studentRes,
        profileRes,
        guardiansRes,
        crossSchoolRes,
        historyRes,
        reportCardsRes,
        marksRes,
        remarksRes,
        healthRes
      ] = await Promise.all([
        api.get(`/students/${studentId}/?status=ALL`),
        api.get(`/students/${studentId}/profile/?status=ALL`).catch(() => ({ data: {} })),
        api.get(`/students/${studentId}/guardians/?status=ALL`).catch(() => ({ data: [] })),
        api.get(`/students/${studentId}/cross_school_history/?status=ALL`).catch(() => ({ data: [] })),
        api.get(`/students/${studentId}/history/?status=ALL`).catch(() => ({ data: [] })),
        api.get(`/academics/report-cards/for_student/?student_id=${studentId}`).catch(() => ({ data: [] })),
        api.get(`/timeline/marks/?student_suid=${alumnus.student_suid}`).catch(() => ({ data: [] })),
        api.get(`/timeline/remarks/?student_suid=${alumnus.student_suid}`).catch(() => ({ data: [] })),
        api.get(`/timeline/health/?student_suid=${alumnus.student_suid}`).catch(() => ({ data: [] }))
      ]);

      const studentData = studentRes.data;
      const fullProfileData = profileRes.data;
      const guardiansList = guardiansRes.data?.results || guardiansRes.data || [];
      const crossSchoolData = crossSchoolRes.data?.results || crossSchoolRes.data || [];
      const historyData = historyRes.data?.results || historyRes.data || [];
      const reportCardsData = reportCardsRes.data?.results || reportCardsRes.data || [];
      const marksList = marksRes.data?.results || marksRes.data || [];
      const remarksList = remarksRes.data?.results || remarksRes.data || [];
      const healthList = healthRes.data?.results || healthRes.data || [];

      setStudentObj(studentData);
      setFullProfile(fullProfileData);
      setGuardians(guardiansList);
      setCrossSchoolHistory(crossSchoolData);
      setStudentHistory(historyData);
      setReportCards(reportCardsData);
      setTimelineMarks(marksList);
      setTimelineRemarks(remarksList);
      setTimelineHealth(healthList);

      const isStudentActive = studentData && studentData.status !== 'ALUMNI' && studentData.status !== 'WITHDRAWN' && studentData.status !== 'TRANSFERRED' && studentData.status !== 'GRADUATED';
      const tempTenuresList = [...crossSchoolData];
      const hasActive = tempTenuresList.some((t: any) => t.status === 'ACTIVE');
      if (!hasActive && isStudentActive) {
        tempTenuresList.push({
          id: 'active-tenure',
          school_name: studentData.school_name || studentData.school?.display_name || 'Current School',
          status: 'ACTIVE',
          admitted_date: studentData.admission_date || '',
          transferred_date: null,
          grade_from: studentData.grade_config?.grade_name || alumnus.grade || '',
          grade_to: studentData.grade_config?.grade_name || alumnus.grade || '',
          timeline_snapshot: {
            marks: marksList,
            remarks: remarksList,
            health: healthList,
            history: historyData,
            report_cards: reportCardsData
          }
        });
      } else {
        tempTenuresList.forEach((t: any) => {
          if (t.status === 'ACTIVE') {
            t.timeline_snapshot = {
              marks: marksList,
              remarks: remarksList,
              health: healthList,
              history: historyData,
              report_cards: reportCardsData
            };
          }
        });
      }

      if (tempTenuresList.length > 0) {
        const latestTenure = tempTenuresList.find((t: any) => t.status === 'ACTIVE') || tempTenuresList[tempTenuresList.length - 1];
        setSelectedTenure(latestTenure);
        setSelectedGrade(latestTenure.grade_to || latestTenure.grade_from || '');
      } else {
        setSelectedTenure(null);
        setSelectedGrade('');
      }

    } catch (err) {
      console.error("Failed to fetch full student journey", err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const schoolTenures = useMemo(() => {
    const list = [...crossSchoolHistory];
    const isStudentActive = studentObj && studentObj.status !== 'ALUMNI' && studentObj.status !== 'WITHDRAWN' && studentObj.status !== 'TRANSFERRED' && studentObj.status !== 'GRADUATED';
    const hasActive = list.some((t: any) => t.status === 'ACTIVE');
    if (!hasActive && isStudentActive) {
      list.push({
        id: 'active-tenure',
        school_name: studentObj.school_name || studentObj.school?.display_name || studentObj.school?.name || 'Current School',
        status: 'ACTIVE',
        admitted_date: studentObj.admission_date || '',
        transferred_date: null,
        grade_from: studentObj.grade_config?.grade_name || detailStudent?.grade || '',
        grade_to: studentObj.grade_config?.grade_name || detailStudent?.grade || '',
        timeline_snapshot: {
          marks: timelineMarks,
          remarks: timelineRemarks,
          health: timelineHealth,
          history: studentHistory,
          report_cards: reportCards
        }
      });
    } else {
      return list.map((t: any) => {
        if (t.status === 'ACTIVE') {
          return {
            ...t,
            timeline_snapshot: {
              marks: timelineMarks,
              remarks: timelineRemarks,
              health: timelineHealth,
              history: studentHistory,
              report_cards: reportCards
            }
          };
        }
        return t;
      });
    }
    return list;
  }, [crossSchoolHistory, studentObj, detailStudent, timelineMarks, timelineRemarks, timelineHealth, studentHistory, reportCards]);

  const currentGrade = studentObj?.grade || (studentObj?.current_class && studentObj.current_class !== 'Unassigned' ? studentObj.current_class.split('-')[0] : null);
  const uniqueGrades = useMemo(() => {
    const gradesSet = new Set<string>();
    
    if (detailStudent?.grade) {
      gradesSet.add(detailStudent.grade);
    }
    if (currentGrade) {
      gradesSet.add(currentGrade);
    }

    schoolTenures.forEach((t: any) => {
      if (t.grade_from) gradesSet.add(t.grade_from);
      if (t.grade_to) gradesSet.add(t.grade_to);
      
      const snap = t.timeline_snapshot || {};
      if (Array.isArray(snap.marks)) {
        snap.marks.forEach((m: any) => { if (m.grade) gradesSet.add(m.grade); });
      }
      if (Array.isArray(snap.remarks)) {
        snap.remarks.forEach((r: any) => { if (r.grade) gradesSet.add(r.grade); });
      }
      if (Array.isArray(snap.health)) {
        snap.health.forEach((h: any) => { if (h.grade) gradesSet.add(h.grade); });
      }
      if (Array.isArray(snap.history)) {
        snap.history.forEach((h: any) => { if (h.grade_name) gradesSet.add(h.grade_name); });
      }
      if (Array.isArray(snap.report_cards)) {
        snap.report_cards.forEach((rc: any) => { if (rc.grade_name) gradesSet.add(rc.grade_name); });
      }
    });

    const allGrades = Array.from(gradesSet).filter(Boolean);
    
    let max = 0;
    allGrades.forEach(g => {
      const num = parseInt(g, 10);
      if (!isNaN(num) && num > max) {
        max = num;
      }
    });
    
    const hasLKG = allGrades.includes('LKG');
    const hasUKG = allGrades.includes('UKG');
    
    const list: string[] = [];
    if (hasLKG) list.push('LKG');
    if (hasUKG) list.push('UKG');
    const endGrade = max || 10;
    for (let i = 1; i <= endGrade; i++) {
      list.push(i.toString());
    }
    return list;
  }, [schoolTenures, detailStudent, currentGrade]);

  const parseGrade = (g: string) => {
    if (g === 'LKG') return -2;
    if (g === 'UKG') return -1;
    const num = parseInt(g, 10);
    return isNaN(num) ? 99 : num;
  };

  const sortedGrades = uniqueGrades;

  const getTenureGrades = (tenure: any) => {
    const grades = new Set<string>();
    if (tenure?.timeline_snapshot?.history) {
      tenure.timeline_snapshot.history.forEach((h: any) => {
        if (h.grade_name) grades.add(h.grade_name);
      });
    }
    if (tenure?.timeline_snapshot?.marks) {
      tenure.timeline_snapshot.marks.forEach((m: any) => {
        if (m.grade) grades.add(m.grade);
      });
    }
    if (tenure?.timeline_snapshot?.remarks) {
      tenure.timeline_snapshot.remarks.forEach((r: any) => {
        if (r.grade) grades.add(r.grade);
      });
    }
    if (tenure?.timeline_snapshot?.health) {
      tenure.timeline_snapshot.health.forEach((h: any) => {
        if (h.grade) grades.add(h.grade);
      });
    }
    if (tenure?.timeline_snapshot?.report_cards) {
      tenure.timeline_snapshot.report_cards.forEach((c: any) => {
        if (c.grade_name) grades.add(c.grade_name);
      });
    }
    if (tenure?.status === 'ACTIVE' && currentGrade) {
      grades.add(currentGrade);
    }
    if (detailStudent?.grade) {
      grades.add(detailStudent.grade);
    }

    let max = 0;
    grades.forEach(g => {
      const num = parseInt(g, 10);
      if (!isNaN(num) && num > max) {
        max = num;
      }
    });

    const hasLKG = grades.has('LKG');
    const hasUKG = grades.has('UKG');

    const list: string[] = [];
    if (hasLKG) list.push('LKG');
    if (hasUKG) list.push('UKG');
    const endGrade = max || 10;
    for (let i = 1; i <= endGrade; i++) {
      list.push(i.toString());
    }
    return list;
  };

  useEffect(() => {
    if (schoolTenures.length > 0) {
      const updatedTenure = schoolTenures.find((t: any) => t.id === selectedTenure?.id) || 
                            schoolTenures.find((t: any) => t.status === 'ACTIVE') || 
                            schoolTenures[schoolTenures.length - 1];
      setSelectedTenure(updatedTenure);
      
      const activeGrades = getTenureGrades(updatedTenure);
      if (activeGrades.length > 0 && (!selectedGrade || !activeGrades.includes(selectedGrade))) {
        setSelectedGrade(activeGrades[activeGrades.length - 1]);
      }
    }
  }, [crossSchoolHistory, studentHistory, studentObj, timelineMarks, timelineRemarks, timelineHealth, reportCards]);

  // When the user drags the slider to a grade that belongs to a DIFFERENT tenure
  // (e.g. a re-admitted student: Tenure #1 = Grade 1-10, Tenure #2 = Grade 11-12),
  // automatically switch selectedTenure to the one that owns that grade so the
  // correct timeline_snapshot data is read.
  useEffect(() => {
    if (!selectedGrade || schoolTenures.length <= 1) return;
    const owningTenure = schoolTenures.find((t: any) => {
      const grades = getTenureGrades(t);
      return grades.includes(selectedGrade);
    });
    if (owningTenure && owningTenure.id !== selectedTenure?.id) {
      setSelectedTenure(owningTenure);
    }
  }, [selectedGrade, schoolTenures]);

  const updateGradeFromY = (clientY: number) => {
    if (!trackRef.current || sortedGrades.length <= 1) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    let relativeY = clientY - rect.top;
    relativeY = Math.max(0, Math.min(relativeY, trackHeight));
    const ratio = relativeY / trackHeight;
    const index = Math.round((1 - ratio) * (sortedGrades.length - 1));
    const clampedIndex = Math.max(0, Math.min(index, sortedGrades.length - 1));
    setSelectedGrade(sortedGrades[clampedIndex]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateGradeFromY(e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      setIsDragging(true);
      updateGradeFromY(e.touches[0].clientY);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        updateGradeFromY(e.clientY);
      };
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };
      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) {
          updateGradeFromY(e.touches[0].clientY);
        }
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('touchend', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  const graduationYears = useMemo(() => {
    const fromAlumni = alumni.map(a => a.academic_year).filter(Boolean);
    const fromSettings = settings?.available_academic_years || [];
    return [...new Set([...fromAlumni, ...fromSettings])].sort().reverse();
  }, [alumni, settings]);


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
                        <button 
                          onClick={() => handleOpenDetail(alumnus)}
                          className="ml-3 font-bold text-slate-850 hover:text-indigo-650 hover:underline transition-colors text-left"
                        >
                          {alumnus.student_name}
                        </button>
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
      {/* Student Academic Timeline Detail Modal */}
      {isDetailOpen && detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-md transition-opacity">
          <div className="bg-white h-full w-full max-w-4xl shadow-2xl border-l border-slate-100 flex flex-col justify-between overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-700 to-indigo-800 p-6 text-white relative shrink-0">
              <button 
                onClick={() => { setIsDetailOpen(false); setDetailStudent(null); }}
                className="absolute right-4 top-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">{detailStudent.student_name}</h2>
                  <p className="text-indigo-150 text-xs font-semibold mt-0.5">SUID Reference: {detailStudent.student_suid}</p>
                </div>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <Loader2 className="animate-spin text-purple-600 h-10 w-10" />
                  <p className="text-sm font-semibold text-slate-500">Retrieving full academic journey...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Journey Stats Banner */}
                  <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-2xl text-white shadow-md">
                    <h3 className="text-xl font-bold mb-1">🎓 Student Journey</h3>
                    <p className="text-purple-100 text-xs font-semibold">
                      {schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length > 0 
                        ? `${schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length} years of academic excellence`
                        : `No historical records`
                      }
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs">
                      <div className="bg-white/20 px-3 py-1 rounded-full font-bold">
                        🏆 {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.awards_count || 0), 0) || 0), 0)} Awards
                      </div>
                      <div className="bg-white/20 px-3 py-1 rounded-full font-bold">
                        📜 {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.certificates_count || 0), 0) || 0), 0)} Certificates
                      </div>
                      <div className="bg-white/20 px-3 py-1 rounded-full font-bold">
                        ⭐ {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.net_karma || 0), 0) || 0), 0)} Karma Points
                      </div>
                    </div>
                  </div>

                  {/* Personal Info & Guardians row */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <User size={14} className="text-blue-600" /> Personal Information
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
                        <div><span className="text-slate-400">Admission No:</span> <span className="font-bold block mt-0.5">{studentObj?.admission_number || '--'}</span></div>
                        <div><span className="text-slate-400">DOB:</span> <span className="font-bold block mt-0.5">{fullProfile?.date_of_birth || '--'}</span></div>
                        <div><span className="text-slate-400">Gender:</span> <span className="font-bold block mt-0.5">{fullProfile?.gender === 'M' ? 'Male' : fullProfile?.gender === 'F' ? 'Female' : '--'}</span></div>
                        <div><span className="text-slate-400">Blood Group:</span> <span className="font-bold block mt-0.5">{fullProfile?.blood_group || '--'}</span></div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                        👨‍👩‍👧 Parents / Guardians
                      </h4>
                      {guardians.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No parent details logged.</p>
                      ) : (
                        <div className="space-y-2">
                          {guardians.map((g: any) => (
                            <div key={g.id} className="flex items-center gap-2 text-xs text-slate-700">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-[10px]">{g.name?.[0]}</div>
                              <div className="flex-1">
                                <span className="font-bold">{g.name}</span>
                                <span className="text-slate-405 ml-1.5 font-medium">({g.relationship})</span>
                              </div>
                              <span className="text-slate-500 text-[10px] font-mono">{g.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-School Academic Timeline Dashboard */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/75 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                          <GraduationCap size={16} className="text-purple-600" /> Multi-School Academic Journey
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Choose school chapter or drag the timeline slider on the right to navigate years.</p>
                      </div>
                      {selectedGrade && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Viewing Grade: {selectedGrade}
                        </span>
                      )}
                    </div>

                    {schoolTenures.length > 0 ? (
                      <div className="grid grid-cols-[1fr_70px] gap-0 min-h-[400px]">
                        {/* Left Panel: Grade Details */}
                        <div className="p-4 border-r border-slate-100 space-y-5 overflow-y-auto max-h-[500px]">
                          {selectedGrade ? (
                            (() => {
                              const currentMarks = (selectedTenure?.timeline_snapshot?.marks || []).filter((m: any) => m.grade === selectedGrade);
                              const currentRemarks = (selectedTenure?.timeline_snapshot?.remarks || []).filter((r: any) => r.grade === selectedGrade);
                              const currentHealth = (selectedTenure?.timeline_snapshot?.health || []).filter((h: any) => h.grade === selectedGrade);
                              const currentReportCards = (selectedTenure?.timeline_snapshot?.report_cards || []).filter((c: any) => c.grade_name === selectedGrade);
                              const currentHistory = (selectedTenure?.timeline_snapshot?.history || []).filter((h: any) => h.grade_name === selectedGrade);
                              
                              const att = (() => {
                                // 1. Prefer live DB records (StudentAttendance rows are retained after graduation)
                                if (dynamicAttendance && dynamicAttendance.total_days > 0) {
                                  return dynamicAttendance;
                                }
                                // 2. Fall back to attendance_percentage stored in the mark snapshot
                                const mWithAtt = currentMarks.find((m: any) => m.attendance_percentage !== null && m.attendance_percentage !== undefined);
                                if (mWithAtt) {
                                  return {
                                    percentage: parseFloat(mWithAtt.attendance_percentage || 0),
                                    days_present: mWithAtt.days_present || 0,
                                    total_days: mWithAtt.total_days || 0,
                                    days_absent: (mWithAtt.total_days || 0) - (mWithAtt.days_present || 0)
                                  };
                                }
                                // 3. Fall back to attendance summary in the StudentHistory snapshot
                                const histMatch = currentHistory.find((h: any) => h.attendance_percentage !== null && h.attendance_percentage !== undefined);
                                if (histMatch) {
                                  return {
                                    percentage: parseFloat(histMatch.attendance_percentage || 0),
                                    days_present: histMatch.days_present || 0,
                                    total_days: histMatch.total_working_days || 0,
                                    days_absent: histMatch.days_absent || 0
                                  };
                                }
                                return null;
                              })();

                              return (
                                <div className="space-y-5">
                                  {/* Year-End Performance Summary */}
                                  {currentHistory.length > 0 && (
                                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100/80 space-y-3 shadow-sm">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h5 className="font-bold text-indigo-900 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                                            🎓 Year-End Performance Summary
                                          </h5>
                                          <p className="text-[9px] text-indigo-600 font-bold">Academic Year: {currentHistory[0].academic_year_name}</p>
                                        </div>
                                        {currentHistory[0].overall_grade && (
                                          <span className="px-2 py-0.5 bg-indigo-650 text-white font-extrabold rounded-full text-[10px] shadow-sm">
                                            Grade {currentHistory[0].overall_grade}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                                        {currentHistory[0].percentage !== null && currentHistory[0].percentage !== undefined && (
                                          <div className="bg-white p-2 rounded-lg border border-indigo-50/50">
                                            <div className="font-extrabold text-slate-800 text-[11px]">{parseFloat(currentHistory[0].percentage).toFixed(1)}%</div>
                                            <div className="text-[8px] uppercase font-bold text-slate-400">Percentage</div>
                                          </div>
                                        )}
                                        {currentHistory[0].total_marks !== null && currentHistory[0].total_marks !== undefined && (
                                          <div className="bg-white p-2 rounded-lg border border-indigo-50/50">
                                            <div className="font-extrabold text-slate-800 text-[11px]">{parseFloat(currentHistory[0].total_marks).toFixed(0)}</div>
                                            <div className="text-[8px] uppercase font-bold text-slate-400">Total Marks</div>
                                          </div>
                                        )}
                                        {currentHistory[0].class_rank !== null && currentHistory[0].class_rank !== undefined && (
                                          <div className="bg-white p-2 rounded-lg border border-indigo-50/50">
                                            <div className="font-extrabold text-slate-800 text-[11px]">#{currentHistory[0].class_rank}</div>
                                            <div className="text-[8px] uppercase font-bold text-slate-400">Class Rank</div>
                                          </div>
                                        )}
                                        {currentHistory[0].grade_rank !== null && currentHistory[0].grade_rank !== undefined && (
                                          <div className="bg-white p-2 rounded-lg border border-indigo-50/50">
                                            <div className="font-extrabold text-slate-800 text-[11px]">#{currentHistory[0].grade_rank}</div>
                                            <div className="text-[8px] uppercase font-bold text-slate-400">Grade Rank</div>
                                          </div>
                                        )}
                                      </div>

                                      {currentHistory[0].teacher_remarks && (
                                        <div className="bg-white p-2.5 rounded-lg border border-indigo-100/50 text-[11px]">
                                          <span className="text-[9px] font-extrabold text-indigo-900 block mb-1">✍️ Class Teacher's Remarks</span>
                                          <p className="text-slate-600 italic font-medium font-sans">"{currentHistory[0].teacher_remarks}"</p>
                                          {currentHistory[0].class_teacher_name && (
                                            <span className="text-[8px] text-slate-400 block mt-1.5 text-right">— {currentHistory[0].class_teacher_name}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* 1. Attendance */}
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150">
                                    <h5 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <Calendar size={13} className="text-blue-500" /> Attendance Statistics
                                    </h5>
                                    {att ? (
                                      <div className="space-y-3">
                                        {att.total_days > 0 && (
                                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                                              <div className="font-bold text-slate-800">{att.total_days}</div>
                                              <div className="text-[9px] uppercase font-bold text-slate-400">Total Days</div>
                                            </div>
                                            <div className="bg-green-50/50 p-2 rounded-lg border border-green-100/50">
                                              <div className="font-bold text-green-600">{att.days_present}</div>
                                              <div className="text-[9px] uppercase font-bold text-green-500">Present</div>
                                            </div>
                                            <div className="bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                                              <div className="font-bold text-red-500">{att.days_absent}</div>
                                              <div className="text-[9px] uppercase font-bold text-red-700">Absent</div>
                                            </div>
                                          </div>
                                        )}
                                        <div>
                                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                            <div
                                              className={`h-full rounded-full transition-all duration-500 ${
                                                att.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'
                                              }`}
                                              style={{ width: `${att.percentage}%` }}
                                            />
                                          </div>
                                          <div className="flex justify-between items-center mt-1.5 text-[10px]">
                                            <span className="text-slate-400">Target: 75%</span>
                                            <span className="font-bold text-slate-700">{att.percentage.toFixed(1)}% Present</span>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No attendance records found for Grade {selectedGrade}.</p>
                                    )}
                                  </div>

                                  {/* 2. Results */}
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150">
                                    <h5 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <FileText size={13} className="text-purple-500" /> Academic Results
                                    </h5>
                                    
                                    {currentReportCards.length > 0 && (
                                      <div className="mb-3 space-y-2">
                                        {currentReportCards.map((card: any) => (
                                          <div key={card.id} className="flex justify-between items-center p-2.5 bg-purple-50/50 rounded-xl border border-purple-100/50 text-xs">
                                            <div>
                                              <span className="font-bold text-purple-900">{card.term_name} Report Card</span>
                                              <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                                                Total Score: {parseFloat(card.total_marks_obtained).toFixed(0)}/{parseFloat(card.total_marks_possible).toFixed(0)} ({parseFloat(card.percentage).toFixed(1)}%)
                                              </p>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">Grade: {card.grade_awarded}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {currentMarks.length > 0 ? (
                                      <div className="overflow-x-auto border border-slate-100 rounded-lg bg-white">
                                        <table className="min-w-full divide-y divide-slate-100">
                                          <thead className="bg-slate-50/50 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                              <th className="px-3 py-1.5 text-left">Subject</th>
                                              <th className="px-3 py-1.5 text-left">Exam</th>
                                              <th className="px-3 py-1.5 text-center">Score</th>
                                              <th className="px-3 py-1.5 text-center">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                            {currentMarks.map((mark: any, midx: number) => (
                                              <tr key={mark.id || midx} className="hover:bg-slate-50/20">
                                                <td className="px-3 py-2 font-bold text-slate-800">{mark.subject}</td>
                                                <td className="px-3 py-2 text-slate-500">{mark.exam_name}</td>
                                                <td className="px-3 py-2 text-center font-mono font-bold">
                                                  {mark.is_absent ? (
                                                    <span className="text-red-500">Absent</span>
                                                  ) : (
                                                    `${parseFloat(mark.marks_obtained).toFixed(0)}/${parseFloat(mark.total_marks).toFixed(0)}`
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                  {mark.is_absent ? (
                                                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Abs</span>
                                                  ) : mark.is_pass ? (
                                                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Pass</span>
                                                  ) : (
                                                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Fail</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No subject marks recorded for Grade {selectedGrade}.</p>
                                    )}
                                  </div>

                                  {/* 3. Conduct & Remarks */}
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150">
                                    <h5 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <Trophy size={13} className="text-yellow-500" /> Behavior, Remarks & Achievements
                                    </h5>
                                    {currentRemarks.length > 0 ? (
                                      <div className="relative border-l border-slate-200 pl-3 ml-1.5 space-y-3">
                                        {currentRemarks.map((rem: any, ridx: number) => {
                                          const isNegative = rem.points && rem.points < 0;
                                          const isPositive = rem.points && rem.points > 0;
                                          return (
                                            <div key={rem.id || ridx} className="relative text-xs">
                                              <div className={`absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
                                                isNegative ? 'bg-red-500' :
                                                isPositive ? 'bg-green-500' :
                                                rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-500' :
                                                'bg-blue-500'
                                              }`} />
                                              <div className={`p-2.5 rounded-lg border ${
                                                isNegative ? 'bg-red-50/50 border-red-100' :
                                                isPositive ? 'bg-green-50/50 border-green-100' :
                                                rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-50/20 border-yellow-100' :
                                                'bg-white border-slate-200'
                                              }`}>
                                                <div className="font-bold text-slate-800">{rem.title || rem.record_type}</div>
                                                {rem.description && <p className="text-slate-500 text-[10px] mt-0.5">{rem.description}</p>}
                                                <div className="flex justify-between items-center text-[9px] text-slate-400 mt-2">
                                                  <span>By: <span className="font-semibold text-slate-500">{rem.teacher_name || 'System'}</span></span>
                                                  {rem.points && (
                                                    <span className={`font-mono font-bold ${isNegative ? 'text-red-650' : 'text-green-650'}`}>
                                                      {rem.points > 0 ? `+${rem.points}` : rem.points} Karma
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No remarks logged for Grade {selectedGrade}.</p>
                                    )}
                                  </div>

                                  {/* 4. Health Visits */}
                                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150">
                                    <h5 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                      <Heart size={13} className="text-red-500" /> Infirmary & Clinic Visits
                                    </h5>
                                    {currentHealth.length > 0 ? (
                                      <div className="space-y-2">
                                        {currentHealth.map((visit: any, vidx: number) => (
                                          <div key={visit.id || vidx} className="p-2.5 bg-white border border-slate-100 rounded-lg flex gap-2 text-xs">
                                            <div className="text-red-500 bg-red-50 p-1.5 rounded-lg h-7 w-7 flex items-center justify-center shrink-0">
                                              <Thermometer size={14} />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              <div className="flex justify-between">
                                                <span className="font-bold text-slate-800">{visit.symptom}</span>
                                                <span className="text-[9px] text-slate-400">{new Date(visit.visit_date).toLocaleDateString()}</span>
                                              </div>
                                              <p className="text-[10px] text-slate-500">Treatment: {visit.treatment_given}</p>
                                              <div className="flex justify-between items-center text-[9px] text-slate-400">
                                                <span>Nurse: <span className="font-semibold text-slate-500">{visit.recorded_by}</span></span>
                                                {visit.sent_home && <span className="bg-orange-100 text-orange-850 px-1 py-0.2 rounded font-black uppercase text-[8px]">Sent Home</span>}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No infirmary visit records for Grade {selectedGrade}.</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-16">
                              <GraduationCap size={40} className="opacity-40 animate-pulse text-purple-600" />
                              <p className="text-xs font-semibold">Select a grade from the timeline track to load details.</p>
                            </div>
                          )}
                        </div>

                        {/* Right Panel: Discrete draggable vertical selector track */}
                        <div className="bg-slate-50/70 py-6 flex flex-col items-center select-none relative border-l border-slate-150">
                          <div 
                            ref={trackRef}
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleTouchStart}
                            className="relative flex-1 w-1 bg-slate-200 rounded-full cursor-ns-resize hover:bg-slate-300 transition-colors py-2 flex flex-col items-center justify-between"
                          >
                            {sortedGrades.length > 1 && selectedGrade && (
                              <div 
                                className="absolute top-0 bottom-0 left-0 right-0 rounded-full bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500"
                                style={{
                                  top: `${((sortedGrades.length - 1 - sortedGrades.indexOf(selectedGrade)) / (sortedGrades.length - 1)) * 100}%`,
                                  bottom: '0%'
                                }}
                              />
                            )}

                            {sortedGrades.map((g: string, i: number) => {
                              const isActive = g === selectedGrade;
                              const yPosPercent = sortedGrades.length > 1 
                                ? ((sortedGrades.length - 1 - i) / (sortedGrades.length - 1)) * 100 
                                : 50;

                              return (
                                <button
                                  key={g}
                                  onClick={() => setSelectedGrade(g)}
                                  style={{ top: `${yPosPercent}%` }}
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 left-1/2 w-5.5 h-5.5 rounded-full flex items-center justify-center font-bold text-[9px] shadow-sm transition-all duration-300 border-2 ${
                                    isActive 
                                      ? 'bg-purple-600 border-white text-white scale-110 ring-2 ring-purple-300/40 z-25' 
                                      : 'bg-white border-slate-300 text-slate-500 hover:border-purple-400 hover:text-purple-650 scale-100 z-20'
                                  }`}
                                >
                                  {g === 'LKG' ? 'L' : g === 'UKG' ? 'U' : g}
                                </button>
                              );
                            })}

                            {sortedGrades.length > 0 && selectedGrade && (
                              <div
                                style={{ 
                                  top: `${sortedGrades.length > 1 ? ((sortedGrades.length - 1 - sortedGrades.indexOf(selectedGrade)) / (sortedGrades.length - 1)) * 100 : 50}%`,
                                  cursor: 'ns-resize'
                                }}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 left-1/2 w-7 h-7 rounded-full border-2 border-white shadow-lg bg-gradient-to-tr from-purple-600 to-indigo-650 z-30 transition-transform flex items-center justify-center text-white text-[9px] font-black ${
                                  isDragging ? 'scale-110 shadow-purple-500/50' : 'scale-100 shadow-gray-400'
                                }`}
                              >
                                {selectedGrade === 'LKG' ? 'L' : selectedGrade === 'UKG' ? 'U' : selectedGrade}
                              </div>
                            )}
                          </div>
                          <div className="text-[8px] uppercase font-black text-slate-400 mt-2 tracking-wider text-center select-none">
                            Timeline
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-16 text-center text-slate-400 bg-slate-50/50">
                        <GraduationCap size={48} className="mx-auto mb-3 opacity-30 text-purple-600 animate-pulse" />
                        <h5 className="font-bold text-slate-700 mb-1">No Academic Timeline Data</h5>
                        <p className="text-[11px] text-slate-500">Timeline data will populate as marks and conduct scores are recorded in their classes.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
              <button 
                onClick={() => { setIsDetailOpen(false); setDetailStudent(null); }}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl transition-all"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
