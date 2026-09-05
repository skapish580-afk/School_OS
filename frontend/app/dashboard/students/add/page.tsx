'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, CheckCircle, Loader2, UserPlus, School, Shield, UploadCloud, FileText, Globe, Activity } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function AddStudentPage() {
  const router = useRouter();
  const { hasPermission, isAdmin, loading: permissionLoading } = usePermissionContext();
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // Image Preview State
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    user_email: '',
    phone_number: '',
    grade: '',
    section: '',
    gender: 'MALE',
    date_of_birth: '',
    blood_group: '',
    address: '',
    latitude: '',
    longitude: '',
    admission_number: '',
    admission_date: '',
    category: '',
    religion: '',
    mother_tongue: '',
    nationality: 'Indian',
    birth_place: '',
    aadhaar_number: '',
    apaar_id: '',
    pen_id: '',
    house_color: '',
    dietary_preference: '',
    allergies: '',
    languages_known: '',
    roll_number: ''
  });

  const [docs, setDocs] = useState<{
    doc_birth_certificate: File | null;
    doc_transfer_certificate: File | null;
    doc_mark_sheet: File | null;
  }>({
    doc_birth_certificate: null,
    doc_transfer_certificate: null,
    doc_mark_sheet: null,
  });

  const [customDocs, setCustomDocs] = useState<{ id: string; title: string; file: File | null }[]>([]);

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

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      setDocs(prev => ({
        ...prev,
        [fieldName]: e.target.files![0]
      }));
    }
  };

  const addCustomDoc = () => {
    setCustomDocs(prev => [...prev, { id: Math.random().toString(), title: '', file: null }]);
  };

  const removeCustomDoc = (id: string) => {
    setCustomDocs(prev => prev.filter(doc => doc.id !== id));
  };

  const handleCustomDocChange = (id: string, field: 'title' | 'file', value: string | File) => {
    setCustomDocs(prev => prev.map(doc => {
      if (doc.id === id) {
        return { ...doc, [field]: value };
      }
      return doc;
    }));
  };

  if (permissionLoading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-500 bg-gray-50">
      <Loader2 className="animate-spin mr-2" /> Loading...
    </div>
  );

  const canAddStudent = isAdmin || hasPermission('students.add_student');
  if (!canAddStudent) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">You do not have permission to add students.</p>
        </div>
      </div>
    );
  }

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file)); // Show preview instantly
    }
  };

  const submitForm = async (status: 'ACTIVE' | 'TEMPORARY') => {
    setLoading(true);

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
        // Only append if value is not empty to avoid 400 Bad Request
        if (value !== undefined && value !== null && String(value).trim() !== '') { 
            data.append(key, String(value));
        }
    });

    data.append('status', status);

    if (photoFile) {
        data.append('profile_photo', photoFile);
    }

    if (docs.doc_birth_certificate) {
        data.append('doc_birth_certificate', docs.doc_birth_certificate);
    }
    if (docs.doc_transfer_certificate) {
        data.append('doc_transfer_certificate', docs.doc_transfer_certificate);
    }
    if (docs.doc_mark_sheet) {
        data.append('doc_mark_sheet', docs.doc_mark_sheet);
    }

    // Append custom documents
    customDocs.forEach((doc) => {
      if (doc.title.trim() !== '' && doc.file) {
        data.append('custom_doc_files', doc.file);
        data.append('custom_doc_titles', doc.title);
      }
    });

    try {
        await api.post('/students/', data);
        if (status === 'TEMPORARY') {
            alert("Student Details Saved Temporarily!");
        } else {
            alert("Student Admitted Successfully!");
        }
        router.push('/dashboard/students');
    } catch (err: any) {
        console.error("Submission Error:", err);
        // Show exact error from backend
        alert(`Failed: ${JSON.stringify(err.response?.data || "Unknown Error")}`); 
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitForm('ACTIVE');
  };

  const handleSaveDetails = async () => {
    if (!formData.user_email || formData.user_email.trim() === '') {
      alert("Email is required to save details.");
      return;
    }
    if (!formData.phone_number || formData.phone_number.trim() === '') {
      alert("Phone number is required to save details.");
      return;
    }
    submitForm('TEMPORARY');
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
                            <input required name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Gender *</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Blood Group</label>
                            <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="">Select Blood Group</option>
                                <option value="A+">A+</option>
                                <option value="A-">A-</option>
                                <option value="B+">B+</option>
                                <option value="B-">B-</option>
                                <option value="O+">O+</option>
                                <option value="O-">O-</option>
                                <option value="AB+">AB+</option>
                                <option value="AB-">AB-</option>
                            </select>
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Address *</label>
                            <textarea required name="address" value={formData.address} rows={3} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm mb-2" placeholder="Full residential address..." />
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
                
                {/* 3. IDENTITY & ACCOUNT INFO */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserPlus size={18} className="text-blue-600"/> Identity & Identification
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* First Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">First Name *</label>
                            <input required name="first_name" value={formData.first_name} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Rahul" />
                        </div>
                        
                        {/* Last Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Last Name</label>
                            <input name="last_name" value={formData.last_name} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Sharma" />
                        </div>

                        {/* Middle Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Middle Name (Optional)</label>
                            <input name="middle_name" value={formData.middle_name} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Kumar" />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email *</label>
                            <input required name="user_email" type="email" value={formData.user_email} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. rahul@example.com" />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Phone *</label>
                            <input required name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="10-digit Phone Number" />
                        </div>

                        {/* Aadhaar Number */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Aadhaar Number</label>
                            <input name="aadhaar_number" value={formData.aadhaar_number} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="12-digit Aadhaar No" maxLength={12} />
                        </div>

                        {/* APAAR ID */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">APAAR ID</label>
                            <input name="apaar_id" value={formData.apaar_id} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="APAAR Card ID" />
                        </div>

                        {/* PEN ID */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">PEN ID</label>
                            <input name="pen_id" value={formData.pen_id} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Permanent Education Number" />
                        </div>
                    </div>
                </div>

                {/* 4. ACADEMIC & ADMISSION */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <School size={18} className="text-purple-600"/> Academic & Admission
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Grade *</label>
                            <input
                                required
                                name="grade"
                                type="text"
                                value={formData.grade}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. 10 or LKG"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Section *</label>
                            <input
                                required
                                name="section"
                                type="text"
                                value={formData.section}
                                onChange={handleChange}
                                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g. A"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Admission Number</label>
                            <input name="admission_number" value={formData.admission_number} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. ADM-2026-001" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Roll Number</label>
                            <input name="roll_number" value={formData.roll_number} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. 12B" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Admission Date</label>
                            <input name="admission_date" type="date" value={formData.admission_date} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500" />
                        </div>
                    </div>
                </div>

                {/* 5. DEMOGRAPHICS & PROFILE */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-orange-600"/> Demographics & Profile Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
                            <select name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                                <option value="">Select Category</option>
                                <option value="GEN">General</option>
                                <option value="OBC">OBC</option>
                                <option value="SC">SC</option>
                                <option value="ST">ST</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Religion</label>
                            <input name="religion" value={formData.religion} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Hinduism, Islam" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mother Tongue</label>
                            <input name="mother_tongue" value={formData.mother_tongue} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Hindi, Tamil" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nationality</label>
                            <input name="nationality" value={formData.nationality} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="Indian" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Birth Place</label>
                            <input name="birth_place" value={formData.birth_place} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="City / Town" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Languages Known</label>
                            <input name="languages_known" value={formData.languages_known} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. English, Hindi" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">House Color</label>
                            <input name="house_color" value={formData.house_color} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Red, Blue" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Dietary Preference</label>
                            <input name="dietary_preference" value={formData.dietary_preference} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Veg, Non-Veg" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Allergies</label>
                            <input name="allergies" value={formData.allergies} onChange={handleChange} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-orange-500" placeholder="e.g. Peanuts, Dust, Pollen, Milk" />
                        </div>

                    </div>
                </div>

                {/* 6. REQUIRED DOCUMENTS */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText size={18} className="text-red-600"/> Required Documents (PDF Format)
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Birth Certificate *</label>
                            <input required type="file" accept="application/pdf" onChange={(e) => handleDocChange(e, 'doc_birth_certificate')} className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" />
                            {docs.doc_birth_certificate && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_birth_certificate.name}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Transfer Certificate (Optional)</label>
                            <input type="file" accept="application/pdf" onChange={(e) => handleDocChange(e, 'doc_transfer_certificate')} className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                            {docs.doc_transfer_certificate && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_transfer_certificate.name}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mark Sheet (Optional)</label>
                            <input type="file" accept="application/pdf" onChange={(e) => handleDocChange(e, 'doc_mark_sheet')} className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                            {docs.doc_mark_sheet && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {docs.doc_mark_sheet.name}</p>}
                        </div>
                    </div>

                    {/* Dynamic Custom Documents */}
                    {customDocs.length > 0 && (
                        <div className="pt-4 border-t border-gray-100 space-y-4">
                            <h4 className="text-xs font-bold text-gray-700 uppercase">Additional Documents</h4>
                            <div className="space-y-4">
                                {customDocs.map((doc, idx) => (
                                    <div key={doc.id} className="p-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 relative space-y-3">
                                        <button 
                                            type="button" 
                                            onClick={() => removeCustomDoc(doc.id)} 
                                            className="absolute right-3 top-3 text-red-500 hover:text-red-700 text-xs font-bold transition-colors"
                                        >
                                            Remove
                                        </button>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">Document Name/Title *</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={doc.title} 
                                                onChange={(e) => handleCustomDocChange(doc.id, 'title', e.target.value)} 
                                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white" 
                                                placeholder="e.g. Migration Certificate" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">Document File (PDF) *</label>
                                            <input 
                                                type="file" 
                                                required
                                                accept="application/pdf" 
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        handleCustomDocChange(doc.id, 'file', e.target.files[0]);
                                                    }
                                                }} 
                                                className="w-full p-2 border rounded-lg outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={addCustomDoc}
                        className="w-full py-2.5 px-4 border border-dashed border-red-300 hover:border-red-500 text-red-600 hover:text-red-700 bg-red-50/20 hover:bg-red-50/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                        + Add More Documents
                    </button>
                </div>

                {/* SUBMIT */}
                <div className="flex justify-end gap-4">
                    <button 
                        type="button" 
                        onClick={handleSaveDetails}
                        disabled={loading}
                        className="px-6 py-4 rounded-xl font-bold border-2 border-black text-black bg-white hover:bg-gray-50 transition-all disabled:opacity-50 active:scale-95"
                    >
                        Save Details
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg active:scale-95"
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