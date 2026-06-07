"use client";

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, ChevronRight, User, FileText, Download, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';

export default function DataUploadsPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'certificate'>('import');
  const [importType, setImportType] = useState<'student' | 'teacher'>('student');

  // --- Import State ---
  const [file, setFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'mapping' | 'uploading' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{ success: number, errors: any[] } | null>(null);

  // --- Certificate State ---
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [docType, setDocType] = useState('CERTIFICATE');
  const [docTitle, setDocTitle] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certStatus, setCertStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  // --- Advanced Filter State ---
  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const STUDENT_DB_FIELDS = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: false },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'gender', label: 'Gender (M/F/O)', required: false },
    { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)', required: false },
    { key: 'admission_number', label: 'Admission No', required: false },
    { key: 'blood_group', label: 'Blood Group', required: false },
    { key: 'grade', label: 'Grade Name', required: false },
    { key: 'section', label: 'Section Name', required: false },
    { key: 'address', label: 'Home Address', required: false },
    { key: 'aadhaar', label: 'Aadhaar No', required: false },
  ];

  const TEACHER_DB_FIELDS = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: false },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'gender', label: 'Gender (M/F/O)', required: false },
    { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD)', required: false },
    { key: 'blood_group', label: 'Blood Group', required: false },
    { key: 'qualifications', label: 'Qualifications', required: false },
    { key: 'certified_subjects', label: 'Certified Subjects', required: false },
    { key: 'experience_years', label: 'Experience Years', required: false },
    { key: 'joining_date', label: 'Joining Date (YYYY-MM-DD)', required: false },
    { key: 'employment_type', label: 'Employment Type', required: false },
  ];

  const dbFields = importType === 'student' ? STUDENT_DB_FIELDS : TEACHER_DB_FIELDS;

  useEffect(() => {
    if (activeTab === 'certificate') {
      fetchStudents();
      fetchGradesAndSections();
    }
  }, [activeTab]);

  const fetchGradesAndSections = async () => {
    try {
      const [gradesRes, sectionsRes] = await Promise.all([
        api.get('/academics/grades/'),
        api.get('/academics/sections/')
      ]);
      setGrades(gradesRes.data);
      setSections(sectionsRes.data);
    } catch (err) {
      console.error("Failed to fetch filters", err);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students/');
      setStudents(res.data);
    } catch (err) {
      console.error("Failed to fetch students", err);
    }
  };

  const downloadTemplate = () => {
    const headers = [dbFields.map(f => f.label)];
    const data = importType === 'student' ? [
      ["John", "Doe", "john.doe@example.com", "9876543210", "M", "2010-05-15", "ADM001", "O+", "10", "A", "123 Street, City", "123456789012"],
      ["Jane", "Smith", "jane.smith@example.com", "9876543211", "F", "2011-08-20", "ADM002", "A+", "9", "B", "456 Avenue, City", "987654321098"]
    ] : [
      ["Alice", "Teacher", "alice@school.com", "9988776655", "F", "1985-04-12", "B+", "M.Sc Mathematics", "Math, Physics", "8", "2023-01-15", "FULL_TIME"],
      ["Bob", "Instructor", "bob@school.com", "8877665544", "M", "1990-11-25", "A-", "B.A English", "English", "5", "2024-06-01", "CONTRACT"]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, importType === 'student' ? "Students" : "Teachers");
    XLSX.writeFile(workbook, `${importType}_import_template.xlsx`);
  };

  // --- Handlers for Import ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setImportStatus('parsing');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length > 0) {
          const headers = data[0].map(h => String(h).trim());
          setExcelHeaders(headers);
          
          // Auto-map using fuzzy/normalized match
          const initialMapping: Record<string, string> = {};
          headers.forEach(h => {
             const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
             const match = dbFields.find(f => {
                const fKeyNorm = f.key.replace(/_/g, '');
                const fLabelNorm = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
                return fKeyNorm === normalized || fLabelNorm === normalized || fLabelNorm.includes(normalized) || normalized.includes(fLabelNorm);
             });
             if (match) initialMapping[h] = match.key;
          });
          setMapping(initialMapping);
          
          // Store raw data (excluding header)
          const rows = XLSX.utils.sheet_to_json(ws);
          setExcelData(rows);
          setImportStatus('mapping');
        }
      } catch (err) {
        console.error(err);
        setImportStatus('error');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const executeImport = async () => {
    setImportStatus('uploading');
    
    // Transform data according to mapping
    const transformedData = excelData.map(row => {
      const mappedRow: any = {};
      Object.keys(mapping).forEach(excelCol => {
         const dbField = mapping[excelCol];
         if (dbField && row[excelCol] !== undefined) {
            mappedRow[dbField] = row[excelCol];
         }
      });
      return mappedRow;
    });

    try {
      const endpoint = importType === 'student' ? '/students/bulk_import/' : '/teachers/profiles/bulk_import/';
      const payloadKey = importType === 'student' ? 'students' : 'teachers';
      const res = await api.post(endpoint, { [payloadKey]: transformedData });
      setImportResult({ success: res.data.success_count, errors: res.data.errors });
      setImportStatus('success');
    } catch (err) {
      console.error(err);
      setImportStatus('error');
    }
  };

  // --- Handlers for Certificate ---
  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !certFile || !docTitle) return;

    setCertStatus('uploading');
    const formData = new FormData();
    formData.append('file', certFile);
    formData.append('document_type', docType);
    formData.append('title', docTitle);

    try {
      await api.post(`/students/${selectedStudent}/upload_document/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCertStatus('success');
      setTimeout(() => {
        setCertStatus('idle');
        setCertFile(null);
        setDocTitle('');
      }, 3000);
    } catch (err) {
      setCertStatus('error');
      setTimeout(() => setCertStatus('idle'), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Data Uploads
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Bulk import students and digitize certificates.</p>
        </div>
        <div className="flex gap-3">
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'import' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileSpreadsheet size={18} />
          Bulk Student Import
        </button>
        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'certificate' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ImageIcon size={18} />
          Digital Records
        </button>
      </div>

      <div className="mt-8">
        {activeTab === 'import' && (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            {/* Import Type Toggle */}
            {(importStatus === 'idle' || importStatus === 'parsing') && (
              <div className="flex gap-4 mb-8 bg-slate-50 p-1.5 rounded-2xl w-fit border border-slate-100">
                <button
                  onClick={() => setImportType('student')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${importType === 'student' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Student Import
                </button>
                <button
                  onClick={() => setImportType('teacher')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${importType === 'teacher' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Teacher Import
                </button>
              </div>
            )}

            {importStatus === 'idle' || importStatus === 'parsing' ? (
              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 hover:bg-slate-100 transition-colors group relative cursor-pointer overflow-hidden">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-500 border border-slate-100">
                  {importStatus === 'parsing' ? <Loader2 size={32} className="text-indigo-500 animate-spin" /> : <UploadCloud size={32} className="text-indigo-500" />}
                </div>
                <h3 className="mt-6 text-xl font-black text-slate-800">Upload your {importType === 'student' ? 'Student' : 'Teacher'} List</h3>
                <p className="mt-2 text-slate-500 font-medium text-sm">Drag & drop or click to browse files (.xlsx, .csv)</p>
                
                <div className="mt-8 p-4 bg-indigo-50 rounded-2xl flex items-start gap-3 max-w-md border border-indigo-100">
                  <Info size={20} className="text-indigo-500 shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    Ensure your file contains at least <strong>First Name</strong> and <strong>Email</strong>. Use our sample template for the best results.
                  </p>
                </div>
              </div>
            ) : importStatus === 'mapping' ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      Map Excel Columns
                    </h3>
                    <p className="text-slate-500 font-medium mt-1">We detected {excelHeaders.length} columns. Link them to system fields.</p>
                  </div>
                  <button 
                    onClick={() => setImportStatus('idle')}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="grid gap-3 bg-slate-50 p-6 rounded-3xl border border-slate-200 max-h-[60vh] overflow-y-auto">
                  {excelHeaders.map(header => (
                    <div key={header} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group hover:border-indigo-200 transition-colors">
                      <div className="flex-1 font-bold text-slate-700 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full group-hover:bg-indigo-500"></div>
                        {header}
                      </div>
                      <ChevronRight className="text-slate-300" />
                      <div className="flex-1">
                        <select 
                          className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-700 font-bold text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={mapping[header] || ''}
                          onChange={(e) => setMapping({...mapping, [header]: e.target.value})}
                        >
                          <option value="">-- Ignore this column --</option>
                          {dbFields.map(field => (
                            <option key={field.key} value={field.key}>
                              {field.label} {field.required ? '*' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={executeImport}
                    className="flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    Start Import <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ) : importStatus === 'uploading' ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2 size={64} className="text-indigo-600 animate-spin mb-6" />
                <h3 className="text-2xl font-black text-slate-900">Processing {importType === 'student' ? 'Students' : 'Teachers'}...</h3>
                <p className="text-slate-500 font-medium mt-2">Writing {excelData.length} records to database. Please wait.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in-95">
                <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl ${importResult?.errors.length === 0 ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
                  {importResult?.errors.length === 0 ? <CheckCircle size={48} /> : <AlertCircle size={48} />}
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">Import Finished</h2>
                <p className="text-slate-500 font-bold text-lg mb-8">
                  Successfully created <span className="text-indigo-600">{importResult?.success}</span> {importType === 'student' ? 'student' : 'teacher'} records.
                </p>
                
                {importResult?.errors && importResult.errors.length > 0 && (
                  <div className="bg-red-50 text-red-800 p-6 rounded-3xl text-left w-full max-w-2xl border border-red-100 shadow-inner">
                    <p className="font-black mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                      <AlertCircle size={16}/> {importResult.errors.length} Issues Detected
                    </p>
                    <ul className="text-xs space-y-2 max-h-48 overflow-y-auto font-medium">
                      {importResult.errors.map((err, i) => (
                        <li key={i} className="flex gap-3 p-2 bg-white/50 rounded-lg border border-red-50">
                          <span className="text-red-400">Row {err.row}:</span> {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => { setImportStatus('idle'); setFile(null); setMapping({}); }}
                    className="px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all"
                  >
                    Upload Another
                  </button>
                  <a 
                    href={importType === 'student' ? "/dashboard/students" : "/dashboard/teachers"}
                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-95"
                  >
                    View {importType === 'student' ? 'Student' : 'Teacher'} Directory
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'certificate' && (
          <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <FileText className="text-purple-600" /> Digital Records
                </h2>
                <button 
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  title="Filter students"
                >
                  <UploadCloud size={20} className={showFilters ? 'rotate-180' : ''} style={{ transform: showFilters ? 'rotate(180deg)' : 'none' }} />
                  {/* Using a better icon for filter */}
                  <div className="flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  </div>
                </button>
              </div>

              {showFilters && (
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Search Name</label>
                      <input 
                        type="text"
                        placeholder="Type name..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Grade</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                        value={filterGrade}
                        onChange={(e) => setFilterGrade(e.target.value)}
                      >
                        <option value="">All Grades</option>
                        {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Section</label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                        value={filterSection}
                        onChange={(e) => setFilterSection(e.target.value)}
                      >
                        <option value="">All Sections</option>
                        {sections
                          .filter(s => !filterGrade || s.grade_config === filterGrade)
                          .map(s => <option key={s.id} value={s.id}>{s.section_letter}</option>)
                        }
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={() => { setFilterName(''); setFilterGrade(''); setFilterSection(''); }}
                      className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:underline"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleCertSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Select Student</label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-800 font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all appearance-none"
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                    >
                      <option value="">Search student name...</option>
                      {students
                        .filter(s => {
                          const name = s.full_name || s.full_name_display || '';
                          const matchesName = name.toLowerCase().includes((filterName || '').toLowerCase());
                          const matchesGrade = !filterGrade || s.grade_config === filterGrade;
                          const matchesSection = !filterSection || s.current_section === filterSection;
                          return matchesName && matchesGrade && matchesSection;
                        })
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.full_name || s.full_name_display}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Category</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                    >
                      <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
                      <option value="MARK_SHEET">Mark Sheet</option>
                      <option value="TRANSFER_CERTIFICATE">Transfer Certificate</option>
                      <option value="PHOTO">Photograph</option>
                      <option value="OTHER">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Title</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Grade 10 Final"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-300"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">File Upload</label>
                  <div className="relative border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-slate-50 transition-all group overflow-hidden shadow-inner">
                    <input 
                      type="file" 
                      required
                      accept="image/*,.pdf"
                      onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <ImageIcon size={40} className="mx-auto text-slate-300 mb-4 group-hover:scale-110 transition-transform" />
                    <p className="text-slate-600 font-black text-sm">{certFile ? certFile.name : 'Click to upload image or PDF'}</p>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Max size: 5MB</p>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={certStatus === 'uploading'}
                  className="w-full py-4 bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-2xl font-black shadow-xl shadow-purple-100 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex justify-center items-center gap-3 active:scale-95"
                >
                  {certStatus === 'uploading' ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                  {certStatus === 'uploading' ? 'Uploading...' : 'Save Document'}
                </button>
                
                {certStatus === 'success' && (
                  <div className="p-4 bg-green-50 text-green-700 rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 border border-green-100 font-bold text-sm">
                    <CheckCircle size={18} /> Document successfully linked!
                  </div>
                )}
              </form>
            </div>
            
            <div className="hidden md:flex flex-col items-center justify-center p-12 text-center rounded-[40px] bg-slate-900 text-white relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
               <div className="w-48 h-48 bg-white/10 rounded-[64px] backdrop-blur-xl border border-white/20 mb-10 flex items-center justify-center group-hover:rotate-12 transition-transform duration-500 shadow-2xl">
                 <ImageIcon size={80} className="text-purple-400" />
               </div>
               <h3 className="text-3xl font-black mb-4 tracking-tight">Paperless Records</h3>
               <p className="text-slate-400 leading-relaxed font-medium max-w-xs text-sm">
                 Securely store birth certificates, marks cards, and medical reports. Access them anytime from the student's cloud profile.
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
