'use client';

import { useEffect, useState, useRef } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useRouter } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import { 
  ArrowLeft, Mail, Phone, User, Shield, Edit, 
  AlertTriangle, Star, ThumbsUp, Plus, X, 
  Thermometer, Heart, Activity, Clock, Loader2,
  MapPin, Calendar, CheckCircle, GraduationCap, ChevronDown, ChevronUp,
  Trophy, Award, Medal, FileText, TrendingUp, Users, Download,
  Eye, EyeOff
} from 'lucide-react';

export default function StudentProfilePage() {
  const router = useRouter();

  // Allowed Tabs for Student Portal Profile
  const allowedTabs = [
    { id: 'journey', label: 'Journey' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'profile', label: 'Profile' },
    { id: 'health', label: 'Health' }
  ];

  const [activeTab, setActiveTab] = useState<'journey' | 'achievements' | 'behavior' | 'profile' | 'health'>('journey');

  // --- STATE ---
  const [studentId, setStudentId] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [timeline, setTimeline] = useState<any[]>([]); 
  const [karmaScore, setKarmaScore] = useState<any>(null);
  const [healthProfile, setHealthProfile] = useState<any>(null);
  const [clinicVisits, setClinicVisits] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [timelineMarks, setTimelineMarks] = useState<any[]>([]);
  const [timelineRemarks, setTimelineRemarks] = useState<any[]>([]);
  const [timelineHealthLogs, setTimelineHealthLogs] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [crossSchoolHistory, setCrossSchoolHistory] = useState<any[]>([]);
  const [selectedTenure, setSelectedTenure] = useState<any>(null);
  const [dynamicAttendance, setDynamicAttendance] = useState<any>(null);

  // 1. Fetch Logged In Student /me Details
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/students/me/');
        if (res.data && res.data.id) {
          setStudentId(res.data.id);
          setStudent(res.data);
        }
      } catch (err) {
        console.error("Failed loading student info:", err);
      } flexily: {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  // 2. Fetch All Profile Data when Student ID is resolved
  useEffect(() => {
    if (!studentId) return;

    fetchJourneyData(studentId);
    fetchBehaviorData(studentId);
    fetchHealthData(studentId);
    fetchAchievementsData(studentId);
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !selectedGrade) return;
    
    const fetchDynamicAttendance = async () => {
      try {
        const res = await api.get(`/attendance/student_grade_stats/?student_id=${studentId}&grade=${selectedGrade}`);
        setDynamicAttendance(res.data);
      } catch (e) {
        console.warn("Failed to fetch dynamic attendance stats", e);
        setDynamicAttendance(null);
      }
    };
    
    fetchDynamicAttendance();
  }, [studentId, selectedGrade]);

  const fetchBehaviorData = async (sid: string) => {
    try {
      const badRes = await api.get(`/discipline/?student=${sid}`);
      const badRecords = (badRes.data?.results || badRes.data || []).map((r: any) => ({ 
        id: `bad-${r.id}`,
        category: r.category ? r.category.replace('_', ' ') : 'INCIDENT', 
        description: r.description,
        date: r.incident_date,
        type: 'BAD',
        severity: r.severity,
        points_deducted: r.points_deducted ?? (r.severity === 'CRITICAL' ? 50 : r.severity === 'MEDIUM' ? 15 : 5)
      }));

      
      let goodRecords: any[] = [];
      try {
        const goodRes = await api.get(`/discipline/karma_history/?student=${sid}`);
        goodRecords = (goodRes.data?.results || goodRes.data || []).map((r: any) => ({
          id: `good-${r.id}`,
          category: 'POSITIVE KARMA',
          description: r.title, 
          date: r.date,
          type: 'GOOD',
          points: r.points
        }));
      } catch (e) { console.warn("Karma history fetch failed"); }
      
      const combined = [...badRecords, ...goodRecords].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTimeline(combined);
      
      api.get(`/discipline/scorecard/?student=${sid}`).then(res => setKarmaScore(res.data));

    } catch (e) { console.error(e); }
  };

  const fetchHealthData = async (sid: string) => {
    try {
      const profileRes = await api.get(`/health/profiles/?student=${sid}`);
      const profiles = profileRes.data?.results || profileRes.data || [];
      setHealthProfile(Array.isArray(profiles) ? profiles[0] : profiles || null);
      const visitsRes = await api.get(`/health/visits/?student=${sid}`);
      const visits = visitsRes.data?.results || visitsRes.data || [];
      setClinicVisits(Array.isArray(visits) ? visits : []);
    } catch (e) { console.error(e); }
  };

  const fetchAchievementsData = async (sid: string, suidVal?: string) => {
    try {
      const suid = suidVal || student?.suid;
      const [awardsRes, yearlyAwardsRes, artifactsRes] = await Promise.all([
        api.get(`/achievements/awards/?student=${sid}`).catch(() => ({ data: [] })),
        api.get(`/achievements/yearly-awards/?student=${sid}`).catch(() => ({ data: [] })),
        api.get(`/achievements/artifacts/?student=${sid}`).catch(() => ({ data: [] }))
      ]);

      let awardsList = awardsRes.data?.results || awardsRes.data || [];
      let yearlyList = yearlyAwardsRes.data?.results || yearlyAwardsRes.data || [];
      const artifactsList = artifactsRes.data?.results || artifactsRes.data || [];

      // Fallback: If empty, try fetching by SUID if suid is available
      if (suid && (!Array.isArray(awardsList) || awardsList.length === 0)) {
        try {
          const fallbackRes = await api.get(`/achievements/awards/?student=${suid}`);
          const fallbackData = fallbackRes.data?.results || fallbackRes.data || [];
          if (Array.isArray(fallbackData) && fallbackData.length > 0) awardsList = fallbackData;
        } catch (e) {}
      }

      if (suid && (!Array.isArray(yearlyList) || yearlyList.length === 0)) {
        try {
          const fallbackRes = await api.get(`/achievements/yearly-awards/?student=${suid}`);
          const fallbackData = fallbackRes.data?.results || fallbackRes.data || [];
          if (Array.isArray(fallbackData) && fallbackData.length > 0) yearlyList = fallbackData;
        } catch (e) {}
      }

      // Combine awards (legacy Achievement) & yearly-awards (StudentYearlyAward) so all recorded achievements appear!
      const combinedAchievements = [
        ...(Array.isArray(awardsList) ? awardsList : []),
        ...(Array.isArray(yearlyList) ? yearlyList : [])
      ];

      // Remove duplicate items by id
      const uniqueAchievements = Array.from(new Map(combinedAchievements.map((item: any) => [item.id, item])).values());

      setAchievements(uniqueAchievements);
      setArtifacts(Array.isArray(artifactsList) ? artifactsList : []);
    } catch (e) { console.error("Failed to fetch achievements data:", e); }
  };


  const fetchJourneyData = async (sid: string) => {
    try {
      const enrollmentsRes = await api.get(`/enrollments/?student=${sid}`);
      const enrollments = enrollmentsRes.data?.results || enrollmentsRes.data || [];
      setEnrollmentHistory(Array.isArray(enrollments) ? enrollments : []);
      
      try {
        const historyRes = await api.get(`/students/${sid}/history/`);
        const history = historyRes.data?.results || historyRes.data || [];
        setStudentHistory(Array.isArray(history) ? history : []);
      } catch (e) { console.warn("History fetch failed", e); }

      try {
        const crossSchoolRes = await api.get(`/students/${sid}/cross_school_history/`);
        const crossSchoolData = crossSchoolRes.data?.results || crossSchoolRes.data || [];
        setCrossSchoolHistory(Array.isArray(crossSchoolData) ? crossSchoolData : []);
      } catch (e) { console.warn("Cross school history fetch failed", e); }

      try {
        const reportCardsRes = await api.get(`/academics/report-cards/for_student/?student_id=${sid}`);
        const reportCardsData = reportCardsRes.data?.results || reportCardsRes.data || [];
        setReportCards(Array.isArray(reportCardsData) ? reportCardsData : []);
      } catch (e) { console.warn("Report cards fetch failed", e); }
      
      try {
        const guardiansRes = await api.get(`/students/${sid}/guardians/`);
        const guardiansList = guardiansRes.data?.results || guardiansRes.data || [];
        setGuardians(Array.isArray(guardiansList) ? guardiansList : []);
      } catch (e) { console.warn("Guardians fetch failed", e); }
      
      let suid = '';
      try {
        const profileRes = await api.get(`/students/${sid}/profile/`);
        setFullProfile(profileRes.data);
        suid = profileRes.data.suid;
      } catch (e) { console.warn("Full profile fetch failed", e); }

      if (!suid && student) {
        suid = student.suid;
      }

      if (suid) {
        try {
          const marksRes = await api.get(`/timeline/marks/?student_suid=${suid}`);
          const marksList = marksRes.data?.results || marksRes.data || [];
          setTimelineMarks(Array.isArray(marksList) ? marksList : []);
        } catch (e) { console.error("Timeline marks fetch failed", e); }

        try {
          const remarksRes = await api.get(`/timeline/remarks/?student_suid=${suid}`);
          const remarksList = remarksRes.data?.results || remarksRes.data || [];
          setTimelineRemarks(Array.isArray(remarksList) ? remarksList : []);
        } catch (e) { console.error("Timeline remarks fetch failed", e); }

        try {
          const healthRes = await api.get(`/timeline/health/?student_suid=${suid}`);
          const healthList = healthRes.data?.results || healthRes.data || [];
          setTimelineHealthLogs(Array.isArray(healthList) ? healthList : []);
        } catch (e) { console.error("Timeline health fetch failed", e); }
      }
      
      fetchAchievementsData(sid);
    } catch (e) { console.error(e); }
  };

  // --- MULTI-SCHOOL ACADEMIC JOURNEY CALCULATIONS & DRAGGABLE TIMELINE ---
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const schoolTenures = (() => {
    const list = [...crossSchoolHistory];
    const isStudentActive = student && student.status !== 'ALUMNI' && student.status !== 'WITHDRAWN' && student.status !== 'TRANSFERRED' && student.status !== 'GRADUATED';
    const hasActive = list.some((t: any) => t.status === 'ACTIVE');
    if (!hasActive && isStudentActive) {
      list.push({
        id: 'active-tenure',
        school_name: student.school_name || student.school?.name || 'Current School',
        status: 'ACTIVE',
        admitted_date: student.admission_date || '',
        transferred_date: null,
        grade_from: student.grade_config?.grade_name || '',
        grade_to: student.grade_config?.grade_name || '',
        timeline_snapshot: {
          marks: timelineMarks,
          remarks: timelineRemarks,
          health: timelineHealthLogs,
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
              health: timelineHealthLogs,
              history: studentHistory,
              report_cards: reportCards
            }
          };
        }
        return t;
      });
    }
    return list;
  })();

  const currentGrade = student?.grade || (student?.current_class && student.current_class !== 'Unassigned' ? student.current_class.split('-')[0] : null);

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
    if (student?.grade_config?.grade_name) {
      grades.add(student.grade_config.grade_name);
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

  const sortedGrades = (() => {
    const gradesSet = new Set<string>();
    if (student?.grade_config?.grade_name) gradesSet.add(student.grade_config.grade_name);
    if (currentGrade) gradesSet.add(currentGrade);

    schoolTenures.forEach((t: any) => {
      if (t.grade_from) gradesSet.add(t.grade_from);
      if (t.grade_to) gradesSet.add(t.grade_to);
      const snap = t.timeline_snapshot || {};
      if (Array.isArray(snap.history)) snap.history.forEach((h: any) => { if (h.grade_name) gradesSet.add(h.grade_name); });
      if (Array.isArray(snap.marks)) snap.marks.forEach((m: any) => { if (m.grade) gradesSet.add(m.grade); });
    });

    const allGrades = Array.from(gradesSet).filter(Boolean);
    let max = 0;
    allGrades.forEach(g => {
      const num = parseInt(g, 10);
      if (!isNaN(num) && num > max) max = num;
    });

    const list: string[] = [];
    if (allGrades.includes('LKG')) list.push('LKG');
    if (allGrades.includes('UKG')) list.push('UKG');
    const endGrade = max || 10;
    for (let i = 1; i <= endGrade; i++) {
      list.push(i.toString());
    }
    return list;
  })();

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
  }, [crossSchoolHistory, studentHistory, student, timelineMarks, timelineRemarks, timelineHealthLogs, reportCards]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="animate-spin mr-2" /> Loading Student Profile...
      </div>
    );
  }

  if (!studentId || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-bold">
        Student profile details not found.
      </div>
    );
  }

  const displayName = student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || "Student";
  const displayEmail = student.email || "No Email Provided";
  const displayPhone = student.phone_number || "No Phone Provided";
  const currentClass = student.current_class || (student.grade_config?.grade_name ? `Grade ${student.grade_config.grade_name}` : "Assigned Class");

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      {/* 1. TOP HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <User size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Student Profile</h1>
              <p className="text-xs text-gray-400">Official Academic & Institutional Record</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
              SUID: {student.suid}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* 2. STUDENT HERO CARD */}
        <div className="bg-white rounded-3xl p-8 border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left relative overflow-hidden">
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center font-black text-4xl shadow-lg shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          
          <div className="space-y-2 flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{displayName}</h2>
                <div className="text-sm font-bold text-indigo-600 flex items-center justify-center md:justify-start gap-2 mt-1">
                  <GraduationCap size={16} /> {currentClass}
                  {student.section_letter && <span className="text-gray-400">| Section {student.section_letter}</span>}
                </div>
              </div>

              {karmaScore && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-3 rounded-2xl border border-purple-100 flex items-center gap-3 shrink-0 self-center md:self-auto">
                  <Star className="text-purple-600 fill-purple-600" size={24} />
                  <div>
                    <div className="text-[10px] font-black text-purple-600 uppercase tracking-wider">Karma Balance</div>
                    <div className="text-lg font-black text-purple-950">{karmaScore.net_score ?? 100} pts</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 gap-1">
                <CheckCircle size={13} /> Active Admission
              </span>
              {student.roll_number && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 font-mono">
                  Roll #{student.roll_number}
                </span>
              )}
              {student.blood_group && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-800 gap-1">
                  <Heart size={12} fill="currentColor" /> {student.blood_group}
                </span>
              )}
            </div>
            
            <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-4 text-xs font-semibold text-gray-500 border-t border-gray-100 mt-4">
              <div className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400" /> {displayEmail}</div>
              <div className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400" /> {displayPhone}</div>
              {student.school_name && (
                <div className="flex items-center gap-1.5"><GraduationCap size={14} className="text-indigo-500" /> {student.school_name}</div>
              )}
            </div>
          </div>
        </div>

        {/* 3. NAVIGATION TABS */}
        <div className="flex border-b border-gray-200 gap-8 overflow-x-auto scrollbar-none">
          {allowedTabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            
          {/* 1. JOURNEY TAB - Multi-School Academic Journey */}
          {activeTab === 'journey' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-2xl text-white shadow-xl">
                <h2 className="text-3xl font-bold mb-2">🎓 Student Journey</h2>
                <p className="text-purple-100">
                  {schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length > 0 
                    ? `${schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length} years of academic excellence`
                    : `Currently in ${currentClass}`
                  }
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                  <div className="bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                    🏆 {achievements.length} Achievements & Awards
                  </div>
                  <div className="bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                    📜 {reportCards.length} Report Cards
                  </div>
                  <div className="bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                    ⭐ {karmaScore?.net_score ?? 100} Karma Balance
                  </div>
                </div>
              </div>

              {/* Personal Info & Guardians - Compact Row */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Personal Info */}
                {(fullProfile || student) && (
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
                      <User size={16} className="text-indigo-600" /> Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-gray-400 block font-semibold">Admission No:</span> <span className="font-bold text-gray-900 block mt-0.5">{fullProfile?.admission_number || student?.admission_number || '--'}</span></div>
                      <div><span className="text-gray-400 block font-semibold">DOB:</span> <span className="font-bold text-gray-900 block mt-0.5">{fullProfile?.date_of_birth || student?.date_of_birth || '--'}</span></div>
                      <div><span className="text-gray-400 block font-semibold">Gender:</span> <span className="font-bold text-gray-900 block mt-0.5">{student?.gender === 'M' ? 'Male' : student?.gender === 'F' ? 'Female' : '--'}</span></div>
                      <div><span className="text-gray-400 block font-semibold">Blood Group:</span> <span className="font-bold text-gray-900 block mt-0.5">{fullProfile?.blood_group || student?.blood_group || '--'}</span></div>
                    </div>
                  </div>
                )}
                
                {/* Guardians */}
                {guardians.length > 0 && (
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
                      👨‍👩‍👧 Parents / Guardians
                    </h3>
                    <div className="space-y-2.5">
                      {guardians.map((g: any) => (
                        <div key={g.id || g.name} className="flex items-center gap-3 text-xs">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-xs shrink-0">{g.name?.[0] || 'G'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{g.name || g.guardian_name}</div>
                            <div className="text-gray-400 text-[10px] uppercase font-semibold">{g.relationship || 'Guardian'}</div>
                          </div>
                          <span className="text-gray-500 font-mono text-[11px] shrink-0">{g.phone || g.phone_number || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Multi-School Academic Timeline Selector */}
              <div className="bg-white rounded-3xl border border-gray-200/80 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-100 bg-gray-50/75 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-gray-900 flex items-center gap-2 text-base">
                      <GraduationCap size={20} className="text-purple-600" /> Multi-School Academic Journey
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Drag or click a grade node on the timeline track (right) to view subject marks, report cards, teacher remarks & attendance.</p>
                  </div>
                  {selectedGrade && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      Viewing: Grade {selectedGrade}
                    </span>
                  )}
                </div>

                {schoolTenures.length > 0 ? (
                  <div className="grid grid-cols-[1fr_180px] gap-0 min-h-[480px]">
                    {/* Left Panel: Grade Details */}
                    <div className="p-6 border-r border-gray-100 space-y-6 overflow-y-auto max-h-[650px]">
                      {selectedGrade ? (
                        (() => {
                          const currentMarks = selectedTenure?.timeline_snapshot?.marks || [];
                          const currentRemarks = selectedTenure?.timeline_snapshot?.remarks || [];
                          const currentHealth = selectedTenure?.timeline_snapshot?.health || [];
                          const currentHistory = selectedTenure?.timeline_snapshot?.history || [];
                          const currentReportCards = selectedTenure?.timeline_snapshot?.report_cards || [];
                          
                          return (
                            <div key={`${selectedTenure?.school_name}-${selectedGrade}`} className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                              
                              {/* Year-End Performance Summary */}
                              {currentHistory.length > 0 && (
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100/80 space-y-4 shadow-sm">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h5 className="font-black text-indigo-900 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        🎓 Year-End Performance Summary
                                      </h5>
                                      <p className="text-[10px] text-indigo-600 font-bold">Academic Year: {currentHistory[0].academic_year_name}</p>
                                    </div>
                                    {currentHistory[0].overall_grade && (
                                      <span className="px-3 py-1 bg-indigo-600 text-white font-black rounded-full text-xs shadow-sm">
                                        Grade {currentHistory[0].overall_grade}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                                    {currentHistory[0].percentage !== null && currentHistory[0].percentage !== undefined && (
                                      <div className="bg-white p-2.5 rounded-xl border border-indigo-50/50">
                                        <div className="font-black text-slate-800 text-sm">{parseFloat(currentHistory[0].percentage).toFixed(1)}%</div>
                                        <div className="text-[9px] uppercase font-bold text-slate-400">Percentage</div>
                                      </div>
                                    )}
                                    {currentHistory[0].total_marks !== null && currentHistory[0].total_marks !== undefined && (
                                      <div className="bg-white p-2.5 rounded-xl border border-indigo-50/50">
                                        <div className="font-black text-slate-800 text-sm">{parseFloat(currentHistory[0].total_marks).toFixed(0)}</div>
                                        <div className="text-[9px] uppercase font-bold text-slate-400">Total Marks</div>
                                      </div>
                                    )}
                                    {currentHistory[0].class_rank !== null && currentHistory[0].class_rank !== undefined && (
                                      <div className="bg-white p-2.5 rounded-xl border border-indigo-50/50">
                                        <div className="font-black text-slate-800 text-sm">#{currentHistory[0].class_rank}</div>
                                        <div className="text-[9px] uppercase font-bold text-slate-400">Class Rank</div>
                                      </div>
                                    )}
                                    {currentHistory[0].grade_rank !== null && currentHistory[0].grade_rank !== undefined && (
                                      <div className="bg-white p-2.5 rounded-xl border border-indigo-50/50">
                                        <div className="font-black text-slate-800 text-sm">#{currentHistory[0].grade_rank}</div>
                                        <div className="text-[9px] uppercase font-bold text-slate-400">Grade Rank</div>
                                      </div>
                                    )}
                                  </div>

                                  {currentHistory[0].teacher_remarks && (
                                    <div className="bg-white p-3 rounded-xl border border-indigo-100/50 text-xs">
                                      <span className="text-[10px] font-black text-indigo-900 block mb-1.5">✍️ Class Teacher's Remarks</span>
                                      <p className="text-slate-600 italic font-medium font-sans">"{currentHistory[0].teacher_remarks}"</p>
                                      {currentHistory[0].class_teacher_name && (
                                        <span className="text-[9px] text-slate-400 block mt-2 text-right">— {currentHistory[0].class_teacher_name}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 1. Attendance Statistics */}
                              <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
                                <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Calendar size={15} className="text-indigo-600" /> Attendance Statistics
                                </h4>
                                {(() => {
                                  const att = (() => {
                                    if (dynamicAttendance && dynamicAttendance.total_days > 0) {
                                      return dynamicAttendance;
                                    }
                                    const mWithAtt = currentMarks.find(
                                      (m: any) => m.grade === selectedGrade && m.attendance_percentage !== null && m.attendance_percentage !== undefined
                                    );
                                    if (mWithAtt) {
                                      return {
                                        percentage: parseFloat(mWithAtt.attendance_percentage || 0),
                                        days_present: mWithAtt.days_present || 0,
                                        total_days: mWithAtt.total_days || 0,
                                        days_absent: (mWithAtt.total_days || 0) - (mWithAtt.days_present || 0)
                                      };
                                    }
                                    const histMatch = currentHistory.find(
                                      (h: any) => h.grade_name === selectedGrade && h.attendance_percentage !== null && h.attendance_percentage !== undefined
                                    );
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

                                  if (!att) {
                                    return <p className="text-xs text-gray-400 italic">No attendance data logged for Grade {selectedGrade}.</p>;
                                  }

                                  return (
                                    <div className="space-y-4">
                                      {att.total_days > 0 && (
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                          <div className="bg-slate-50 p-2.5 rounded-xl">
                                            <div className="text-base font-black text-slate-900">{att.total_days}</div>
                                            <div className="text-[9px] uppercase font-bold text-slate-400">Total Days</div>
                                          </div>
                                          <div className="bg-emerald-50/60 p-2.5 rounded-xl">
                                            <div className="text-base font-black text-emerald-600">{att.days_present}</div>
                                            <div className="text-[9px] uppercase font-bold text-emerald-600">Present</div>
                                          </div>
                                          <div className="bg-rose-50/60 p-2.5 rounded-xl">
                                            <div className="text-base font-black text-rose-500">{att.days_absent}</div>
                                            <div className="text-[9px] uppercase font-bold text-rose-600">Absent</div>
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              att.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${att.percentage}%` }}
                                          />
                                        </div>
                                        <div className="flex justify-between items-center mt-2 text-xs">
                                          <span className="text-gray-400">Target: 75%</span>
                                          <span className="font-bold text-gray-700">{att.percentage.toFixed(1)}% Present</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* 2. Academic Performance & Report Cards */}
                              <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
                                <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <FileText size={15} className="text-indigo-600" /> Academic Results & Report Cards
                                </h4>
                                
                                {currentReportCards.filter((card: any) => card.grade_name === selectedGrade).length > 0 && (
                                  <div className="mb-4 space-y-3">
                                    {currentReportCards.filter((card: any) => card.grade_name === selectedGrade).map((card: any) => (
                                      <div key={card.id} className="flex justify-between items-center p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-indigo-950">{card.term_name} Report Card</span>
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Grade: {card.grade_awarded}</span>
                                          </div>
                                          <p className="text-xs text-indigo-700 font-semibold">
                                            Score: {parseFloat(card.total_marks_obtained).toFixed(0)}/{parseFloat(card.total_marks_possible).toFixed(0)} ({parseFloat(card.percentage).toFixed(1)}%) {card.rank && `| Rank: #${card.rank}`}
                                          </p>
                                        </div>
                                        {card.file_path && (
                                          <a
                                            href={getMediaUrl(card.file_path)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                                          >
                                            View PDF
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {currentMarks.filter((m: any) => m.grade === selectedGrade).length > 0 ? (
                                  <div className="overflow-x-auto border border-gray-150 rounded-xl">
                                    <table className="min-w-full divide-y divide-gray-150">
                                      <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        <tr>
                                          <th className="px-4 py-2.5 text-left">Subject</th>
                                          <th className="px-4 py-2.5 text-left">Exam</th>
                                          <th className="px-4 py-2.5 text-center">Score</th>
                                          <th className="px-4 py-2.5 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 text-xs font-medium text-slate-700">
                                        {currentMarks.filter((m: any) => m.grade === selectedGrade).map((mark: any, midx: number) => (
                                          <tr key={mark.id || midx} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-bold text-slate-900">{mark.subject}</td>
                                            <td className="px-4 py-3 text-slate-500">{mark.exam_name}</td>
                                            <td className="px-4 py-3 text-center font-mono font-bold">
                                              {mark.is_absent ? (
                                                <span className="text-rose-600">Absent</span>
                                              ) : (
                                                `${parseFloat(mark.marks_obtained).toFixed(0)}/${parseFloat(mark.total_marks).toFixed(0)}`
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              {mark.is_absent ? (
                                                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Absent</span>
                                              ) : mark.is_pass ? (
                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Pass</span>
                                              ) : (
                                                <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Fail</span>
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
                              <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
                                <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Trophy size={15} className="text-amber-500" /> Conduct, Achievements & Remarks
                                </h4>
                                {currentRemarks.filter((r: any) => r.grade === selectedGrade).length > 0 ? (
                                  <div className="relative border-l-2 border-slate-100 pl-4 ml-2 space-y-4">
                                    {currentRemarks.filter((r: any) => r.grade === selectedGrade).map((rem: any, ridx: number) => {
                                      const isNegative = rem.points && rem.points < 0;
                                      const isPositiveKarma = rem.points && rem.points > 0;
                                      
                                      return (
                                        <div key={rem.id || ridx} className="relative">
                                          <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                            isNegative ? 'bg-rose-500' :
                                            isPositiveKarma ? 'bg-emerald-500' : 'bg-indigo-500'
                                          }`} />
                                          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                                            <div className="font-bold text-slate-900 mb-1">{rem.title || rem.record_type}</div>
                                            {rem.description && <p className="text-slate-600 text-xs mt-1">{rem.description}</p>}
                                          </div>
                                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-semibold">
                                            <span>By: <span className="text-slate-600">{rem.teacher_name}</span></span>
                                            {rem.points && (
                                              <span className={`font-mono font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {rem.points > 0 ? `+${rem.points}` : rem.points} Karma
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">No conduct remarks logged for Grade {selectedGrade}.</p>
                                )}
                              </div>

                              {/* 4. Health Logs */}
                              <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm">
                                <h4 className="font-black text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Heart size={15} className="text-pink-600 fill-pink-600" /> Infirmary Visits
                                </h4>
                                {currentHealth.filter((v: any) => v.grade === selectedGrade).length > 0 ? (
                                  <div className="space-y-3">
                                    {currentHealth.filter((v: any) => v.grade === selectedGrade).map((visit: any, vidx: number) => (
                                      <div key={visit.id || vidx} className="p-3 bg-pink-50/30 border border-pink-100 rounded-xl flex gap-3 text-xs">
                                        <div className="text-pink-600 bg-pink-50 p-2 rounded-lg h-9 w-9 flex items-center justify-center shrink-0">
                                          <Thermometer size={18} />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <div className="flex justify-between">
                                            <span className="font-bold text-gray-900">{visit.symptom}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(visit.visit_date).toLocaleDateString()}</span>
                                          </div>
                                          <p className="text-xs text-gray-500">Treatment: {visit.treatment_given}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 italic">No clinic visits recorded for Grade {selectedGrade}.</p>
                                )}
                              </div>

                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                          <GraduationCap size={48} className="text-purple-400 mb-2 animate-bounce" />
                          <p className="text-xs font-bold">Select a grade on the right to browse history details.</p>
                        </div>
                      )}
                    </div>

                    {/* Right Side: Draggable vertical timeline selector */}
                    <div className="bg-gray-50/70 py-10 flex flex-col items-center select-none relative border-l border-gray-150">
                      <div 
                        ref={trackRef}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        className="relative flex-1 w-1.5 bg-gray-200 rounded-full cursor-ns-resize hover:bg-gray-300 transition-colors py-2 flex flex-col items-center justify-between"
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
                              className={`absolute -translate-x-1/2 -translate-y-1/2 left-1/2 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shadow-sm transition-all duration-300 border-2 ${
                                isActive 
                                  ? 'bg-purple-600 border-white text-white scale-125 ring-4 ring-purple-300/40 z-25' 
                                  : 'bg-white border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 scale-100 z-20'
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
                            className={`absolute -translate-x-1/2 -translate-y-1/2 left-1/2 w-8 h-8 rounded-full border-2 border-white shadow-lg bg-gradient-to-tr from-purple-600 to-indigo-600 z-30 transition-transform flex items-center justify-center text-white text-[10px] font-black ${
                              isDragging ? 'scale-110 shadow-purple-500/50' : 'scale-100 shadow-gray-400'
                            }`}
                          >
                            {selectedGrade === 'LKG' ? 'L' : selectedGrade === 'UKG' ? 'U' : selectedGrade}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] uppercase font-extrabold text-gray-400 mt-4 tracking-widest text-center px-1 select-none">
                        Timeline
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-16 text-center text-gray-400 bg-gray-50/50">
                    <GraduationCap size={56} className="mx-auto mb-4 opacity-25 text-purple-600 animate-pulse" />
                    <h4 className="font-bold text-gray-700 mb-1">No Academic Timeline Data</h4>
                    <p className="text-xs text-gray-500">Timeline data will populate automatically as marks, conduct, and attendance are recorded.</p>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-5 rounded-2xl">
                <p className="text-xs text-blue-900 font-semibold leading-relaxed">
                  💡 <strong>Forever Accessible:</strong> This complete journey - from first day to graduation - is permanently stored and accessible to the student, family, and authorized school staff. Every achievement, every milestone.
                </p>
              </div>
            </div>
          )}

          {/* 2. ACHIEVEMENTS TAB */}
          {activeTab === 'achievements' && (
            <div className="bg-white rounded-3xl p-8 border border-gray-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                  <Trophy className="text-yellow-500 fill-yellow-500" size={22} /> Achievements, Awards & Certificates
                </h3>
                <span className="px-3.5 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-full">
                  Total: {achievements.length} Recorded
                </span>
              </div>

              {achievements && achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {achievements.map((ach: any) => (
                    <div key={ach.id} className="p-6 bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-2xl border border-amber-150 shadow-sm space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-800 uppercase bg-amber-100 px-3 py-1 rounded-full">
                            {ach.category || ach.award_type || 'CURRICULAR'}
                          </span>
                          {(ach.date_awarded || ach.event_date) && (
                            <span className="text-xs font-semibold text-gray-400">
                              {new Date(ach.date_awarded || ach.event_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-base">{ach.title || ach.description}</h4>
                        {ach.description && ach.title && (
                          <p className="text-xs text-gray-600">{ach.description}</p>
                        )}
                        {ach.issued_by && (
                          <p className="text-xs text-gray-500"><span className="font-semibold">Issued By:</span> {ach.issued_by}</p>
                        )}
                      </div>
                      {ach.certificate_image && (
                        <div className="pt-2 border-t border-amber-100">
                          <a 
                            href={getMediaUrl(ach.certificate_image)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            <Download size={14} /> View Certificate Proof
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                  <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-bold">No achievements recorded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Awards and competitive recognitions will appear here.</p>
                </div>
              )}
            </div>
          )}

          {/* 3. BEHAVIOR TAB */}
          {activeTab === 'behavior' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-gray-200/80 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                    <Star className="text-purple-600 fill-purple-600" size={22} /> Karma & Conduct History
                  </h3>
                  {karmaScore && (
                    <div className="text-right">
                      <div className="text-xs text-gray-400 font-bold uppercase">Net Conduct Score</div>
                      <div className="text-2xl font-black text-purple-900">{karmaScore.net_score ?? 100} pts</div>
                    </div>
                  )}
                </div>

                {timeline && timeline.length > 0 ? (
                  <div className="space-y-4">
                    {timeline.map((item: any) => (
                      <div 
                        key={item.id} 
                        className={`p-5 rounded-2xl border flex items-start justify-between gap-4 ${
                          item.type === 'GOOD' 
                          ? 'bg-emerald-50/50 border-emerald-150 text-emerald-950' 
                          : 'bg-red-50/50 border-red-150 text-red-950'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              item.type === 'GOOD' ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                            }`}>
                              {item.category}
                            </span>
                            <span className="text-xs text-gray-400">{item.date}</span>
                          </div>
                          <p className="font-bold text-sm text-gray-900">{item.description}</p>
                        </div>

                        <div className={`font-black text-base shrink-0 ${item.type === 'GOOD' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {item.type === 'GOOD' ? `+${item.points}` : `-${item.points_deducted}`} pts
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                    <Star size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold">Clean Conduct Record</p>
                    <p className="text-xs text-gray-400 mt-1">Positive karma awards and discipline records will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-3xl border border-gray-200/80 p-8 grid md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-lg">
                  <User size={20} className="text-indigo-600"/> Personal & Academic Details
                </h3>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Middle Name</dt>
                    <dd className="font-bold text-gray-900">{student.middle_name || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Gender</dt>
                    <dd className="font-bold text-gray-900">{student.gender === 'F' ? 'Female' : student.gender === 'M' ? 'Male' : student.gender || "Standard"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Date of Birth</dt>
                    <dd className="font-bold text-gray-900">{student.date_of_birth || "Not set"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Roll Number</dt>
                    <dd className="font-bold text-gray-900">{student.roll_number || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Admission Date</dt>
                    <dd className="font-bold text-gray-900">{student.admission_date || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Category</dt>
                    <dd className="font-bold text-gray-900">{student.category || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Religion</dt>
                    <dd className="font-bold text-gray-900">{student.religion || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Mother Tongue</dt>
                    <dd className="font-bold text-gray-900">{student.mother_tongue || "--"}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-6">
                <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-lg">
                  <MapPin size={20} className="text-indigo-600"/> Address & Location Details
                </h3>
                <dl className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Nationality</dt>
                    <dd className="font-bold text-gray-900">{student.nationality || "Indian"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Birth Place</dt>
                    <dd className="font-bold text-gray-900">{student.birth_place || "--"}</dd>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-gray-500 font-semibold">Residential Address</dt>
                    <dd className="font-bold text-gray-900 text-right">
                      {student.address_line1 || student.city || student.state ? (
                        <>
                          {student.address_line1 || ''} {student.address_line2 ? `, ${student.address_line2}` : ''}<br />
                          {student.city || ''}, {student.state || ''} - {student.pincode || ''}
                        </>
                      ) : (
                        student.address || "--"
                      )}
                    </dd>
                  </div>
                </dl>

                {guardians && guardians.length > 0 && (
                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <h4 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
                      <Users size={18} className="text-indigo-600" /> Parent / Guardian Information
                    </h4>
                    <div className="space-y-3">
                      {guardians.map((g: any, i: number) => (
                        <div key={g.id || i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-black text-gray-900 text-sm">{g.name || g.guardian_name}</div>
                            <div className="text-gray-400 font-bold uppercase">{g.relationship || 'Guardian'}</div>
                          </div>
                          <div className="text-right text-gray-600 font-semibold">
                            <div>{g.phone || g.phone_number || '-'}</div>
                            <div>{g.email || '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {fullProfile?.documents && fullProfile.documents.length > 0 && (
                <div className="mt-8 pt-8 border-t border-gray-100 md:col-span-2">
                  <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-lg mb-6">
                    <FileText size={20} className="text-indigo-600"/> Uploaded Official Documents
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fullProfile.documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3 group hover:border-indigo-300 transition-all">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-0.5">{doc.document_type.replace(/_/g, ' ')}</div>
                          <div className="font-bold text-gray-900 truncate text-sm" title={doc.title}>{doc.title}</div>
                        </div>
                        <a 
                          href={getMediaUrl(doc.file)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-indigo-600 transition-colors shadow-sm"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. HEALTH TAB */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-8 border border-gray-200/80 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                    <Heart className="text-pink-600 fill-pink-600" size={22} /> Medical & Health Profile
                  </h3>
                  {healthProfile?.blood_group && (
                    <span className="px-3.5 py-1 bg-pink-100 text-pink-800 font-extrabold text-xs rounded-full">
                      Blood Group: {healthProfile.blood_group}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="text-xs font-extrabold text-slate-400 uppercase">Blood Group</div>
                    <div className="text-xl font-black text-slate-900">
                      {student?.blood_group || fullProfile?.blood_group || healthProfile?.blood_group || '--'}
                    </div>
                  </div>


                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="text-xs font-extrabold text-slate-400 uppercase">Known Allergies</div>
                    <div className="text-sm font-bold text-slate-800">
                      {healthProfile?.allergies || 'No allergies recorded'}
                    </div>
                  </div>

                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="text-xs font-extrabold text-slate-400 uppercase">Medical Conditions</div>
                    <div className="text-sm font-bold text-slate-800">
                      {healthProfile?.medical_conditions || 'None reported'}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h4 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                    <Activity size={18} className="text-indigo-600" /> School Clinic & Infirmary Visit History
                  </h4>
                  {clinicVisits && clinicVisits.length > 0 ? (
                    <div className="space-y-3">
                      {clinicVisits.map((visit: any) => (
                        <div key={visit.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{visit.complaint || visit.reason || 'Infirmary Checkup'}</div>
                            <div className="text-gray-400">{new Date(visit.created_at || visit.visit_date).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold">
                              {visit.status || 'Completed'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-100">
                      <p className="text-xs font-bold">No clinic visits recorded.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
