'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, BookOpen, MapPin, Sparkles, User, 
  Grid, ListFilter, ShieldCheck, CheckCircle2, Info, AlertCircle
} from 'lucide-react';
import api from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleEntry {
  id: string;
  day: string;
  day_code?: string;
  period: number;
  start_time: string;
  end_time: string;
  subject: string;
  subject_code?: string;
  teacher: string;
  room: string;
  is_today?: boolean;
}

export default function StudentSchedulePage() {
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [viewMode, setViewMode] = useState<'matrix' | 'day'>('matrix');

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const response = await api.get('/academics/timetables/student_schedule/');
      const data = response.data;
      setScheduleData(data);

      const items: ScheduleEntry[] = data.schedule || [];
      setSchedule(items);

      if (data.today_day && DAYS.includes(data.today_day)) {
        setSelectedDay(data.today_day);
      } else {
        setSelectedDay('Monday');
      }
    } catch (error) {
      console.error('Failed to fetch student schedule', error);
      // Fallback sample data if timetable is not configured yet
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      setScheduleData({
        today_day: DAYS.includes(todayName) ? todayName : 'Tuesday',
        school_name: 'School OS Academy',
        class_name: 'Enrolled Class',
        student_name: 'Student'
      });
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const todayDayName = scheduleData?.today_day || new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Helper to find class slot for a day and period
  const getClassForSlot = (day: string, period: number) => {
    return schedule.find(s => 
      (s.day.toLowerCase() === day.toLowerCase() || 
       s.day_code?.toLowerCase() === day.substring(0, 3).toLowerCase()) &&
      s.period === period
    );
  };

  // Derive unique periods (1..6 minimum)
  const existingPeriodNums = Array.from(new Set(schedule.map(s => s.period))).sort((a, b) => a - b);
  const periodNumbers = existingPeriodNums.length > 0 
    ? Array.from(new Set([...existingPeriodNums, 1, 2, 3, 4, 5, 6])).sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6];

  const currentDaySchedule = schedule.filter(s => 
    s.day.toLowerCase() === selectedDay.toLowerCase() ||
    s.day_code?.toLowerCase() === selectedDay.substring(0, 3).toLowerCase()
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-indigo-600" /> View-Only Access
            </span>
            {scheduleData?.class_name && (
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-extrabold">
                {scheduleData.class_name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={22} />
            </div>
            Class Schedule & Timetable
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official class schedule synced directly from the School Admin Timetable module.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-md">
            <Sparkles size={16} className="text-amber-300" />
            <div className="text-left">
              <span className="text-[10px] text-indigo-200 uppercase font-bold block leading-none">Today is</span>
              <span className="text-sm font-black">{todayDayName}</span>
            </div>
          </div>

          <div className="bg-slate-100 p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Grid size={14} /> Weekly Table
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'day' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListFilter size={14} /> Day View
            </button>
          </div>
        </div>
      </div>

      {/* View Mode 1: Weekly Tabular Matrix View (Matches Teacher My Classes Grid) */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Grid size={18} className="text-indigo-600" /> Weekly Timetable Matrix
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              Columns for today's day ({todayDayName}) are automatically highlighted.
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <tr>
                  <th className="px-4 py-3.5 w-36 bg-slate-100/70 border-r border-slate-200">Period</th>
                  {DAYS.map(day => {
                    const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                    return (
                      <th 
                        key={day} 
                        className={`px-4 py-3.5 text-center transition-colors relative ${
                          isToday 
                            ? 'bg-indigo-600 text-white font-black' 
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span>{day}</span>
                          {isToday && (
                            <span className="mt-0.5 px-2 py-0.2 bg-amber-400 text-indigo-950 font-black text-[9px] uppercase tracking-wider rounded-full shadow-xs">
                              Today
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {periodNumbers.map(pNum => {
                  const sample = schedule.find(s => s.period === pNum);
                  const timeDisplay = sample?.start_time && sample?.end_time 
                    ? `${sample.start_time} - ${sample.end_time}` 
                    : null;

                  return (
                    <tr key={pNum} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 bg-slate-50/50 border-r border-slate-200">
                        <div className="font-bold text-slate-900 text-xs">Period {pNum}</div>
                        {timeDisplay ? (
                          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="text-indigo-600" />
                            {timeDisplay}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">Regular Slot</div>
                        )}
                      </td>

                      {DAYS.map(day => {
                        const isToday = day.toLowerCase() === todayDayName.toLowerCase();
                        const classInfo = getClassForSlot(day, pNum);

                        return (
                          <td 
                            key={day} 
                            className={`px-2 py-2 text-center transition-colors ${
                              isToday ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            {classInfo ? (
                              <div className={`p-3 rounded-xl border text-left transition-all hover:shadow-sm ${
                                isToday 
                                  ? 'bg-white border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs' 
                                  : 'bg-white border-slate-200'
                              }`}>
                                <div className="font-extrabold text-slate-900 text-xs mb-1 flex items-center justify-between">
                                  <span>{classInfo.subject}</span>
                                  {classInfo.subject_code && (
                                    <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                      {classInfo.subject_code}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-0.5 text-[11px] text-slate-600">
                                  <div className="flex items-center gap-1 font-semibold text-indigo-700">
                                    <User size={11} /> {classInfo.teacher}
                                  </div>
                                  {classInfo.room && (
                                    <div className="flex items-center gap-1 text-slate-500 font-medium">
                                      <MapPin size={11} /> {classInfo.room}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="h-16 rounded-xl bg-slate-50/60 border border-dashed border-slate-200 flex items-center justify-center">
                                <span className="text-[11px] text-slate-400 font-medium">Free</span>
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
        </div>
      )}

      {/* View Mode 2: Day Tabs Filter View */}
      {viewMode === 'day' && (
        <div className="space-y-6">
          {/* Day Selector Tabs */}
          <div className="bg-white p-3 rounded-3xl border border-slate-200/80 shadow-sm flex flex-wrap gap-2">
            {DAYS.map(day => {
              const isToday = day.toLowerCase() === todayDayName.toLowerCase();
              const isSelected = selectedDay.toLowerCase() === day.toLowerCase();

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : isToday
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{day}</span>
                  {isToday && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isSelected ? 'bg-amber-400 text-indigo-950' : 'bg-indigo-600 text-white'
                    }`}>
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Period List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock size={18} className="text-indigo-600" /> Periods for {selectedDay}
              </h2>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                {currentDaySchedule.length} {currentDaySchedule.length === 1 ? 'Period' : 'Periods'} Scheduled
              </span>
            </div>

            {currentDaySchedule.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Info size={28} className="mx-auto text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">No Classes Scheduled for {selectedDay}</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no periods or classes set up for this day in the school timetable.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDaySchedule.map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 border border-indigo-100">
                        P{item.period}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">{item.subject}</h3>
                          {item.subject_code && (
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              {item.subject_code}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Clock size={13} className="text-indigo-600" /> {item.start_time} - {item.end_time}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-indigo-700">
                            <User size={13} /> {item.teacher}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-xl self-start md:self-auto">
                      <MapPin size={14} className="text-indigo-600" /> {item.room || 'Classroom'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
