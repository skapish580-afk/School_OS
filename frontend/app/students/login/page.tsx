'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { School, User, Lock, Eye, EyeOff, ArrowRight, GraduationCap, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import api from '@/lib/api';
import Cookies from 'js-cookie';

export default function StudentLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Send Login Request with School Name, Username/SUID, Password
      const response = await api.post('/auth/rbac/role-login/', {
        school_name: formData.schoolName.trim(),
        username: formData.username.trim(),
        password: formData.password
      });

      const { access, refresh } = response.data;

      // 2. Save tokens to LocalStorage and Cookies
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      Cookies.set('access_token', access, { expires: 1 });
      Cookies.set('refresh_token', refresh, { expires: 7 });

      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // 3. Retrieve user profile
      try {
        const profileResponse = await api.get('/auth/me/');
        localStorage.setItem('user', JSON.stringify(profileResponse.data));
      } catch (profileErr) {
        console.warn('Could not load user profile, proceeding...', profileErr);
      }

      // 4. Redirect to Student Portal Dashboard
      window.location.href = '/students';
    } catch (err: any) {
      console.error('Student Login Failed:', err);
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Invalid school name, SUID/username, or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Portal Branding Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl shadow-xl shadow-indigo-950/50 mb-4 border border-indigo-400/20 text-white">
            <GraduationCap size={36} />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            Student Portal <Sparkles className="w-5 h-5 text-indigo-400" />
          </h1>
          <p className="text-indigo-200/80 text-sm mt-1">School OS Ecosystem</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/40 border border-indigo-100 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Student Sign In</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your school name and student ID or username</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50/90 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Authentication Error</span>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Field 1: School Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                School Name
              </label>
              <div className="relative">
                <School className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600" size={19} />
                <input
                  type="text"
                  required
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-gray-900 text-sm font-medium transition-all"
                  placeholder="e.g., Greenwood High"
                />
              </div>
            </div>

            {/* Field 2: Username / SUID */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                Student ID / Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600" size={19} />
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-gray-900 text-sm font-medium transition-all"
                  placeholder="e.g., SUID-2025-001 or alex_student"
                />
              </div>
            </div>

            {/* Field 3: Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600" size={19} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-11 pr-12 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-gray-900 text-sm font-medium transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Student Portal</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Secondary Footer Links */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
            <Link
              href="/teachers/login"
              className="text-gray-600 hover:text-indigo-600 transition-colors flex items-center gap-1 hover:underline"
            >
              <BookOpen size={14} /> Teacher Portal →
            </Link>
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors flex items-center gap-1 hover:underline"
            >
              Admin/Staff Login →
            </Link>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-indigo-300/60 mt-6">
          © {new Date().getFullYear()} School OS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
