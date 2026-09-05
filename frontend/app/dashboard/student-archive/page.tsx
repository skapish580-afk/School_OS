'use client';

import { useState, useEffect, useRef } from 'react';
import api, { getMediaUrl } from '@/lib/api';
import { 
  Search, Filter, Calendar, FileText, Trophy, Heart, 
  Thermometer, GraduationCap, Shield, ArrowLeft, Loader2, 
  Download, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function StudentArchivePage() {
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();
  const canAdmit = isAdmin || hasPermission('students.edit_students') || hasPermission('enrollments.add_enrollment');
  const [archives, setArchives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  
  // Active directory status mapping
  const [activeStudentsMap, setActiveStudentsMap] = useState<Record<string, { id: number; status: string }>>({});
  
  // Admit Modal State
  const [admittingArchive, setAdmittingArchive] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [admitGradeId, setAdmitGradeId] = useState<string>('');
  const [admitSectionName, setAdmitSectionName] = useState<string>('');
  const [admitLoading, setAdmitLoading] = useState(false);
  const [admitError, setAdmitError] = useState<string>('');

  // Detail View State
  const [selectedArchive, setSelectedArchive] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'timeline' | 'school_history' | 'documents'>('profile');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [crossSchoolHistory, setCrossSchoolHistory] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!permissionsLoading && (isAdmin || hasPermission('student_archive.view_student_archive') || hasPermission('students.view_student_archive'))) {
      fetchArchives();
      fetchActiveStudents();
    }
  }, [permissionsLoading]);

  const marksList = selectedArchive?.timeline_data?.marks || [];
  const remarksList = selectedArchive?.timeline_data?.remarks || [];
  const healthList = selectedArchive?.timeline_data?.health || [];
  const historyList = selectedArchive?.timeline_data?.history || [];
  const reportCardsList = selectedArchive?.timeline_data?.report_cards || [];

  const uniqueGrades = Array.from(new Set([
    ...marksList.map((m: any) => m.grade),
    ...remarksList.map((r: any) => r.grade),
    ...historyList.map((h: any) => h.grade_name),
    ...reportCardsList.map((c: any) => c.grade_name)
  ])).filter(Boolean);

  const parseGrade = (g: string) => {
    if (g === 'LKG') return -2;
    if (g === 'UKG') return -1;
    const num = parseInt(g, 10);
    return isNaN(num) ? 99 : num;
  };

  const sortedGrades = uniqueGrades.sort((a, b) => parseGrade(a) - parseGrade(b));

  // Reset selected grade when selecting a different student, and fetch cross school history
  useEffect(() => {
    setSelectedGrade(null);
    if (!selectedArchive) {
      setCrossSchoolHistory([]);
      return;
    }
    const fetchHistoryBySuid = async () => {
      try {
        const res = await api.get(`/students/?suid=${selectedArchive.student_global_id}`);
        const studentsList = res.data?.results || res.data || [];
        if (studentsList.length > 0) {
          const studentId = studentsList[0].id;
          const historyRes = await api.get(`/students/${studentId}/cross_school_history/`);
          const crossSchoolData = historyRes.data?.results || historyRes.data || [];
          setCrossSchoolHistory(Array.isArray(crossSchoolData) ? crossSchoolData : []);
        }
      } catch (e) {
        console.error("Failed to fetch cross school history in archive", e);
      }
    };
    fetchHistoryBySuid();
  }, [selectedArchive]);

  // Initialize selected grade to the highest available grade for the selected student
  useEffect(() => {
    if (selectedArchive && sortedGrades.length > 0 && !selectedGrade) {
      setSelectedGrade(sortedGrades[sortedGrades.length - 1]);
    }
  }, [selectedArchive, sortedGrades, selectedGrade]);

  const fetchActiveStudents = async () => {
    try {
      const res = await api.get('/students/?status=ACTIVE');
      const data = res.data?.results || res.data || [];
      const mapping: Record<string, { id: number; status: string }> = {};
      data.forEach((s: any) => {
        if (s.suid) {
          mapping[s.suid] = { id: s.id, status: s.status };
        }
      });
      setActiveStudentsMap(mapping);
    } catch (e) {
      console.error("Failed to fetch active students", e);
    }
  };

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const res = await api.get('/timeline/archive/');
      const data = res.data?.results || res.data || [];
      setArchives(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch archives", e);
    } finally {
      setLoading(false);
    }
  };

  const openAdmitModal = async (archive: any) => {
    setAdmittingArchive(archive);
    setAdmitGradeId('');
    setAdmitSectionName('');
    setAdmitError('');
    setAdmitLoading(true);
    try {
      const res = await api.get('/academics/grades/');
      const data = res.data?.results || res.data || [];
      setGrades(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch grades", e);
      setAdmitError("Failed to fetch available grades.");
    } finally {
      setAdmitLoading(false);
    }
  };

  // Fetch sections when grade selection changes
  useEffect(() => {
    if (!admitGradeId) {
      setSections([]);
      return;
    }
    const fetchSectionsForGrade = async () => {
      try {
        const res = await api.get(`/academics/sections/?grade=${admitGradeId}`);
        const data = res.data?.results || res.data || [];
        setSections(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to fetch sections", e);
      }
    };
    fetchSectionsForGrade();
  }, [admitGradeId]);

  const handleAdmitSubmit = async () => {
    if (!admittingArchive || !admitGradeId || !admitSectionName) {
      setAdmitError("Please select both a grade and a section.");
      return;
    }
    setAdmitLoading(true);
    setAdmitError('');
    try {
      const gradeObj = grades.find((g: any) => g.id.toString() === admitGradeId.toString());
      if (!gradeObj) {
        setAdmitError("Selected grade is invalid.");
        return;
      }
      const res = await api.post(`/timeline/archive/${admittingArchive.id}/admit/`, {
        grade: gradeObj.grade_name,
        section: admitSectionName
      });
      if (res.data?.success) {
        alert("Student admitted temporarily successfully!");
        setAdmittingArchive(null);
        fetchActiveStudents();
        fetchArchives();
      } else {
        setAdmitError(res.data?.error || "Failed to admit student.");
      }
    } catch (e: any) {
      console.error("Admit failed", e);
      setAdmitError(e.response?.data?.error || e.response?.data?.detail || "An error occurred during admission.");
    } finally {
      setAdmitLoading(false);
    }
  };

  // Get unique schools from archive records for filtering
  const uniqueSchools = Array.from(new Set(archives.map((a: any) => a.school_name))).filter(Boolean);

  // Filter list
  const filteredArchives = archives.filter((item: any) => {
    // Exclude students who are re-admitted elsewhere or currently active in any school
    if (item.re_admitted || activeStudentsMap[item.student_global_id]) {
      return false;
    }

    const studentDetails = item.admission_details || {};
    const fullName = `${studentDetails.first_name || ''} ${studentDetails.last_name || ''}`.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.student_global_id.toLowerCase().includes(searchLower) || 
      fullName.includes(searchLower) ||
      item.school_name.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesSchool = schoolFilter === 'ALL' || item.school_name === schoolFilter;

    return matchesSearch && matchesStatus && matchesSchool;
  });

  // (Moved helper functions and hooks to the top of component to respect React rules)

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

  // Access check
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!isAdmin && !hasPermission('student_archive.view_student_archive') && !hasPermission('students.view_student_archive')) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-20 text-center bg-white border border-red-100 rounded-2xl shadow-xl">
        <Shield size={64} className="mx-auto text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-sm text-gray-500">
          You do not have the required permissions to view the School OS Student Archive. 
          Please contact your School Administrator for access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {selectedArchive ? (
        /* DETAIL VIEW */
        <div className="space-y-6">
          {/* Header Action bar */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {
                setSelectedArchive(null);
                setSelectedGrade(null);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-sm text-gray-600 font-medium bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition shadow-sm"
            >
              <ArrowLeft size={16} /> Back to Archives
            </button>
            <div className="flex gap-2">
              <span className={`px-3.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border flex items-center justify-center ${
                selectedArchive.status === 'WITHDRAWN' 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {selectedArchive.status}
              </span>
            </div>
          </div>

          {/* Student Header Card */}
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-6 shadow-lg border border-purple-950 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center font-bold text-2xl border border-white/20 select-none">
                {selectedArchive.admission_details?.first_name?.[0]}
                {selectedArchive.admission_details?.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  {selectedArchive.admission_details?.first_name} {selectedArchive.admission_details?.last_name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-purple-200 mt-1.5 font-medium">
                  <span className="flex items-center gap-1"><Shield size={14} /> SUID: {selectedArchive.student_global_id}</span>
                  <span>•</span>
                  <span>Origin School: {selectedArchive.school_name}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> Archived on: {new Date(selectedArchive.archived_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="shrink-0 w-full md:w-auto">
              {(() => {
                const activeInfo = activeStudentsMap[selectedArchive.student_global_id];
                if (activeInfo) {
                  return (
                    <span className="px-3.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border border-green-500/30 bg-green-500/20 text-green-200 text-center">
                      Admitted here
                    </span>
                  );
                } else if (selectedArchive.re_admitted) {
                  return (
                    <span className="px-3.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border border-blue-500/30 bg-blue-500/20 text-blue-200 text-center" title={`Admitted to ${selectedArchive.re_admitted_to_school_name}`}>
                      Admitted elsewhere
                    </span>
                  );
                } else if (canAdmit) {
                  return (
                    <button
                      onClick={() => openAdmitModal(selectedArchive)}
                      className="w-full md:w-auto px-5 py-2.5 bg-white text-purple-900 font-extrabold rounded-xl hover:bg-purple-50 transition shadow-lg text-sm flex items-center justify-center gap-2"
                    >
                      Admit Student
                    </button>
                  );
                } else {
                  return (
                    <span className="px-3.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full border border-slate-300 bg-slate-100 text-slate-700 text-center">
                      Archived
                    </span>
                  );
                }
              })()}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-gray-200 bg-white p-1.5 rounded-xl border shadow-sm max-w-lg">
            {(['profile', 'timeline', 'school_history', 'documents'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeSubTab === tab 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab === 'profile' ? 'Profile Details' : tab === 'timeline' ? 'Academic Timeline' : tab === 'school_history' ? 'School History' : 'Submitted Docs'}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="min-h-[500px]">
            {activeSubTab === 'profile' ? (
              /* TAB 1: PROFILE DETAILS */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Columns: Demographics & Admission details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* General Profile Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                      <GraduationCap size={18} className="text-purple-600" /> Core Admission Demographics
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Admission Number</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.admission_number || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Admission Date</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.admission_date ? new Date(selectedArchive.admission_details.admission_date).toLocaleDateString() : '--'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Email Address</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.email || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Gender</div>
                        <div className="font-semibold text-gray-900 mt-1 uppercase">{selectedArchive.admission_details?.gender || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Date of Birth</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.date_of_birth ? new Date(selectedArchive.admission_details.date_of_birth).toLocaleDateString() : '--'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Blood Group</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.blood_group || '--'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Medical & Address Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                      <Heart size={18} className="text-red-500" /> Health Conditions & Address
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Medical Conditions / Allergies</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.medical_conditions || 'None Declared'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Emergency Contact</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.emergency_contact_name || '--'} 
                          {selectedArchive.admission_details?.emergency_contact_phone ? ` (${selectedArchive.admission_details.emergency_contact_phone})` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Residential Address</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.address_line1 || ''} 
                          {selectedArchive.admission_details?.address_line2 ? `, ${selectedArchive.admission_details.address_line2}` : ''}
                          <br />
                          {selectedArchive.admission_details?.city || ''}, {selectedArchive.admission_details?.state || ''} - {selectedArchive.admission_details?.pincode || ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Coordinates (Latitude, Longitude)</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.latitude && selectedArchive.admission_details?.longitude 
                            ? `${selectedArchive.admission_details.latitude}, ${selectedArchive.admission_details.longitude}` 
                            : '--'}
                        </div>
                      </div>
                      {selectedArchive.admission_details?.address && (
                        <div>
                          <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Legacy Address String</div>
                          <div className="font-semibold text-gray-900 mt-1 whitespace-pre-wrap">{selectedArchive.admission_details?.address}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Demographic & Social Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                      🌍 Demographic & Social Details
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Category</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.category || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Religion</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.religion || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Mother Tongue</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.mother_tongue || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Languages Known</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.languages_known || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Nationality</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.nationality || 'Indian'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Birth Place</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.birth_place || '--'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Preferences & School Details Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                      ✨ Preferences & Special Programs
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Dietary Preference</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.dietary_preference || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">House Color</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.house_color || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">RTE Student</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.is_rte_student ? 'Yes' : 'No'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Fee Concession Applicable</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.fee_concession_applicable ? 'Yes' : 'No'}</div>
                      </div>
                      {selectedArchive.admission_details?.fee_concession_applicable && (
                        <div>
                          <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Fee Concession Amount</div>
                          <div className="font-semibold text-gray-900 mt-1">₹{selectedArchive.admission_details?.fee_concession_amount || '0.00'}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Alumni Directory Consent</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.alumni_directory_consent ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Government Identifiers Card */}
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                      🔒 Government Identifiers
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Aadhaar Number</div>
                        <div className="font-semibold text-gray-900 mt-1">
                          {selectedArchive.admission_details?.aadhaar_number 
                            ? `•••• •••• ${selectedArchive.admission_details.aadhaar_number.slice(-4)}` 
                            : (selectedArchive.admission_details?.aadhaar_last_4_digits 
                              ? `•••• •••• ${selectedArchive.admission_details.aadhaar_last_4_digits}` 
                              : '--')}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">APAAR ID</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.apaar_id || '--'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">PEN ID</div>
                        <div className="font-semibold text-gray-900 mt-1">{selectedArchive.admission_details?.pen_id || '--'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Parents/Guardians */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                  <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                    👨‍👩‍👧 Parents / Guardians
                  </h3>
                  <div className="space-y-4">
                    {selectedArchive.admission_details?.guardians && selectedArchive.admission_details.guardians.length > 0 ? (
                      selectedArchive.admission_details.guardians.map((g: any, gidx: number) => (
                        <div key={gidx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-gray-900">{g.name}</div>
                              <div className="text-xs text-gray-400 font-medium capitalize mt-0.5">{g.relationship}</div>
                            </div>
                            {g.is_primary && (
                              <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>Phone: <span className="font-medium text-gray-900">{g.phone || '--'}</span></div>
                            <div>Email: <span className="font-medium text-gray-900">{g.email || '--'}</span></div>
                            <div>Occupation: <span className="font-medium text-gray-900">{g.occupation || '--'} ({g.workplace || '--'})</span></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 italic">No parent/guardian information archived.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : activeSubTab === 'timeline' ? (
              /* TAB 2: ACADEMIC TIMELINE (Archived ledger) */
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-100 bg-gray-50/75 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
                      <GraduationCap size={20} className="text-purple-600" /> Archived Multi-Year Journey
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Drag the handle or click grade nodes on the right track to switch years</p>
                  </div>
                  {selectedGrade && (
                    <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Archived: Grade {selectedGrade} – {selectedArchive.school_name}
                    </span>
                  )}
                </div>

                {sortedGrades.length > 0 ? (
                  <div className="grid grid-cols-[1fr_80px] gap-0 min-h-[450px]">
                    {/* Left details pane */}
                    <div className="p-6 border-r border-gray-100 space-y-6 overflow-y-auto max-h-[600px]">
                      {selectedGrade ? (
                        <div key={selectedGrade} className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                          
                          {/* 1. Attendance Card */}
                          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Calendar size={15} className="text-blue-500" /> Attendance Summary
                            </h4>
                            {(() => {
                              let percentage = 0;
                              let present = 0;
                              let total = 0;
                              let found = false;
 
                              const mWithAtt = marksList.find(
                                (m: any) => m.grade === selectedGrade && 
                                           m.attendance_percentage !== null && 
                                           m.attendance_percentage !== undefined &&
                                           m.attendance_percentage !== ''
                              );
                              if (mWithAtt) {
                                percentage = parseFloat(mWithAtt.attendance_percentage);
                                present = parseInt(mWithAtt.days_present || 0, 10);
                                total = parseInt(mWithAtt.total_days || 0, 10);
                                found = true;
                              } else {
                                const hMatch = historyList.find(
                                  (h: any) => h.grade_name === selectedGrade && 
                                             h.attendance_percentage !== null && 
                                             h.attendance_percentage !== undefined
                                );
                                if (hMatch) {
                                  percentage = parseFloat(hMatch.attendance_percentage);
                                  present = parseInt(hMatch.days_present || 0, 10);
                                  total = parseInt(hMatch.total_working_days || 0, 10);
                                  found = true;
                                }
                              }
 
                              if (!found) {
                                return <p className="text-sm text-gray-400 italic">No attendance data logged for this grade configuration.</p>;
                              }
 
                              const absent = total - present;
 
                              return (
                                <div className="space-y-4">
                                  {total > 0 && (
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                      <div className="bg-gray-50 p-2.5 rounded-lg">
                                        <div className="text-lg font-bold text-gray-900">{total}</div>
                                        <div className="text-[10px] uppercase font-bold text-gray-400">Total Days</div>
                                      </div>
                                      <div className="bg-green-50/50 p-2.5 rounded-lg">
                                        <div className="text-lg font-bold text-green-600">{present}</div>
                                        <div className="text-[10px] uppercase font-bold text-green-500">Present</div>
                                      </div>
                                      <div className="bg-red-50/50 p-2.5 rounded-lg">
                                        <div className="text-lg font-bold text-red-500">{absent}</div>
                                        <div className="text-[10px] uppercase font-bold text-red-500">Absent</div>
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          percentage >= 90 ? 'bg-green-500' :
                                          percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'
                                        }`} 
                                        style={{ width: `${percentage}%` }} 
                                      />
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-xs">
                                      <span className="text-gray-400">Target: 75%</span>
                                      <span className="font-bold text-gray-700">{percentage.toFixed(1)}% Present</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* 2. Academic marks */}
                          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                              <FileText size={15} className="text-purple-500" /> Academic Results
                            </h4>

                            {/* Digital Report Card Display */}
                            {reportCardsList.filter((card: any) => card.grade_name === selectedGrade).length > 0 && (
                              <div className="mb-4 space-y-3">
                                {reportCardsList.filter((card: any) => card.grade_name === selectedGrade).map((card: any, idx: number) => (
                                  <div key={card.id || idx} className="flex justify-between items-center p-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
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

                            {marksList.filter((m: any) => m.grade === selectedGrade).length > 0 ? (
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
                                    {marksList.filter((m: any) => m.grade === selectedGrade).map((mark: any, midx: number) => (
                                      <tr key={midx} className="hover:bg-gray-50/50">
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
                            ) : reportCardsList.filter((card: any) => card.grade_name === selectedGrade).length > 0 ? (
                              <p className="text-xs text-gray-500 italic">No subject-wise details available in multi-year ledger. Please download the Term Report Card PDF above for detailed marks.</p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No subject marks recorded in multi-year ledger for Grade {selectedGrade}.</p>
                            )}
                          </div>

                          {/* 3. Conduct & Remarks */}
                          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Trophy size={15} className="text-yellow-500" /> Conduct, Remarks & Achievements
                            </h4>
                            {remarksList.filter((r: any) => r.grade === selectedGrade).length > 0 ? (
                              <div className="relative border-l border-gray-150 pl-4 ml-2 space-y-4">
                                {remarksList.filter((r: any) => r.grade === selectedGrade).map((rem: any, ridx: number) => {
                                  const isNegative = rem.points && rem.points < 0;
                                  const isPositive = rem.points && rem.points > 0;

                                  return (
                                    <div key={ridx} className="relative">
                                      <div className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                                        isNegative ? 'bg-red-500' :
                                        isPositive ? 'bg-green-500' :
                                        rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-500' :
                                        'bg-blue-500'
                                      }`} />
                                      <div className={`p-3 rounded-lg border text-sm ${
                                        isNegative ? 'bg-red-50/50 border-red-100' :
                                        isPositive ? 'bg-green-50/50 border-green-100' :
                                        rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-50/30 border-yellow-100' :
                                        'bg-gray-50 border-gray-150'
                                      }`}>
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                          <span className="font-bold text-gray-900">{rem.title}</span>
                                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                            isNegative ? 'bg-red-100 text-red-800' :
                                            isPositive ? 'bg-green-100 text-green-800' :
                                            rem.record_type === 'ACHIEVEMENT' || rem.record_type === 'AWARD' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-blue-100 text-blue-800'
                                          }`}>
                                            {rem.record_type}
                                          </span>
                                        </div>
                                        <p className="text-gray-600 mb-2">{rem.description}</p>
                                        <div className="flex justify-between items-center text-xs text-gray-400">
                                          <span>By: <span className="font-semibold text-gray-500">{rem.teacher_name}</span></span>
                                          {rem.points && (
                                            <span className={`font-mono font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
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
                              <p className="text-sm text-gray-400 italic">No remarks or achievements recorded in archive for Grade {selectedGrade}.</p>
                            )}
                          </div>

                          {/* 4. Health & Infirmary visits */}
                          <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                              <Heart size={15} className="text-red-500 animate-pulse" /> Infirmary Visits
                            </h4>
                            {healthList.filter((v: any) => v.grade === selectedGrade).length > 0 ? (
                              <div className="space-y-3">
                                {healthList.filter((v: any) => v.grade === selectedGrade).map((visit: any, vidx: number) => (
                                  <div key={vidx} className="p-3 bg-red-50/20 border border-red-50 rounded-lg flex gap-3 text-sm">
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
                              <p className="text-sm text-gray-400 italic">No clinic visits recorded for Grade {selectedGrade}.</p>
                            )}
                          </div>

                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                          <GraduationCap size={48} className="mb-2 opacity-50" />
                          <p>Select a grade configurations from the track on the right.</p>
                        </div>
                      )}
                    </div>

                    {/* Right vertical track */}
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
                    <GraduationCap size={56} className="mx-auto mb-4 opacity-20 text-purple-600" />
                    <h4 className="font-bold text-gray-700 mb-1">No Archived Academic Timeline Data</h4>
                    <p className="text-xs text-gray-500">Timeline data was not captured during the active lifecycle of this student.</p>
                  </div>
                )}
              </div>
            ) : activeSubTab === 'school_history' ? (
              /* NEW TAB: SCHOOL HISTORY (TENURES) */
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                  <Clock size={18} className="text-purple-600" /> Complete School Tenure Chain
                </h3>
                {crossSchoolHistory.length > 0 ? (
                  <div className="space-y-6 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {crossSchoolHistory.map((tenure: any, idx: number) => (
                      <div key={tenure.id || idx} className="flex gap-6 relative items-start">
                        {/* Circle node */}
                        <div className={`w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center shrink-0 z-10 ${
                          tenure.status === 'ACTIVE'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-400 text-white'
                        }`}>
                          <GraduationCap size={20} />
                        </div>
                        <div className="bg-gray-50/50 hover:bg-gray-50 border border-gray-200 p-5 rounded-2xl flex-1 transition-all">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="font-extrabold text-gray-900 text-sm">{tenure.school_name}</h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              tenure.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {tenure.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3 font-medium text-gray-700">
                            <div>
                              <span className="text-gray-400 block font-medium">Admitted On</span>
                              <span className="font-bold text-gray-805 block mt-0.5">{tenure.admitted_date ? new Date(tenure.admitted_date).toLocaleDateString() : 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">Transferred On</span>
                              <span className="font-bold text-gray-805 block mt-0.5">{tenure.transferred_date ? new Date(tenure.transferred_date).toLocaleDateString() : 'Active/N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">Starting Grade</span>
                              <span className="font-bold text-gray-805 block mt-0.5">{tenure.grade_from || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">Last Grade</span>
                              <span className="font-bold text-gray-805 block mt-0.5">{tenure.grade_to || 'N/A'}</span>
                            </div>
                          </div>

                          {tenure.admitted_to_school_name && (
                            <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-blue-800 font-medium flex items-center gap-1.5">
                              ➔ Transferred & admitted to <strong>{tenure.admitted_to_school_name}</strong> on {tenure.admitted_to_date ? new Date(tenure.admitted_to_date).toLocaleDateString() : 'N/A'}.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No cross-school tenure history records found for this student SUID.</p>
                )}
              </div>
            ) : (
              /* TAB 3: SUBMITTED DOCUMENTS */
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                  <FileText size={18} className="text-purple-600" /> Archived Admission Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedArchive.documents && selectedArchive.documents.length > 0 ? (
                    selectedArchive.documents.map((doc: any, docidx: number) => (
                      <div key={docidx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs select-none">
                            PDF
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{doc.title}</div>
                            <div className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">{doc.document_type || 'GENERAL'}</div>
                            {doc.academic_year && <div className="text-[10px] text-gray-400 mt-0.5">Year: {doc.academic_year}</div>}
                          </div>
                        </div>
                        {doc.file_url ? (
                          <a 
                            href={`${api.defaults.baseURL?.replace('/api/v1', '')}${doc.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          >
                            <Download size={16} />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No File Url</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-12 text-gray-400">
                      <FileText size={48} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No documents submitted or archived.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">School OS Student Archive</h1>
              <p className="text-sm text-gray-500 mt-1">
                Unified permanent registry containing all withdrawn and transferred students across all School OS campuses.
              </p>
            </div>
            <button 
              onClick={fetchArchives}
              className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-semibold rounded-xl hover:bg-purple-200 transition"
            >
              Refresh Data
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search SUID, student name or school name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>

            {/* School Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="ALL">All Schools</option>
                {uniqueSchools.map((sch) => (
                  <option key={sch} value={sch}>{sch}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-2" />
                <p className="text-sm">Fetching Student Archive Registry...</p>
              </div>
            ) : filteredArchives.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50/75 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4.5 text-left">Student Name</th>
                      <th className="px-6 py-4.5 text-left">SUID</th>
                      <th className="px-6 py-4.5 text-left">Origin School</th>
                      <th className="px-6 py-4.5 text-center">Status</th>
                      <th className="px-6 py-4.5 text-left">Archived Date</th>
                      <th className="px-6 py-4.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                    {filteredArchives.map((archive) => {
                      const details = archive.admission_details || {};
                      const fullName = `${details.first_name || ''} ${details.last_name || ''}`;
                      return (
                        <tr key={archive.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4.5 font-bold text-gray-900">{fullName}</td>
                          <td className="px-6 py-4.5 font-mono text-gray-500 text-xs">{archive.student_global_id}</td>
                          <td className="px-6 py-4.5 font-semibold text-gray-700">{archive.school_name}</td>
                          <td className="px-6 py-4.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${
                              archive.status === 'WITHDRAWN' 
                                ? 'bg-red-50 text-red-700 border-red-150' 
                                : 'bg-amber-50 text-amber-700 border-amber-150'
                            }`}>
                              {archive.status}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-gray-500 text-xs">
                            {new Date(archive.archived_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedArchive(archive)}
                                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                              >
                                Open Profile
                              </button>
                              {(() => {
                                const activeInfo = activeStudentsMap[archive.student_global_id];
                                if (activeInfo) {
                                  return (
                                    <span className="px-3.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold shadow-sm">
                                      Active here
                                    </span>
                                  );
                                } else if (archive.re_admitted) {
                                  return (
                                    <span className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold shadow-sm" title={`Admitted to ${archive.re_admitted_to_school_name}`}>
                                      Admitted elsewhere
                                    </span>
                                  );
                                } else if (canAdmit) {
                                  return (
                                    <button
                                      onClick={() => openAdmitModal(archive)}
                                      className="px-3.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition shadow-sm"
                                    >
                                      Admit
                                    </button>
                                  );
                                } else {
                                  return (
                                    <span className="px-3.5 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold shadow-sm">
                                      Archived
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-20 text-center text-gray-400">
                <Clock size={48} className="mx-auto mb-3 opacity-25 text-purple-600" />
                <h4 className="font-bold text-gray-700 mb-1">No Archived Student Records</h4>
                <p className="text-xs text-gray-500">
                  {searchTerm || statusFilter !== 'ALL' || schoolFilter !== 'ALL' 
                    ? 'No records matches the current search filters.' 
                    : 'The Student Enrollment Archive is empty. When a student is withdrawn/transferred, their record will populate here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIT MODAL */}
      {admittingArchive && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-150 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-purple-800 to-indigo-800 text-white p-6">
              <h3 className="text-xl font-bold">Admit Archived Student</h3>
              <p className="text-purple-200 text-xs mt-1">Initiating a temporary admission listing for this student.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Student Name</span>
                <div className="font-bold text-gray-900 text-base">
                  {admittingArchive.admission_details?.first_name} {admittingArchive.admission_details?.last_name}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">SUID</span>
                <div className="font-mono text-gray-700 text-xs font-semibold">{admittingArchive.student_global_id}</div>
              </div>
              <div className="p-3.5 bg-indigo-50 text-indigo-900 text-xs rounded-xl border border-indigo-150 flex items-start gap-2 leading-relaxed mb-4">
                <Shield size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  💡 <strong>Read-Only Passport:</strong> Records from <strong>{admittingArchive.school_name}</strong> will be preserved as a permanent, read-only chapter in the student's academic history.
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Grade</label>
                  {admitLoading && grades.length === 0 ? (
                    <div className="text-xs text-gray-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading grades...</div>
                  ) : (
                    <select
                      value={admitGradeId}
                      onChange={(e) => {
                        setAdmitGradeId(e.target.value);
                        setAdmitSectionName('');
                      }}
                      disabled={admitLoading}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="">Select Target Grade</option>
                      {grades.map((g: any) => (
                        <option key={g.id} value={g.id}>Grade {g.grade_name}</option>
                      ))}
                    </select>
                  )}
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Section</label>
                  <select
                    value={admitSectionName}
                    onChange={(e) => setAdmitSectionName(e.target.value)}
                    disabled={admitLoading || !admitGradeId}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select Section</option>
                    {sections.map((s: any) => (
                      <option key={s.id} value={s.section_letter}>Section {s.section_letter} (Remaining Capacity: {Math.max(0, (s.capacity || 0) - (s.student_count || 0))})</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 justify-end">
                <button
                  onClick={() => setAdmittingArchive(null)}
                  disabled={admitLoading}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-bold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdmitSubmit}
                  disabled={admitLoading || !admitGradeId || !admitSectionName}
                  className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {admitLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Admission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
