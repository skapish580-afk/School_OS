'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, Calendar, ClipboardCheck, Award, BookOpen, User, 
  LogOut, Menu, X, Bell, GraduationCap, FileText, Sparkles, CreditCard,
  HeartPulse, KeyRound, Bus, Library
} from 'lucide-react';
import { PermissionProvider } from '@/lib/rbac-context';
import { FeatureProvider } from '@/lib/FeatureContext';

import api from '@/lib/api';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/students/login') {
      setIsCheckingAuth(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      window.location.href = '/students/login';
      return;
    }

    setIsAuthenticated(true);
    setIsCheckingAuth(false);
    fetchStudentInfo();
  }, [pathname]);

  const fetchStudentInfo = async () => {
    try {
      const response = await api.get('/students/me/');
      const data = response.data;
      setStudent({
        name: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Student',
        suid: data.suid || 'SUID-STUDENT',
        grade: data.current_class || 'Enrolled Student',
        email: data.email
      });
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        window.location.href = '/students/login';
      } else {
        console.error('Failed to fetch student info', error);
        const storedUserStr = localStorage.getItem('user');
        if (storedUserStr) {
          try {
            const storedUser = JSON.parse(storedUserStr);
            setStudent({
              name: storedUser.full_name || storedUser.username || 'Student',
              suid: storedUser.username || 'SUID-STUDENT',
              grade: 'Student',
              email: storedUser.email
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
    }

  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    window.location.href = '/students/login';
  };

  const menuItems = [
    { title: 'Dashboard', path: '/students', icon: LayoutDashboard },
    { title: 'Schedule & Timetable', path: '/students/schedule', icon: Calendar },
    { title: 'My Attendance', path: '/students/attendance', icon: ClipboardCheck },
    { title: 'Finance & Fees', path: '/students/finance', icon: CreditCard },
    { title: 'Marks & Results', path: '/students/results', icon: Award },
    { title: 'Health', path: '/students/health', icon: HeartPulse },
    { title: 'Gate Pass', path: '/students/gate-pass', icon: KeyRound },
    { title: 'Transport', path: '/students/transport', icon: Bus },
    { title: 'Library', path: '/students/library', icon: Library },
    { title: 'My Profile', path: '/students/profile', icon: User },
  ];


  if (pathname === '/students/login') {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying student authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PermissionProvider>
      <FeatureProvider>
        <div className="flex h-screen bg-slate-50">
          {/* Sidebar */}
          <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 h-screen flex flex-col shrink-0 bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-950 text-white transform transition-transform duration-200 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}>
            {/* Header */}
            <div className="p-5 flex items-center justify-between border-b border-indigo-800/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-950/50">
                  <GraduationCap size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-base font-bold tracking-wide">Student Portal</div>
                  <div className="text-xs text-indigo-300">School OS</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-indigo-200 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Student Info Card */}
            <div className="p-4 bg-white/10 m-4 rounded-2xl border border-white/10 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center font-bold text-white text-sm">
                  {student?.name ? student.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold text-sm truncate">{student?.name || 'Student Name'}</div>
                  <div className="text-xs text-indigo-300 font-mono truncate">{student?.suid || 'SUID-STUDENT'}</div>
                </div>
              </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [ms-overflow-style:none] [scrollbar-width:none]">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold shadow-md shadow-indigo-950/50' 
                        : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={19} />
                    <span className="text-sm">{item.title}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-indigo-800/40 shrink-0">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3.5 py-2.5 w-full text-indigo-200 hover:bg-red-500/20 hover:text-red-200 rounded-xl transition-colors text-sm font-medium cursor-pointer"
              >
                <LogOut size={19} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>




          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600"
                >
                  <Menu size={22} />
                </button>
                <h2 className="text-lg font-bold text-slate-800 hidden sm:block">
                  Welcome to Student Portal
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  className="relative p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={19} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                </button>

                <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-slate-800">{student?.name || 'Student'}</p>
                    <p className="text-xs text-slate-500">{student?.suid || 'SUID'}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {student?.name ? student.name.charAt(0).toUpperCase() : 'S'}
                  </div>
                </div>
              </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {children}
            </main>
          </div>

          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>
      </FeatureProvider>
    </PermissionProvider>
  );
}
