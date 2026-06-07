'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useRouter, useParams } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import Link from 'next/link';
import QRCode from "react-qr-code"; 
import { 
  ArrowLeft, Mail, Phone, User, Shield, Edit, 
  AlertTriangle, Star, ThumbsUp, Plus, X, 
  Thermometer, Heart, Activity, Clock, Loader2,
  MapPin, Calendar, CheckCircle, GraduationCap, ChevronDown, ChevronUp,
  Trophy, Award, Medal, FileText, TrendingUp, Users, Download
} from 'lucide-react';

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

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams(); 
  
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  // --- STATE ---
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'behavior' | 'gatepass' | 'health' | 'achievements' | 'journey'>('journey');

  // Module Data
  const [timeline, setTimeline] = useState<any[]>([]); 
  const [karmaScore, setKarmaScore] = useState<any>(null);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [healthProfile, setHealthProfile] = useState<any>(null);
  const [clinicVisits, setClinicVisits] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [fullProfile, setFullProfile] = useState<any>(null);

  const { settings } = useSettings();

  // Modals
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [showKarmaModal, setShowKarmaModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewPass, setPreviewPass] = useState<any>(null);

  // Forms
  const [newIncident, setNewIncident] = useState({ category: 'UNIFORM', severity: 'LOW', description: '' });
  const [newKarma, setNewKarma] = useState({ title: '', points: 10 });
  const [passReason, setPassReason] = useState('');

  // --- FETCH DATA ---
  useEffect(() => {
    if (!id || id === 'undefined') return;

    setLoading(true);
    api.get(`/students/${id}/`).then(res => {
      setStudent(res.data);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load student", err);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id || id === 'undefined') return;
    
    if (activeTab === 'behavior') fetchBehaviorData();
    if (activeTab === 'gatepass') fetchGatePasses();
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
              severity: r.severity
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
        
        // Get guardians/parents info
        try {
          const guardiansRes = await api.get(`/students/${id}/guardians/`);
          const guardiansList = guardiansRes.data?.results || guardiansRes.data || [];
          setGuardians(Array.isArray(guardiansList) ? guardiansList : []);
        } catch (e) { console.warn("Guardians fetch failed", e); }
        
        // Get full profile
        try {
          const profileRes = await api.get(`/students/${id}/profile/`);
          setFullProfile(profileRes.data);
        } catch (e) { console.warn("Full profile fetch failed", e); }
        
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
          setNewIncident({ category: 'UNIFORM', severity: 'LOW', description: '' });
          fetchBehaviorData();
          alert("Incident Reported.");
      } catch (e) { alert("Failed to report incident."); }
  };

  const handleAwardKarma = async () => {
      try {
          await api.post('/discipline/award_karma/', { student: id, ...newKarma });
          setShowKarmaModal(false);
          setNewKarma({ title: '', points: 10 });
          fetchBehaviorData();
          alert("Points Awarded!");
      } catch (e) { alert("Failed to award points."); }
  };

  const handleIssuePass = async () => {
      if (!passReason || !passReason.trim()) {
        alert('Please enter a reason for the pass.');
        return;
      }

      const payload = { student: id, reason: passReason };
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
  if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
          <Loader2 className="animate-spin mr-2" /> Loading Student Profile...
      </div>
  );

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
                    <Link href={`/dashboard/students/${id}/edit`}>
                        <button className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <Edit size={16} /> Edit Details
                        </button>
                    </Link>
              </div>
          </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
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
            {['journey', 'achievements', 'behavior', 'profile', 'gatepass', 'health'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeTab === tab 
                        ? 'border-b-2 border-black text-black' 
                        : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
                    }`}
                >
                    {tab === 'gatepass' ? 'Digital Pass' : tab}
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
                                <dt className="text-gray-500">Admission Date</dt>
                                <dd className="font-medium text-gray-900">{student.admission_date}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Category</dt>
                                <dd className="font-medium text-gray-900">{student.category || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Religion</dt>
                                <dd className="font-medium text-gray-900">{student.religion || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Mother Tongue</dt>
                                <dd className="font-medium text-gray-900">{student.mother_tongue || "--"}</dd>
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
                                <dd className="font-medium text-gray-900">{student.birth_place || "--"}</dd>
                            </div>
                        </dl>
                        <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {student.address || "No address provided."}
                        </p>
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
                                <dt className="text-gray-500">Aadhaar (Last 4)</dt>
                                <dd className="font-medium text-gray-900">{student.aadhaar_last_4_digits || "****"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">APAAR ID</dt>
                                <dd className="font-medium text-gray-900">{student.apaar_id || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">PEN ID</dt>
                                <dd className="font-medium text-gray-900">{student.pen_id || "--"}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                            <Activity size={20} className="text-blue-600"/> Additional Info
                        </h3>
                        <dl className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">House Color</dt>
                                <dd className="font-medium text-gray-900">{student.house_color || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Dietary Preference</dt>
                                <dd className="font-medium text-gray-900">{student.dietary_preference || "--"}</dd>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <dt className="text-gray-500">Languages</dt>
                                <dd className="font-medium text-gray-900">{student.languages_known || "--"}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            )}

            {/* BEHAVIOR TAB */}
            {activeTab === 'behavior' && (
                <div className="space-y-8">
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg col-span-2 flex items-center justify-between relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="text-indigo-100 font-medium text-xs uppercase tracking-wider mb-1 flex items-center gap-2"><Star size={14}/> Karma Score</div>
                                <div className="text-5xl font-bold tracking-tight">{karmaScore?.net_score || 100}</div>
                                <div className="text-indigo-200 text-sm mt-2 font-medium">Status: {karmaScore?.status || 'Good Standing'}</div>
                            </div>
                            <div className="h-32 w-32 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm absolute -right-4 -bottom-4">
                                <ThumbsUp size={48} className="text-white/30" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button onClick={() => setShowKarmaModal(true)} className="w-full h-1/2 bg-green-50 border border-green-100 hover:bg-green-100 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                                <Plus size={18}/> Award Karma
                            </button>
                            <button onClick={() => setShowDisciplineModal(true)} className="w-full h-1/2 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                                <AlertTriangle size={18}/> Report Incident
                            </button>
                        </div>
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
                        <button onClick={() => setShowPassModal(true)} className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2">
                            <Plus size={16}/> New Pass
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {gatePasses.map((pass) => (
                          <div key={pass.id} className={`group bg-white rounded-2xl border p-6 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md ${pass.status === 'ACTIVE' ? 'border-green-500 shadow-sm ring-1 ring-green-100' : 'border-gray-200 opacity-70 grayscale'}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${pass.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{pass.status}</span>
                                    {pass.status === 'ACTIVE' && <div className="animate-pulse w-2 h-2 rounded-full bg-green-500"></div>}
                                </div>
                                <button
                                  onClick={() => { setPreviewPass(pass); setShowPrintPreview(true); }}
                                  className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-2 rounded-full border shadow-sm z-30"
                                  title="Show print preview"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="2" ry="2"/></svg>
                                </button>
                                <div className="text-center py-2 flex justify-center">
                                    {pass.status === 'ACTIVE' ? (
                                            <div className="bg-white p-2 inline-block rounded-xl border border-gray-100 shadow-inner relative">
                                                <div id={`qr-${pass.id}`}> 
                                                  <QRCode value={JSON.stringify({ id: pass.id, name: displayName, exp: pass.valid_until })} size={120} />
                                                </div>
                                            </div>
                                        ) : (
                                        <div className="h-[138px] w-[138px] flex items-center justify-center text-gray-300 font-mono text-xs border-2 border-dashed border-gray-200 rounded-xl">EXPIRED</div>
                                    )}
                                </div>
                                <div className="space-y-1 text-center">
                                    <div className="font-bold text-gray-900 text-sm">{pass.reason}</div>
                                    <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><Clock size={12}/> Expires: {new Date(pass.valid_until).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                            </div>
                        ))}
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
                                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Allergies</label><div className="text-sm font-medium text-gray-700 mt-1">{healthProfile?.allergies || "None reported"}</div></div>
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
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-2xl text-white shadow-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-yellow-100 text-sm font-medium mb-2">Total Achievements</div>
                                <div className="text-5xl font-bold">{achievements.length}</div>
                            </div>
                            <Star size={80} className="text-white/20" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {achievements.length === 0 ? (
                            <div className="col-span-2 text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
                                No achievements yet. Keep up the good work!
                            </div>
                        ) : achievements.map((achievement) => (
                            <div key={achievement.id} className="bg-white p-6 rounded-xl border-2 border-yellow-200 shadow-sm hover:shadow-lg transition">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Star size={24} className="text-yellow-600" fill="currentColor" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-bold text-yellow-600 uppercase">{achievement.category}</span>
                                        <h4 className="font-bold text-gray-900 mt-1">{achievement.title}</h4>
                                        <p className="text-sm text-gray-600 mt-2">{achievement.description}</p>
                                        <div className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                                            <Calendar size={12} /> {achievement.date_awarded}
                                        </div>
                                    </div>
                                </div>
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
                          {studentHistory.length > 0 
                            ? `${studentHistory.length} years of academic excellence from ${[...studentHistory].reverse()[0]?.grade_name || 'LKG'} to ${currentClass}`
                            : `Currently in ${currentClass}`
                          }
                        </p>
                        {studentHistory.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-4 text-sm">
                            <div className="bg-white/20 px-3 py-1 rounded-full">
                              🏆 {studentHistory.reduce((sum, y) => sum + (y.awards_count || 0), 0)} Awards
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full">
                              📜 {studentHistory.reduce((sum, y) => sum + (y.certificates_count || 0), 0)} Certificates
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded-full">
                              ⭐ {studentHistory.reduce((sum, y) => sum + (y.net_karma || 0), 0)} Karma Points
                            </div>
                          </div>
                        )}
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

                    {/* LinkedIn-Style Academic Timeline */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                          <GraduationCap size={20} className="text-blue-600" /> Academic Timeline
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Click on any year to expand details, awards, and attendance</p>
                      </div>
                      
                      {studentHistory.length > 0 ? (
                        <div className="relative">
                          {/* Timeline Line */}
                          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-gray-200" />
                          
                          {/* Timeline Items - sorted oldest to newest */}
                          <div className="divide-y divide-gray-100">
                            {[...studentHistory].reverse().map((year: any, idx: number) => (
                              <TimelineYearCard 
                                key={year.id || idx} 
                                year={year} 
                                isLast={idx === studentHistory.length - 1}
                                isFirst={idx === 0}
                                studentName={displayName}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-400">
                          <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
                          <p>No academic history recorded yet.</p>
                          <p className="text-xs mt-1">History will appear here as the student progresses through grades.</p>
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
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-gray-800">Report Incident</h3>
                <select className="w-full p-3 border rounded-xl bg-gray-50" value={newIncident.category} onChange={e => setNewIncident({...newIncident, category: e.target.value})}>
                    <option value="UNIFORM">Uniform Issue</option>
                    <option value="LATE">Late Arrival</option>
                    <option value="HOMEWORK">Homework</option>
                    <option value="DISRUPTIVE">Disruptive Behavior</option>
                </select>
                <textarea className="w-full p-3 border rounded-xl bg-gray-50 min-h-[100px]" placeholder="Describe what happened..." value={newIncident.description} onChange={e => setNewIncident({...newIncident, description: e.target.value})} />
                <div className="flex gap-3"><button onClick={() => setShowDisciplineModal(false)} className="flex-1 py-3 text-gray-500 font-medium">Cancel</button><button onClick={handleReportIncident} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Report</button></div>
            </div>
        </div>
      )}

      {/* KARMA MODAL */}
      {showKarmaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Star size={20} className="text-yellow-500"/> Award Points</h3>
                <input className="w-full p-3 border rounded-xl bg-gray-50" placeholder="Reason..." value={newKarma.title} onChange={e => setNewKarma({...newKarma, title: e.target.value})} />
                <select className="w-full p-3 border rounded-xl bg-gray-50" value={newKarma.points} onChange={e => setNewKarma({...newKarma, points: parseInt(e.target.value)})}>
                    <option value="5">+5</option><option value="10">+10</option><option value="20">+20</option>
                </select>
                <div className="flex gap-3"><button onClick={() => setShowKarmaModal(false)} className="flex-1 py-3 text-gray-500 font-medium">Cancel</button><button onClick={handleAwardKarma} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold">Award</button></div>
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

    </div>
  );
}