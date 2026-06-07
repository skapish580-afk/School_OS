'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, CheckCircle, Loader2, UserPlus, School, Shield, UploadCloud } from 'lucide-react';

export default function AddStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // Image Preview State
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '', // <--- Added Middle Name
    last_name: '',
    user_email: '',
    user_phone: '',
    grade: '',
    section: '',
    gender: 'MALE',
    date_of_birth: '',
    blood_group: '',
    address: '',
    latitude: '',
    longitude: ''
  });

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Fetch grades and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gradesRes, sectionsRes] = await Promise.all([
          api.get('/academics/grades/'),
          api.get('/academics/sections/')
        ]);
        setGrades(gradesRes.data);
        setSections(sectionsRes.data);
      } catch (error) {
        console.error('Failed to fetch grades/sections', error);
      }
    };
    fetchData();
  }, []);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file)); // Show preview instantly
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
        // Only append if value is not empty to avoid 400 Bad Request
        if (value && value.trim() !== '') { 
            data.append(key, value);
        }
    });

    if (photoFile) {
        data.append('profile_photo', photoFile);
    }

    try {
        await api.post('/students/', data);
        alert("Student Admitted Successfully!");
        router.push('/dashboard/students');
    } catch (err: any) {
        console.error("Submission Error:", err);
        // Show exact error from backend
        alert(`Failed: ${JSON.stringify(err.response?.data || "Unknown Error")}`); 
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-8 pb-20">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-2xl font-bold text-gray-800">New Admission</h1>
            <p className="text-gray-500 text-sm">Fill details below. Student ID will be auto-generated secure ID.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: PHOTO & PERSONAL */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* 1. PHOTO UPLOAD */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
                    <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase">Profile Photo</h3>
                    
                    <div className="relative w-32 h-32 mx-auto mb-4 group">
                        {preview ? (
                            <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-full border-4 border-gray-100" />
                        ) : (
                            <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                                <UserPlus size={40} />
                            </div>
                        )}
                        
                        {/* Overlay Upload Button */}
                        <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <UploadCloud size={24} />
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                    </div>
                    <p className="text-xs text-gray-400">Click to upload image</p>
                </div>

                {/* 2. PERSONAL DETAILS */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Shield size={18} className="text-green-600"/> Personal
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date of Birth *</label>
                            <input required name="date_of_birth" type="date" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Gender *</label>
                            <select name="gender" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Address *</label>
                            <textarea required name="address" rows={3} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm mb-2" placeholder="Full residential address..." />
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Geographic Location *</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Latitude *</label>
                                    <input required name="latitude" value={formData.latitude} onChange={handleChange} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white" placeholder="e.g. 18.922" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Longitude *</label>
                                    <input required name="longitude" value={formData.longitude} onChange={handleChange} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-sm bg-white" placeholder="e.g. 72.834" />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 italic">Enter manual coordinates for school transport tracking.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: ACCOUNT & ACADEMIC */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 3. ACCOUNT INFO */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserPlus size={18} className="text-blue-600"/> Identity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* First Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">First Name *</label>
                            <input required name="first_name" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Rahul" />
                        </div>
                        
                        {/* Last Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Last Name</label>
                            <input name="last_name" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Sharma" />
                        </div>

                        {/* Middle Name - Full Width */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Middle Name (Optional)</label>
                            <input name="middle_name" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Kumar" />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email</label>
                            <input required name="user_email" type="email" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Phone</label>
                            <input name="user_phone" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
                        </div>
                    </div>
                </div>

                {/* 4. ACADEMIC */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <School size={18} className="text-purple-600"/> Class Assignment
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Grade *</label>
                            <select required name="grade" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                                <option value="">Select Grade</option>
                                {grades.map((g) => (
                                    <option key={g.id} value={g.grade_number}>{g.grade_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Section *</label>
                            <select required name="section" onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                                <option value="">Select Section</option>
                                {Array.from(new Set(sections.map(s => s.section_letter))).map((letter) => (
                                    <option key={letter} value={letter}>{letter}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* SUBMIT */}
                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                        Confirm Admission
                    </button>
                </div>

            </div>
        </div>
      </form>
    </div>
  );
}