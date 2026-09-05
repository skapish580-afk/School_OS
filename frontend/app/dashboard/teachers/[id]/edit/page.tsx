'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import { ArrowLeft, Save, Loader2, UploadCloud, User, FileText, Trash2 } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function EditTeacherPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Image State
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Documents State
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [newDocs, setNewDocs] = useState<{
    doc_resume: File | null;
    doc_id_proof: File | null;
    doc_qualification: File | null;
  }>({
    doc_resume: null,
    doc_id_proof: null,
    doc_qualification: null,
  });
  const [customDocs, setCustomDocs] = useState<{ id: string; title: string; file: File | null }[]>([]);

  const [formData, setFormData] = useState({
    title: 'Mr.',
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: 'O',
    marital_status: '',
    place_of_birth: '',
    blood_group: '',
    emergency_contact_phone: '',
    address: '',
    salary: '',
    date_of_joining: '',
    experience_years: '',
    dietary_preference: '',
    qualifications: '',
    certified_subjects: '',
    aadhaar_last_4_digits: '',
    pan_number: '',
    teacher_type: 'TEACHING',
  });

  useEffect(() => {
    if (id) {
      fetchTeacher();
    }
  }, [id]);

  const fetchTeacher = async () => {
    try {
      const res = await api.get(`/teachers/profiles/${id}/`);
      const t = res.data;
      
      if (t.documents) {
        setExistingDocs(t.documents);
      }

      setFormData({
        title: t.title || 'Mr.',
        full_name: t.full_name || '',
        email: t.email || '',
        phone: t.phone || '',
        date_of_birth: t.date_of_birth || '',
        gender: t.gender || 'O',
        marital_status: t.marital_status || '',
        place_of_birth: t.place_of_birth || '',
        blood_group: t.blood_group || '',
        emergency_contact_phone: t.emergency_contact_phone || '',
        address: t.address || '',
        salary: t.salary || '',
        date_of_joining: t.date_of_joining || '',
        experience_years: t.experience_years !== undefined ? String(t.experience_years) : '',
        dietary_preference: t.dietary_preference || '',
        qualifications: t.qualifications || '',
        certified_subjects: t.certified_subjects || '',
        aadhaar_last_4_digits: t.aadhaar_last_4_digits || '',
        pan_number: t.pan_number || '',
        teacher_type: t.teacher_type || 'TEACHING',
      });

      if (t.photo) {
        setPreview(getMediaUrl(t.photo) || null);
      }
      
      setLoading(false);
    } catch (e) {
      alert("Failed to load teacher data");
    }
  };

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof typeof newDocs) => {
    if (e.target.files && e.target.files[0]) {
      setNewDocs(prev => ({
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

  const handleDeleteExistingDoc = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }
    try {
      await api.post(`/teachers/profiles/${id}/delete_document/`, { document_id: docId });
      setExistingDocs(prev => prev.filter(d => d.id !== docId));
      alert("Document deleted successfully!");
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Failed to delete document.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data = new FormData();
    data.append('title', formData.title);
    data.append('full_name', formData.full_name);
    data.append('email', formData.email);
    data.append('phone', formData.phone);
    
    if (formData.date_of_birth) {
      data.append('date_of_birth', formData.date_of_birth);
    }
    data.append('gender', formData.gender);
    data.append('marital_status', formData.marital_status);
    data.append('place_of_birth', formData.place_of_birth);
    data.append('blood_group', formData.blood_group);
    data.append('emergency_contact_phone', formData.emergency_contact_phone);
    data.append('address', formData.address);
    
    if (formData.salary) {
      data.append('salary', formData.salary);
    }
    if (formData.date_of_joining) {
      data.append('date_of_joining', formData.date_of_joining);
    }
    
    data.append('experience_years', formData.experience_years);
    data.append('teacher_type', formData.teacher_type);
    data.append('dietary_preference', formData.dietary_preference);
    data.append('qualifications', formData.qualifications);
    data.append('certified_subjects', formData.certified_subjects);
    data.append('aadhaar_last_4_digits', formData.aadhaar_last_4_digits);
    data.append('pan_number', formData.pan_number);

    // Staged files
    if (newDocs.doc_resume) {
      data.append('doc_resume', newDocs.doc_resume);
    }
    if (newDocs.doc_id_proof) {
      data.append('doc_id_proof', newDocs.doc_id_proof);
    }
    if (newDocs.doc_qualification) {
      data.append('doc_qualification', newDocs.doc_qualification);
    }

    // Append custom documents
    customDocs.forEach((doc) => {
      if (doc.title.trim() !== '' && doc.file) {
        data.append('custom_doc_files', doc.file);
        data.append('custom_doc_titles', doc.title);
      }
    });

    try {
      await api.patch(`/teachers/profiles/${id}/`, data);
      alert("Teacher updated successfully!");
      router.push(`/dashboard/teachers/${id}`);
    } catch (err: any) {
      console.error("Update failed:", err?.response?.data || err);
      alert("Failed to update teacher. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const isTeaching = formData?.teacher_type === 'TEACHING';
  const canEditTeacher = isAdmin || 
    (isTeaching && hasPermission('teachers.manage_teaching')) || 
    (!isTeaching && hasPermission('teachers.manage_non_teaching'));

  if (permissionsLoading || loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={30}/></div>;

  if (!canEditTeacher) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded-xl border border-red-100 max-w-md mx-auto mt-12">
        Access Denied. You do not have permission to edit this staff profile.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Teacher Details</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8 animate-in fade-in duration-300">
            
            {/* Identity & Contact Details */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg border-b pb-2 mb-4">👤 Identity & Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Title *</label>
                  <select
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                    required
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Miss">Miss</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr">Dr</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Full Legal Name *</label>
                  <input
                    name="full_name"
                    type="text"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email *</label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Phone *</label>
                  <input
                    name="phone"
                    type="text"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg border-b pb-2 mb-4">🏠 Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date of Birth *</label>
                  <input
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Gender *</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                    required
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Marital Status</label>
                  <input
                    name="marital_status"
                    type="text"
                    value={formData.marital_status}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Place of Birth</label>
                  <input
                    name="place_of_birth"
                    type="text"
                    value={formData.place_of_birth}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Blood Group</label>
                  <input
                    name="blood_group"
                    type="text"
                    value={formData.blood_group}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    placeholder="e.g. O+"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Emergency Contact Phone</label>
                  <input
                    name="emergency_contact_phone"
                    type="text"
                    value={formData.emergency_contact_phone}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    placeholder="Enter teacher's physical address"
                  />
                </div>
              </div>
            </div>

            {/* Professional & Employment Details */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg border-b pb-2 mb-4">💼 Professional & Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Salary (Monthly) *</label>
                  <input
                    name="salary"
                    type="number"
                    value={formData.salary}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Date of Joining *</label>
                  <input
                    name="date_of_joining"
                    type="date"
                    value={formData.date_of_joining}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Years of Experience *</label>
                  <input
                    name="experience_years"
                    type="number"
                    value={formData.experience_years}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Staff Type *</label>
                  <select
                    name="teacher_type"
                    value={formData.teacher_type}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                    required
                  >
                    <option value="TEACHING">Teaching Staff (Teacher)</option>
                    <option value="NON_TEACHING">Non-teaching Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Dietary Preference</label>
                  <input
                    name="dietary_preference"
                    type="text"
                    value={formData.dietary_preference}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Qualifications *</label>
                  <textarea
                    name="qualifications"
                    value={formData.qualifications}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 h-20 resize-none"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Certified Subjects *</label>
                  <textarea
                    name="certified_subjects"
                    value={formData.certified_subjects}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 h-20 resize-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Identity Details */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg border-b pb-2 mb-4">🛡️ Identity Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Aadhaar (Last 4 digits)</label>
                  <input
                    name="aadhaar_last_4_digits"
                    type="text"
                    maxLength={4}
                    value={formData.aadhaar_last_4_digits}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                    placeholder="e.g. 1234"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">PAN Number</label>
                  <input
                    name="pan_number"
                    type="text"
                    value={formData.pan_number}
                    onChange={handleChange}
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Uploaded Documents */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg border-b pb-2 mb-4">📁 Uploaded Documents</h3>
              
              {/* Existing Documents */}
              {existingDocs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase">Existing Documents</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {existingDocs.map((doc) => (
                      <div key={doc.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">{doc.title} ({doc.document_type.replace(/_/g, ' ')})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingDoc(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                          title="Delete Document"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload New Documents */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Upload Additional Documents (PDF only)</h4>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Resume / CV</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleDocChange(e, 'doc_resume')}
                    className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                  />
                  {newDocs.doc_resume && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {newDocs.doc_resume.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">ID Proof (Aadhaar/PAN/Passport)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleDocChange(e, 'doc_id_proof')}
                    className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                  />
                  {newDocs.doc_id_proof && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {newDocs.doc_id_proof.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Qualification Certificate</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleDocChange(e, 'doc_qualification')}
                    className="w-full p-2 border rounded-xl outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                  />
                  {newDocs.doc_qualification && <p className="text-xs text-green-600 mt-1 font-bold">Selected: {newDocs.doc_qualification.name}</p>}
                </div>

                {/* Staged Custom Documents */}
                {customDocs.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    {customDocs.map((doc) => (
                      <div key={doc.id} className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 relative space-y-3">
                        <button
                          type="button"
                          onClick={() => removeCustomDoc(doc.id)}
                          className="absolute right-3 top-3 text-red-500 hover:text-red-700 text-xs font-bold transition-colors"
                        >
                          Remove
                        </button>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase">Document Title *</label>
                          <input
                            type="text"
                            required
                            value={doc.title}
                            onChange={(e) => handleCustomDocChange(doc.id, 'title', e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none text-sm bg-white text-gray-900"
                            placeholder="e.g. Reference Letter"
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
                            className="w-full p-2 border rounded-lg outline-none file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-sm bg-white text-gray-900"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addCustomDoc}
                  className="w-full py-2.5 px-4 border border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-600 hover:text-indigo-700 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  + Add More Documents
                </button>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex justify-center items-center gap-2 disabled:bg-gray-400"
              >
                {saving ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Save Changes</>}
              </button>
            </div>

        </form>
      </div>
    </div>
  );
}
