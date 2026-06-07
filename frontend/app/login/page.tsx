'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ArrowRight, HelpCircle } from 'lucide-react';
import api from '@/lib/api';
import Cookies from 'js-cookie'; // Make sure to install: npm install js-cookie

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Send Login Request
      const response = await api.post('/auth/login/', {
        email: formData.email,
        password: formData.password
      });

      // 2. Extract Tokens
      const { access, refresh } = response.data;

      // 3. CRITICAL: Save to BOTH LocalStorage and Cookies
      // API.ts looks in LocalStorage
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Middleware looks in Cookies
      Cookies.set('access_token', access, { expires: 1 }); // Expires in 1 day
      Cookies.set('refresh_token', refresh, { expires: 7 });

      // 4. Force a hard reload of the API configuration
      // This ensures the new token is picked up immediately
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // 5. Get user profile to determine role and school
      const profileResponse = await api.get('/auth/me/');
      const userData = profileResponse.data;

      // Store full user data for use in Navbar and other components
      localStorage.setItem('user', JSON.stringify(userData));

      // 6. Redirect based on role
      if (userData.user_type === 'PLATFORM_ADMIN') {
        router.push('/owner');
      } else if (userData.role === 'TEACHER') {
        router.push('/teachers');
      } else {
        router.push('/dashboard');
      }

    } catch (err: any) {
      console.error('Login Failed:', err);
      setError(err.response?.data?.detail || 'Invalid email or password');
      // Show forgot password link after failed login attempt
      setShowForgotPassword(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-500">Sign in to manage your school</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
              {error}
            </div>
          )}

          {/* Forgot Password Prompt - Shows after failed login */}
          {showForgotPassword && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
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

          <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Always visible forgot password link */}
          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}