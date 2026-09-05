'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sparkles, BookOpen, Calendar, Award, CheckCircle2, Clock, 
  CreditCard, TrendingUp, AlertCircle, ArrowRight, Bell, UserCheck, Wallet, Receipt
} from 'lucide-react';
import api from '@/lib/api';

export default function StudentDashboardPage() {
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/students/me/');
        setStudentInfo(res.data);
      } catch (err) {
        console.error('Failed loading student dashboard profile', err);
      }

      try {
        const attRes = await api.get('/attendance/student_attendance/');
        setAttendanceRate(attRes.data?.overall_percentage ?? 100.0);
      } catch (err) {
        console.error('Failed loading student attendance rate', err);
        setAttendanceRate(100.0);
      }

      try {
        const notifRes = await api.get('/schools/broadcasts/my_notifications/');
        setNotifications(Array.isArray(notifRes.data) ? notifRes.data : notifRes.data?.results || []);
      } catch (err) {
        console.error('Failed loading student notifications', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/schools/broadcasts/${notificationId}/mark_read/`, {});
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Failed marking notification read', err);
    }
  };


  const studentName = studentInfo?.full_name || studentInfo?.first_name || 'Student';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-3xl p-8 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-indigo-200 border border-white/10">
              <Sparkles size={14} className="text-amber-400" /> Student Workspace
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hello, {studentName}! 👋
            </h1>
            <p className="text-indigo-200/90 text-sm sm:text-base max-w-xl">
              Welcome to your dedicated student portal. View your schedule, check marks, manage fees & payments, and track attendance all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/students/schedule"
              className="px-5 py-3 bg-white text-indigo-900 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all shadow-md flex items-center gap-2"
            >
              <Calendar size={18} /> View Schedule
            </Link>
            <Link
              href="/students/finance"
              className="px-5 py-3 bg-indigo-700/60 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm border border-indigo-500/30 transition-all flex items-center gap-2"
            >
              <CreditCard size={18} /> Finance & Fees
            </Link>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Overall Attendance</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-900">
              {attendanceRate !== null ? `${attendanceRate}%` : '100%'}
            </span>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
              <TrendingUp size={14} /> Good standing
            </div>
          </div>

        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Enrolled Subjects</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-900">6</span>
            <p className="text-xs text-slate-500 mt-1">Active academic courses</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Fee Account Balance</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-emerald-600">$0.00</span>
            <p className="text-xs text-emerald-700 font-medium mt-1">Paid in full for current term</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Average Grade</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-900">A</span>
            <p className="text-xs text-slate-500 mt-1">Based on latest term exam</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Navigation & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Actions & Portal Sections */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Quick Portal Modules</h2>
              <span className="text-xs text-slate-500">Dedicated Student Access</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/students/schedule"
                className="p-5 bg-slate-50 hover:bg-indigo-50/60 rounded-2xl border border-slate-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Calendar size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Class Schedule</h3>
                <p className="text-xs text-slate-500 mt-1">Check today's timetable and subject periods.</p>
              </Link>

              <Link
                href="/students/attendance"
                className="p-5 bg-slate-50 hover:bg-emerald-50/60 rounded-2xl border border-slate-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <UserCheck size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Attendance History</h3>
                <p className="text-xs text-slate-500 mt-1">Review present/absent logs and monthly breakdown.</p>
              </Link>

              <Link
                href="/students/finance"
                className="p-5 bg-slate-50 hover:bg-emerald-50/60 rounded-2xl border border-slate-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <CreditCard size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Finance & Fee Ledger</h3>
                <p className="text-xs text-slate-500 mt-1">View fee invoices, payment breakdown, and download receipts.</p>
              </Link>

              <Link
                href="/students/results"
                className="p-5 bg-slate-50 hover:bg-purple-50/60 rounded-2xl border border-slate-100 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Award size={20} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Marks & Report Card</h3>
                <p className="text-xs text-slate-500 mt-1">Track exam marks, grades, and teacher remarks.</p>
              </Link>
            </div>
          </div>

          {/* Student Status & Ready Notice */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-indigo-950 text-base">Student Portal Live</h3>
                <p className="text-sm text-indigo-800">
                  Your student portal at <code className="bg-indigo-100 px-2 py-0.5 rounded text-indigo-900 font-mono font-bold">/students</code> includes Finance & Fees management at <code className="bg-indigo-100 px-2 py-0.5 rounded text-indigo-900 font-mono font-bold">/students/finance</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Notice Board & Recent Activity */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell size={18} className="text-indigo-600" /> School Notice Board
              </h2>
            </div>
            
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
                  <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No notifications broadcasted yet.</p>
                </div>
              ) : (
                notifications.map(notif => {
                  const getPriorityStyle = (p: string) => {
                    switch (p) {
                      case 'URGENT':
                        return { border: 'border-l-4 border-red-500', dotBg: 'bg-red-500', bg: notif.is_read ? 'bg-slate-50' : 'bg-red-50/30' };
                      case 'HIGH':
                        return { border: 'border-l-4 border-orange-500', dotBg: 'bg-orange-500', bg: notif.is_read ? 'bg-slate-50' : 'bg-orange-50/30' };
                      case 'LOW':
                        return { border: 'border-l-4 border-emerald-500', dotBg: 'bg-emerald-500', bg: notif.is_read ? 'bg-slate-50' : 'bg-emerald-50/30' };
                      case 'NORMAL':
                      default:
                        return { border: 'border-l-4 border-blue-500', dotBg: 'bg-blue-500', bg: notif.is_read ? 'bg-slate-50' : 'bg-blue-50/30' };
                    }
                  };
                  const style = getPriorityStyle(notif.priority);

                  return (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-2xl shadow-sm border border-slate-100 ${style.border} ${style.bg} transition-all space-y-1.5`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${style.dotBg} shrink-0`} />
                          <h4 className="font-bold text-slate-900 text-sm">{notif.title}</h4>
                          {!notif.is_read && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-extrabold tracking-wide uppercase rounded-full">New</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                          <Clock size={11} />
                          {notif.sent_at ? new Date(notif.sent_at).toLocaleString() : new Date(notif.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                      {!notif.is_read && (
                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            Mark as read
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">My Account Profile</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Student ID (SUID)</span>
                <span className="font-bold text-slate-900 font-mono">{studentInfo?.suid || 'SUID-STUDENT'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Account Role</span>
                <span className="font-semibold text-indigo-600">STUDENT</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Status</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 size={14} /> Active
                </span>
              </div>
            </div>
            <Link
              href="/students/profile"
              className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1"
            >
              Manage Full Profile <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
