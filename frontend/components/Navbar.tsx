'use client';

import { useEffect, useState } from 'react';
import { Bell, Search, User, Command, Building2 } from 'lucide-react';
import SmartSearch from './SmartSearch';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    // Load user data from local storage (fastest way)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Keyboard shortcut: Ctrl+K or Cmd+K to open search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get display role
  const getDisplayRole = () => {
    if (!user) return 'USER';
    // Check explicit platform admin flag from API
    if (user.is_platform_admin === true) return 'PLATFORM ADMIN';
    // Use user_type field
    const userType = user.user_type || user.role;
    switch(userType) {
      case 'PLATFORM_ADMIN': return 'PLATFORM ADMIN';
      case 'SCHOOL_ADMIN': return 'SCHOOL ADMIN';
      case 'ADMIN': return 'ADMIN';
      case 'TEACHER': return 'TEACHER';
      case 'STUDENT': return 'STUDENT';
      case 'PARENT': return 'PARENT';
      default: return userType?.replace('_', ' ') || 'USER';
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 fixed top-0 right-0 left-64 z-40">
        {/* Search Bar */}
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg w-96 transition-colors group"
        >
          <Search size={18} className="text-gray-400 mr-2 group-hover:text-gray-600" />
          <span className="text-sm text-gray-500 group-hover:text-gray-700 flex-1 text-left">
            Search students, teachers... (handles typos!)
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-300">
            <Command size={12} />
            <span>K</span>
          </div>
        </button>

        {/* Right Side Icons */}
        <div className="flex items-center gap-6">
          {/* School Badge - show for non-platform admins */}
          {user?.school_name && !user?.is_platform_admin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              <Building2 size={16} />
              <span className="text-sm font-medium">{user.school_name}</span>
            </div>
          )}
          {/* Platform Admin Badge - only for actual platform admins */}
          {user?.is_platform_admin === true && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
              <Building2 size={16} />
              <span className="text-sm font-medium">All Schools</span>
            </div>
          )}
          
          <button className="relative text-gray-500 hover:text-gray-700">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="flex items-center gap-3 border-l pl-6 border-gray-200">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-gray-900 leading-none">
                {user?.full_name || 'Loading...'}
              </p>
              <p className="text-xs text-gray-500 mt-1 uppercase">
                {getDisplayRole()}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-200">
              {user?.full_name?.[0] || <User size={20} />}
            </div>
          </div>
        </div>
      </header>

      {/* Smart Search Modal */}
      {showSearch && (
        <SmartSearch
          showModal={true}
          onClose={() => setShowSearch(false)}
          autoFocus={true}
        />
      )}
    </>
  );
}