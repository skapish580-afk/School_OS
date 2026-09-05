'use client';

import { useEffect, useState, useRef } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useRouter, useParams, usePathname } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import Link from 'next/link';
import QRCode from "react-qr-code"; 
import { 
  ArrowLeft, Mail, Phone, User, Shield, Edit, 
  AlertTriangle, Star, ThumbsUp, Plus, X, 
  Thermometer, Heart, Activity, Clock, Loader2,
  MapPin, Calendar, CheckCircle, GraduationCap, ChevronDown, ChevronUp,
  Trophy, Award, Medal, FileText, TrendingUp, Users, Download,
  Eye, EyeOff, Trash2
} from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

// LinkedIn-Style Timeline Year Card Component
function TimelineYearCard({ year, isLast, isFirst, studentName }: { year: any; isLast: boolean; isFirst: boolean; studentName: string }) {
  const { formatAcademicYear } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const gradeColor = year?.overall_grade === 'A+' ? 'from-green-500 to-emerald-600'
    : year?.overall_grade === 'A' ? 'from-green-400 to-green-500'
    : year?.overall_grade === 'B+' ? 'from-blue-500 to-blue-600'
    : year?.overall_grade === 'B' ? 'from-blue-400 to-blue-500'
    : year?.overall_grade === 'C+' ? 'from-yellow-500 to-yellow-600'
    : 'from-gray-400 to-gray-500';

  const hasAwards = Array.isArray(year?.awards) && year.awards.length > 0;

  return (
    <div className="relative pl-16 pr-4 py-4 hover:bg-gray-50 transition-colors">
      <div className={`absolute left-6 w-4 h-4 rounded-full border-4 border-white shadow-md bg-gradient-to-br ${gradeColor} z-10`} />
      <div className="absolute left-0 top-4 text-xs font-bold text-gray-400 w-5 text-right">
        {year?.grade_name === 'LKG' ? 'L' : year?.grade_name === 'UKG' ? 'U' : year?.grade_name}
      </div>

      <div onClick={() => setExpanded(!expanded)} className="cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-bold text-gray-900">Grade {year?.grade_name} - Section {year?.section_name}</h4>
              <span className="text-xs text-gray-400">{formatAcademicYear(year?.academic_year_name)}</span>
              {isLast && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>}
              {isFirst && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Started Here</span>}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {year?.class_rank && (
                <div className="flex items-center gap-1">
                  <TrendingUp size={14} className="text-blue-500" />
                  <span className="font-semibold text-blue-600">Rank #{year.class_rank}</span>
                  <span className="text-gray-400">of {year.total_students_in_class}</span>
                </div>
              )}

              {year?.percentage && (
                <div className={`font-bold px-2 py-0.5 rounded ${
                  parseFloat(year.percentage) >= 90 ? 'bg-green-100 text-green-700' :
                  parseFloat(year.percentage) >= 75 ? 'bg-blue-100 text-blue-700' :
                  parseFloat(year.percentage) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {parseFloat(year.percentage).toFixed(1)}%
                </div>
              )}

              {year?.attendance_percentage && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Calendar size={14} />
                  <span>{parseFloat(year.attendance_percentage).toFixed(1)}% attendance</span>
                </div>
              )}

              {hasAwards && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Trophy size={14} />
                  <span className="font-medium">{year.awards.length} award{year.awards.length > 1 ? 's' : ''}</span>
                </div>
              )}

              {year?.net_karma > 0 && (
                <div className="flex items-center gap-1 text-purple-600">
                  <Star size={14} />
                  <span>+{year.net_karma} karma</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${gradeColor} text-white`}>
              {year?.overall_grade || '--'}
            </div>
            <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              {expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg">
              <div className="text-xs text-blue-600 font-medium">Class Rank</div>
              <div className="text-lg font-bold text-blue-900">#{year?.class_rank || '--'} <span className="text-sm font-normal text-blue-600">of {year?.total_students_in_class || '--'}</span></div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg">
              <div className="text-xs text-purple-600 font-medium">Grade Rank</div>
              <div className="text-lg font-bold text-purple-900">#{year?.grade_rank || '--'} <span className="text-sm font-normal text-purple-600">of {year?.total_students_in_grade || '--'}</span></div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
              <div className="text-xs text-green-600 font-medium">Percentage</div>
              <div className="text-lg font-bold text-green-900">{year?.percentage ? `${parseFloat(year.percentage).toFixed(1)}%` : '--'}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg">
              <div className="text-xs text-orange-600 font-medium">Total Marks</div>
              <div className="text-lg font-bold text-orange-900">{year?.total_marks ? parseFloat(year.total_marks).toFixed(0) : '--'}/500</div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar size={16} /> Attendance Details
            </h5>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{year?.total_working_days || '--'}</div>
                <div className="text-xs text-gray-500">Working Days</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{year?.days_present || '--'}</div>
                <div className="text-xs text-gray-500">Present</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{year?.days_absent || '--'}</div>
                <div className="text-xs text-gray-500">Absent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{year?.days_late || '--'}</div>
                <div className="text-xs text-gray-500">Late</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  parseFloat(year?.attendance_percentage || 0) >= 90 ? 'bg-green-500' :
                  parseFloat(year?.attendance_percentage || 0) >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                }`} style={{ width: `${year?.attendance_percentage || 0}%` }} />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">{parseFloat(year?.attendance_percentage || 0).toFixed(1)}% attendance</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 

// Need to import MessageSquare icon
const MessageSquare = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const routeParams = useParams(); 
  const pathname = usePathname();
  
  const rawId = params?.id || routeParams?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;


  const { hasPermission, isAdmin, loading: permissionLoading } = usePermissionContext();
  const isTeacherPortal = (pathname && pathname.startsWith('/teachers')) || (typeof window !== 'undefined' && window.location.pathname.startsWith('/teachers'));

  const canViewAny = isAdmin || isTeacherPortal || 
    hasPermission('students.view_student_only') || 
    hasPermission('students.view_profile') || 
    hasPermission('students.view_journey') || 
    hasPermission('students.view_health');

  const allowedTabs = [
    { id: 'journey', label: 'journey', permission: 'students.view_journey' },
    { id: 'achievements', label: 'achievements', permission: 'students.view_student_only' },
    { id: 'behavior', label: 'behavior', permission: 'students.view_student_only' },
    { id: 'profile', label: 'profile', permission: 'students.view_profile' },
    { id: 'gatepass', label: 'Digital Pass', permission: 'students.view_student_only' },
    { id: 'health', label: 'health', permission: 'students.view_health' }
  ].filter(tab => isAdmin || isTeacherPortal || hasPermission(tab.permission));

  // --- STATE ---
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'behavior' | 'gatepass' | 'health' | 'achievements' | 'journey'>('journey');

  // Fallback default active tab
  useEffect(() => {
    if (!permissionLoading && allowedTabs.length > 0 && !allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0].id as any);
    }
  }, [permissionLoading, allowedTabs, activeTab]);

  // Module Data
  const [teacherRoleForStudent, setTeacherRoleForStudent] = useState<'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'NONE'>('NONE');
  const [currentUserType, setCurrentUserType] = useState<string>('');

  const isUserAdmin = isAdmin || ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(currentUserType);
  const isClassTeacher = isUserAdmin || teacherRoleForStudent === 'CLASS_TEACHER';
  const isSubjectOrClassTeacher = isUserAdmin || teacherRoleForStudent === 'CLASS_TEACHER' || teacherRoleForStudent === 'SUBJECT_TEACHER';

  useEffect(() => {
    const checkTeacherRole = async () => {
      if (!student) return;
      try {
        const [meRes, assignmentsRes, sectionsRes] = await Promise.all([
          api.get('/auth/me/').catch(() => ({ data: null })),
          api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] })),
          api.get('/academics/sections/').catch(() => ({ data: [] }))
        ]);

        const meUser = meRes.data;
        if (meUser) {
          setCurrentUserType(meUser.user_type || '');
          if (['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(meUser.user_type)) {
            setTeacherRoleForStudent('CLASS_TEACHER');
            return;
          }
        }

        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || [];
        const sectionsData = Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || [];

        const cleanG = (g: any) => (g || '').toString().toLowerCase().replace('grade', '').split('-')[0].trim();
        const cleanS = (s: any) => {
          const str = (s || '').toString().trim().toUpperCase();
          return str.includes('-') ? (str.split('-').pop() || str) : str;
        };

        let studentGrade = cleanG(student.grade_name || student.grade);
        let studentSection = cleanS(student.section_letter || student.section);

        if (student.current_section && typeof student.current_section === 'object') {
          if (student.current_section.grade_config?.grade_name) {
            studentGrade = cleanG(student.current_section.grade_config.grade_name);
          }
          if (student.current_section.section_letter) {
            studentSection = cleanS(student.current_section.section_letter);
          }
        }

        const rawClass = (student.current_class || '').toString().trim();
        if (rawClass.includes('-')) {
          const parts = rawClass.split('-');
          if (!studentGrade) studentGrade = cleanG(parts[0]);
          if (!studentSection) studentSection = cleanS(parts[1]);
        } else if (rawClass && !studentGrade) {
          studentGrade = cleanG(rawClass);
        }

        let isCT = false;
        let isST = false;

        // 1. Check sectionsData for Class Teacher assignment
        if (meUser) {
          const myFullName = (meUser.full_name || `${meUser.first_name || ''} ${meUser.last_name || ''}`).trim().toLowerCase();
          const matchedSec = sectionsData.find((s: any) => {
            const secGrade = cleanG(s.grade_name || s.grade_config?.grade_name);
            const secLetter = cleanS(s.section_letter);
            if (secGrade !== studentGrade || secLetter !== studentSection) return false;

            if (!s.class_teacher_name && !s.class_teacher_info) return false;
            const ctName = (s.class_teacher_name || s.class_teacher_info?.name || '').toLowerCase();
            const teacherId = s.class_teacher_info?.id || s.class_teacher_id;
            const matchesTeacherId = meUser.teacher_profile?.id && String(teacherId) === String(meUser.teacher_profile.id);
            const matchesName = myFullName && (ctName.includes(myFullName) || myFullName.includes(ctName));
            const matchesFirstName = meUser.first_name && ctName.includes(meUser.first_name.toLowerCase());
            return matchesTeacherId || matchesName || matchesFirstName;
          });

          if (matchedSec) {
            isCT = true;
          }
        }

        // 2. Check assignments list
        assignments.forEach((a: any) => {
          if (!a.grade || !a.section) return;
          const aGrade = cleanG(a.grade);
          const aSection = cleanS(a.section);
          if (aGrade === studentGrade && aSection === studentSection) {
            const roleIsCT = a.role === 'CLASS_TEACHER' || a.role === 'CLASS' || a.role_display?.toLowerCase().includes('class teacher');
            if (roleIsCT) {
              isCT = true;
            } else {
              isST = true;
            }
          }
        });

        // 3. Fallback: If teacher has active assignments for this grade, grant subject teacher access
        if (!isCT && !isST && (meUser?.user_type === 'TEACHER' || meUser?.teacher_profile) && assignments.length > 0) {
          isST = assignments.some((a: any) => cleanG(a.grade) === studentGrade);
        }

        if (isCT) {
          setTeacherRoleForStudent('CLASS_TEACHER');
        } else if (isST) {
          setTeacherRoleForStudent('SUBJECT_TEACHER');
        } else {
          setTeacherRoleForStudent('NONE');
        }
      } catch (err) {
        console.error('Failed to resolve teacher role for student:', err);
      }
    };

    checkTeacherRole();
  }, [student]);

  const [timeline, setTimeline] = useState<any[]>([]); 
  const [karmaScore, setKarmaScore] = useState<any>(null);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
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

  useEffect(() => {
    if (!id || id === 'undefined' || !selectedGrade) return;
    
    const fetchDynamicAttendance = async () => {
      try {
        const res = await api.get(`/attendance/student_grade_stats/?student_id=${id}&grade=${selectedGrade}`);
        setDynamicAttendance(res.data);
      } catch (e) {
        console.warn("Failed to fetch dynamic attendance stats", e);
        setDynamicAttendance(null);
      }
    };
    
    fetchDynamicAttendance();
  }, [id, selectedGrade]);

  // Confirm Admission State & Logic
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string>('');

  const hasBirthCertificate = !!fullProfile?.documents?.some((doc: any) => doc.document_type === 'BIRTH_CERTIFICATE');
  const hasTransferCertificate = !!fullProfile?.documents?.some((doc: any) => doc.document_type === 'TRANSFER_CERTIFICATE');
  const hasMarkSheet = !!fullProfile?.documents?.some((doc: any) => doc.document_type === 'MARK_SHEET');

  const hasName = !!(fullProfile?.first_name?.trim() || student?.first_name?.trim());
  const hasEmail = !!(fullProfile?.email?.trim() || student?.email?.trim());
  const hasDOB = !!(fullProfile?.date_of_birth || student?.date_of_birth);
  const hasAddress = !!(
    fullProfile?.address?.trim() || 
    fullProfile?.address_line1?.trim() || 
    student?.address?.trim() || 
    student?.address_line1?.trim()
  );
  const hasCoordinates = !!(
    (fullProfile?.latitude !== null && fullProfile?.latitude !== undefined && String(fullProfile?.latitude).trim() !== '') ||
    (student?.latitude !== null && student?.latitude !== undefined && String(student?.latitude).trim() !== '')
  ) && !!(
    (fullProfile?.longitude !== null && fullProfile?.longitude !== undefined && String(fullProfile?.longitude).trim() !== '') ||
    (student?.longitude !== null && student?.longitude !== undefined && String(student?.longitude).trim() !== '')
  );

  const hasRequiredDetails = hasName && hasDOB && hasAddress && hasCoordinates;
  const canConfirmAdmission = hasBirthCertificate && hasRequiredDetails;

  const handleConfirmAdmission = async () => {
    if (!canConfirmAdmission) return;
    setConfirmLoading(true);
    setConfirmError('');
    try {
      const res = await api.post(`/students/${id}/confirm_admission/`);
      if (res.data?.success) {
        alert("Student admission confirmed successfully!");
        // Re-fetch to refresh status
        const studentRes = await api.get(`/students/${id}/`);
        setStudent(studentRes.data);
        const profileRes = await api.get(`/students/${id}/profile/`);
        setFullProfile(profileRes.data);
      } else {
        setConfirmError(res.data?.error || "Failed to confirm admission.");
      }
    } catch (e: any) {
      console.error("Confirm admission failed", e);
      setConfirmError(e.response?.data?.error || e.response?.data?.detail || "An error occurred while confirming admission.");
    } finally {
      setConfirmLoading(false);
    }
  };
  
  // DRAGGABLE TIMELINE LOGIC
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map all tenures (including current active school tenure)
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
  const uniqueGrades = (() => {
    const gradesSet = new Set<string>();
    
    if (student?.grade_config?.grade_name) {
      gradesSet.add(student.grade_config.grade_name);
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
  })();

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

  const [hideSensitive, setHideSensitive] = useState(false);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  const formatSensitive = (val: any) => {
    if (val === null || val === undefined || val === '') return '--';
    return hideSensitive ? '╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│' : val;
  };

  const { settings } = useSettings();

  // Modals
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [showKarmaModal, setShowKarmaModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewPass, setPreviewPass] = useState<any>(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);

  // Forms
  const [newIncident, setNewIncident] = useState({ category: '', severity: 'LOW', description: '', points_deducted: 5 });
  const [newKarma, setNewKarma] = useState({ title: '', points: 10, description: '' });
  const [passReason, setPassReason] = useState('');
  const [newAchievement, setNewAchievement] = useState<{
    category: string;
    description: string;
    certificate_image: File | null;
  }>({
    category: 'CURRICULAR',
    description: '',
    certificate_image: null,
  });

  // --- FETCH DATA ---
  useEffect(() => {
    if (permissionLoading) return;
    if (!id || id === 'undefined') return;
    if (!canViewAny) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.get(`/students/${id}/`).then(res => {
      setStudent(res.data);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load student", err);
      setLoading(false);
    });
  }, [id, permissionLoading, canViewAny]);

  useEffect(() => {
    if (!id || id === 'undefined') return;
    
    if (activeTab === 'behavior') fetchBehaviorData();
    if (activeTab === 'gatepass') {
      fetchGatePasses();
      const timer = setInterval(() => {
        fetchGatePasses();
      }, 10000);
      return () => clearInterval(timer);
    }

    if (activeTab === 'health') fetchHealthData();
    if (activeTab === 'achievements') fetchAchievements();
    if (activeTab === 'journey' || activeTab === 'profile') fetchJourneyData();
  }, [activeTab, id]);

  const fetchBehaviorData = async () => {
      try {
          // 1. Get Bad Records
          const badRes = await api.get(`/discipline/?student=${id}`);
          const badRecords = badRes.data.map((r: any) => ({ 
              id: `bad-${r.id}`,
              category: r.category.replace('_', ' '), 
              description: r.description,
              date: r.incident_date,
              type: 'BAD',
              severity: r.severity,
              points_deducted: r.points_deducted ?? (r.severity === 'CRITICAL' ? 50 : r.severity === 'MEDIUM' ? 15 : 5)
          }));

          
          // 2. Get Good Records
          let goodRecords: any[] = [];
          try {
             const goodRes = await api.get(`/discipline/karma_history/?student=${id}`);
             goodRecords = goodRes.data.map((r: any) => ({
                 id: `good-${r.id}`,
                 category: 'POSITIVE KARMA',
                 description: r.title, 
                 date: r.date,
                 type: 'GOOD',
                 points: r.points
             }));
          } catch (e) { console.warn("Karma history fetch failed"); }
          
          // 3. Merge & Sort
          const combined = [...badRecords, ...goodRecords].sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setTimeline(combined);
          
          // 4. Get Score
          api.get(`/discipline/scorecard/?student=${id}`).then(res => setKarmaScore(res.data));

      } catch (e) { console.error(e); }
  };

  const fetchGatePasses = async () => {
      try {
        const res = await api.get(`/gatepass/passes/?student=${id}`);
        const passes = res.data?.results || res.data || [];
        setGatePasses(Array.isArray(passes) ? passes : []);
      } catch (e) { console.error(e); }
  };

  const fetchHealthData = async () => {
      try {
        const profileRes = await api.get(`/health/profiles/?student=${id}`);
        const profiles = profileRes.data?.results || profileRes.data || [];
        setHealthProfile(Array.isArray(profiles) ? profiles[0] : profiles || null);
        const visitsRes = await api.get(`/health/visits/?student=${id}`);
        const visits = visitsRes.data?.results || visitsRes.data || [];
        setClinicVisits(Array.isArray(visits) ? visits : []);
      } catch (e) { console.error(e); }
  };

  const fetchAchievements = async () => {
      try {
        const achievementsRes = await api.get(`/achievements/awards/?student=${id}`);
        const achievementsList = achievementsRes.data?.results || achievementsRes.data || [];
        setAchievements(Array.isArray(achievementsList) ? achievementsList : []);
        const artifactsRes = await api.get(`/achievements/artifacts/?student=${id}`);
        const artifactsList = artifactsRes.data?.results || artifactsRes.data || [];
        setArtifacts(Array.isArray(artifactsList) ? artifactsList : []);
      } catch (e) { console.error(e); }
  };

  const fetchJourneyData = async () => {
      try {
        // Get enrollment history
        const enrollmentsRes = await api.get(`/enrollments/?student=${id}`);
        // Handle paginated response (results array) or plain array
        const enrollments = enrollmentsRes.data?.results || enrollmentsRes.data || [];
        setEnrollmentHistory(Array.isArray(enrollments) ? enrollments : []);
        
        // Get detailed student history with grades and remarks
        try {
          const historyRes = await api.get(`/students/${id}/history/`);
          const history = historyRes.data?.results || historyRes.data || [];
          setStudentHistory(Array.isArray(history) ? history : []);
        } catch (e) { console.warn("History fetch failed", e); }

        // Get cross school history
        try {
          const crossSchoolRes = await api.get(`/students/${id}/cross_school_history/`);
          const crossSchoolData = crossSchoolRes.data?.results || crossSchoolRes.data || [];
          setCrossSchoolHistory(Array.isArray(crossSchoolData) ? crossSchoolData : []);
        } catch (e) { console.warn("Cross school history fetch failed", e); }

        // Get student report cards
        try {
          const reportCardsRes = await api.get(`/academics/report-cards/for_student/?student_id=${id}`);
          const reportCardsData = reportCardsRes.data?.results || reportCardsRes.data || [];
          setReportCards(Array.isArray(reportCardsData) ? reportCardsData : []);
        } catch (e) { console.warn("Report cards fetch failed", e); }
        
        // Get guardians/parents info
        try {
          const guardiansRes = await api.get(`/students/${id}/guardians/`);
          const guardiansList = guardiansRes.data?.results || guardiansRes.data || [];
          setGuardians(Array.isArray(guardiansList) ? guardiansList : []);
        } catch (e) { console.warn("Guardians fetch failed", e); }
        
        // Get full profile
        let suid = '';
        try {
          const profileRes = await api.get(`/students/${id}/profile/`);
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
        
        // Also fetch achievements and good karma for journey
        fetchAchievements();
        
        const goodRes = await api.get(`/discipline/karma_history/?student=${id}`).catch(() => ({data: []}));
        const goodRecords = goodRes.data?.results || goodRes.data || [];
        
        // Combine all positive memories
        const memories = [...(Array.isArray(goodRecords) ? goodRecords : []), ...achievements].sort((a, b) => 
          new Date(b.date || b.date_awarded).getTime() - new Date(a.date || a.date_awarded).getTime()
        );
      } catch (e) { console.error(e); }
  };

  // --- ACTIONS ---
  const handleReportIncident = async () => {
      try {
          await api.post('/discipline/', { student: id, ...newIncident });
          setShowDisciplineModal(false);
          setNewIncident({ category: '', severity: 'LOW', description: '', points_deducted: 5 });
          fetchBehaviorData();
          alert("Incident Reported.");
      } catch (e) { alert("Failed to report incident."); }
  };

  const handleAwardKarma = async () => {
      try {
          await api.post('/discipline/award_karma/', { student: id, ...newKarma });
          setShowKarmaModal(false);
          setNewKarma({ title: '', points: 10, description: '' });
          fetchBehaviorData();
          alert("Points Awarded!");
      } catch (e) { alert("Failed to award points."); }
  };

  const handleRecordAchievement = async () => {
    if (!newAchievement.description.trim()) {
      alert("Please enter a description for the achievement.");
      return;
    }
    
    try {
      const data = new FormData();
      data.append('student', id);
      data.append('category', newAchievement.category);
      data.append('description', newAchievement.description);
      if (newAchievement.certificate_image) {
        data.append('certificate_image', newAchievement.certificate_image);
      }

      await api.post('/achievements/awards/', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setShowAchievementModal(false);
      setNewAchievement({
        category: 'CURRICULAR',
        description: '',
        certificate_image: null,
      });
      fetchAchievements();
      alert("Achievement recorded successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to record achievement.");
    }
  };

  const handleIssuePass = async () => {
      if (!passReason || !passReason.trim()) {
        alert('Please enter a reason for the pass.');
        return;
      }

      const payload = { student: student?.suid, reason: passReason };
      console.log('Issuing pass - payload:', payload);

      try {
          const res = await api.post('/gatepass/passes/', payload);
          console.log('Issue pass response:', res.data);
          setShowPassModal(false);
          setPassReason('');
          fetchGatePasses();
          alert("Pass Issued.");
      } catch (err: any) {
        console.error('Issue pass failed:', err);
        // Show detailed server validation errors if present
        const serverData = err.response?.data;
        let msg = 'Failed to issue pass.';
        if (serverData) {
          // Prefer detail or non-field errors, otherwise stringify
          msg = serverData.detail || serverData.non_field_errors || JSON.stringify(serverData);
        }
        alert(msg);
      }
  };

  // --- RENDER ---
  if (permissionLoading || (loading && canViewAny)) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
          <Loader2 className="animate-spin mr-2" /> Loading Student Profile...
      </div>
  );

  if (!canViewAny) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">You do not have permission to view student profiles.</p>
        </div>
      </div>
    );
  }

  if (!student) return <div className="min-h-screen flex items-center justify-center text-red-500">Student not found</div>;

  // --- FIX: EXACT NAME LOGIC TO PREVENT UNKNOWN ---
  const displayName = student.full_name || 
                      (student.first_name ? `${student.first_name} ${student.last_name || ''}` : "Unknown Student");
  
  const displayEmail = student.email || "No Email";
  const displayPhone = student.phone_number || "No Phone";
  const currentClass = student.current_class || "Unassigned";

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      {/* 1. TOP HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                      <ArrowLeft size={20} />
                  </button>
                  <h1 className="text-xl font-bold text-gray-800">Student Profile</h1>
              </div>
              <div className="flex gap-2">
                    {(isUserAdmin || isClassTeacher || hasPermission('students.hide_student')) && (
                        <button
                            onClick={() => setHideSensitive(!hideSensitive)}
                            className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors flex items-center gap-2 ${
                                hideSensitive 
                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                            title={hideSensitive ? "Show sensitive details" : "Hide sensitive details"}
                        >
                            {hideSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
                            {hideSensitive ? "Show Details" : "Hide Details"}
                        </button>
                    )}
                    {(isUserAdmin || isClassTeacher || hasPermission('students.edit_profile')) && (
                        <Link href={typeof window !== 'undefined' && window.location.pathname.startsWith('/teachers') ? `/teachers/remarks/${id}/edit` : `/dashboard/students/${id}/edit`}>
                            <button className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                                <Edit size={16} /> Edit Details
                            </button>
                        </Link>
                    )}
              </div>
          </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* TEMPORARY ADMISSION BANNER */}
        {student?.status === 'TEMPORARY' && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="space-y-4 flex-1 w-full">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h3 className="font-extrabold text-base tracking-tight">Temporary Admission Registry</h3>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed max-w-2xl">
                This student is currently admitted under a <strong>TEMPORARY</strong> status. To confirm their active admission in the school directory, all required profile details and documents must be provided.
              </p>
              
              {/* Requirements Checklists */}
              <div className="space-y-4 pt-1">
                <div>
                  <h4 className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider mb-2">Required Profile Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasName ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasName ? "text-gray-700" : "text-amber-800/60 font-bold"}>First Name</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasEmail ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasEmail ? "text-gray-700" : "text-amber-800/60 font-bold"}>Email Address</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasDOB ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasDOB ? "text-gray-700" : "text-amber-800/60 font-bold"}>Date of Birth</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasAddress ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasAddress ? "text-gray-700" : "text-amber-800/60 font-bold"}>Residential Address</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasCoordinates ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasCoordinates ? "text-gray-700" : "text-amber-800/60 font-bold"}>GPS Coordinates</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider mb-2">Required Documents</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasBirthCertificate ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasBirthCertificate ? "text-gray-700" : "text-amber-800/60 font-bold"}>Birth Certificate</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasTransferCertificate ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasTransferCertificate ? "text-gray-700" : "text-amber-800/60 font-bold"}>Transfer Certificate</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold bg-white px-3 py-2 rounded-xl border border-gray-150 shadow-sm">
                      {hasMarkSheet ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className={hasMarkSheet ? "text-gray-700" : "text-amber-800/60 font-bold"}>Mark Sheet</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {confirmError && (
                <div className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100 mt-2">
                  {confirmError}
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-auto items-stretch">
              {(isUserAdmin || isClassTeacher || hasPermission('students.edit_profile')) ? (
                <>
                  <button
                    onClick={handleConfirmAdmission}
                    disabled={confirmLoading || !canConfirmAdmission}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-sm transition shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 duration-100"
                  >
                    {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm Admission
                  </button>
                  <Link href={typeof window !== 'undefined' && window.location.pathname.startsWith('/teachers') ? `/teachers/remarks/${id}/edit` : `/dashboard/students/${id}/edit`} className="w-full">
                    <button className="w-full px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl text-sm transition shadow-sm text-center whitespace-nowrap">
                      Upload Documents & Details
                    </button>
                  </Link>
                </>
              ) : (
                <div className="text-xs text-amber-800 font-medium bg-amber-50/50 px-4 py-2.5 rounded-xl border border-amber-100 max-w-xs text-center">
                  Admission verification pending approval from an authorized editor.
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 2. IDENTITY CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row gap-8 items-center md:items-start relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
            
            <div className="w-28 h-28 rounded-2xl bg-gray-100 flex-shrink-0 border-4 border-white shadow-lg overflow-hidden relative z-10 flex items-center justify-center">
                {student.profile_photo ? (
                    <img src={getMediaUrl(student.profile_photo)!} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-3xl font-bold text-gray-400">{displayName[0]}</span>
                )}
            </div>

            <div className="flex-1 text-center md:text-left space-y-2 z-10">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{displayName}</h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                        <GraduationCap size={14} /> {currentClass}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800 font-mono">
                        {student.suid}
                    </span>
                    {student.roll_number && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-indigo-100 text-indigo-800 font-mono">
                            Roll: {student.roll_number}
                        </span>
                    )}
                    {student.blood_group && (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-pink-100 text-pink-800 gap-1">
                            <Heart size={12} fill="currentColor" /> {student.blood_group}
                        </span>
                    )}
                </div>
                
                <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5"><Mail size={14}/> {displayEmail}</div>
                      <div className="flex items-center gap-1.5"><Phone size={14}/> {displayPhone}</div>
                </div>
            </div>
        </div>

        {/* 3. NAVIGATION TABS */}
        <div className="flex border-b border-gray-200 gap-8 overflow-x-auto scrollbar-none">
            {allowedTabs.map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'border-b-2 border-black text-black' 
                        : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            
            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <User size={20} className="text-blue-600"/> Personal Details
                        </h3>
                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Middle Name</dt>
                                <dd className="font-medium text-gray-900">{student.middle_name || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Gender</dt>
                                <dd className="font-medium text-gray-900">{student.gender || "Not set"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Date of Birth</dt>
                                <dd className="font-medium text-gray-900">{student.date_of_birth || "Not set"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Roll Number</dt>
                                <dd className="font-medium text-gray-900">{student.roll_number || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Admission Date</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.admission_date)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Category</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.category)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Religion</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.religion)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Mother Tongue</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.mother_tongue)}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <MapPin size={20} className="text-blue-600"/> Address & Location
                        </h3>
                        <dl className="space-y-4 text-sm">
                             <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Nationality</dt>
                                <dd className="font-medium text-gray-900">{student.nationality || "Indian"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Birth Place</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.birth_place)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Residential Address</dt>
                                <dd className="font-medium text-gray-900 text-right">
                                    {student.address_line1 || student.address_line2 || student.city || student.state || student.pincode ? (
                                        <>
                                            {student.address_line1 || ''} 
                                            {student.address_line2 ? `, ${student.address_line2}` : ''}
                                            <br />
                                            {student.city || ''}, {student.state || ''} - {student.pincode || ''}
                                        </>
                                    ) : (
                                        student.address || "--"
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Coordinates</dt>
                                <dd className="font-medium text-gray-900">
                                    {student.latitude && student.longitude 
                                        ? `${student.latitude}, ${student.longitude}` 
                                        : '--'}
                                </dd>
                            </div>
                            {student.address && (student.address_line1 || student.city) && (
                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <dt className="text-gray-500">Legacy Address</dt>
                                    <dd className="font-medium text-gray-900">{student.address}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="mt-10 pt-10 border-t border-gray-100 md:col-span-2">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg mb-6">
                            <FileText size={20} className="text-blue-600"/> Documents Available
                        </h3>
                        {fullProfile?.documents?.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {fullProfile.documents.map((doc: any) => (
                                    <div key={doc.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3 group hover:border-blue-300 transition-all">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">{doc.document_type.replace(/_/g, ' ')}</div>
                                            <div className="font-bold text-gray-900 truncate text-sm" title={doc.title}>{doc.title}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                                        </div>
                                        <a 
                                            href={getMediaUrl(doc.file)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-blue-600 transition-colors shadow-sm"
                                            title="View/Download Document"
                                        >
                                            <Download size={16} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                                <FileText size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">No documents uploaded yet.</p>
                                <p className="text-[10px] mt-1 uppercase tracking-widest">Digital certificates will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* NEW SECTIONS */}
                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <Shield size={20} className="text-blue-600"/> Government IDs
                        </h3>
                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Aadhaar Number</dt>
                                <dd className="font-medium text-gray-900 text-right">
                                    <div>
                                        {student.aadhaar_number ? (
                                            showFullAadhaar ? (
                                                hideSensitive ? "╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│" : student.aadhaar_number
                                            ) : (
                                                `╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│ ╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│ ${student.aadhaar_number.slice(-4)}`
                                            )
                                        ) : (
                                            student.aadhaar_last_4_digits ? `╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│ ╬ô├ç├│╬ô├ç├│╬ô├ç├│╬ô├ç├│ ${student.aadhaar_last_4_digits}` : "--"
                                        )}
                                    </div>
                                    {student.aadhaar_number && (
                                        <button
                                            type="button"
                                            onClick={() => setShowFullAadhaar(!showFullAadhaar)}
                                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold mt-1 uppercase tracking-wider focus:outline-none transition-all block ml-auto"
                                        >
                                            {showFullAadhaar ? "hide full number" : "display full number"}
                                        </button>
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">APAAR ID</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.apaar_id)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">PEN ID</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.pen_id)}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <Activity size={20} className="text-blue-600"/> Additional Info & Preferences
                        </h3>
                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">House Color</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.house_color)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Dietary Preference</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.dietary_preference)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Languages</dt>
                                <dd className="font-medium text-gray-900">{formatSensitive(student.languages_known)}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">RTE Student</dt>
                                <dd className="font-medium text-gray-900">{student.is_rte_student ? 'Yes' : 'No'}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Fee Concession Applicable</dt>
                                <dd className="font-medium text-gray-900">{student.fee_concession_applicable ? 'Yes' : 'No'}</dd>
                            </div>
                            {student.fee_concession_applicable && (
                                <div className="flex justify-between border-b border-gray-50 pb-2">
                                    <dt className="text-gray-500">Fee Concession Amount</dt>
                                    <dd className="font-medium text-gray-900">╬ô├⌐Γòú{student.fee_concession_amount || '0.00'}</dd>
                                </div>
                            )}
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Alumni Directory Consent</dt>
                                <dd className="font-medium text-gray-900">{student.alumni_directory_consent ? 'Yes' : 'No'}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            )}

            {/* BEHAVIOR TAB */}
            {activeTab === 'behavior' && (
                <div className="space-y-8">
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className={`bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between relative overflow-hidden ${
                            (isUserAdmin || isSubjectOrClassTeacher || hasPermission('students.manage_behavior')) ? 'col-span-2' : 'col-span-3'
                        }`}>
                            <div className="relative z-10">
                                <div className="text-indigo-100 font-medium text-xs uppercase tracking-wider mb-1 flex items-center gap-2"><Star size={14}/> Karma Score</div>
                                <div className="text-5xl font-bold tracking-tight">{karmaScore?.net_score ?? 0}</div>
                                <div className="text-indigo-200 text-sm mt-2 font-medium">Status: {karmaScore?.status || 'Good Standing'}</div>
                            </div>
                            <div className="h-32 w-32 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm absolute -right-4 -bottom-4">
                                <ThumbsUp size={48} className="text-white/30" />
                            </div>
                        </div>
                        {(isUserAdmin || isSubjectOrClassTeacher || hasPermission('students.manage_behavior')) && (
                            <div className="space-y-3">
                                <button onClick={() => setShowKarmaModal(true)} className="w-full h-1/2 bg-green-50 border border-green-100 hover:bg-green-100 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                                    <Plus size={18}/> Award Karma
                                </button>
                                <button onClick={() => setShowDisciplineModal(true)} className="w-full h-1/2 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                                    <AlertTriangle size={18}/> Report Incident
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-8 flex items-center gap-2">
                           <Clock size={20} className="text-gray-400"/> History Timeline
                        </h3>
                        
                        <div className="relative border-l-2 border-gray-100 ml-4 space-y-8">
                            {timeline.length === 0 ? (
                                <div className="pl-12 text-gray-400 italic py-4">No recent activity recorded.</div>
                            ) : (
                                timeline.map((record) => (
                                    <div key={record.id} className="relative pl-10">
                                        <div className={`absolute -left-[13px] top-1 w-7 h-7 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${record.type === 'BAD' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {record.type === 'BAD' ? <AlertTriangle size={12}/> : <Star size={12}/>}
                                        </div>
                                        <div className={`p-4 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md ${record.type === 'BAD' ? 'bg-white' : 'bg-green-50/30'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${record.type === 'BAD' ? (record.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700') : 'bg-green-100 text-green-700'}`}>
                                                        {record.category}
                                                    </span>
                                                    {record.type === 'GOOD' && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-200 text-green-800">+{record.points} pts</span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><Calendar size={10} /> {record.date}</span>
                                            </div>
                                            <h4 className={`font-bold text-sm ${record.type === 'BAD' ? 'text-gray-900' : 'text-green-900'}`}>{record.description}</h4>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* GATE PASS */}
            {activeTab === 'gatepass' && (
                <div>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Shield size={20} className="text-black"/> Digital Passes</h3>
                        {(isUserAdmin || isClassTeacher || hasPermission('students.issue_pass')) && (
                            <button onClick={() => setShowPassModal(true)} className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2">
                                <Plus size={16}/> New Pass
                            </button>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {gatePasses.map((pass) => {
                          const isActive = pass.status === 'ACTIVE' && pass.valid_until && new Date(pass.valid_until).getTime() > Date.now();
                          const statusText = isActive ? 'ACTIVE' : (pass.status === 'ACTIVE' ? 'EXPIRED' : pass.status);
                          return (
                            <div key={pass.id} className={`group bg-white rounded-2xl border p-6 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-green-500 shadow-sm ring-1 ring-green-100' : 'border-gray-200 opacity-70 grayscale'}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{statusText}</span>
                                    {isActive && <div className="animate-pulse w-2 h-2 rounded-full bg-green-500"></div>}
                                </div>
                                <button
                                  onClick={() => { setPreviewPass(pass); setShowPrintPreview(true); }}
                                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-2 rounded-full border shadow-sm z-30"
                                  title="Show print preview"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="2" ry="2"/></svg>
                                </button>
                                <div className="text-center py-2 flex justify-center">
                                    {isActive ? (
                                            <div className="bg-white p-2 inline-block rounded-xl border border-gray-100 shadow-inner relative">
                                                <div id={`qr-${pass.id}`}> 
                                                  <QRCode value={JSON.stringify({ id: pass.id, name: displayName, exp: pass.valid_until })} size={120} />
                                                </div>
                                            </div>
                                        ) : (
                                        <div className="h-[138px] w-[138px] flex items-center justify-center text-gray-300 font-mono text-xs border-2 border-dashed border-gray-200 rounded-xl">{statusText}</div>
                                    )}
                                </div>
                                <div className="space-y-1 text-center">
                                    <div className="font-bold text-gray-900 text-sm">{pass.reason}</div>
                                    <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><Clock size={12}/> Expires: {new Date(pass.valid_until).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                            </div>
                          );
                        })}

                    </div>
                </div>
            )}

            {/* HEALTH TAB */}
            {activeTab === 'health' && (
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative group">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600"><Heart size={20}/></div>
                                <h3 className="font-bold text-gray-900">Medical Profile</h3>
                            </div>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Blood Group</label><div className="text-2xl font-bold text-gray-800 mt-1">{student.blood_group || "--"}</div></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Allergies</label><div className="text-sm font-medium text-gray-700 mt-1">{healthProfile?.allergies || student?.allergies || student?.medical_conditions || "None reported"}</div></div>

                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conditions</label><div className="text-sm font-medium text-gray-700 mt-1">{healthProfile?.chronic_conditions || "None"}</div></div>
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2"><Thermometer size={20} className="text-orange-500"/> Infirmary Visits</h3>
                        <div className="space-y-4">
                            {clinicVisits.length === 0 ? (<div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">No visits recorded.</div>) : clinicVisits.map((visit, i) => (
                                <div key={i} className="flex gap-4 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-lg leading-none">{new Date(visit.visit_date).getDate()}</span>
                                        <span className="text-[10px] font-bold uppercase">{new Date(visit.visit_date).toLocaleString('default', { month: 'short' })}</span>
                                    </div>
                                    <div><h4 className="font-bold text-gray-900 text-sm">{visit.symptom}</h4><p className="text-gray-600 text-xs mt-1">{visit.treatment_given}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ACHIEVEMENTS TAB */}
            {activeTab === 'achievements' && (
                <div className="space-y-8">
                    <div className="grid md:grid-cols-2 gap-6 items-stretch">
                        <div className={`bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-2xl text-white shadow-xl flex items-center justify-between ${
                            (isUserAdmin || isSubjectOrClassTeacher || hasPermission('students.record_achievements')) ? '' : 'col-span-2'
                        }`}>
                            <div>
                                <div className="text-yellow-100 text-sm font-medium mb-2">Total Achievements</div>
                                <div className="text-5xl font-bold">{achievements.length}</div>
                            </div>
                            <Star size={64} className="text-white/20" />
                        </div>
                        {(isUserAdmin || isSubjectOrClassTeacher || hasPermission('students.record_achievements')) && (
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center gap-3">
                                <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
                                    <Award size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-950 text-base">New Milestone?</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Record a new curricular, non-curricular or extra-curricular achievement for this student.</p>
                                </div>
                                <button
                                    onClick={() => setShowAchievementModal(true)}
                                    className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                                >
                                    <Plus size={16} /> Record Achievement
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {achievements.length === 0 ? (
                            <div className="col-span-2 text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
                                No achievements yet. Keep up the good work!
                            </div>
                        ) : achievements.map((achievement) => (
                            <div key={achievement.id} className="bg-white p-6 rounded-xl border-2 border-yellow-200 shadow-sm hover:shadow-lg transition flex flex-col justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Star size={24} className="text-yellow-600" fill="currentColor" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-bold text-yellow-600 uppercase">
                                            {achievement.category ? achievement.category.replace('_', ' ') : 'ACHIEVEMENT'}
                                        </span>
                                        <h4 className="font-bold text-gray-900 mt-1">{achievement.title}</h4>
                                        <p className="text-sm text-gray-600 mt-2">{achievement.description}</p>
                                        <div className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                                            <Calendar size={12} /> {achievement.date_awarded}
                                        </div>
                                    </div>
                                </div>
                                {achievement.certificate_image && (
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                        <a 
                                            href={getMediaUrl(achievement.certificate_image)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                                        >
                                            <FileText size={14} /> View Certificate/Proof
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {artifacts.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                📁 Student Portfolio
                            </h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                {artifacts.map((artifact) => (
                                    <div key={artifact.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                                        <div className="font-medium text-gray-900 text-sm">{artifact.title}</div>
                                        <div className="text-xs text-gray-500 mt-1">{artifact.description}</div>
                                        <div className="text-xs text-blue-600 mt-2">Uploaded: {new Date(artifact.upload_date).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* JOURNEY TAB - LinkedIn Style Timeline */}
            {activeTab === 'journey' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-2xl text-white shadow-xl">
                        <h2 className="text-3xl font-bold mb-2">🎓 Student Journey</h2>
                        <p className="text-purple-100">
                          {schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length > 0 
                            ? `${schoolTenures.flatMap((t: any) => t.timeline_snapshot?.history || []).length} years of academic excellence`
                            : `Currently in ${currentClass}`
                          }
                        </p>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                          <div className="bg-white/20 px-3 py-1 rounded-full">
                            🏆 {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.awards_count || 0), 0) || 0), 0)} Awards
                          </div>
                          <div className="bg-white/20 px-3 py-1 rounded-full">
                            📜 {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.certificates_count || 0), 0) || 0), 0)} Certificates
                          </div>
                          <div className="bg-white/20 px-3 py-1 rounded-full">
                            ⭐ {schoolTenures.reduce((sum, t) => sum + (t.timeline_snapshot?.history?.reduce((s: number, y: any) => s + (y.net_karma || 0), 0) || 0), 0)} Karma Points
                          </div>
                        </div>
                    </div>

                    {/* Personal Info & Guardians - Compact Row */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Personal Info */}
                      {(fullProfile || student) && (
                        <div className="bg-white p-5 rounded-xl border border-gray-200">
                          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
                            <User size={16} className="text-blue-600" /> Personal Information
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-400">Admission No:</span> <span className="font-medium block">{fullProfile?.admission_number || student?.admission_number || '--'}</span></div>
                            <div><span className="text-gray-400">DOB:</span> <span className="font-medium block">{fullProfile?.date_of_birth || '--'}</span></div>
                            <div><span className="text-gray-400">Gender:</span> <span className="font-medium block">{fullProfile?.gender === 'M' ? 'Male' : fullProfile?.gender === 'F' ? 'Female' : '--'}</span></div>
                            <div><span className="text-gray-400">Blood Group:</span> <span className="font-medium block">{fullProfile?.blood_group || '--'}</span></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Guardians */}
                      {guardians.length > 0 && (
                        <div className="bg-white p-5 rounded-xl border border-gray-200">
                          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm">
                            👨‍👩‍👧 Parents / Guardians
                          </h3>
                          <div className="space-y-2">
                            {guardians.map((g: any) => (
                              <div key={g.id} className="flex items-center gap-3 text-sm">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{g.name?.[0]}</div>
                                <div className="flex-1">
                                  <span className="font-medium">{g.name}</span>
                                  <span className="text-gray-400 ml-2">({g.relationship})</span>
                                  {g.is_primary && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded ml-2">Primary</span>}
                                </div>
                                <span className="text-gray-500 text-xs">{g.phone}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Interactive Multi-School Academic Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-gray-100 bg-gray-50/75 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                            <GraduationCap size={20} className="text-purple-600" /> Multi-School Academic Journey
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">Select a school chapter and grade on the right to browse their corresponding history details.</p>
                        </div>
                        {selectedGrade && (
                          <div className="flex gap-2">
                            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                              Viewing: Grade {selectedGrade}
                            </span>
                          </div>
                        )}
                      </div>

                      {schoolTenures.length > 0 ? (
                        <div className="grid grid-cols-[1fr_180px] gap-0 min-h-[450px]">
                          {/* Left Panel: Grade Details */}
                          <div className="p-6 border-r border-gray-100 space-y-6 overflow-y-auto max-h-[600px]">
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
                                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100/80 space-y-4 shadow-sm">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <h5 className="font-bold text-indigo-900 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                              🎓 Year-End Performance Summary
                                            </h5>
                                            <p className="text-[10px] text-indigo-600 font-bold">Academic Year: {currentHistory[0].academic_year_name}</p>
                                          </div>
                                          {currentHistory[0].overall_grade && (
                                            <span className="px-3 py-1 bg-indigo-650 text-white font-extrabold rounded-full text-xs shadow-sm">
                                              Grade {currentHistory[0].overall_grade}
                                            </span>
                                          )}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                                          {currentHistory[0].percentage !== null && currentHistory[0].percentage !== undefined && (
                                            <div className="bg-white p-2.5 rounded-lg border border-indigo-50/50">
                                              <div className="font-extrabold text-slate-800 text-sm">{parseFloat(currentHistory[0].percentage).toFixed(1)}%</div>
                                              <div className="text-[9px] uppercase font-bold text-slate-400">Percentage</div>
                                            </div>
                                          )}
                                          {currentHistory[0].total_marks !== null && currentHistory[0].total_marks !== undefined && (
                                            <div className="bg-white p-2.5 rounded-lg border border-indigo-50/50">
                                              <div className="font-extrabold text-slate-800 text-sm">{parseFloat(currentHistory[0].total_marks).toFixed(0)}</div>
                                              <div className="text-[9px] uppercase font-bold text-slate-400">Total Marks</div>
                                            </div>
                                          )}
                                          {currentHistory[0].class_rank !== null && currentHistory[0].class_rank !== undefined && (
                                            <div className="bg-white p-2.5 rounded-lg border border-indigo-50/50">
                                              <div className="font-extrabold text-slate-800 text-sm">#{currentHistory[0].class_rank}</div>
                                              <div className="text-[9px] uppercase font-bold text-slate-400">Class Rank</div>
                                            </div>
                                          )}
                                          {currentHistory[0].grade_rank !== null && currentHistory[0].grade_rank !== undefined && (
                                            <div className="bg-white p-2.5 rounded-lg border border-indigo-50/50">
                                              <div className="font-extrabold text-slate-800 text-sm">#{currentHistory[0].grade_rank}</div>
                                              <div className="text-[9px] uppercase font-bold text-slate-400">Grade Rank</div>
                                            </div>
                                          )}
                                        </div>

                                        {currentHistory[0].teacher_remarks && (
                                          <div className="bg-white p-3 rounded-lg border border-indigo-100/50 text-xs">
                                            <span className="text-[10px] font-extrabold text-indigo-900 block mb-1.5">✍️ Class Teacher's Remarks</span>
                                            <p className="text-slate-600 italic font-medium font-sans">"{currentHistory[0].teacher_remarks}"</p>
                                            {currentHistory[0].class_teacher_name && (
                                              <span className="text-[9px] text-slate-400 block mt-2 text-right">— {currentHistory[0].class_teacher_name}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Transfer / Admission Details Banner */}
                                    {selectedTenure && selectedTenure.status !== 'ACTIVE' && (
                                      <div className="bg-blue-50/60 border border-blue-150 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-xs text-blue-900 gap-2">
                                        <div>
                                          <strong>Transferred Out:</strong> marked Transferred from <strong>{selectedTenure.school_name}</strong> on {selectedTenure.transferred_date ? new Date(selectedTenure.transferred_date).toLocaleDateString() : 'N/A'}.
                                        </div>
                                        {selectedTenure.admitted_to_school_name && (
                                          <div>
                                            Admitted to <strong>{selectedTenure.admitted_to_school_name}</strong> on {selectedTenure.admitted_to_date ? new Date(selectedTenure.admitted_to_date).toLocaleDateString() : 'N/A'}.
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* 1. Attendance Card */}
                                    <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                                      <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Calendar size={15} className="text-blue-500" /> Attendance Statistics
                                      </h4>
                                      {(() => {
                                        const att = (() => {
                                          if (dynamicAttendance && dynamicAttendance.total_days > 0) {
                                            return dynamicAttendance;
                                          }
                                          const mWithAtt = currentMarks.find(
                                            (m: any) => m.grade === selectedGrade &&
                                                       m.attendance_percentage !== null &&
                                                       m.attendance_percentage !== undefined &&
                                                       m.attendance_percentage !== ''
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
                                            (h: any) => h.grade_name === selectedGrade &&
                                                       h.attendance_percentage !== null &&
                                                       h.attendance_percentage !== undefined
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
                                          return <p className="text-sm text-gray-400 italic">No attendance data logged for this grade.</p>;
                                        }

                                        return (
                                          <div className="space-y-4">
                                            {att.total_days > 0 && (
                                              <div className="grid grid-cols-3 gap-3 text-center">
                                                <div className="bg-gray-50 p-2.5 rounded-lg">
                                                  <div className="text-lg font-bold text-gray-900">{att.total_days}</div>
                                                  <div className="text-[10px] uppercase font-bold text-gray-400">Total Days</div>
                                                </div>
                                                <div className="bg-green-50/50 p-2.5 rounded-lg">
                                                  <div className="text-lg font-bold text-green-600">{att.days_present}</div>
                                                  <div className="text-[10px] uppercase font-bold text-green-500">Present</div>
                                                </div>
                                                <div className="bg-red-50/50 p-2.5 rounded-lg">
                                                  <div className="text-lg font-bold text-red-500">{att.days_absent}</div>
                                                  <div className="text-[10px] uppercase font-bold text-red-700">Absent</div>
                                                </div>
                                              </div>
                                            )}
                                            <div>
                                              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                <div
                                                  className={`h-full rounded-full transition-all duration-500 ${
                                                    att.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'
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

                                    {/* 2. Academic Performance Marks */}
                                    <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                                      <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <FileText size={15} className="text-purple-500" /> Academic Results
                                      </h4>
                                      
                                      {/* Digital Report Card Display */}
                                      {currentReportCards.filter((card: any) => card.grade_name === selectedGrade).length > 0 && (
                                        <div className="mb-4 space-y-3">
                                          {currentReportCards.filter((card: any) => card.grade_name === selectedGrade).map((card: any) => (
                                            <div key={card.id} className="flex justify-between items-center p-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-sm text-purple-900">{card.term_name} Report Card</span>
                                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Grade: {card.grade_awarded}</span>
                                                </div>
                                                <p className="text-xs text-purple-700 font-medium">
                                                  Total Marks: {parseFloat(card.total_marks_obtained).toFixed(0)}/{parseFloat(card.total_marks_possible).toFixed(0)} ({parseFloat(card.percentage).toFixed(1)}%) {card.rank && `| Rank: ${card.rank}`}
                                                </p>
                                              </div>
                                              {card.file_path && (
                                                <a
                                                  href={getMediaUrl(card.file_path)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-xs bg-purple-600 text-white hover:bg-purple-700 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                                                >
                                                  View PDF
                                                </a>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {currentMarks.filter((m: any) => m.grade === selectedGrade).length > 0 ? (
                                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                                          <table className="min-w-full divide-y divide-gray-150">
                                            <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                              <tr>
                                                <th className="px-4 py-2 text-left">Subject</th>
                                                <th className="px-4 py-2 text-left">Exam</th>
                                                <th className="px-4 py-2 text-center">Score</th>
                                                <th className="px-4 py-2 text-center">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                              {currentMarks.filter((m: any) => m.grade === selectedGrade).map((mark: any, midx: number) => (
                                                <tr key={mark.id || midx} className="hover:bg-gray-50/50">
                                                  <td className="px-4 py-3 font-semibold text-gray-900">{mark.subject}</td>
                                                  <td className="px-4 py-3 text-gray-500">{mark.exam_name}</td>
                                                  <td className="px-4 py-3 text-center font-mono font-bold">
                                                    {mark.is_absent ? (
                                                      <span className="text-red-500">Absent</span>
                                                    ) : (
                                                      `${parseFloat(mark.marks_obtained).toFixed(0)}/${parseFloat(mark.total_marks).toFixed(0)}`
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-3 text-center">
                                                    {mark.is_absent ? (
                                                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">Absent</span>
                                                    ) : mark.is_pass ? (
                                                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Pass</span>
                                                    ) : (
                                                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">Fail</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : currentReportCards.filter((card: any) => card.grade_name === selectedGrade).length > 0 ? (
                                        <p className="text-xs text-gray-500 italic">No subject-wise details available in multi-year ledger. Please download the Term Report Card PDF above for detailed marks.</p>
                                      ) : (
                                        <p className="text-sm text-gray-400 italic">No subject marks recorded in multi-year ledger for Grade {selectedGrade}.</p>
                                      )}
                                    </div>

                                    {/* 3. Conduct, Remarks, Achievements */}
                                    <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                                      <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Trophy size={15} className="text-yellow-500" /> Conduct, Achievements & Remarks
                                      </h4>
                                      {currentRemarks.filter((r: any) => r.grade === selectedGrade).length > 0 ? (
                                        <div className="relative border-l border-gray-150 pl-4 ml-2 space-y-4">
                                          {currentRemarks.filter((r: any) => r.grade === selectedGrade).map((rem: any, ridx: number) => {
                                            const isNegative = rem.points && rem.points < 0;
                                            const isPositiveKarma = rem.points && rem.points > 0;
                                            
                                            return (
                                              <div key={rem.id || ridx} className="relative">
                                                {/* Bullet icon */}
                                                <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                                  isNegative ? 'bg-red-500' :
                                                  isPositiveKarma ? 'bg-green-500' :
                                                  rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-500' :
                                                  'bg-blue-500'
                                                }`} />
                                                <div className={`p-3 rounded-lg border text-sm ${
                                                  isNegative ? 'bg-red-50/50 border-red-100' :
                                                  isPositiveKarma ? 'bg-green-50/50 border-green-100' :
                                                  rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-50/30 border-yellow-100' :
                                                  'bg-gray-50 border-gray-150'
                                                }`}>
                                                  <div className="font-bold text-gray-800 mb-1">{rem.title || rem.record_type}</div>
                                                  {rem.description && <p className="text-gray-600 text-xs mt-1">{rem.description}</p>}
                                                </div>
                                                <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                                                  <span>By: <span className="font-semibold text-gray-500">{rem.teacher_name}</span></span>
                                                  {rem.points && (
                                                    <span className={`font-mono font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                                      {rem.points > 0 ? `+${rem.points}` : rem.points} Karma
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-400 italic">No conduct remarks or achievements logged for Grade {selectedGrade}.</p>
                                      )}
                                    </div>
                                  <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Heart size={15} className="text-red-500 animate-pulse" /> Infirmary Visits
                                  </h4>
                                                                  {timelineHealthLogs.filter((v: any) => v.grade === selectedGrade).length > 0 ? (
                                    <div className="space-y-3">
                                      {timelineHealthLogs.filter((v: any) => v.grade === selectedGrade).map((visit: any, vidx: number) => (
                                        <div key={visit.id || vidx} className="p-3 bg-red-50/20 border border-red-50 rounded-lg flex gap-3 text-sm">
                                          <div className="text-red-500 bg-red-50 p-2 rounded-lg h-9 w-9 flex items-center justify-center shrink-0">
                                            <Thermometer size={18} />
                                          </div>
                                          <div className="flex-1 space-y-1">
                                            <div className="flex justify-between">
                                              <span className="font-bold text-gray-900">{visit.symptom}</span>
                                              <span className="text-[10px] text-gray-400">{new Date(visit.visit_date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-500">Treatment: {visit.treatment_given}</p>
                                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                                              <span>Nurse: <span className="font-semibold text-gray-500">{visit.recorded_by}</span></span>
                                              {visit.sent_home && <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase">Sent Home</span>}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No infirmary or clinic visits recorded for Grade {selectedGrade}.</p>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <GraduationCap size={48} className="animate-bounce mb-2" />
                                <p>Select a grade on the right to browse history details.</p>
                              </div>
                            )}
                          </div>

                          {/* Right Side: Draggable vertical timeline selector */}
                          <div className="bg-gray-50/70 py-10 flex flex-col items-center select-none relative border-l border-gray-150">
                            {/* Track container */}
                            <div 
                              ref={trackRef}
                              onMouseDown={handleMouseDown}
                              onTouchStart={handleTouchStart}
                              className="relative flex-1 w-1.5 bg-gray-200 rounded-full cursor-ns-resize hover:bg-gray-300 transition-colors py-2 flex flex-col items-center justify-between"
                            >
                              {/* Glowing Active track */}
                              {sortedGrades.length > 1 && selectedGrade && (
                                <div 
                                  className="absolute top-0 bottom-0 left-0 right-0 rounded-full bg-gradient-to-b from-purple-500 via-indigo-500 to-blue-500"
                                  style={{
                                    top: `${((sortedGrades.length - 1 - sortedGrades.indexOf(selectedGrade)) / (sortedGrades.length - 1)) * 100}%`,
                                    bottom: '0%'
                                  }}
                                />
                              )}

                              {/* Grade discrete nodes */}
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

                              {/* Draggable Selector Handle Overlay */}
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
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-5 rounded-xl">
                        <p className="text-sm text-blue-800">
                            💡 <strong>Forever Accessible:</strong> This complete journey - from first day to graduation - is permanently stored and accessible to the student, family, and authorized school staff. Every achievement, every kind word from teachers, every milestone.
                        </p>
                    </div>
                </div>
            )}

        </div>
      </div>

      {/* --- MODALS --- */}
      {/* DISCIPLINE MODAL */}
      {showDisciplineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-left">
                <h3 className="font-bold text-gray-800 text-lg">Report Incident</h3>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Incident Title / Category *</label>
                    <input 
                        required
                        type="text"
                        className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-red-500" 
                        placeholder="e.g. Late Arrival, Uniform Violation" 
                        value={newIncident.category} 
                        onChange={e => setNewIncident({...newIncident, category: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Points to Deduct *</label>
                    <input 
                        required
                        type="number"
                        min="0"
                        className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-red-500" 
                        placeholder="Points (e.g. 5, 15, 50)" 
                        value={newIncident.points_deducted} 
                        onChange={e => setNewIncident({...newIncident, points_deducted: parseInt(e.target.value) || 0})} 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description / Notes</label>
                    <textarea 
                        className="w-full p-3 border rounded-xl bg-gray-50 min-h-[100px] text-sm outline-none focus:ring-2 focus:ring-red-500" 
                        placeholder="Describe what happened..." 
                        value={newIncident.description} 
                        onChange={e => setNewIncident({...newIncident, description: e.target.value})} 
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowDisciplineModal(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleReportIncident} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition-colors">Report</button>
                </div>
            </div>
        </div>
      )}

      {/* KARMA MODAL */}
      {showKarmaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-left">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Star size={20} className="text-yellow-500 fill-yellow-500"/> Award Points
                </h3>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Reason / Title *</label>
                    <input 
                        required
                        type="text"
                        className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        placeholder="Reason (e.g. Helped clean lab)" 
                        value={newKarma.title} 
                        onChange={e => setNewKarma({...newKarma, title: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Points to Award *</label>
                    <input 
                        required
                        type="number"
                        min="1"
                        className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        placeholder="Points (e.g. 5, 10, 20)" 
                        value={newKarma.points} 
                        onChange={e => setNewKarma({...newKarma, points: parseInt(e.target.value) || 0})} 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Detailed Description</label>
                    <textarea 
                        className="w-full p-3 border rounded-xl bg-gray-50 min-h-[80px] text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        placeholder="Describe context / details..." 
                        value={newKarma.description} 
                        onChange={e => setNewKarma({...newKarma, description: e.target.value})} 
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowKarmaModal(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleAwardKarma} className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transition-colors">Award</button>
                </div>
            </div>
        </div>
      )}

      {/* PASS MODAL */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-gray-800">Issue Gate Pass</h3>
                <textarea className="w-full p-3 border rounded-xl h-24 bg-gray-50" placeholder="Reason..." value={passReason} onChange={e => setPassReason(e.target.value)} />
                <div className="flex gap-3"><button onClick={() => setShowPassModal(false)} className="flex-1 py-3 text-gray-500 font-medium">Cancel</button><button onClick={handleIssuePass} className="flex-1 py-3 bg-black text-white rounded-xl font-bold">Generate</button></div>
            </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreview && previewPass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-gray-800">Digital Pass Preview</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-md border">
                <QRCode value={previewPass.id} size={160} />
              </div>
              <div className="w-full text-sm text-gray-700">
                <div><b>Student:</b> {previewPass.student_name} ({previewPass.student_suid})</div>
                <div><b>Reason:</b> {previewPass.reason}</div>
                <div><b>Issued:</b> {previewPass.issued_at ? new Date(previewPass.issued_at).toLocaleString() : previewPass.requested_at ? new Date(previewPass.requested_at).toLocaleString() : 'N/A'}</div>
                <div><b>Expires:</b> {previewPass.valid_until ? new Date(previewPass.valid_until).toLocaleString() : 'N/A'}</div>
                <div><b>Pass ID:</b> {previewPass.id}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex-1 py-3 text-gray-500 font-medium border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // open printable window with full details
                  const el = document.getElementById(`qr-${previewPass.id}`);
                  const svg = el ? el.innerHTML : '';
                  const issuedAt = previewPass.issued_at ? new Date(previewPass.issued_at).toLocaleString() : (previewPass.requested_at ? new Date(previewPass.requested_at).toLocaleString() : 'N/A');
                  const expiresAt = previewPass.valid_until ? new Date(previewPass.valid_until).toLocaleString() : 'N/A';
                  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Digital Pass - ${previewPass.id}</title></head><body style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;color:#111"><div style="width:360px;border:1px solid #e6e6e6;padding:16px;border-radius:8px"><div style="text-align:center;padding:8px;background:#fff;border-radius:6px">${svg}</div><div style="margin-top:8px;font-size:13px;color:#444"><div><b>Student:</b> ${previewPass.student_name} (${previewPass.student_suid})</div><div><b>Reason:</b> ${previewPass.reason}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${previewPass.id}</div></div></div></body></html>`;
                  const win = window.open('', '_blank');
                  if (!win) return;
                  win.document.open();
                  win.document.write(html);
                  win.document.close();
                  win.focus();
                  setTimeout(()=>{ try{ win.print(); }catch(e){} try{ win.close(); }catch(e){} }, 350);
                }}
                className="flex-1 py-3 bg-black text-white rounded-lg font-bold"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD ACHIEVEMENT MODAL */}
      {showAchievementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-left">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Trophy size={20} className="text-yellow-500 fill-yellow-500"/> Record Achievement
                </h3>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Type of Activity *</label>
                    <select
                        required
                        className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-yellow-500"
                        value={newAchievement.category}
                        onChange={e => setNewAchievement({...newAchievement, category: e.target.value})}
                    >
                        <option value="CURRICULAR">Curricular</option>
                        <option value="NON_CURRICULAR">Non-curricular</option>
                        <option value="EXTRA_CURRICULAR">Extra-curricular</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description *</label>
                    <textarea 
                        required
                        className="w-full p-3 border rounded-xl bg-gray-50 min-h-[100px] text-sm outline-none focus:ring-2 focus:ring-yellow-500" 
                        placeholder="Describe the achievement..." 
                        value={newAchievement.description} 
                        onChange={e => setNewAchievement({...newAchievement, description: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Scanned Proof / Certificate (Optional)</label>
                    <input 
                        type="file"
                        accept="image/*,application/pdf"
                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                        onChange={e => setNewAchievement({
                            ...newAchievement,
                            certificate_image: e.target.files ? e.target.files[0] : null
                        })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Accepts images and PDF files.</p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowAchievementModal(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleRecordAchievement} className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold shadow-md transition-colors">Record</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}