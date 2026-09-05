'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, ClipboardCheck, BookOpen, MessageSquare, 
  Calendar, User, LogOut, Menu, X, Bell, Library, DollarSign
} from 'lucide-react';
import { PermissionProvider } from '@/lib/rbac-context';
import { FeatureProvider } from '@/lib/FeatureContext';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teacher, setTeacher] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/teachers/login') {
      setIsCheckingAuth(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      window.location.href = '/teachers/login';
      return;
    }
    
    setIsAuthenticated(true);
    setIsCheckingAuth(false);
    fetchTeacherInfo();
  }, [pathname]);

  const fetchTeacherInfo = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/v1/teachers/me/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTeacher({
          name: data.full_name,
          employee_id: data.tuid,
          subjects: data.certified_subjects ? data.certified_subjects.split(',') : []
        });
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        window.location.href = '/teachers/login';
      }
    } catch (error) {
      console.error('Failed to fetch teacher info', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    window.location.href = '/teachers/login';
  };

  const menuItems = [
    { title: 'Dashboard', path: '/teachers', icon: LayoutDashboard },
    { title: 'Attendance', path: '/teachers/attendance', icon: ClipboardCheck },
    { title: 'Marks', path: '/teachers/marks', icon: BookOpen },
    { title: 'Remarks', path: '/teachers/remarks', icon: MessageSquare },
    { title: 'My Classes', path: '/teachers/schedule', icon: Calendar },
    { title: 'Library', path: '/teachers/library', icon: Library },
    { title: 'Salary', path: '/teachers/salary', icon: DollarSign },
    { title: 'Profile', path: '/teachers/profile', icon: User },
  ];

  if (pathname === '/teachers/login') {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Verifying authentication...</p>
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
        <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-green-700 to-green-800 text-white transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-green-600/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="text-base font-bold">Teacher Portal</div>
              <div className="text-xs text-green-200">School OS</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Teacher Info */}
        {teacher && (
          <div className="p-4 bg-white/10 m-4 rounded-lg">
            <div className="font-semibold text-sm">{teacher.name}</div>
            <div className="text-xs text-green-200">{teacher.employee_id}</div>
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-white text-green-700 font-medium' 
                    : 'text-green-100 hover:bg-white/10'
                }`}
              >
                <Icon size={20} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-green-600/30">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-green-100 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
        </div>
      </FeatureProvider>
    </PermissionProvider>
  );
}
