'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  DollarSign, 
  ToggleLeft, 
  ToggleRight, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  LifeBuoy,
  MessageSquare,
  Bug,
  Activity,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Clock,
  Send,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Globe,
  Terminal,
  Server,
  Layers,
  GraduationCap,
  Shield,
  FileText,
  UserCheck,
  LogOut,
  Lock
} from 'lucide-react';
import api from '@/lib/api';

// Data Interfaces
interface SchoolHierarchy {
  id: string;
  name: string;
  display_name: string;
  legal_name: string;
  code: string;
  board: string;
  city: string;
  state: string;
  onboarding_status: string;
  teachers_count: number;
  students_count: number;
  open_tickets_count: number;
  subscription_plan: string;
}

interface TeacherItem {
  id: string;
  teacher_id: string;
  full_name: string;
  email: string;
  phone: string;
  qualification: string;
  designation: string;
  is_active: boolean;
  joining_date: string;
  assigned_classes: string[];
}

interface StudentItem {
  id: string;
  admission_number: string;
  full_name: string;
  email: string;
  roll_number: string;
  gender: string;
  is_active: boolean;
  current_class_name: string;
  created_at: string;
}

interface TicketMessage {
  id: string;
  sender_name: string;
  sender_role: string;
  sender_email: string;
  is_admin_reply: boolean;
  message: string;
  created_at: string;
}

interface SupportTicketDetail {
  id: string;
  ticket_number: string;
  school?: string;
  school_name?: string;
  school_code?: string;
  user_name: string;
  user_role: string;
  user_email: string;
  title: string;
  category: string;
  description: string;
  current_route: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  diagnostic_data?: {
    session_id?: string;
    generated_at?: string;
    current_route?: string;
    user_context?: any;
    device_context?: {
      browser?: string;
      os?: string;
      screen_resolution?: string;
      viewport_size?: string;
      online_status?: boolean;
      user_agent?: string;
      timezone?: string;
    };
    recent_errors?: Array<{
      type: string;
      message: string;
      stack?: string;
      timestamp: string;
    }>;
    recent_failed_requests?: Array<{
      url: string;
      method: string;
      status: number;
      status_text?: string;
      duration_ms?: number;
      response_preview?: string;
      timestamp: string;
    }>;
    breadcrumbs?: Array<{
      type: string;
      category: string;
      message: string;
      timestamp: string;
      data?: any;
    }>;
  };
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  messages?: TicketMessage[];
}

interface PlatformStats {
  total_schools: number;
  total_teachers: number;
  total_students: number;
  tickets: {
    open: number;
    investigating: number;
    resolved: number;
    critical: number;
    total: number;
  };
  category_breakdown?: Array<{ category: string; count: number }>;
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthorized'>('checking');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'support_desk' | 'hierarchy' | 'subscriptions' | 'activity'>('overview');
  
  // Platform Stats
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Support Desk State
  const [tickets, setTickets] = useState<SupportTicketDetail[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetail | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('ALL');
  const [ticketSeverityFilter, setTicketSeverityFilter] = useState('ALL');
  const [ticketSearch, setTicketSearch] = useState('');
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [inspectorSubTab, setInspectorSubTab] = useState<'overview' | 'breadcrumbs' | 'network' | 'console' | 'environment'>('overview');

  // Hierarchy Explorer State
  const [schools, setSchools] = useState<SchoolHierarchy[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolHierarchy | null>(null);
  const [schoolTeachers, setSchoolTeachers] = useState<TeacherItem[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<StudentItem[]>([]);
  const [hierarchyViewType, setHierarchyViewType] = useState<'teachers' | 'students'>('teachers');
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);
  const [hierarchySearch, setHierarchySearch] = useState('');

  // Subscriptions & Features State
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Global Activity Stream State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verifyAuthentication();
  }, []);

  const verifyAuthentication = async () => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      setAuthStatus('checking');
      window.location.href = '/owner-login?redirect=/platform';
      return;
    }

    try {
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      const userRole = (user.role || user.user_type || '').toUpperCase();
      const isSuper = user.is_superuser || user.is_staff || ['SUPER_ADMIN', 'OWNER', 'PLATFORM_ADMIN'].includes(userRole);

      if (!isSuper) {
        setAuthStatus('unauthorized');
        return;
      }

      setAuthStatus('authenticated');
      fetchStats();
      fetchTickets();
      fetchSchools();
      fetchSubscriptions();
      fetchAuditLogs();
    } catch {
      window.location.href = '/owner-login?redirect=/platform';
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await api.get('/audit/');
      setAuditLogs(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.warn('Could not load audit logs', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/owner-login';
  };

  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await api.get('/support/tickets/platform_stats/');
      setStats(res.data);
    } catch (err) {
      console.warn('Could not load platform stats', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const params: any = {};
      if (ticketStatusFilter !== 'ALL') params.status = ticketStatusFilter;
      if (ticketSeverityFilter !== 'ALL') params.severity = ticketSeverityFilter;
      if (ticketSearch.trim()) params.search = ticketSearch.trim();

      const res = await api.get('/support/tickets/', { params });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setTickets(list);
    } catch (err) {
      console.warn('Could not load support tickets', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}/`);
      setSelectedTicket(res.data);
      fetchTickets();
      fetchStats();
    } catch (err) {
      console.warn('Could not load ticket detail', err);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReplyText.trim()) return;

    setIsSendingReply(true);
    try {
      const res = await api.post(`/support/tickets/${selectedTicket.id}/add_message/`, {
        message: adminReplyText.trim()
      });
      setSelectedTicket({
        ...selectedTicket,
        status: selectedTicket.status === 'OPEN' ? 'INVESTIGATING' : selectedTicket.status,
        messages: [...(selectedTicket.messages || []), res.data]
      });
      setAdminReplyText('');
      fetchTickets();
    } catch (err) {
      console.error('Failed to send admin reply', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleUpdateTicketStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setIsUpdatingStatus(true);
    try {
      const res = await api.patch(`/support/tickets/${selectedTicket.id}/update_status/`, {
        status: newStatus
      });
      setSelectedTicket(res.data);
      fetchTickets();
      fetchStats();
    } catch (err) {
      console.error('Failed to update ticket status', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const fetchSchools = async () => {
    setIsLoadingHierarchy(true);
    try {
      const res = await api.get('/support/hierarchy/schools/');
      setSchools(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Could not load schools hierarchy', err);
    } finally {
      setIsLoadingHierarchy(false);
    }
  };

  const handleSelectSchool = async (school: SchoolHierarchy) => {
    setSelectedSchool(school);
    setIsLoadingHierarchy(true);
    try {
      const [teachersRes, studentsRes] = await Promise.all([
        api.get(`/support/hierarchy/schools/${school.id}/teachers/`),
        api.get(`/support/hierarchy/schools/${school.id}/students/`)
      ]);
      setSchoolTeachers(teachersRes.data?.teachers || []);
      setSchoolStudents(studentsRes.data?.students || []);
    } catch (err) {
      console.error('Failed to load school teachers and students', err);
    } finally {
      setIsLoadingHierarchy(false);
    }
  };

  const fetchSubscriptions = async () => {
    setLoadingSub(true);
    try {
      const res = await api.get('/platform/subscriptions/');
      setSubscriptions(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.warn('Could not load subscriptions', err);
    } finally {
      setLoadingSub(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Open</span>;
      case 'INVESTIGATING':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Investigating</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">Resolved</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Closed</span>;
    }
  };

  const getSeverityChip = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-rose-600 text-white animate-pulse">Critical</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-orange-500 text-white">High</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-blue-500 text-white">Medium</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-400 text-white">Low</span>;
    }
  };

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Verifying System Admin Credentials...</h2>
        <p className="text-xs text-slate-500 mt-1">Securing connection to School OS Platform Management</p>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/60 p-8 rounded-3xl text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-950/80 border border-rose-700/60 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Access Denied</h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            The System Admin Console is strictly reserved for Top Management and Super Administrators. Your current login (<span className="text-indigo-400 font-mono">{currentUser?.email}</span>) does not possess platform superadmin privileges.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-indigo-600/30"
            >
              Sign In with Super Admin Account
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              Return to Standard Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top SuperAdmin Header */}
      <header className="bg-slate-950/80 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">School OS</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                System Admin Console
              </span>
            </div>
            <p className="text-xs text-slate-400">Global Tenant Hierarchy, Live Telemetry & Error Resolution Desk</p>
          </div>
        </div>

        {/* Header Navigation Tabs & User Profile */}
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              Command Center
            </button>
            <button
              onClick={() => {
                setActiveTab('support_desk');
                fetchTickets();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'support_desk'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LifeBuoy className="w-4 h-4" />
              Diagnostic Desk
              {stats && stats.tickets?.open > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                  {stats.tickets.open}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('hierarchy');
                fetchSchools();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'hierarchy'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              Tenant Hierarchy
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'subscriptions'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Subscriptions
            </button>
            <button
              onClick={() => {
                setActiveTab('activity');
                fetchAuditLogs();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'activity'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              Activity Stream
            </button>
          </nav>

          {/* User Info & Sign Out */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white">{currentUser?.first_name || currentUser?.name || 'Super Admin'}</div>
              <div className="text-[10px] text-indigo-400 font-mono">{currentUser?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2.5 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-700/60 rounded-xl text-slate-400 hover:text-rose-300 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body View */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">

        {/* 1. COMMAND CENTER OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-slate-800/80 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Schools</span>
                  <Building2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-3xl font-black text-white">{stats?.total_schools || 0}</div>
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Multi-Tenant Active
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Teachers</span>
                  <UserCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-black text-white">{stats?.total_teachers || 0}</div>
                <p className="text-xs text-slate-400 mt-2">Across all tenant schools</p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Enrolled Students</span>
                  <GraduationCap className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white">{stats?.total_students || 0}</div>
                <p className="text-xs text-slate-400 mt-2">Active student profiles</p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Open Technical Issues</span>
                  <Bug className="w-5 h-5 text-rose-400" />
                </div>
                <div className="text-3xl font-black text-rose-400">{stats?.tickets?.open || 0}</div>
                <p className="text-xs text-rose-300 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {stats?.tickets?.critical || 0} Critical priority
                </p>
              </div>
            </div>

            {/* Platform Pulse & Support Queue Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Cols: Recent Unresolved Complaints */}
              <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <LifeBuoy className="w-5 h-5 text-indigo-400" />
                      Live Error Reports & Technical Complaints
                    </h3>
                    <p className="text-xs text-slate-400">Issues reported by School Admins, Teachers, and Students</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('support_desk')}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    Open Diagnostic Desk <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    All systems healthy. No unresolved tickets.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          fetchTicketDetails(t.id);
                          setActiveTab('support_desk');
                        }}
                        className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-400">{t.ticket_number}</span>
                            {getStatusChip(t.status)}
                            {getSeverityChip(t.severity)}
                            <span className="text-xs text-slate-400 font-semibold">• {t.user_name} ({t.user_role})</span>
                            {t.school_name && <span className="text-xs text-indigo-300 font-medium">@ {t.school_name}</span>}
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">{t.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-1">{t.description}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition group-hover:translate-x-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Col: Category Breakdown & Flight Recorder Pulse */}
              <div className="space-y-6">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Flight Recorder Diagnostics Engine
                  </h3>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Ring Buffer Mode</span>
                      <span className="font-bold text-emerald-400">150 Events (FIFO)</span>
                    </div>
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Console & API Interceptor</span>
                      <span className="font-bold text-emerald-400">Active</span>
                    </div>
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">PII & Secret Sanitizer</span>
                      <span className="font-bold text-emerald-400">Enabled</span>
                    </div>
                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Network Overhead</span>
                      <span className="font-bold text-indigo-400">0 KB (On-Demand Only)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-3">Quick Navigation</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveTab('hierarchy')}
                      className="p-3 bg-slate-900 hover:bg-indigo-900/40 border border-slate-800 hover:border-indigo-500 text-left rounded-xl transition"
                    >
                      <Layers className="w-5 h-5 text-indigo-400 mb-1" />
                      <div className="text-xs font-bold text-white">All Schools</div>
                      <div className="text-[10px] text-slate-400">Teachers & Students</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('support_desk')}
                      className="p-3 bg-slate-900 hover:bg-indigo-900/40 border border-slate-800 hover:border-indigo-500 text-left rounded-xl transition"
                    >
                      <LifeBuoy className="w-5 h-5 text-blue-400 mb-1" />
                      <div className="text-xs font-bold text-white">Support Desk</div>
                      <div className="text-[10px] text-slate-400">Inspect & Reply</div>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 2. DIAGNOSTIC SUPPORT DESK (INSPECTOR & 2-WAY CHAT) */}
        {activeTab === 'support_desk' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
            
            {/* Left Col: Tickets Filter & List (4 Cols) */}
            <div className="lg:col-span-4 bg-slate-800/70 border border-slate-700/60 rounded-2xl flex flex-col overflow-hidden">
              
              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-slate-700/60 space-y-3 bg-slate-800">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchTickets()}
                    placeholder="Search tickets, users, schools..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ticketStatusFilter}
                    onChange={(e) => {
                      setTicketStatusFilter(e.target.value);
                      setTimeout(fetchTickets, 50);
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="INVESTIGATING">Investigating</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  <select
                    value={ticketSeverityFilter}
                    onChange={(e) => {
                      setTicketSeverityFilter(e.target.value);
                      setTimeout(fetchTickets, 50);
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              {/* Tickets List View */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {isLoadingTickets ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading tickets...
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No tickets match criteria.
                  </div>
                ) : (
                  tickets.map((t) => {
                    const isSelected = selectedTicket?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => fetchTicketDetails(t.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono font-bold text-indigo-400">{t.ticket_number}</span>
                          <div className="flex items-center gap-1.5">
                            {getSeverityChip(t.severity)}
                            {getStatusChip(t.status)}
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">{t.title}</h4>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{t.user_name} ({t.user_role})</span>
                          <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                        {t.school_name && (
                          <div className="text-[10px] text-indigo-300 font-medium mt-1 truncate">
                            🏫 {t.school_name}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Right Col: Deep Diagnostic Inspector & Two-Way Resolution Chat (8 Cols) */}
            <div className="lg:col-span-8 bg-slate-800/70 border border-slate-700/60 rounded-2xl flex flex-col overflow-hidden">
              {selectedTicket ? (
                <div className="flex flex-col h-full">
                  
                  {/* Ticket Header & Status Changer */}
                  <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-bold text-indigo-400">{selectedTicket.ticket_number}</span>
                        {getSeverityChip(selectedTicket.severity)}
                        <span className="text-xs text-slate-400">• Created on {new Date(selectedTicket.created_at).toLocaleString()}</span>
                      </div>
                      <h2 className="text-base font-bold text-white">{selectedTicket.title}</h2>
                      <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                        <span>User: <strong className="text-white">{selectedTicket.user_name}</strong> ({selectedTicket.user_role})</span>
                        <span>• Email: <strong className="text-white">{selectedTicket.user_email}</strong></span>
                        {selectedTicket.school_name && (
                          <span>• School: <strong className="text-indigo-300">{selectedTicket.school_name} ({selectedTicket.school_code})</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Quick Status Buttons */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateTicketStatus(e.target.value)}
                        disabled={isUpdatingStatus}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="OPEN">Status: OPEN</option>
                        <option value="INVESTIGATING">Status: INVESTIGATING</option>
                        <option value="RESOLVED">Status: RESOLVED</option>
                        <option value="CLOSED">Status: CLOSED</option>
                      </select>
                    </div>
                  </div>

                  {/* Inspector Tabs (Overview / Breadcrumbs / Network / Console / Environment) */}
                  <div className="flex border-b border-slate-800 bg-slate-900/50 px-4">
                    <button
                      onClick={() => setInspectorSubTab('overview')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition ${
                        inspectorSubTab === 'overview'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      Complaint Details
                    </button>
                    <button
                      onClick={() => setInspectorSubTab('breadcrumbs')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                        inspectorSubTab === 'breadcrumbs'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Timeline Breadcrumbs ({selectedTicket.diagnostic_data?.breadcrumbs?.length || 0})
                    </button>
                    <button
                      onClick={() => setInspectorSubTab('network')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                        inspectorSubTab === 'network'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" />
                      Failed API Requests ({selectedTicket.diagnostic_data?.recent_failed_requests?.length || 0})
                    </button>
                    <button
                      onClick={() => setInspectorSubTab('console')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                        inspectorSubTab === 'console'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Console & Stack ({selectedTicket.diagnostic_data?.recent_errors?.length || 0})
                    </button>
                    <button
                      onClick={() => setInspectorSubTab('environment')}
                      className={`px-3 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                        inspectorSubTab === 'environment'
                          ? 'border-indigo-500 text-indigo-400'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Device Context
                    </button>
                  </div>

                  {/* Inspector Panel Body */}
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-900/30">
                    
                    {/* SUBTAB 1: Complaint & Messages */}
                    {inspectorSubTab === 'overview' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Original User Complaint</h4>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                          {selectedTicket.current_route && (
                            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                              Active Route at Crash: <code className="text-indigo-300 font-mono">{selectedTicket.current_route}</code>
                            </div>
                          )}
                        </div>

                        {/* Two-Way Message Thread */}
                        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Two-Way Conversation Thread</h4>
                          
                          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {selectedTicket.messages && selectedTicket.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`flex flex-col ${m.is_admin_reply ? 'items-end' : 'items-start'}`}
                              >
                                <div
                                  className={`max-w-[80%] p-3 rounded-2xl text-xs ${
                                    m.is_admin_reply
                                      ? 'bg-indigo-600 text-white rounded-tr-none'
                                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1 text-[10px] font-bold">
                                    <span>{m.sender_name} ({m.sender_role})</span>
                                  </div>
                                  <p className="whitespace-pre-wrap">{m.message}</p>
                                </div>
                                <span className="text-[10px] text-slate-500 mt-1">
                                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>

                          {/* Reply Input */}
                          <form onSubmit={handleSendAdminReply} className="flex gap-2 pt-2 border-t border-slate-800">
                            <input
                              type="text"
                              value={adminReplyText}
                              onChange={(e) => setAdminReplyText(e.target.value)}
                              placeholder="Type response back to user..."
                              className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={isSendingReply || !adminReplyText.trim()}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Send Reply
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {/* SUBTAB 2: Timeline Breadcrumbs */}
                    {inspectorSubTab === 'breadcrumbs' && (
                      <div className="space-y-2">
                        {(!selectedTicket.diagnostic_data?.breadcrumbs || selectedTicket.diagnostic_data.breadcrumbs.length === 0) ? (
                          <p className="text-xs text-slate-500 text-center py-8">No breadcrumb telemetry captured for this ticket.</p>
                        ) : (
                          selectedTicket.diagnostic_data.breadcrumbs.map((b, idx) => (
                            <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3 text-xs">
                              <span className="font-mono text-[10px] text-slate-500 mt-0.5">
                                {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                b.type === 'navigation' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                                b.type === 'click' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                                b.type === 'network_error' ? 'bg-rose-900/60 text-rose-300 border border-rose-700' :
                                'bg-slate-800 text-slate-300'
                              }`}>
                                {b.type}
                              </span>
                              <div className="flex-1 text-slate-200">
                                <p>{b.message}</p>
                                {b.data && (
                                  <pre className="mt-1 p-2 bg-slate-950 rounded text-[10px] text-slate-400 font-mono overflow-x-auto">
                                    {JSON.stringify(b.data, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* SUBTAB 3: Failed API Requests */}
                    {inspectorSubTab === 'network' && (
                      <div className="space-y-3">
                        {(!selectedTicket.diagnostic_data?.recent_failed_requests || selectedTicket.diagnostic_data.recent_failed_requests.length === 0) ? (
                          <p className="text-xs text-slate-500 text-center py-8">No failed network requests recorded.</p>
                        ) : (
                          selectedTicket.diagnostic_data.recent_failed_requests.map((r, idx) => (
                            <div key={idx} className="p-4 bg-slate-900 border border-rose-900/50 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded">
                                    HTTP {r.status}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-white">{r.method}</span>
                                  <span className="text-xs font-mono text-slate-300">{r.url}</span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(r.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              {r.response_preview && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Response Body Preview:</p>
                                  <pre className="mt-1 p-2.5 bg-slate-950 text-rose-300 text-xs font-mono rounded-lg overflow-x-auto border border-slate-800">
                                    {r.response_preview}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* SUBTAB 4: Console & Stack */}
                    {inspectorSubTab === 'console' && (
                      <div className="space-y-3">
                        {(!selectedTicket.diagnostic_data?.recent_errors || selectedTicket.diagnostic_data.recent_errors.length === 0) ? (
                          <p className="text-xs text-slate-500 text-center py-8">No unhandled console errors or exceptions recorded.</p>
                        ) : (
                          selectedTicket.diagnostic_data.recent_errors.map((err, idx) => (
                            <div key={idx} className="p-4 bg-slate-900 border border-amber-900/40 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase rounded">
                                  {err.type}
                                </span>
                                <span className="text-[10px] text-slate-500">{new Date(err.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-xs font-bold text-rose-300 font-mono">{err.message}</p>
                              {err.stack && (
                                <pre className="p-3 bg-slate-950 text-[11px] font-mono text-slate-300 rounded-lg overflow-x-auto border border-slate-800 leading-relaxed whitespace-pre-wrap">
                                  {err.stack}
                                </pre>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* SUBTAB 5: Device Context */}
                    {inspectorSubTab === 'environment' && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {selectedTicket.diagnostic_data?.device_context ? (
                          <>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Operating System</span>
                              <span className="text-white font-semibold text-sm">{selectedTicket.diagnostic_data.device_context.os || 'Unknown'}</span>
                            </div>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Browser</span>
                              <span className="text-white font-semibold text-sm">{selectedTicket.diagnostic_data.device_context.browser || 'Unknown'}</span>
                            </div>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Screen Resolution</span>
                              <span className="text-white font-semibold">{selectedTicket.diagnostic_data.device_context.screen_resolution || 'N/A'}</span>
                            </div>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Viewport Size</span>
                              <span className="text-white font-semibold">{selectedTicket.diagnostic_data.device_context.viewport_size || 'N/A'}</span>
                            </div>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Online Status</span>
                              <span className="text-emerald-400 font-semibold">{selectedTicket.diagnostic_data.device_context.online_status ? 'Connected (Online)' : 'Offline'}</span>
                            </div>
                            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Timezone</span>
                              <span className="text-white font-semibold">{selectedTicket.diagnostic_data.device_context.timezone || 'UTC'}</span>
                            </div>
                            <div className="col-span-2 p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">User Agent</span>
                              <span className="text-slate-300 font-mono text-[11px] break-all">{selectedTicket.diagnostic_data.device_context.user_agent}</span>
                            </div>
                          </>
                        ) : (
                          <p className="col-span-2 text-center text-slate-500 py-6">No device context available.</p>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <LifeBuoy className="w-12 h-12 text-slate-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-300">Select a Support Ticket</h3>
                  <p className="text-xs max-w-sm mt-1 text-slate-400">
                    Click any ticket on the left to inspect its Flight Recorder error timeline, device specifications, and communicate directly with the user.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. MULTI-TENANT HIERARCHY EXPLORER */}
        {activeTab === 'hierarchy' && (
          <div className="space-y-6">
            
            {/* Top Search Bar */}
            <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={hierarchySearch}
                  onChange={(e) => setHierarchySearch(e.target.value)}
                  placeholder="Search schools by name, code, board..."
                  className="w-full bg-slate-900 border border-slate-700 px-3.5 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">{schools.length} Total Tenant Schools</span>
                <button
                  onClick={fetchSchools}
                  className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hierarchy Drill-Down Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Col: Schools Directory (5 Cols) */}
              <div className="lg:col-span-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Schools</h3>
                
                {schools
                  .filter((s) => !hierarchySearch || s.name.toLowerCase().includes(hierarchySearch.toLowerCase()) || s.code.toLowerCase().includes(hierarchySearch.toLowerCase()))
                  .map((school) => {
                    const isSelected = selectedSchool?.id === school.id;
                    return (
                      <div
                        key={school.id}
                        onClick={() => handleSelectSchool(school)}
                        className={`p-4 rounded-2xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/50'
                            : 'bg-slate-800/70 border-slate-700/60 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-indigo-400">{school.code}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-700 text-slate-300">
                            {school.board || 'CBSE'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-2">{school.name}</h4>
                        
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-center">
                          <div className="bg-slate-900/60 p-1.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Teachers</span>
                            <span className="text-xs font-bold text-blue-400">{school.teachers_count}</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Students</span>
                            <span className="text-xs font-bold text-emerald-400">{school.students_count}</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Open Tickets</span>
                            <span className="text-xs font-bold text-amber-400">{school.open_tickets_count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Right Col: Teachers / Students Drilldown (7 Cols) */}
              <div className="lg:col-span-7 bg-slate-800/70 border border-slate-700/60 rounded-2xl p-5 flex flex-col">
                {selectedSchool ? (
                  <div className="space-y-4">
                    
                    {/* Selected School Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                      <div>
                        <h3 className="text-base font-bold text-white">{selectedSchool.name}</h3>
                        <p className="text-xs text-slate-400">Code: {selectedSchool.code} • Location: {selectedSchool.city || selectedSchool.state || 'India'}</p>
                      </div>

                      {/* Toggle View: Teachers vs Students */}
                      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                        <button
                          onClick={() => setHierarchyViewType('teachers')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                            hierarchyViewType === 'teachers'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Teachers ({schoolTeachers.length})
                        </button>
                        <button
                          onClick={() => setHierarchyViewType('students')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                            hierarchyViewType === 'students'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Students ({schoolStudents.length})
                        </button>
                      </div>
                    </div>

                    {/* Drill-down Content */}
                    {isLoadingHierarchy ? (
                      <div className="text-center py-12 text-slate-400 text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                        Loading school records...
                      </div>
                    ) : hierarchyViewType === 'teachers' ? (
                      // Teachers List
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {schoolTeachers.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-8">No teachers registered in this school.</p>
                        ) : (
                          schoolTeachers.map((tch) => (
                            <div key={tch.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{tch.full_name}</h4>
                                <p className="text-[11px] text-slate-400">{tch.email} • ID: {tch.teacher_id}</p>
                                <p className="text-[10px] text-indigo-300 mt-0.5">
                                  Designation: {tch.designation || 'Teacher'}
                                </p>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                tch.is_active ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {tch.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      // Students List
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                        {schoolStudents.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-8">No students enrolled in this school.</p>
                        ) : (
                          schoolStudents.map((stu) => (
                            <div key={stu.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{stu.full_name}</h4>
                                <p className="text-[11px] text-slate-400">Adm No: {stu.admission_number} • Roll: {stu.roll_number || 'N/A'}</p>
                                <p className="text-[10px] text-emerald-300 mt-0.5">Class: {stu.current_class_name}</p>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                stu.is_active ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {stu.is_active ? 'Enrolled' : 'Inactive'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <Layers className="w-12 h-12 text-slate-600 mb-3" />
                    <h3 className="text-base font-bold text-slate-300">Select a School</h3>
                    <p className="text-xs max-w-sm mt-1 text-slate-400">
                      Choose any school from the left to view all registered teachers, assigned subjects, and enrolled students.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 4. SUBSCRIPTIONS & PLATFORM QUOTAS */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60">
              <h3 className="text-base font-bold text-white mb-1">School Subscriptions & Quota Controls</h3>
              <p className="text-xs text-slate-400 mb-4">Manage tenant subscription plans, student limits, and feature access</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase font-bold border-b border-slate-700">
                    <tr>
                      <th className="p-3">School Name</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Max Students</th>
                      <th className="p-3">Max Teachers</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {subscriptions.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-slate-900/50 transition">
                        <td className="p-3 font-bold text-white">{sub.school_details?.name || `School #${sub.school}`}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 font-bold rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                            {sub.plan}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 font-bold rounded ${
                            sub.status === 'ACTIVE' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
                          }`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{sub.max_students}</td>
                        <td className="p-3 text-slate-300">{sub.max_teachers}</td>
                        <td className="p-3 text-slate-400">{sub.start_date || 'N/A'}</td>
                        <td className="p-3 text-slate-400">{sub.end_date || 'Ongoing'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. GLOBAL ACTIVITY & AUDIT STREAM */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Global Platform Activity & Audit Stream
                  </h3>
                  <p className="text-xs text-slate-400">Real-time audit log of actions performed across all tenant schools</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="VIEW">VIEW</option>
                  </select>

                  <button
                    onClick={fetchAuditLogs}
                    className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {isLoadingAudit ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Streaming live audit trail...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  No platform activity logged yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-bold border-b border-slate-700">
                      <tr>
                        <th className="p-3">Actor / User</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Target Entity</th>
                        <th className="p-3">Summary / Details</th>
                        <th className="p-3">IP Address</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {auditLogs
                        .filter((log) => auditActionFilter === 'ALL' || log.action === auditActionFilter)
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-slate-900/50 transition">
                            <td className="p-3 font-semibold text-white">
                              <div>{log.actor_name || 'System / Auto'}</div>
                              {log.actor_email && <div className="text-[10px] text-slate-400 font-mono">{log.actor_email}</div>}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-700 text-slate-300">
                                {log.actor_role || 'SYSTEM'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded ${
                                log.action === 'CREATE' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                                log.action === 'UPDATE' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                                log.action === 'DELETE' ? 'bg-rose-900/60 text-rose-300 border border-rose-700' :
                                log.action === 'LOGIN' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                                'bg-slate-700 text-slate-300'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-indigo-300 text-[11px]">
                              {log.object_type || log.content_type || 'N/A'} #{String(log.object_id || '').substring(0, 8)}
                            </td>
                            <td className="p-3 text-slate-300 max-w-xs truncate">
                              {log.details || 'Action completed successfully'}
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[11px]">
                              {log.ip_address || '127.0.0.1'}
                            </td>
                            <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
