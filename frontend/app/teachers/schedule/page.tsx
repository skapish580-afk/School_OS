'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, Users, BookOpen, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface ClassSchedule {
  id: string;
  day: string;
  day_code?: string;
  period: number;
  start_time: string;
  end_time: string;
  subject: string;
  grade: string;
  section: string;
  room: string;
  student_count: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/timetables/my_schedule/');
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setSchedule(data);
    } catch (error) {
      console.error('Failed to fetch schedule', error);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const getClassForSlot = (day: string, period: number) => {
    return schedule.find(s => 
      (s.day.toLowerCase() === day.toLowerCase() || s.day_code?.toLowerCase() === day.substring(0, 3).toLowerCase()) &&
      s.period === period
    );
  };

  // Derive unique period numbers from schedule or default 1..6
  const existingPeriodNums = Array.from(new Set(schedule.map(s => s.period))).sort((a, b) => a - b);
  const periodNumbers = existingPeriodNums.length > 0 
    ? Array.from(new Set([...existingPeriodNums, 1, 2, 3, 4, 5, 6])).sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6];

  const totalClasses = schedule.length;

  // Calculate unique student count across distinct grade-sections
  const uniqueSectionsMap = new Map<string, number>();
  schedule.forEach(s => {
    const key = `${s.grade}-${s.section}`;
    if (!uniqueSectionsMap.has(key)) {
      uniqueSectionsMap.set(key, s.student_count || 0);
    }
  });
  const totalStudents = Array.from(uniqueSectionsMap.values()).reduce((sum, val) => sum + val, 0);
  const subjects = [...new Set(schedule.map(s => s.subject).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600 font-medium">Loading schedule from Academics Timetable...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
        <p className="text-gray-600 mt-1">Weekly timetable fetched from Academics Module</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-700">{totalClasses}</div>
              <div className="text-blue-600 text-sm font-medium">Classes This Week</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-700">{totalStudents}</div>
              <div className="text-green-600 text-sm font-medium">Total Students</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-purple-700">{subjects.length}</div>
              <div className="text-purple-600 text-sm font-medium">Assigned Subjects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-36">Period</th>
              {DAYS.map(day => (
                <th key={day} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {periodNumbers.map(pNum => {
              // Find sample times for this period number
              const sample = schedule.find(s => s.period === pNum);
              const timeDisplay = sample?.start_time && sample?.end_time 
                ? `${sample.start_time} - ${sample.end_time}` 
                : null;

              return (
                <tr key={pNum} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-semibold text-gray-900">Period {pNum}</div>
                    {timeDisplay && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                        <Clock size={12} />
                        {timeDisplay}
                      </div>
                    )}
                  </td>
                  {DAYS.map(day => {
                    const classInfo = getClassForSlot(day, pNum);
                    
                    return (
                      <td key={day} className="px-2 py-2">
                        {classInfo ? (
                          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                            <div className="font-semibold text-gray-900 text-sm mb-1">
                              {classInfo.subject}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div className="flex items-center justify-between font-medium">
                                <span>Grade {classInfo.grade}{classInfo.section}</span>
                                <span className="flex items-center gap-1 text-green-700 font-bold">
                                  <Users size={12} />
                                  {classInfo.student_count}
                                </span>
                              </div>
                              {classInfo.room && (
                                <div className="text-gray-500 font-medium">Room: {classInfo.room}</div>
                              )}
                              {classInfo.start_time && classInfo.end_time && !timeDisplay && (
                                <div className="text-gray-500 text-[10px]">
                                  {classInfo.start_time} - {classInfo.end_time}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="h-20 bg-gray-50/50 rounded-lg flex items-center justify-center border border-dashed border-gray-200">
                            <span className="text-xs text-gray-400 font-medium">Free</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Subject-wise Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Subject-wise Breakdown</h2>
        {subjects.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 flex items-center justify-center gap-2">
            <AlertCircle size={18} className="text-amber-500" />
            <span>No subject timetable entries assigned to your teacher login.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {subjects.map(subject => {
              const classes = schedule.filter(s => s.subject === subject);
              const secMap = new Map<string, number>();
              classes.forEach(s => {
                const key = `Grade ${s.grade}${s.section}`;
                if (!secMap.has(key)) {
                  secMap.set(key, s.student_count || 0);
                }
              });
              const subjectStudents = Array.from(secMap.values()).reduce((sum, val) => sum + val, 0);
              const sectionList = Array.from(secMap.keys());
              
              return (
                <div key={subject} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <div className="font-semibold text-gray-900">{subject}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {sectionList.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{classes.length} {classes.length === 1 ? 'period' : 'periods'}/week</div>
                    <div className="text-xs text-gray-500 font-medium">{subjectStudents} total students</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
