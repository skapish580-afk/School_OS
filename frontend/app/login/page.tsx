'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ArrowRight, HelpCircle, School, User } from 'lucide-react';
import api from '@/lib/api';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'admin' | 'role' | 'register'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    schoolName: '',
    username: ''
  });
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'admin') {
        // 1. Send Login Request
        const response = await api.post('/auth/login/', {
          email: formData.email,
          password: formData.password
        });

        // 2. Extract Tokens
        const { access, refresh } = response.data;

        // 3. Save to LocalStorage and Cookies
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        Cookies.set('access_token', access, { expires: 1 });
        Cookies.set('refresh_token', refresh, { expires: 7 });

        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

        // 4. Get profile
        const profileResponse = await api.get('/auth/me/');
        const userData = profileResponse.data;
        localStorage.setItem('user', JSON.stringify(userData));

        // 5. Redirect based on role
        if (userData.user_type === 'PLATFORM_ADMIN') {
          window.location.href = '/owner';
        } else if (userData.role === 'TEACHER') {
          window.location.href = '/teachers';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        // Role Login Request
        const response = await api.post('/auth/rbac/role-login/', {
          school_name: formData.schoolName,
          username: formData.username,
          password: formData.password
        });

        const { access, refresh } = response.data;

        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        Cookies.set('access_token', access, { expires: 1 });
        Cookies.set('refresh_token', refresh, { expires: 7 });

        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

        // Get profile
        const profileResponse = await api.get('/auth/me/');
        const userData = profileResponse.data;
        localStorage.setItem('user', JSON.stringify(userData));

        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      console.error('Login Failed:', err);
      setError(
        err.response?.data?.error || 
        err.response?.data?.detail || 
        'Invalid login credentials'
      );
      if (activeTab === 'admin') {
        setShowForgotPassword(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">School OS</h1>
            <p className="text-gray-500">Sign in to manage your school ecosystem</p>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-gray-100 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('admin'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all ${
                activeTab === 'admin'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Admin/Staff
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('role'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all ${
                activeTab === 'role'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Login as Role
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 text-center transition-all ${
                activeTab === 'register'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
              {error}
            </div>
          )}

          {activeTab === 'register' ? (
            <div className="space-y-6 py-4 text-center">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-1">New School Registration</h3>
                <p className="text-sm text-blue-700">
                  Ready to onboard your school? Launch the onboarding wizard to define your structure and start managing student records, finance, attendance, and more.
                </p>
              </div>
              <Link
                href="/onboarding"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Start Onboarding <ArrowRight size={20} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {activeTab === 'role' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">School Name</label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        required
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="e.g., Greenwood High"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="e.g., accountant"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'admin' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="admin@school.com"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {showForgotPassword && activeTab === 'admin' && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-left">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Forgot your password?</p>
                      <p className="text-xs text-blue-600 mt-1">
                        School administrators can reset their password via email.
                      </p>
                      <Link
                        href="/forgot-password"
                        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-800 font-semibold mt-2 underline"
                      >
                        Reset Password →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'admin' && (
            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <Link
              href="/students/login"
              className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors flex items-center gap-1 hover:underline"
            >
              🎓 Student Portal →
            </Link>
            <Link
              href="/teachers/login"
              className="text-green-700 hover:text-green-900 font-semibold transition-colors flex items-center gap-1 hover:underline"
            >
              📚 Teacher Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}