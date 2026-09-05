'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getMediaUrl } from '@/lib/api';
import { 
  Loader2, User, Mail, Phone, Calendar, Heart, MapPin, 
  Droplet, AlertCircle, FileText, Briefcase, CheckCircle2, ShieldAlert,
  ArrowLeft, Eye, EyeOff, Edit, Camera
} from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function TeacherProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await api.post(`/teachers/profiles/${id}/upload_photo/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTeacher(res.data);
    } catch (err) {
      console.error('Failed upload_photo endpoint, trying patch:', err);
      try {
        const formData = new FormData();
        formData.append('photo', file);
        const patchRes = await api.patch(`/teachers/profiles/${id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setTeacher(patchRes.data);
      } catch (patchErr) {
        console.error('Failed to upload photo:', patchErr);
        alert('Failed to upload profile picture. Please try again.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const isTeaching = teacher?.teacher_type === 'TEACHING';
  const hasViewPermission = isAdmin || 
    (isTeaching && hasPermission('teachers.view_teaching')) || 
    (!isTeaching && hasPermission('teachers.view_non_teaching'));

  if (permissionsLoading || loading) return <div className="p-12 text-center"><Loader2 className="animate-spin inline text-blue-600" /></div>;
  if (!teacher) return <div className="p-12 text-center text-red-500">Teacher not found</div>;

  if (!hasViewPermission) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100 max-w-md mx-auto mt-12">
        Access Denied. You do not have permission to view this staff profile.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* 1. TOP HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 mb-6">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-800">Teacher Profile</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHideSensitive(!hideSensitive)}
              className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors flex items-center gap-2 ${
                hideSensitive 
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={hideSensitive ? "Show sensitive details" : "Hide sensitive details"}
            >
              {hideSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
              {hideSensitive ? "Show Details" : "Hide Details"}
            </button>
            {(isAdmin || 
              (isTeaching && hasPermission('teachers.manage_teaching')) || 
              (!isTeaching && hasPermission('teachers.manage_non_teaching'))) && (
              <Link href={`/dashboard/teachers/${id}/edit`}>
                <button className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <Edit size={16} /> Edit Details
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Header Profile */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-700"></div>

        {/* Profile Picture Avatar & Upload Camera Badge */}
        <div className="relative shrink-0 group/avatar">
          {teacher.photo ? (
            <img
              src={getMediaUrl(teacher.photo)}
              alt={teacher.full_name}
              className="w-32 h-32 rounded-3xl object-cover shadow-xl ring-4 ring-white"
            />
          ) : (
            <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 rounded-3xl shadow-xl flex items-center justify-center text-white text-4xl font-black ring-4 ring-white">
              {teacher.full_name?.charAt(0) || 'T'}
            </div>
          )}

          {(isAdmin || 
            (isTeaching && hasPermission('teachers.manage_teaching')) || 
            (!isTeaching && hasPermission('teachers.manage_non_teaching'))) && (
            <>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 p-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-lg ring-4 ring-white transition-all duration-200 flex items-center justify-center cursor-pointer"
                title="Upload or Change Profile Picture"
              >
                {uploadingPhoto ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </>
          )}
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
              <Calendar size={16} className="text-blue-500" /> Joined {new Date(teacher.date_of_joining || teacher.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
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
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><MapPin size={18} /></div>
              <div>
                <p className="text-sm font-medium text-slate-500">Address</p>
                <p className="font-bold text-slate-900">{teacher.address || 'N/A'}</p>
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
              <div className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={18} /></div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Monthly Salary</p>
                  <p className="font-bold text-slate-900">{teacher.salary ? `₹${Number(teacher.salary).toLocaleString()}` : 'N/A'}</p>
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
                <span className="font-bold text-slate-900 font-mono bg-slate-100 px-3 py-1 rounded-md">
                  {hideSensitive ? '••••' : (teacher.aadhaar_last_4_digits || 'N/A')}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-sm font-medium text-slate-500">PAN Number</span>
                <span className="font-bold text-slate-900 font-mono bg-slate-100 px-3 py-1 rounded-md">
                  {hideSensitive ? '••••••••••' : (teacher.pan_number || 'N/A')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hired Documents & Records */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
        <h3 className="font-bold text-xl text-slate-900 mb-6 flex items-center gap-3">
          <FileText size={24} className="text-blue-600" /> Hired Documents & Records
        </h3>
        {teacher.documents && teacher.documents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacher.documents.map((doc: any) => (
              <div key={doc.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 group hover:border-blue-400 hover:bg-white transition-all">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">
                    {doc.document_type.replace(/_/g, ' ')}
                  </div>
                  <div className="font-bold text-slate-900 truncate text-sm" title={doc.title}>
                    {doc.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                  </div>
                </div>
                <a 
                  href={getMediaUrl(doc.file)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors shadow-sm bg-white border border-slate-200"
                  title="View/Download Document"
                >
                  <FileText size={16} />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <FileText size={40} className="mx-auto mb-3 opacity-20 text-slate-500" />
            <p className="text-sm font-medium">No documents uploaded yet.</p>
            <p className="text-[10px] mt-1 uppercase tracking-widest">Digital certificates will appear here</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
