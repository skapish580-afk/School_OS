'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Loader2, Clock, ArrowLeft, Edit2, Trash2, Calendar } from 'lucide-react';
import Modal from '@/components/Modal';
import { usePermissionContext } from '@/lib/rbac-context';

interface Period {
  id: string;
  day: string;
  day_display?: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  subject_id: string;
  teacher_name: string | null;
  teacher_id: number | null;
}

interface Timetable {
  id: string;
  section_name: string;
  section_id: string;
  grade_name?: string;
  section_letter?: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Teacher {
  id: number;
  name: string;
}

const DAYS_OF_WEEK = [
  { code: 'MON', name: 'Monday' },
  { code: 'TUE', name: 'Tuesday' },
  { code: 'WED', name: 'Wednesday' },
  { code: 'THU', name: 'Thursday' },
  { code: 'FRI', name: 'Friday' },
  { code: 'SAT', name: 'Saturday' },
];

export default function TimetableDetailPage() {
  const params = useParams();
  const timetableId = params?.id as string;
  
  const { hasPermission, isAdmin, permissions, loading: permissionsLoading } = usePermissionContext();
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Period Number sequence recovery states
  const [nextPeriodNumber, setNextPeriodNumber] = useState<number>(1);
  const [missingPeriods, setMissingPeriods] = useState<number[]>([]);
  const [isAddingMissing, setIsAddingMissing] = useState(false);

  const [formData, setFormData] = useState({
    day: 'MON',
    period_number: '1',
    start_time: '09:00',
    end_time: '10:00',
    subject_id: '',
    teacher_id: '',
  });

  const canAddTimetable = isAdmin || hasPermission('academics.add_timetable');

  useEffect(() => {
    if (timetableId && !permissionsLoading && canAddTimetable) {
      fetchTimetableDetails();
      fetchPeriods();
    }
  }, [timetableId, permissionsLoading, canAddTimetable]);

  const fetchTimetableDetails = async () => {
    try {
      const response = await api.get(`/academics/timetables/${timetableId}/`);
      setTimetable(response.data);
      if (response.data.section_id) {
        fetchSubjectsForSection(response.data.section_id);
      }
    } catch (error) {
      console.error('Failed to load timetable', error);
      setError('Failed to load timetable details');
    }
  };

  const fetchSubjectsForSection = async (sectionId: string) => {
    try {
      const response = await api.get(`/academics/subject-mappings/?section=${sectionId}&is_active=true`);
      const mappings = Array.isArray(response.data) ? response.data : response.data.results || [];
      const allocatedSubjects = mappings.map((m: any) => ({
        id: m.subject_id,
        name: m.subject_name
      }));
      // Filter out duplicate subjects
      const uniqueSubjects: Subject[] = [];
      const seenIds = new Set();
      allocatedSubjects.forEach((sub: any) => {
        if (sub.id && !seenIds.has(sub.id)) {
          seenIds.add(sub.id);
          uniqueSubjects.push(sub);
        }
      });
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Failed to load subjects', error);
    }
  };

  const [allSchoolPeriods, setAllSchoolPeriods] = useState<Period[]>([]);

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  const minutesToTime = (totalMinutes: number): string => {
    const normalized = (totalMinutes + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getDefaultTimesForPeriod = (targetPeriodNumber: number, existingPeriods: Period[]) => {
    // 1. Check if current timetable has an existing period for this period_number
    const sameNumCurrent = existingPeriods.find(p => p.period_number === targetPeriodNumber);
    if (sameNumCurrent && sameNumCurrent.start_time && sameNumCurrent.end_time) {
      return {
        start_time: sameNumCurrent.start_time.substring(0, 5),
        end_time: sameNumCurrent.end_time.substring(0, 5),
      };
    }

    // 2. Check if ANY timetable in the school has an existing period for this period_number
    const sameNumSchool = allSchoolPeriods.find(p => p.period_number === targetPeriodNumber);
    if (sameNumSchool && sameNumSchool.start_time && sameNumSchool.end_time) {
      return {
        start_time: sameNumSchool.start_time.substring(0, 5),
        end_time: sameNumSchool.end_time.substring(0, 5),
      };
    }

    // 3. Check for previous period (targetPeriodNumber - 1) in current timetable or school
    const combinedPeriods = [...existingPeriods, ...allSchoolPeriods];
    const prevPeriod = combinedPeriods
      .filter(p => p.period_number < targetPeriodNumber)
      .sort((a, b) => b.period_number - a.period_number)[0];

    if (prevPeriod && prevPeriod.start_time && prevPeriod.end_time) {
      const prevStartMins = timeToMinutes(prevPeriod.start_time);
      const prevEndMins = timeToMinutes(prevPeriod.end_time);
      const duration = prevEndMins - prevStartMins;
      const validDuration = duration > 0 ? duration : 40;

      const calcStartMins = prevEndMins;
      const calcEndMins = calcStartMins + validDuration;

      return {
        start_time: minutesToTime(calcStartMins),
        end_time: minutesToTime(calcEndMins),
      };
    }

    // 4. Fallback default if no period exists in school yet
    return {
      start_time: '07:00',
      end_time: '07:40',
    };
  };

  const fetchSequenceInfo = async (dayCode: string, overridePeriodNum?: number) => {
    try {
      const response = await api.get(`/academics/timetables/${timetableId}/missing_periods/?day=${dayCode}`);
      setNextPeriodNumber(response.data.next_period);
      setMissingPeriods(response.data.missing_periods);
      
      setFormData(prev => {
        if (editingId) return prev;
        const targetNum = overridePeriodNum ?? response.data.next_period;
        const defaultTimes = getDefaultTimesForPeriod(targetNum, periods);
        return {
          ...prev,
          day: dayCode,
          period_number: targetNum.toString(),
          start_time: defaultTimes.start_time,
          end_time: defaultTimes.end_time,
        };
      });
    } catch (err) {
      console.error('Failed to fetch sequence info', err);
    }
  };

  const handlePeriodNumberChange = (pNumStr: string) => {
    const pNum = parseInt(pNumStr, 10) || 1;
    const defaultTimes = getDefaultTimesForPeriod(pNum, periods);
    setFormData(prev => ({
      ...prev,
      period_number: pNumStr,
      start_time: defaultTimes.start_time,
      end_time: defaultTimes.end_time,
    }));
    if (formData.subject_id) {
      fetchTeachersForSubject(formData.subject_id, formData.day, pNum);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setIsAddingMissing(false);
    setTeachers([]);
    fetchSequenceInfo('MON');
    setShowModal(true);
  };

  const fetchTeachersForSubject = async (subjectId: string, currentDay?: string, currentPNum?: number) => {
    const selectedSub = subjects.find(s => s.id === subjectId);
    if (!selectedSub) return;
    
    setLoadingTeachers(true);
    try {
      const teacherMap = new Map();

      // 1. Fetch teachers directly assigned to this subject in SubjectMapping for this section
      if (timetable?.section_id) {
        try {
          const mappingRes = await api.get(`/academics/subject-mappings/?section=${timetable.section_id}&subject=${subjectId}&is_active=true`);
          const mappings = Array.isArray(mappingRes.data) ? mappingRes.data : mappingRes.data.results || [];
          mappings.forEach((m: any) => {
            if (m.teacher_id && m.teacher_name) {
              teacherMap.set(m.teacher_id, {
                id: m.teacher_id,
                name: m.teacher_name
              });
            }
          });
        } catch (mErr) {
          console.error('Failed to fetch subject mappings for section', mErr);
        }
      }

      // 2. Fetch teachers assigned via Teacher Assignments filtered by Subject, Grade, AND Section
      let url = `/teachers/assignments/?role=SUBJECT_TEACHER&subject=${encodeURIComponent(selectedSub.name)}&is_active=true`;
      if (timetable?.grade_name) {
        url += `&grade=${encodeURIComponent(timetable.grade_name)}`;
      }
      if (timetable?.section_letter) {
        url += `&section=${encodeURIComponent(timetable.section_letter)}`;
      }

      const response = await api.get(url);
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      data.forEach((asm: any) => {
        if (asm.teacher && asm.teacher_name) {
          teacherMap.set(asm.teacher, {
            id: asm.teacher,
            name: asm.teacher_name
          });
        }
      });

      // 3. Filter out any teachers who are already assigned to a period on the target day and period_number in DIFFERENT timetables
      const targetDay = currentDay || formData.day;
      const targetPNum = currentPNum ?? parseInt(formData.period_number, 10);
      const busyTeacherIds = new Set<number>();

      if (targetDay && !isNaN(targetPNum)) {
        try {
          const busyRes = await api.get(`/academics/periods/?day=${targetDay}`);
          const busyPeriods = Array.isArray(busyRes.data) ? busyRes.data : busyRes.data.results || [];
          busyPeriods.forEach((bp: any) => {
            if (editingId && bp.id === editingId) return;
            // Only mark as busy if assigned in a DIFFERENT timetable/section
            if (bp.timetable !== timetableId && bp.period_number === targetPNum && bp.teacher_id) {
              busyTeacherIds.add(bp.teacher_id);
            }
          });
        } catch (bErr) {
          console.error('Failed to check busy teachers', bErr);
        }
      }

      const availableTeachers = Array.from(teacherMap.values()).filter(
        t => !busyTeacherIds.has(t.id)
      );

      setTeachers(availableTeachers);
    } catch (err) {
      console.error('Failed to load teachers for subject', err);
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const [currRes, schoolRes] = await Promise.all([
        api.get(`/academics/periods/?timetable=${timetableId}`),
        api.get('/academics/periods/')
      ]);
      const currData = Array.isArray(currRes.data) ? currRes.data : currRes.data.results || [];
      const schoolData = Array.isArray(schoolRes.data) ? schoolRes.data : schoolRes.data.results || [];
      setPeriods(currData);
      setAllSchoolPeriods(schoolData);
    } catch (error) {
      console.error('Failed to load periods', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        timetable_id: timetableId,
        day: formData.day,
        period_number: parseInt(formData.period_number),
        start_time: formData.start_time,
        end_time: formData.end_time,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id ? parseInt(formData.teacher_id) : null,
      };

      if (editingId) {
        await api.put(`/academics/periods/${editingId}/`, payload);
      } else {
        await api.post('/academics/periods/', payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({
        day: 'MON',
        period_number: '1',
        start_time: '09:00',
        end_time: '10:00',
        subject_id: '',
        teacher_id: '',
      });
      setTeachers([]);
      fetchPeriods();
      fetchSequenceInfo(payload.day);
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData) {
        const errorMessages = Object.values(errorData).flat().join(', ');
        setError(errorMessages || 'Failed to save period');
      } else {
        setError('Failed to save period');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (period: Period) => {
    if (confirm('Are you sure you want to delete this period?')) {
      try {
        await api.delete(`/academics/periods/${period.id}/`);
        fetchPeriods();
        fetchSequenceInfo(period.day);
      } catch (error) {
        setError('Failed to delete period');
      }
    }
  };

  const handleEdit = (period: Period) => {
    setEditingId(period.id);
    setIsAddingMissing(false);
    setFormData({
      day: period.day,
      period_number: period.period_number.toString(),
      start_time: period.start_time.substring(0, 5),
      end_time: period.end_time.substring(0, 5),
      subject_id: period.subject_id,
      teacher_id: period.teacher_id?.toString() || '',
    });
    if (period.subject_id) {
      fetchTeachersForSubject(period.subject_id);
    }
    setShowModal(true);
  };

  const currentUserId = permissions?.user_id;
  const isCreator = timetable?.created_by === currentUserId;
  const canManage = isAdmin || (hasPermission('academics.add_timetable') && isCreator);

  if (permissionsLoading || loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-green-600" size={40} />
      </div>
    );
  }

  if (!canAddTimetable) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg mx-auto mt-12 text-center gap-4">
        <Calendar size={48} className="text-red-500" />
        <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to view or manage the Timetable section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/dashboard/academics/timetable" className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={24} className="text-gray-600" />
        </a>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Periods</h1>
          <p className="text-gray-600 mt-1">{timetable?.section_name}</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 border border-green-200 p-4 rounded-xl">
        <p className="text-sm text-green-800">
          <strong>Tip:</strong> Create periods for each day and time slot. Collision protection ensures time slots do not overlap on the same day.
        </p>
      </div>

      {/* Add Button */}
      {canManage && (
        <button
          onClick={openAddModal}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Plus size={20} /> Add Period
        </button>
      )}

      {/* Periods List grouped by Day of Week */}
      {periods.length === 0 ? (
        <div className="bg-gray-50 p-12 rounded-xl text-center text-gray-500">
          <Clock size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No periods defined yet</p>
          <p className="text-sm mt-2">Add periods to create the daily schedule</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {DAYS_OF_WEEK.map((day) => {
            const dayPeriods = periods
              .filter((p) => p.day === day.code)
              .sort((a, b) => a.period_number - b.period_number);

            return (
              <div key={day.code} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Day Header */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-gray-900">{day.name}</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold">
                    {dayPeriods.length} Periods
                  </span>
                </div>

                {/* Day Periods */}
                <div className="p-6 divide-y divide-gray-150">
                  {dayPeriods.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-2">No periods scheduled for {day.name}</p>
                  ) : (
                    dayPeriods.map((period, idx) => (
                      <div
                        key={period.id}
                        className={`flex items-center justify-between py-4 ${idx === 0 ? 'pt-0' : ''} ${
                          idx === dayPeriods.length - 1 ? 'pb-0' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="font-bold text-gray-900 text-base">Period {period.period_number}</span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded">
                              <Clock size={12} /> {period.start_time.substring(0, 5)} - {period.end_time.substring(0, 5)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 font-medium">
                            {period.subject_name ? (
                              <span>
                                <strong className="text-green-700">{period.subject_name}</strong>
                                {period.teacher_name && (
                                  <span className="text-gray-500 ml-2">by {period.teacher_name}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">No subject</span>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(period)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(period)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Period' : 'Add Period'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Day of Week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day of Week*
            </label>
            <select
              value={formData.day}
              onChange={(e) => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, day: val }));
                if (!editingId) {
                  setIsAddingMissing(false);
                  fetchSequenceInfo(val);
                }
                if (formData.subject_id) {
                  fetchTeachersForSubject(formData.subject_id, val);
                }
              }}
              disabled={!!editingId}
              className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              required
            >
              {DAYS_OF_WEEK.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Period Number with Auto-increment or Missing recovery */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Period Number*
              </label>
              {!editingId && missingPeriods.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isAddingMissing;
                    setIsAddingMissing(nextMode);
                    const targetNumStr = nextMode ? (missingPeriods[0]?.toString() || '1') : nextPeriodNumber.toString();
                    handlePeriodNumberChange(targetNumStr);
                  }}
                  className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline cursor-pointer"
                >
                  {isAddingMissing ? 'Use next incremented number' : 'Add a missing period'}
                </button>
              )}
            </div>

            {isAddingMissing && !editingId ? (
              <select
                value={formData.period_number}
                onChange={(e) => handlePeriodNumberChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                {missingPeriods.map(p => (
                  <option key={p} value={p}>Period {p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={`Period ${formData.period_number}`}
                disabled
                className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-650 rounded-lg"
              />
            )}
          </div>

          {/* Start Time */}
          {(() => {
            const activeDefault = getDefaultTimesForPeriod(parseInt(formData.period_number, 10) || 1, periods);
            return (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time (HH:MM)*
                  </label>
                  <input
                    type="text"
                    placeholder={activeDefault.start_time}
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time (HH:MM)*
                  </label>
                  <input
                    type="text"
                    placeholder={activeDefault.end_time}
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </>
            );
          })()}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject*
            </label>
            <select
              value={formData.subject_id}
              onChange={(e) => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, subject_id: val, teacher_id: '' }));
                if (val) {
                  fetchTeachersForSubject(val);
                } else {
                  setTeachers([]);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Teacher */}
          {formData.subject_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Teacher*
              </label>
              <select
                value={formData.teacher_id}
                onChange={(e) => setFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">{loadingTeachers ? 'Loading teachers...' : 'Select Teacher'}</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Submit / Cancel Footer Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-105 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingId(null);
              }}
              className="flex-1 px-5 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:bg-gray-400 flex justify-center items-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : (editingId ? 'Update Period' : 'Add Period')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
