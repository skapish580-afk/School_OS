'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, CalendarCheck, Banknote,
  BookOpen, Settings, LogOut, GraduationCap,
  Briefcase, ArrowRightLeft, Menu, Heart, Trophy, Shield, X, AlertTriangle, UserCheck, FileText, TrendingUp, Calendar,
  ChevronDown, ChevronRight, UserCog, UploadCloud, LucideIcon,
  Bus, Library, Box, Globe, MessageSquare
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { usePermissionContext } from '@/lib/rbac-context';
import { useFeatures } from '@/lib/FeatureContext';

// Menu item type with optional permission requirement
interface MenuItem {
  title: string;
  path: string;
  icon: LucideIcon;
  module?: string;  // RBAC module for permission check
  feature?: string; // Feature toggle check
  subFeature?: string; // Sub-feature toggle check
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Organized menu with RBAC module mappings
const menuSections: MenuSection[] = [
  {
    title: 'Main',
    items: [
      { title: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { title: 'Calendar', path: '/dashboard/calendar', icon: Calendar },
    ]
  },
  {
    title: 'Management',
    items: [
      { title: 'Students', path: '/dashboard/students', icon: Users, module: 'students', feature: 'STUDENTS' },
      { title: 'Teachers', path: '/dashboard/teachers', icon: Briefcase, module: 'teachers', feature: 'TEACHERS' },
      { title: 'Academics', path: '/dashboard/academics', icon: BookOpen, module: 'academics' },
      { title: 'Enrollments', path: '/dashboard/enrollments', icon: UserCheck, module: 'enrollments', feature: 'STUDENTS' },
    ]
  },
  {
    title: 'Operations',
    items: [
      { title: 'Attendance', path: '/dashboard/attendance', icon: CalendarCheck, module: 'attendance', feature: 'ATTENDANCE' },
      { title: 'Finance', path: '/dashboard/finance', icon: Banknote, module: 'finance', feature: 'FINANCE' },
      { title: 'Health', path: '/dashboard/health', icon: Heart, module: 'health', feature: 'HEALTH' },
      { title: 'Gate Pass', path: '/dashboard/gatepass', icon: Shield, module: 'gatepass', feature: 'GATE_PASS' },
      { title: 'Transport', path: '/dashboard/transport', icon: Bus, module: 'transport', feature: 'TRANSPORT' },
      { title: 'Library', path: '/dashboard/library', icon: Library, module: 'library', feature: 'LIBRARY' },
      { title: 'Assets', path: '/dashboard/assets', icon: Box, module: 'assets', feature: 'ASSETS' },
      { title: 'Data Uploads', path: '/dashboard/uploads', icon: UploadCloud },
    ]
  },
  {
    title: 'Records',
    items: [
      { title: 'Achievements', path: '/dashboard/achievements', icon: Trophy, module: 'achievements', feature: 'ACHIEVEMENTS' },
      { title: 'Certificates', path: '/dashboard/certificates', icon: FileText, module: 'students', feature: 'CERTIFICATES' },
      { title: 'Discipline', path: '/dashboard/discipline', icon: AlertTriangle, module: 'discipline', feature: 'DISCIPLINE' },
      { title: 'Transfers', path: '/dashboard/transfers', icon: ArrowRightLeft, module: 'transfers', feature: 'TRANSFERS' },
      { title: 'Community', path: '/dashboard/community', icon: Globe, feature: 'COMMUNITY' },
      { title: 'Alumni', path: '/dashboard/alumni', icon: GraduationCap, feature: 'STUDENTS' },
    ]
  },
  {
    title: 'System',
    items: [
      { title: 'Analytics', path: '/dashboard/analytics', icon: TrendingUp, module: 'reports', feature: 'AI_ANALYTICS' },
      { title: 'Reports', path: '/dashboard/reports', icon: FileText, module: 'reports', feature: 'REPORTS' },
      { title: 'Promotion', path: '/dashboard/promotion', icon: CalendarCheck, module: 'enrollments' },
    ]
  }
];

// Settings submenu items
const settingsItems: MenuItem[] = [
  { title: 'General', path: '/dashboard/settings', icon: Settings, module: 'settings' },
  { title: 'Roles', path: '/dashboard/settings/roles', icon: Shield, module: 'roles' },
  { title: 'Assignments', path: '/dashboard/settings/role-assignments', icon: UserCog, module: 'roles' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(pathname?.startsWith('/dashboard/settings'));

  // RBAC Permission Context
  const { hasModuleAccess, isAdmin, loading: permissionsLoading } = usePermissionContext();
  const { isFeatureEnabled, loading: featuresLoading } = useFeatures();

  // Filter menu items based on permissions
  const filteredMenuSections = useMemo(() => {
    if (permissionsLoading || featuresLoading) return menuSections; // Show all while loading

    return menuSections.map(section => ({
      ...section,
      items: section.items.filter(item => {
        // 1. Check Feature Toggles (Global Owner Control)
        if (item.feature) {
          if (!isFeatureEnabled(item.feature, item.subFeature)) return false;
        }

        // 2. Check RBAC (Role Based Access)
        // No module requirement = always show
        if (!item.module) return true;
        // Admin sees everything
        if (isAdmin) return true;
        // Check module access
        return hasModuleAccess(item.module);
      })
    })).filter(section => section.items.length > 0); // Remove empty sections
  }, [hasModuleAccess, isAdmin, isFeatureEnabled, permissionsLoading, featuresLoading]);

  // Filter settings items
  const filteredSettingsItems = useMemo(() => {
    if (permissionsLoading) return settingsItems;

    return settingsItems.filter(item => {
      if (!item.module) return true;
      if (isAdmin) return true;
      return hasModuleAccess(item.module);
    });
  }, [hasModuleAccess, isAdmin, permissionsLoading]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  const isExactMatch = (path: string) => pathname === path;
  const isSettingsActive = pathname?.startsWith('/dashboard/settings');

  return (
    <>
      {/* MOBILE TOGGLE */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-40 lg:hidden p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        <Menu size={20} />
      </button>

      <aside className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* BRANDING */}
        <div className="p-5 flex items-center justify-between border-b border-slate-700/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight">School OS</span>
              <span className="text-[10px] text-slate-400">Management</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-700/50 rounded transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* MENU */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {filteredMenuSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>
              {section.items.map((item) => {
                const isActive = isExactMatch(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                  >
                    <item.icon
                      size={18}
                      strokeWidth={isActive ? 2.5 : 2}
                      className="flex-shrink-0"
                    />
                    <span className="text-sm font-medium">{item.title}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Settings with submenu - only show if user has access */}
          {filteredSettingsItems.length > 0 && (
            <div className="pt-3 border-t border-slate-700/30">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className={`flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isSettingsActive
                  ? 'bg-blue-600/30 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} strokeWidth={isSettingsActive ? 2.5 : 2} />
                  <span className="text-sm font-medium">Settings</span>
                </div>
                {settingsExpanded ? (
                  <ChevronDown size={16} className="text-slate-400" />
                ) : (
                  <ChevronRight size={16} className="text-slate-400" />
                )}
              </button>

              {/* Settings Submenu */}
              {settingsExpanded && (
                <div className="mt-1 ml-3 pl-3 border-l border-slate-700/50 space-y-1">
                  {filteredSettingsItems.map((item) => {
                    const isActive = isExactMatch(item.path);
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`}
                      >
                        <item.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* LOGOUT */}
        <div className="p-3 border-t border-slate-700/30">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-all duration-200 group"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}