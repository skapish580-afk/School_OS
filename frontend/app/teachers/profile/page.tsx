'use client';

import { useState, useEffect } from 'react';
import api, { getMediaUrl } from '@/lib/api';
import { 
  User, Mail, Phone, MapPin, Calendar, Briefcase, 
  BookOpen, Award, Lock, FileText, CheckCircle2, ShieldCheck, 
  Heart, Shield, Hash, DollarSign, ExternalLink, Layers, Sparkles, AlertCircle, Loader2
} from 'lucide-react';

interface TeacherDocument {
  id: number;
  document_type: string;
  title: string;
  file: string;
  uploaded_at: string;
  notes?: string;
}

interface TeacherAssignmentItem {
  id: number;
  role: string;
  role_display?: string;
  grade: string;
  section: string;
  subject?: string;
  academic_year?: string;
}

interface TeacherProfile {
  id: number;
  tuid: string;
  full_name: string;
  email: string;
  phone: string;
  title?: string;
  date_of_birth: string | null;
  gender: string;
  marital_status?: string;
  place_of_birth?: string;
  blood_group?: string;
  emergency_contact_phone?: string;
  address?: string;
  aadhaar_last_4_digits?: string;
  pan_number?: string;
  dietary_preference?: string;
  qualifications: string;
  certified_subjects: string;
  experience_years: number;
  awards: string;
  photo?: string;
  salary?: number | string | null;
  date_of_joining?: string | null;
  verification_status?: string;
  teacher_type?: string;
  documents?: TeacherDocument[];
  active_assignments?: TeacherAssignmentItem[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/teachers/me/');
      setProfile(response.data);
    } catch (err: any) {
      console.error('Failed to fetch teacher profile', err);
      setError('Failed to load teacher profile details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="animate-spin text-emerald-600" size={36} />
        <span className="text-gray-600 font-medium text-sm">Loading teacher profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-rose-50 border border-rose-200 rounded-2xl text-center">
        <AlertCircle size={40} className="text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-rose-900 mb-1">Profile Unavailable</h2>
        <p className="text-rose-700 text-sm">{error || 'Teacher profile information could not be retrieved.'}</p>
      </div>
    );
  }

  const subjects = profile.certified_subjects
    ? profile.certified_subjects.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const formattedSalary = profile.salary
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(profile.salary))
    : 'Not Specified';

  const photoUrl = getMediaUrl(profile.photo);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner with Lock Notice */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">My Profile</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
              {profile.teacher_type === 'NON_TEACHING' ? 'Non-Teaching Staff' : 'Teaching Staff'}
            </span>
          </div>
          <p className="text-gray-600 text-sm mt-1 font-medium">
            Personal and professional information registered in the school system.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl text-amber-900 text-xs font-bold">
          <Lock size={16} className="text-amber-600 flex-shrink-0" />
          <span>View-Only Profile • Managed by School Admin</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Identity & Overview */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Photo & Identity Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
            <div className="flex flex-col items-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={profile.full_name}
                  className="w-36 h-36 rounded-full object-cover border-4 border-emerald-100 shadow-md"
                />
              ) : (
                <div className="w-36 h-36 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-full flex items-center justify-center text-white text-4xl font-extrabold shadow-md border-4 border-emerald-100">
                  {profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
              )}

              <h2 className="text-xl font-bold text-gray-900 mt-4">
                {profile.title ? `${profile.title}. ` : ''}{profile.full_name}
              </h2>

              <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-700">
                <Hash size={13} className="text-gray-500" />
                <span>{profile.tuid}</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {profile.verification_status === 'VERIFIED' ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
                    <ShieldCheck size={14} /> Verified Staff
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-semibold">
                    Unverified Status
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl">
                <div className="text-2xl font-black text-emerald-800">{profile.experience_years}</div>
                <div className="text-xs font-semibold text-emerald-600">Years Experience</div>
              </div>
              <div className="bg-teal-50/60 border border-teal-100 p-3 rounded-xl">
                <div className="text-2xl font-black text-teal-800">{subjects.length}</div>
                <div className="text-xs font-semibold text-teal-600">Certified Subjects</div>
              </div>
            </div>
          </div>

          {/* Emergency Contact & Address */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Phone size={16} className="text-emerald-600" />
              Emergency & Address
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-bold text-gray-500 block uppercase">Emergency Phone</span>
                <span className="font-semibold text-gray-900">{profile.emergency_contact_phone || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 block uppercase">Residential Address</span>
                <span className="font-medium text-gray-800 whitespace-pre-line">{profile.address || 'Not Provided'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Detailed Sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
              <User size={18} className="text-emerald-600" />
              Personal Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Email Address</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" />
                  {profile.email}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Phone Number</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" />
                  {profile.phone || 'Not Provided'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Gender</span>
                <span className="font-semibold text-gray-900">
                  {profile.gender === 'M' ? 'Male' : profile.gender === 'F' ? 'Female' : 'Other'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Date of Birth</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Specified'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Marital Status</span>
                <span className="font-semibold text-gray-900">{profile.marital_status || 'Not Specified'}</span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Place of Birth</span>
                <span className="font-semibold text-gray-900">{profile.place_of_birth || 'Not Specified'}</span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Blood Group</span>
                <span className="font-semibold text-gray-900">{profile.blood_group || 'Not Specified'}</span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Dietary Preference</span>
                <span className="font-semibold text-gray-900">{profile.dietary_preference || 'Not Specified'}</span>
              </div>
            </div>
          </div>

          {/* Professional & Employment Information */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
              <Briefcase size={18} className="text-emerald-600" />
              Professional & Employment Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Staff Classification</span>
                <span className="font-bold text-emerald-800">
                  {profile.teacher_type === 'NON_TEACHING' ? 'Non-Teaching Staff' : 'Teaching Staff'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Date of Joining</span>
                <span className="font-semibold text-gray-900">
                  {profile.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Specified'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-0.5">Monthly Salary</span>
                <span className="font-bold text-gray-900">{formattedSalary}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Qualifications</span>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-gray-900 font-semibold text-sm">
                  {profile.qualifications || 'Not Specified'}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Certified Subjects</span>
                <div className="flex flex-wrap gap-2">
                  {subjects.length > 0 ? (
                    subjects.map(subject => (
                      <span key={subject} className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                        {subject}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-xs italic">No certified subjects listed</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Awards & Recognition</span>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm font-medium">
                  {profile.awards || 'None listed'}
                </div>
              </div>
            </div>
          </div>

          {/* Government Identifiers */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
              <ShieldCheck size={18} className="text-emerald-600" />
              Verification & Government Identifiers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase block">Aadhaar Card</span>
                  <span className="font-mono font-bold text-slate-900">
                    {profile.aadhaar_last_4_digits ? `XXXX XXXX ${profile.aadhaar_last_4_digits}` : 'Not Provided'}
                  </span>
                </div>
                <Shield size={18} className="text-slate-400" />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase block">PAN Card Number</span>
                  <span className="font-mono font-bold text-slate-900">
                    {profile.pan_number || 'Not Provided'}
                  </span>
                </div>
                <FileText size={18} className="text-slate-400" />
              </div>
            </div>
          </div>

          {/* Active Assigned Roles & Classes */}
          {profile.active_assignments && profile.active_assignments.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
                <Layers size={18} className="text-emerald-600" />
                Active Class & Subject Roles (Teachers Module)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.active_assignments.map((a, idx) => (
                  <div key={a.id || idx} className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-gray-900 text-sm">
                        Grade {a.grade} - Section {a.section}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        {a.role === 'CLASS_TEACHER' ? 'Class Teacher' : (a.role_display || 'Subject Teacher')}
                        {a.subject ? ` (${a.subject})` : ''}
                      </div>
                    </div>
                    {a.role === 'CLASS_TEACHER' && (
                      <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        Class Teacher
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Documents Section */}
          {profile.documents && profile.documents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
                <FileText size={18} className="text-emerald-600" />
                Official Staff Documents
              </h3>

              <div className="space-y-2">
                {profile.documents.map(doc => {
                  const docUrl = getMediaUrl(doc.file);
                  return (
                    <div key={doc.id} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-lg flex items-center justify-center font-bold">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{doc.title}</div>
                          <div className="text-xs text-gray-500">
                            Uploaded on {new Date(doc.uploaded_at).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                      </div>
                      {docUrl && (
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <ExternalLink size={14} />
                          View Document
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
