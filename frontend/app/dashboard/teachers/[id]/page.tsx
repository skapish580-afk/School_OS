'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  Loader2, User, Mail, Phone, Calendar, Heart, MapPin, 
  Droplet, AlertCircle, FileText, Briefcase, CheckCircle2, ShieldAlert
} from 'lucide-react';

export default function TeacherProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchTeacher();
  }, [id]);

  const fetchTeacher = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/teachers/profiles/${id}/`);
      setTeacher(res.data);
    } catch (err) {
      console.error('Failed to load teacher profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin inline text-blue-600" /></div>;
  if (!teacher) return <div className="p-12 text-center text-red-500">Teacher not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header Profile */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-700"></div>
        <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 rounded-3xl shadow-xl flex items-center justify-center text-white text-4xl font-black ring-4 ring-white shrink-0">
          {teacher.full_name?.charAt(0) || 'T'}
        </div>
        <div className="flex-1 text-center md:text-left space-y-2 relative z-10">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {teacher.title ? `${teacher.title} ` : ''}{teacher.full_name}
            </h1>
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black font-mono border border-blue-100 uppercase tracking-widest">
              {teacher.tuid}
            </span>
          </div>
          <p className="text-slate-500 text-lg font-medium">{teacher.qualifications || 'Educator'} • {teacher.certified_subjects || 'General Faculty'}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl ring-1 ring-slate-200/50">
              {teacher.verification_status === 'VERIFIED' ? (
                <><CheckCircle2 size={16} className="text-green-500" /> Verified Educator</>
              ) : (
                <><ShieldAlert size={16} className="text-amber-500" /> Verification Pending</>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl ring-1 ring-slate-200/50">
              <Calendar size={16} className="text-blue-500" /> Joined {new Date(teacher.created_at).getFullYear()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Personal Details */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
          <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3">
            <User size={24} className="text-blue-600" /> Personal Details
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Email Address</p>
                <p className="font-bold text-slate-900">{teacher.email || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Phone size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Phone Number</p>
                <p className="font-bold text-slate-900">{teacher.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Calendar size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Date of Birth</p>
                <p className="font-bold text-slate-900">{teacher.date_of_birth || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Gender</p>
                <p className="font-bold text-slate-900">
                  {teacher.gender === 'M' ? 'Male' : teacher.gender === 'F' ? 'Female' : teacher.gender === 'O' ? 'Other' : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Heart size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Marital Status</p>
                <p className="font-bold text-slate-900">{teacher.marital_status || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Droplet size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Dietary Preference</p>
                <p className="font-bold text-slate-900">{teacher.dietary_preference || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info & Credentials */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3">
              <Briefcase size={24} className="text-indigo-600" /> Professional Info
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Qualifications</p>
                  <p className="font-bold text-slate-900">{teacher.qualifications || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CheckCircle2 size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Certified Subjects</p>
                  <p className="font-bold text-slate-900">{teacher.certified_subjects || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Briefcase size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Years of Experience</p>
                  <p className="font-bold text-slate-900">{teacher.experience_years} Years</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3">
              <AlertCircle size={24} className="text-red-600" /> Emergency & Health
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Phone size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Emergency Contact</p>
                  <p className="font-bold text-slate-900">{teacher.emergency_contact_phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Droplet size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Blood Group</p>
                  <p className="font-bold text-slate-900">{teacher.blood_group || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><MapPin size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Place of Birth</p>
                  <p className="font-bold text-slate-900">{teacher.place_of_birth || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
            <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3">
              <ShieldAlert size={24} className="text-amber-600" /> Identity Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-sm font-medium text-slate-500">Aadhaar (Last 4)</span>
                <span className="font-bold text-slate-900 font-mono bg-slate-100 px-3 py-1 rounded-md">{teacher.aadhaar_last_4_digits || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-sm font-medium text-slate-500">PAN Number</span>
                <span className="font-bold text-slate-900 font-mono bg-slate-100 px-3 py-1 rounded-md">{teacher.pan_number || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
