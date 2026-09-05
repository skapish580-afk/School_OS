'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CheckCircle2, Loader2, School, User, CreditCard, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    school_name: '',
    school_code: '',
    contact_email: '',
    phone_number: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    plan: 'BASIC'
  });

  const [onboardingData, setOnboardingData] = useState<any>(null);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. Submit onboarding registration
      const regRes = await api.post('/onboarding/register/', formData);
      
      // 2. Programmatically verify payment in background to provision the school immediately
      const verifyRes = await api.post('/onboarding/verify-payment/', {
        razorpay_order_id: regRes.data.razorpay_order_id,
        razorpay_payment_id: 'pay_dummy_123',
        razorpay_signature: 'sig_dummy_123'
      });

      setOnboardingData(verifyRes.data);
      setStep(4); // Go to Success Step (4)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Progress Bar */}
        <div className="flex h-2 bg-gray-100">
            {[1,2,3,4].map(s => (
                <div key={s} className={`flex-1 transition-all duration-500 ${step >= s ? 'bg-blue-600' : ''}`} />
            ))}
        </div>

        <div className="p-10">
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <School size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900">School Identity</h2>
                    <p className="text-gray-500">Let's start with your institution's basic details.</p>
                    <div className="space-y-4">
                        <input name="school_name" placeholder="School Name" onChange={handleChange} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                        <input name="school_code" placeholder="School Code (e.g. GWD-MUM)" onChange={handleChange} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="contact_email" placeholder="Contact Email" onChange={handleChange} className="p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                            <input name="phone_number" placeholder="Phone" onChange={handleChange} className="p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <button onClick={() => setStep(2)} className="w-full bg-black text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                        Next <ArrowRight size={20} />
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                        <User size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900">Admin Account</h2>
                    <p className="text-gray-500">This will be the primary administrator for the school.</p>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <input name="admin_first_name" placeholder="First Name" onChange={handleChange} className="p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                            <input name="admin_last_name" placeholder="Last Name" onChange={handleChange} className="p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <input name="admin_email" placeholder="Admin Email (Login)" onChange={handleChange} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setStep(1)} className="flex-1 border p-4 rounded-2xl font-bold">Back</button>
                        <button onClick={() => setStep(3)} className="flex-[2] bg-black text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2">Next</button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                        <CreditCard size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900">Choose a Plan</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setFormData({...formData, plan: 'BASIC'})}
                            className={`p-6 rounded-3xl border-2 text-left transition-all ${formData.plan === 'BASIC' ? 'border-blue-600 bg-blue-50' : 'border-gray-100'}`}
                        >
                            <div className="font-bold text-lg">Basic</div>
                            <div className="text-2xl font-black mt-2">₹4,999<span className="text-sm font-normal text-gray-500">/yr</span></div>
                            <ul className="text-xs text-gray-500 mt-4 space-y-1">
                                <li>• Attendance</li>
                                <li>• Academics</li>
                                <li>• Max 200 Students</li>
                             </ul>
                        </button>
                        <button 
                            onClick={() => setFormData({...formData, plan: 'PREMIUM'})}
                            className={`p-6 rounded-3xl border-2 text-left transition-all ${formData.plan === 'PREMIUM' ? 'border-blue-600 bg-blue-50' : 'border-gray-100'}`}
                        >
                            <div className="font-bold text-lg text-blue-600">Premium</div>
                            <div className="text-2xl font-black mt-2">₹9,999<span className="text-sm font-normal text-gray-500">/yr</span></div>
                            <ul className="text-xs text-gray-500 mt-4 space-y-1">
                                <li>• Everything in Basic</li>
                                <li>• Finance & Fees</li>
                                <li>• Library & Transport</li>
                                <li>• Max 1000 Students</li>
                            </ul>
                        </button>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button onClick={handleRegister} disabled={loading} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" /> : "Confirm & Register"}
                    </button>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-8 text-center animate-in zoom-in-90 duration-700">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={48} />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black text-gray-900">Welcome to SchoolOS!</h2>
                        <p className="text-gray-500 mt-2">Your school <span className="font-bold text-gray-900">{onboardingData?.school_name}</span> has been provisioned.</p>
                    </div>
                    
                    <div className="bg-blue-600 text-white p-8 rounded-3xl text-left space-y-4 shadow-2xl shadow-blue-200">
                        <h3 className="font-bold border-b border-white/20 pb-2">Login Credentials</h3>
                        <div>
                            <label className="text-[10px] uppercase font-bold opacity-70">Email</label>
                            <p className="font-bold">{onboardingData?.admin_email}</p>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold opacity-70">Temporary Password</label>
                            <p className="font-bold font-mono">{onboardingData?.temporary_password}</p>
                        </div>
                    </div>

                    <button onClick={() => router.push('/login')} className="w-full bg-black text-white p-5 rounded-2xl font-bold">
                        Go to Login
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
