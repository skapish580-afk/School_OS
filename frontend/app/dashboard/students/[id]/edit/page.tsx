'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import api, { getMediaUrl } from '@/lib/api';
import { ArrowLeft, Save, Loader2, UploadCloud, User, FileText, Trash2, Download } from 'lucide-react';
import { usePermissionContext } from '@/lib/rbac-context';

export default function EditStudentPage({ params: propParams }: { params?: any }) {
  const router = useRouter();
  const routeParams = useParams();
  const pathname = usePathname();
  const isTeacherPortal = (pathname && pathname.startsWith('/teachers')) || (typeof window !== 'undefined' && window.location.pathname.startsWith('/teachers'));

  const rawId = propParams?.id || routeParams?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { hasPermission, isAdmin, loading: permissionLoading } = usePermissionContext();

  const [studentDbId, setStudentDbId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // Image State
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Documents State
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [newDocs, setNewDocs] = useState<{
    doc_birth_certificate: File | null;
    doc_transfer_certificate: File | null;
    doc_mark_sheet: File | null;
  }>({
    doc_birth_certificate: null,
    doc_transfer_certificate: null,
    doc_mark_sheet: null,
  });
  const [customDocs, setCustomDocs] = useState<{ id: string; title: string; file: File | null }[]>([]);

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
    grade: '',
    section: '',
    admission_number: '',
    admission_date: '',
    category: '',
    religion: '',
    mother_tongue: '',
    languages_known: '',
    nationality: 'Indian',
    birth_place: '',
    is_rte_student: false,
    fee_concession_applicable: false,
    fee_concession_amount: '0.00',
    house_color: '',
    alumni_directory_consent: false,
    aadhaar_number: '',
    apaar_id: '',
    pen_id: '',
    dietary_preference: '',
    allergies: '',
    roll_number: ''
  });


  const [teacherRoleForStudent, setTeacherRoleForStudent] = useState<'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'NONE'>('NONE');
  const [currentUserType, setCurrentUserType] = useState<string>('');
  const [teacherRoleResolved, setTeacherRoleResolved] = useState<boolean>(false);

  const isUserAdmin = isAdmin || ['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(currentUserType);
  const isClassTeacher = isUserAdmin || teacherRoleForStudent === 'CLASS_TEACHER';
  const canEditStudent = isUserAdmin || isClassTeacher || hasPermission('students.edit_profile');

  useEffect(() => {
    const checkTeacherRole = async () => {
      if (!id) return;
      try {
        const [studentRes, meRes, assignmentsRes, sectionsRes] = await Promise.all([
          api.get(`/students/${id}/`).catch(() => ({ data: null })),
          api.get('/auth/me/').catch(() => ({ data: null })),
          api.get('/teachers/assignments/?is_active=true').catch(() => ({ data: [] })),
          api.get('/academics/sections/').catch(() => ({ data: [] }))
        ]);

        const meUser = meRes.data;
        if (meUser) {
          setCurrentUserType(meUser.user_type || '');
          if (['PLATFORM_ADMIN', 'SCHOOL_ADMIN', 'ADMIN'].includes(meUser.user_type)) {
            setTeacherRoleForStudent('CLASS_TEACHER');
            setTeacherRoleResolved(true);
            return;
          }
        }

        const student = studentRes.data;
        if (!student) {
          setTeacherRoleResolved(true);
          return;
        }

        const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || [];
        const sectionsData = Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data.results || [];

        const cleanG = (g: any) => (g || '').toString().toLowerCase().replace('grade', '').split('-')[0].trim();
        const cleanS = (s: any) => {
          const str = (s || '').toString().trim().toUpperCase();
          return str.includes('-') ? (str.split('-').pop() || str) : str;
        };

        let studentGrade = cleanG(student.grade_name || student.grade);
        let studentSection = cleanS(student.section_letter || student.section);

        if (student.current_section && typeof student.current_section === 'object') {
          if (student.current_section.grade_config?.grade_name) {
            studentGrade = cleanG(student.current_section.grade_config.grade_name);
          }
          if (student.current_section.section_letter) {
            studentSection = cleanS(student.current_section.section_letter);
          }
        }

        const rawClass = (student.current_class || '').toString().trim();
        if (rawClass.includes('-')) {
          const parts = rawClass.split('-');
          if (!studentGrade) studentGrade = cleanG(parts[0]);
          if (!studentSection) studentSection = cleanS(parts[1]);
        } else if (rawClass && !studentGrade) {
          studentGrade = cleanG(rawClass);
        }

        let isCT = false;
        let isST = false;

        if (meUser) {
          const myFullName = (meUser.full_name || `${meUser.first_name || ''} ${meUser.last_name || ''}`).trim().toLowerCase();
          const matchedSec = sectionsData.find((s: any) => {
            const secGrade = cleanG(s.grade_name || s.grade_config?.grade_name);
            const secLetter = cleanS(s.section_letter);
            if (secGrade !== studentGrade || secLetter !== studentSection) return false;

            if (!s.class_teacher_name && !s.class_teacher_info) return false;
            const ctName = (s.class_teacher_name || s.class_teacher_info?.name || '').toLowerCase();
            const teacherId = s.class_teacher_info?.id || s.class_teacher_id;
            const matchesTeacherId = meUser.teacher_profile?.id && String(teacherId) === String(meUser.teacher_profile.id);
            const matchesName = myFullName && (ctName.includes(myFullName) || myFullName.includes(ctName));
            const matchesFirstName = meUser.first_name && ctName.includes(meUser.first_name.toLowerCase());
            return matchesTeacherId || matchesName || matchesFirstName;
          });

          if (matchedSec) {
            isCT = true;
          }
        }

        assignments.forEach((a: any) => {
          if (!a.grade || !a.section) return;
          const aGrade = cleanG(a.grade);
          const aSection = cleanS(a.section);
          if (aGrade === studentGrade && aSection === studentSection) {
            const roleIsCT = a.role === 'CLASS_TEACHER' || a.role === 'CLASS' || a.role_display?.toLowerCase().includes('class teacher');
            if (roleIsCT) {
              isCT = true;
            } else {
              isST = true;
            }
          }
        });

        if (isCT) {
          setTeacherRoleForStudent('CLASS_TEACHER');
        } else if (isST) {
          setTeacherRoleForStudent('SUBJECT_TEACHER');
        } else {
          setTeacherRoleForStudent('NONE');
        }
      } catch (err) {
        console.error('Failed to resolve teacher role for student edit:', err);
      } finally {
        setTeacherRoleResolved(true);
      }
    };

    checkTeacherRole();
  }, [id]);

  useEffect(() => {
    if (permissionLoading || !teacherRoleResolved) return;
    if (!canEditStudent) {
      setLoading(false);
      return;
    }
    if (id) {
      fetchStudent();
      fetchGradesAndSections();
    }
  }, [id, permissionLoading, teacherRoleResolved, canEditStudent]);

  const fetchGradesAndSections = async () => {
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

  const fetchStudent = async () => {
    try {
      const res = await api.get(`/students/${id}/profile/`);
      const s = res.data;
      if (s.id) setStudentDbId(s.id);
      
      if (s.documents) {
        setExistingDocs(s.documents);
      }
      
      let grade = '';
      let section = '';
      if (s.current_class && s.current_class !== 'Unassigned') {
        const parts = s.current_class.split('-');
        if (parts.length === 2) {
          grade = parts[0];
          section = parts[1];
        }
      }

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
        grade: grade,
        section: section,
        admission_number: s.admission_number || '',
        admission_date: s.admission_date || '',
        category: s.category || '',
        religion: s.religion || '',
        mother_tongue: s.mother_tongue || '',
        languages_known: s.languages_known || '',
        nationality: s.nationality || 'Indian',
        birth_place: s.birth_place || '',
        is_rte_student: s.is_rte_student || false,
        fee_concession_applicable: s.fee_concession_applicable || false,
        fee_concession_amount: s.fee_concession_amount || '0.00',
        house_color: s.house_color || '',
        alumni_directory_consent: s.alumni_directory_consent || false,
        aadhaar_number: s.aadhaar_number || '',
        apaar_id: s.apaar_id || '',
        pen_id: s.pen_id || '',
        dietary_preference: s.dietary_preference || '',
        allergies: s.allergies || s.medical_conditions || '',
        roll_number: s.roll_number || ''
      });


      // Set existing photo preview
      if (s.profile_photo) {
        setPreview(getMediaUrl(s.profile_photo) || null);
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

  const handleDeleteExistingDoc = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }
    try {
      await api.post(`/students/${id}/delete_document/`, { document_id: docId });
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
    
    // Use FormData to support file uploads (profile_photo).
    // IMPORTANT: Do NOT append empty strings for Date/nullable fields —
    // Django's DateField rejects '' and returns a 400. Only append them when they have a value.
    const data = new FormData();

    // Always-present string fields (safe to send even if empty)
    data.append('first_name', formData.first_name);
    data.append('last_name', formData.last_name);
    data.append('middle_name', formData.middle_name);
    data.append('phone_number', formData.phone_number);
    data.append('user_email', formData.email);
    
    // Address & Coordinates
    data.append('address', formData.address);
    const parsedLat = parseFloat(formData.latitude);
    const parsedLng = parseFloat(formData.longitude);
    if (!isNaN(parsedLat)) {
      data.append('latitude', parsedLat.toFixed(6));
    }
    if (!isNaN(parsedLng)) {
      data.append('longitude', parsedLng.toFixed(6));
    }

    data.append('blood_group', formData.blood_group);
    data.append('nationality', formData.nationality);

    // Conditional: only send date if it has a real value (avoid sending '' to DateField)
    if (formData.date_of_birth) {
      data.append('date_of_birth', formData.date_of_birth);
    }
    if (formData.admission_date) {
      data.append('admission_date', formData.admission_date);
    }

    // Optional text fields
    if (formData.grade) data.append('grade', formData.grade);
    if (formData.section) data.append('section', formData.section);
    data.append('admission_number', formData.admission_number);
    data.append('category', formData.category);
    data.append('religion', formData.religion);
    data.append('mother_tongue', formData.mother_tongue);
    data.append('languages_known', formData.languages_known);
    data.append('birth_place', formData.birth_place);
    data.append('house_color', formData.house_color);
    data.append('aadhaar_number', formData.aadhaar_number);
    data.append('apaar_id', formData.apaar_id);
    data.append('pen_id', formData.pen_id);
    data.append('dietary_preference', formData.dietary_preference);
    data.append('allergies', formData.allergies);
    data.append('roll_number', formData.roll_number);


    // Boolean fields — send as string 'true'/'false'
    data.append('is_rte_student', String(formData.is_rte_student));
    data.append('fee_concession_applicable', String(formData.fee_concession_applicable));
    if (formData.fee_concession_applicable) {
      data.append('fee_concession_amount', formData.fee_concession_amount || '0.00');
    } else {
      data.append('fee_concession_amount', '0.00');
    }
    data.append('alumni_directory_consent', String(formData.alumni_directory_consent));

    // Only append photo if a new one was selected
    if (photoFile) {
      data.append('profile_photo', photoFile);
    }

    // Append new required documents if staged
    if (newDocs.doc_birth_certificate) {
      data.append('doc_birth_certificate', newDocs.doc_birth_certificate);
    }
    if (newDocs.doc_transfer_certificate) {
      data.append('doc_transfer_certificate', newDocs.doc_transfer_certificate);
    }
    if (newDocs.doc_mark_sheet) {
      data.append('doc_mark_sheet', newDocs.doc_mark_sheet);
    }

    // Append custom documents
    customDocs.forEach((doc) => {
      if (doc.title.trim() !== '' && doc.file) {
        data.append('custom_doc_files', doc.file);
        data.append('custom_doc_titles', doc.title);
      }
    });

    try {
      const targetStudentId = studentDbId || id;
      await api.patch(`/students/${targetStudentId}/`, data);
      const targetUrl = isTeacherPortal ? `/teachers/remarks/${id}` : `/dashboard/students/${id}`;
      router.push(targetUrl);
    } catch (err: any) {
      console.error("Update failed:", err?.response?.data || err);
      const serverData = err?.response?.data;
      let msg = err?.message || "Failed to update student.";
      if (serverData) {
        if (typeof serverData === 'string') msg = serverData;
        else if (serverData.detail) msg = serverData.detail;
        else if (serverData.error) msg = serverData.error;
        else msg = Object.entries(serverData).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
      }
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  if (permissionLoading || !teacherRoleResolved || (loading && canEditStudent)) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={30}/></div>;

  if (!canEditStudent) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-8 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-600">You do not have permission to edit student profiles.</p>
        </div>
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
                    <label className="text-xs font-bold text-gray-500 uppercase">Email *</label>
                    <input name="email" value={formData.email} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" required />
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

            {/* ACADEMIC & ADMISSION */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Academic & Admission</h3>
                <div className="grid md:grid-cols-4 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Grade *</label>
                        <select required name="grade" value={formData.grade} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select Grade</option>
                            {grades.map((g) => (
                                <option key={g.id} value={g.grade_number}>{g.grade_name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Section *</label>
                        <select required name="section" value={formData.section} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Select Section</option>
                            {Array.from(new Set(sections.map(s => s.section_letter))).map((letter) => (
                                <option key={letter} value={letter}>{letter}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Admission Number</label>
                        <input name="admission_number" value={formData.admission_number} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. ADM-2026-001" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Roll Number</label>
                        <input name="roll_number" value={formData.roll_number} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 12B" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Admission Date</label>
                        <input type="date" name="admission_date" value={formData.admission_date} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
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
                {formData.fee_concession_applicable && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <label className="text-xs font-bold text-gray-500 uppercase">Concession Amount</label>
                        <input
                            type="number"
                            name="fee_concession_amount"
                            min="0"
                            step="0.01"
                            value={formData.fee_concession_amount}
                            onChange={handleChange}
                            className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none max-w-xs block"
                            placeholder="Concession Amount (e.g. 500.00)"
                            required
                        />
                    </div>
                )}
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
                        <label className="text-xs font-bold text-gray-500 uppercase">Aadhaar Number</label>
                        <input name="aadhaar_number" maxLength={12} value={formData.aadhaar_number} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="12-digit Aadhaar No" />
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

            {/* HEALTH & DIETARY PREFERENCES */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Health & Dietary Preferences</h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Allergies</label>
                        <input name="allergies" value={formData.allergies} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Peanuts, Dust, Pollen, Milk" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Dietary Preference (Veg/Non-Veg/etc)</label>
                        <input name="dietary_preference" value={formData.dietary_preference} onChange={handleChange} className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Veg, Non-Veg" />
                    </div>
                </div>
            </div>


            {/* DOCUMENT MANAGEMENT */}
            <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" /> Document Management
                </h3>
                
                {/* Required Documents (Birth Cert, Transfer Cert, Mark Sheet) */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Required Documents (PDF Format)</h4>
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Birth Certificate */}
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Birth Certificate</label>
                                {(() => {
                                    const existing = existingDocs.find(d => d.document_type === 'BIRTH_CERTIFICATE');
                                    return existing ? (
                                        <div className="mb-3 p-2 bg-white rounded border border-gray-100 flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600 truncate max-w-[150px]" title={existing.title}>{existing.title}</span>
                                            <a href={getMediaUrl(existing.file)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-bold">
                                                <Download size={14} /> View
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-500 italic mb-3">No certificate uploaded</p>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                    {existingDocs.some(d => d.document_type === 'BIRTH_CERTIFICATE') ? 'Replace Birth Certificate' : 'Upload Birth Certificate'}
                                </label>
                                <input type="file" accept="application/pdf" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setNewDocs(prev => ({ ...prev, doc_birth_certificate: e.target.files![0] }));
                                    }
                                }} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                {newDocs.doc_birth_certificate && <p className="text-[10px] text-green-600 mt-1 font-semibold">Staged: {newDocs.doc_birth_certificate.name}</p>}
                            </div>
                        </div>

                        {/* Transfer Certificate */}
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Transfer Certificate</label>
                                {(() => {
                                    const existing = existingDocs.find(d => d.document_type === 'TRANSFER_CERTIFICATE');
                                    return existing ? (
                                        <div className="mb-3 p-2 bg-white rounded border border-gray-100 flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600 truncate max-w-[150px]" title={existing.title}>{existing.title}</span>
                                            <a href={getMediaUrl(existing.file)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-bold">
                                                <Download size={14} /> View
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-500 italic mb-3">No certificate uploaded</p>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                    {existingDocs.some(d => d.document_type === 'TRANSFER_CERTIFICATE') ? 'Replace Transfer Certificate' : 'Upload Transfer Certificate'}
                                </label>
                                <input type="file" accept="application/pdf" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setNewDocs(prev => ({ ...prev, doc_transfer_certificate: e.target.files![0] }));
                                    }
                                }} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                {newDocs.doc_transfer_certificate && <p className="text-[10px] text-green-600 mt-1 font-semibold">Staged: {newDocs.doc_transfer_certificate.name}</p>}
                            </div>
                        </div>

                        {/* Mark Sheet */}
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-between">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Mark Sheet</label>
                                {(() => {
                                    const existing = existingDocs.find(d => d.document_type === 'MARK_SHEET');
                                    return existing ? (
                                        <div className="mb-3 p-2 bg-white rounded border border-gray-100 flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600 truncate max-w-[150px]" title={existing.title}>{existing.title}</span>
                                            <a href={getMediaUrl(existing.file)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 font-bold">
                                                <Download size={14} /> View
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-red-500 italic mb-3">No sheet uploaded</p>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                                    {existingDocs.some(d => d.document_type === 'MARK_SHEET') ? 'Replace Mark Sheet' : 'Upload Mark Sheet'}
                                </label>
                                <input type="file" accept="application/pdf" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setNewDocs(prev => ({ ...prev, doc_mark_sheet: e.target.files![0] }));
                                    }
                                }} className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                {newDocs.doc_mark_sheet && <p className="text-[10px] text-green-600 mt-1 font-semibold">Staged: {newDocs.doc_mark_sheet.name}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Documents Section */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Additional Documents</h4>
                    
                    {/* Existing Custom Docs */}
                    {(() => {
                        const customEx = existingDocs.filter(d => d.document_type === 'OTHER');
                        if (customEx.length > 0) {
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {customEx.map((doc) => (
                                        <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText size={16} className="text-gray-400 shrink-0" />
                                                <span className="text-sm font-semibold text-gray-700 truncate" title={doc.title}>{doc.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a href={getMediaUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-100 transition-colors" title="Download">
                                                    <Download size={14} />
                                                </a>
                                                <button type="button" onClick={() => handleDeleteExistingDoc(doc.id)} className="p-1.5 bg-white text-red-500 hover:bg-red-50 rounded-lg border border-gray-100 transition-colors" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        return <p className="text-xs text-gray-400 italic">No additional custom documents uploaded.</p>;
                    })()}

                    {/* New Custom Docs to add */}
                    {customDocs.length > 0 && (
                        <div className="space-y-3 pt-2">
                            {customDocs.map((doc) => (
                                <div key={doc.id} className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 relative grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setCustomDocs(prev => prev.filter(d => d.id !== doc.id))} 
                                        className="absolute right-3 top-2.5 text-red-500 hover:text-red-700 text-xs font-bold transition-colors"
                                    >
                                        Remove
                                    </button>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Document Name *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={doc.title} 
                                            onChange={(e) => setCustomDocs(prev => prev.map(d => d.id === doc.id ? { ...d, title: e.target.value } : d))} 
                                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" 
                                            placeholder="e.g. Migration Certificate" 
                                        />
                                    </div>
                                    <div className="pr-12">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Document File (PDF) *</label>
                                        <input 
                                            type="file" 
                                            required
                                            accept="application/pdf" 
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setCustomDocs(prev => prev.map(d => d.id === doc.id ? { ...d, file: e.target.files![0] } : d));
                                                }
                                            }} 
                                            className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setCustomDocs(prev => [...prev, { id: Math.random().toString(), title: '', file: null }])}
                        className="w-full py-2.5 px-4 border border-dashed border-gray-300 hover:border-gray-500 text-gray-600 hover:text-gray-700 bg-gray-50/50 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                        + Add More Documents
                    </button>
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