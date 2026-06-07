'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import { ArrowLeft, Save, Loader2, UploadCloud, User } from 'lucide-react';

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Image State
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '', 
    phone_number: '',
    address: '',
    latitude: '',
    longitude: '',
    blood_group: '',
    date_of_birth: '',
    // New Fields
    category: '',
    religion: '',
    mother_tongue: '',
    languages_known: '',
    nationality: 'Indian',
    birth_place: '',
    is_rte_student: false,
    fee_concession_applicable: false,
    house_color: '',
    alumni_directory_consent: false,
    aadhaar_last_4_digits: '',
    apaar_id: '',
    pen_id: '',
    dietary_preference: ''
  });

  useEffect(() => {
    if (id) fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    try {
      const res = await api.get(`/students/${id}/`);
      const s = res.data;
      
      // Pre-fill form
      setFormData({
        first_name: s.first_name || '', 
        last_name: s.last_name || '',
        middle_name: s.middle_name || '',
        email: s.email || '',
        phone_number: s.phone_number || '',
        address: s.address || '',
        latitude: s.latitude || '',
        longitude: s.longitude || '',
        blood_group: s.blood_group || '',
        date_of_birth: s.date_of_birth || '',
        category: s.category || '',
        religion: s.religion || '',
        mother_tongue: s.mother_tongue || '',
        languages_known: s.languages_known || '',
        nationality: s.nationality || 'Indian',
        birth_place: s.birth_place || '',
        is_rte_student: s.is_rte_student || false,
        fee_concession_applicable: s.fee_concession_applicable || false,
        house_color: s.house_color || '',
        alumni_directory_consent: s.alumni_directory_consent || false,
        aadhaar_last_4_digits: s.aadhaar_last_4_digits || '',
        apaar_id: s.apaar_id || '',
        pen_id: s.pen_id || '',
        dietary_preference: s.dietary_preference || ''
      });

      // Set existing photo preview
      if (s.profile_photo) {
        setPreview(getMediaUrl(s.profile_photo));
      }
      
      setLoading(false);
    } catch (e) {
      alert("Failed to load student data");
    }
  };

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle New Photo Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreview(URL.createObjectURL(file)); // Show new preview
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Use FormData to support file uploads (profile_photo).
    // IMPORTANT: Do NOT append empty strings for Date/nullable fields —
    // Django's DateField rejects '' and returns a 400. Only append them when they have a value.
    const data = new FormData();

    // Always-present string fields (safe to send even if empty)
    data.append('first_name', formData.first_name);
    data.append('last_name', formData.last_name);
    data.append('middle_name', formData.middle_name);
    data.append('phone_number', formData.phone_number);
    
    // Address & Coordinates
    data.append('address', formData.address);
    data.append('latitude', formData.latitude);
    data.append('longitude', formData.longitude);

    data.append('blood_group', formData.blood_group);
    data.append('nationality', formData.nationality);

    // Conditional: only send date if it has a real value (avoid sending '' to DateField)
    if (formData.date_of_birth) {
      data.append('date_of_birth', formData.date_of_birth);
    }

    // Optional text fields
    data.append('category', formData.category);
    data.append('religion', formData.religion);
    data.append('mother_tongue', formData.mother_tongue);
    data.append('languages_known', formData.languages_known);
    data.append('birth_place', formData.birth_place);
    data.append('house_color', formData.house_color);
    data.append('aadhaar_last_4_digits', formData.aadhaar_last_4_digits);
    data.append('apaar_id', formData.apaar_id);
    data.append('pen_id', formData.pen_id);
    data.append('dietary_preference', formData.dietary_preference);

    // Boolean fields — send as string 'true'/'false'
    data.append('is_rte_student', String(formData.is_rte_student));
    data.append('fee_concession_applicable', String(formData.fee_concession_applicable));
    data.append('alumni_directory_consent', String(formData.alumni_directory_consent));

    // Only append photo if a new one was selected
    if (photoFile) {
      data.append('profile_photo', photoFile);
    }

    try {
      await api.patch(`/students/${id}/`, data);
      alert("Student updated successfully!");
      router.push(`/dashboard/students/${id}`);
    } catch (err: any) {
      console.error("Update failed:", err?.response?.data || err);
      alert("Failed to update student. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={30}/></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8 animate-in fade-in duration-300">
            
            {/* PHOTO UPLOAD SECTION */}
            <div className="flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 group cursor-pointer">
                    {preview ? (
                        <img src={preview} alt="Profile" className="w-full h-full object-cover rounded-full border-4 border-gray-100 shadow-sm" />
                    ) : (
                        <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                            <User size={40} />
                        </div>
                    )}
                    
                    {/* The Overlay Icon */}
                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <UploadCloud size={24} />
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>
                <p className="text-xs text-gray-400 mt-3">Click to change photo</p>
            </div>

            {/* FORM FIELDS */}
            <div className="grid md:grid-cols-3 gap-6">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">First Name</label>
                    <input name="first_name" value={formData.first_name} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Middle Name</label>
                    <input name="middle_name" value={formData.middle_name} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Last Name</label>
                    <input name="last_name" value={formData.last_name} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Email (Read Only)</label>
                    <input name="email" value={formData.email} disabled className="w-full p-3 border rounded-lg mt-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                    <input name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Address & Location *</h3>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Full Address *</label>
                    <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="House No, Street, City, State, Pincode" />
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-4">
                    <label className="text-xs font-bold text-gray-900 uppercase">Geographic Coordinates *</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Latitude *</label>
                            <input name="latitude" value={formData.latitude} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 bg-white text-gray-900 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500" required placeholder="0.000000" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Longitude *</label>
                            <input name="longitude" value={formData.longitude} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 bg-white text-gray-900 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500" required placeholder="0.000000" />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 italic">Please enter the latitude and longitude manually for accurate transport mapping.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Date of Birth</label>
                    <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Blood Group</label>
                    <input name="blood_group" value={formData.blood_group} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            {/* DEMOGRAPHIC & SOCIAL */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Demographic & Social</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Category (GEN/OBC/SC/ST)</label>
                        <input name="category" value={formData.category} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Religion</label>
                        <input name="religion" value={formData.religion} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Mother Tongue</label>
                        <input name="mother_tongue" value={formData.mother_tongue} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Nationality</label>
                        <input name="nationality" value={formData.nationality} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Birth Place</label>
                        <input name="birth_place" value={formData.birth_place} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Languages Known</label>
                    <input name="languages_known" value={formData.languages_known} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. English, Hindi, Marathi" />
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">House Color</label>
                        <input name="house_color" value={formData.house_color} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id="is_rte_student" name="is_rte_student" checked={formData.is_rte_student} onChange={(e) => setFormData({...formData, is_rte_student: e.target.checked})} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                        <label htmlFor="is_rte_student" className="text-sm font-medium text-gray-700">RTE Student</label>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id="fee_concession_applicable" name="fee_concession_applicable" checked={formData.fee_concession_applicable} onChange={(e) => setFormData({...formData, fee_concession_applicable: e.target.checked})} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                        <label htmlFor="fee_concession_applicable" className="text-sm font-medium text-gray-700">Fee Concession</label>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="alumni_directory_consent" name="alumni_directory_consent" checked={formData.alumni_directory_consent} onChange={(e) => setFormData({...formData, alumni_directory_consent: e.target.checked})} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="alumni_directory_consent" className="text-sm font-medium text-gray-700">Consent for Alumni Directory</label>
                </div>
            </div>

            {/* GOVERNMENT IDENTIFIERS */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Government Identifiers</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Aadhaar (Last 4 Digits)</label>
                        <input name="aadhaar_last_4_digits" maxLength={4} value={formData.aadhaar_last_4_digits} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">APAAR ID</label>
                        <input name="apaar_id" value={formData.apaar_id} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">PEN ID</label>
                        <input name="pen_id" value={formData.pen_id} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>
            </div>

            {/* DIETARY PREFERENCES */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Dietary Preferences</h3>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Preference (Veg/Non-Veg/etc)</label>
                    <input name="dietary_preference" value={formData.dietary_preference} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 transition-all disabled:opacity-50 shadow-md">
                    {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                    Save Changes
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}