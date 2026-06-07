"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function VerifyPassPage() {
  const searchParams = useSearchParams();
  const pass_id = searchParams.get('pass_id');
  
  const [formData, setFormData] = useState({ secret_key: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      // Point to the backend API
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/gatepass/passes/verify_api/`, {
        pass_id,
        ...formData
      });
      
      setStudentName(response.data.student_name);
      setStatus('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed. Please check your details.');
      setStatus('error');
    }
  };

  // No longer blocking if pass_id is missing to allow manual entry of Secret Key

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-['Outfit']">
        <div className="bg-white p-10 rounded-3xl shadow-xl border text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pass Verified</h1>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Student <span className="font-bold text-gray-900">{studentName}</span> has been verified successfully.
          </p>
          <p className="text-sm text-gray-500 mt-6">
            The guardian has been notified.
          </p>
          <button 
            onClick={() => window.close()}
            className="mt-8 w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-['Outfit']">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full">
        <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2 justify-center">
          <Shield size={24} />
          <span className="text-xl tracking-tight">SchoolOS Secure</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Verify Gate Pass</h1>
        <p className="text-gray-500 text-center text-sm mb-8">
          Enter details sent to the primary guardian's email to verify the student.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student ID field removed for simplicity */}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
              6-Digit Secret Key
            </label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="######"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-50 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all text-lg tracking-[0.2em] font-mono"
              value={formData.secret_key}
              onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Mark as Used'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          &copy; 2026 SchoolOS • Secure Gate Management
        </p>
      </div>
    </div>
  );
}
