'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, CheckCircle2, XCircle, Clock, Calendar, 
  ShieldCheck, AlertCircle, Filter, RefreshCw, Lock, Sparkles, TrendingUp, Info
} from 'lucide-react';
import api from '@/lib/api';

interface AttendanceLog {
  id: string;
  date: string;
  day_name: string;
  session_type: string;
  session_type_display: string;
  subject_name: string;
  status: string;
  status_display: string;
  time_in?: string | null;
  remarks?: string;
  is_locked: boolean;
}

export default function StudentAttendancePage() {
  const [data, setData] = useState<any>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Default: previous 7 days (including today)
  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(sevenDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    fetchAttendance(startDate, endDate);
  }, []);

  const fetchAttendance = async (start: string, end: string) => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/student_attendance/', {
        params: { start_date: start, end_date: end }
      });
      setData(response.data);
      setLogs(response.data?.logs || []);
    } catch (error) {
      console.error('Failed to load student attendance', error);
      setData(null);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchAttendance(startDate, endDate);
  };

  const handleQuickRange = (range: '7days' | '30days' | 'thisMonth') => {
    const end = new Date().toISOString().split('T')[0];
    let start = '';
    
    if (range === '7days') {
      start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (range === '30days') {
      start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else if (range === 'thisMonth') {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    setStartDate(start);
    setEndDate(end);
    fetchAttendance(start, end);
  };

  const overallPercentage = data?.overall_percentage ?? 100.0;
  const totalConducted = data?.total_conducted ?? 0;
  const presentCount = data?.present_count ?? 0;
  const absentCount = data?.absent_count ?? 0;
  const lateCount = data?.late_count ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" /> View-Only Access
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-extrabold flex items-center gap-1">
              <Lock size={11} /> Locked Registers Only
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ClipboardCheck size={22} />
            </div>
            My Attendance Records
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official attendance log calculated directly from locked School Admin registers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-2xl text-right">
            <span className="text-xs text-emerald-700 font-bold block flex items-center justify-end gap-1">
              <TrendingUp size={12} /> Discipline & Consistency
            </span>
            <span className="text-2xl font-black text-emerald-800">
              {overallPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Discipline & Consistency Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Attendance Rate</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ClipboardCheck size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 mt-3">{overallPercentage}%</p>
          <p className="text-xs text-slate-400 mt-1">Calculated from locked sessions</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Conducted Sessions</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">{totalConducted}</p>
          <p className="text-xs text-slate-500 mt-1">Locked register entries</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Present Days / Sessions</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">{presentCount}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Includes {lateCount} late arrivals</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Absences / Leaves</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <XCircle size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-rose-600 mt-3">{absentCount}</p>
          <p className="text-xs text-slate-400 mt-1">Unexcused absence count</p>
        </div>
      </div>

      {/* Filter Section: Custom Date Range Selector */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Custom Date Range Selector</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleQuickRange('7days')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleQuickRange('30days')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleQuickRange('thisMonth')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              This Month
            </button>
          </div>
        </div>

        <form onSubmit={handleApplyFilter} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex-1 space-y-1.5 w-full">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <RefreshCw size={16} /> Apply Date Range
          </button>
        </form>
      </div>

      {/* Recent Daily Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-emerald-600" /> Recent Daily Logs ({startDate} to {endDate})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Showing locked attendance records for the selected period.</p>
          </div>
          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            {logs.length} {logs.length === 1 ? 'Record' : 'Records'} Found
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-semibold text-sm">
            Loading attendance records from School Admin...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Info size={28} className="mx-auto text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">No Locked Attendance Registers Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No locked attendance registers exist for your grade & section between {startDate} and {endDate}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Day</th>
                  <th className="py-3.5 px-4">Session / Subject</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Time In</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Register Lock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{log.date}</div>
                      <div className="text-xs text-slate-500 font-semibold">{log.day_name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{log.subject_name}</div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.2 rounded">
                        {log.session_type_display}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {log.status === 'PRESENT' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                          <CheckCircle2 size={13} /> Present
                        </span>
                      )}
                      {log.status === 'LATE' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                          <Clock size={13} /> Late Arrival
                        </span>
                      )}
                      {log.status === 'ABSENT' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200">
                          <XCircle size={13} /> Absent
                        </span>
                      )}
                      {['EXCUSED', 'MEDICAL', 'OUT'].includes(log.status) && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200">
                          <Info size={13} /> {log.status_display}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-700">
                      {log.time_in ? log.time_in : '-'}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-500">
                      {log.remarks || 'No remarks'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 font-bold text-[11px] rounded-lg">
                        <Lock size={11} className="text-emerald-600" /> Locked Register
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
