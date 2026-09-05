"use client";

import { useState, useEffect } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useFeatures } from '@/lib/FeatureContext';
import { usePermissionContext } from '@/lib/rbac-context';
import api from '@/lib/api';
import { Plus, Scan, CheckCircle, Shield, Clock, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import Modal from '@/components/Modal';
import PermissionGate from '@/components/PermissionGate';

export default function GatePassPage() {
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissionContext();
  const [passes, setPasses] = useState<any[]>([]);
  const [visitorPasses, setVisitorPasses] = useState<any[]>([]);
  const [activeModule, setActiveModule] = useState<'student' | 'visitor'>('student');
  const { settings } = useSettings();
  const { isFeatureEnabled } = useFeatures();
  
  const [showModal, setShowModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewPass, setPreviewPass] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Custom Selection Form State
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const getDefaultExpiryTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const getExpiryHoursFromTime = (timeStr: string) => {
    if (!timeStr) return 2;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 2;
    const now = new Date();
    const target = new Date();
    target.setHours(parts[0], parts[1], 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const diffMs = target.getTime() - now.getTime();
    return Math.max(0.01, Number((diffMs / (1000 * 60 * 60)).toFixed(4)));
  };


  const [nowTick, setNowTick] = useState(Date.now());
  const [formData, setFormData] = useState({ student: '', reason: '', expiry_time: getDefaultExpiryTime() });
  const [visitorFormData, setVisitorFormData] = useState({
    name: '',
    address: '',
    purpose: '',
    email: '',
    phone_number: '',
    expiry_time: getDefaultExpiryTime()
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');


  // Cancellation states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [passToCancel, setPassToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const canViewStudent = isAdmin || hasPermission('gatepass.view_student_gatepass');
  const canViewVisitor = isAdmin || hasPermission('gatepass.view_visitor_pass');
  
  const canEditStudent = isAdmin || hasPermission('gatepass.edit_student_gatepass');
  const canEditVisitor = isAdmin || hasPermission('gatepass.edit_visitor_pass');

  const fetchData = async () => {
    try {
      const promises: Promise<any>[] = [];
      if (canViewStudent) {
        promises.push(api.get('/gatepass/passes/').then(res => ({ type: 'student', data: res.data })));
      }
      if (canViewVisitor) {
        promises.push(api.get('/gatepass/visitors/').then(res => ({ type: 'visitor', data: res.data })));
      }
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        if (result.type === 'student') {
          setPasses(result.data);
        } else if (result.type === 'visitor') {
          setVisitorPasses(result.data);
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentsGradesSections = async () => {
    setLoadingStudents(true);
    try {
      const [studentsRes, gradesRes, sectionsRes] = await Promise.all([
        api.get('/students/?status=ACTIVE'),
        api.get('/academics/grades/'),
        api.get('/academics/sections/')
      ]);
      setStudents(studentsRes.data);
      setGrades(gradesRes.data);
      setSections(sectionsRes.data);
    } catch (err) {
      console.error("Failed to fetch autocomplete dependencies:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewStudent || canViewVisitor) {
      fetchData();
      fetchStudentsGradesSections();

      const fetchTimer = setInterval(() => {
        fetchData();
      }, 10000);
      return () => clearInterval(fetchTimer);
    }
  }, [permissionsLoading, canViewStudent, canViewVisitor]);


  useEffect(() => {
    if (permissionsLoading) return;
    if (canViewStudent) {
      setActiveModule('student');
    } else if (canViewVisitor) {
      setActiveModule('visitor');
    }
  }, [permissionsLoading, canViewStudent, canViewVisitor]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (activeModule === 'student') {
        await api.post('/gatepass/passes/', {
          student: formData.student,
          reason: formData.reason,
          expiry_time: formData.expiry_time,
          expiry_hours: getExpiryHoursFromTime(formData.expiry_time)
        });
      } else {
        await api.post('/gatepass/visitors/', {
          ...visitorFormData,
          expiry_time: visitorFormData.expiry_time,
          expiry_hours: getExpiryHoursFromTime(visitorFormData.expiry_time)
        });
      }
      setShowModal(false);
      setFormData({ student: '', reason: '', expiry_time: getDefaultExpiryTime() });
      setVisitorFormData({
        name: '',
        address: '',
        purpose: '',
        email: '',
        phone_number: '',
        expiry_time: getDefaultExpiryTime()
      });
      setSelectedGrade('');
      setSelectedSection('');
      setSearchQuery('');
      fetchData();
    } catch (err) {
      setError(activeModule === 'student' ? 'Failed to issue gate pass' : 'Failed to record visitor');
    } finally {
      setSubmitting(false);
    }
  };


  const handleCancelSubmit = async () => {
    if (!passToCancel) return;
    setCancelling(true);
    setCancelError('');
    try {
      const apiPrefix = activeModule === 'student' ? '/gatepass/passes' : '/gatepass/visitors';
      await api.post(`${apiPrefix}/${passToCancel.id}/terminate/`, { reason: cancelReason });
      setShowCancelModal(false);
      setPassToCancel(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      setCancelError('Failed to cancel pass');
    } finally {
      setCancelling(false);
    }
  };


  const isDigitalPassEnabled = isFeatureEnabled('GATE_PASS', 'digital_pass');
  const isPrintPassEnabled = isFeatureEnabled('GATE_PASS', 'print_pass');

  // Filter students based on grade, section and search query
  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.toLowerCase();
    const rollNo = (student.roll_number || '').toLowerCase();
    const suid = (student.suid || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesQuery = fullName.includes(query) || rollNo.includes(query) || suid.includes(query);

    const currentClass = student.current_class || '';
    let matchesGrade = true;
    let matchesSection = true;

    if (selectedGrade) {
      matchesGrade = currentClass.startsWith(`${selectedGrade}-`);
    }
    if (selectedSection) {
      matchesSection = currentClass.endsWith(`-${selectedSection}`);
    }

    return matchesQuery && matchesGrade && matchesSection;
  });

  const getEffectiveStatus = (pass: any) => {
    if (!pass) return 'ACTIVE';
    if (pass.status === 'ACTIVE' && pass.valid_until && new Date(pass.valid_until).getTime() <= nowTick) {
      return 'EXPIRED';
    }
    return pass.status;
  };

  const currentPasses = activeModule === 'student' ? passes : visitorPasses;

  const activePasses = currentPasses.filter((p: any) => getEffectiveStatus(p) === 'ACTIVE' || getEffectiveStatus(p) === 'DRAFT');
  const usedPasses = currentPasses.filter((p: any) => getEffectiveStatus(p) === 'USED');
  const expiredPasses = currentPasses.filter((p: any) => getEffectiveStatus(p) === 'EXPIRED');
  const terminatedPasses = currentPasses.filter((p: any) => getEffectiveStatus(p) === 'CANCELLED');


  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <PermissionGate anyPermission={['gatepass.view_student_gatepass', 'gatepass.view_visitor_pass']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isDigitalPassEnabled ? '🎫 Digital Gate Pass' : 'Gate Pass Records'}
            </h1>
            <p className="text-gray-600 mt-1">
              {activeModule === 'student' ? 'Issue and scan student passes' : 'Record and manage campus visitors'}
            </p>
          </div>
          <div className="flex gap-3 items-center">

            {(activeModule === 'student' ? canEditStudent : canEditVisitor) && (
              <button
                onClick={() => {
                  setFormData({ student: '', reason: '', expiry_time: getDefaultExpiryTime() });
                  setVisitorFormData({
                    name: '',
                    address: '',
                    purpose: '',
                    email: '',
                    phone_number: '',
                    expiry_time: getDefaultExpiryTime()
                  });

                  setSelectedGrade('');
                  setSelectedSection('');
                  setSearchQuery('');
                  setShowModal(true);
                }}
                className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
              >
                <Plus size={20} /> {activeModule === 'student' ? 'Issue Pass' : 'Record Visitor'}
              </button>
            )}

          <div className="flex items-center gap-2">
            {isPrintPassEnabled && (
              <>
                <button
                  onClick={() => {
                    // first click enables selection mode, second click performs print
                    if (!selectionMode) {
                      setSelectionMode(true);
                      setSelectedIds([]);
                      return;
                    }

                    if (selectedIds.length === 0) {
                      alert('Select at least one pass to print.');
                      return;
                    }

                    const htmlParts: string[] = [];
                    selectedIds.forEach((id) => {
                      const pass = currentPasses.find((p: any) => p.id === id);
                      const el = document.getElementById(`qr-${id}`);
                      const svg = el ? el.innerHTML : '';
                      if (!pass) return;
                      const issuedAt = new Date(pass.issued_at).toLocaleString();
                      const expiresAt = new Date(pass.valid_until).toLocaleString();
                      
                      let part = '';
                      if (activeModule === 'student') {
                        part = `<div style="width:320px;border:1px solid #e6e6e6;padding:12px;margin:8px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#111"><div style="text-align:center;padding:8px;background:#fff;border-radius:6px">${svg}</div><div style="margin-top:8px;font-size:13px;color:#444"><div><b>Student:</b> ${pass.student_name} (${pass.student_suid})</div><div><b>Reason:</b> ${pass.reason}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${pass.id}</div></div></div>`;
                      } else {
                        part = `<div style="width:320px;border:1px solid #e6e6e6;padding:12px;margin:8px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#111"><div style="text-align:center;padding:8px;background:#fff;border-radius:6px">${svg}</div><div style="margin-top:8px;font-size:13px;color:#444"><div><b>Visitor:</b> ${pass.name}</div><div><b>Purpose:</b> ${pass.purpose}</div><div><b>Phone:</b> ${pass.phone_number}</div><div><b>Email:</b> ${pass.email}</div><div><b>Address:</b> ${pass.address}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${pass.pass_id}</div></div></div>`;
                      }
                      htmlParts.push(part);
                    });
                    if (htmlParts.length === 0) return;
                    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bulk Print Passes</title></head><body style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;margin:0;padding:24px">${htmlParts.join('')}</body></html>`;
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.open();
                      win.document.write(html);
                      win.document.close();
                      win.focus();
                      setTimeout(() => {
                        try { win.print(); } catch (e) { }
                        try { win.close(); } catch (e) { }
                        setSelectionMode(false);
                        setSelectedIds([]);
                      }, 450);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition ${selectionMode ? (selectedIds.length ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700') : 'bg-gray-100 text-gray-700'}`}
                >
                  {selectionMode ? `Print Selected (${selectedIds.length})` : 'Bulk Print'}
                </button>

                {selectionMode && (
                  <button
                    onClick={() => { setSelectionMode(false); setSelectedIds([]); }}
                    className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Module Selector */}
      {(canViewStudent || canViewVisitor) && (
        <div className="flex gap-2 border-b border-gray-200 pb-3">
          {canViewStudent && (
            <button
              onClick={() => {
                setActiveModule('student');
                setSelectionMode(false);
                setSelectedIds([]);
              }}
              className={`px-4 py-2 font-semibold text-sm rounded-lg transition ${
                activeModule === 'student'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Student Gate Passes
            </button>
          )}
          {canViewVisitor && (
            <button
              onClick={() => {
                setActiveModule('visitor');
                setSelectionMode(false);
                setSelectedIds([]);
              }}
              className={`px-4 py-2 font-semibold text-sm rounded-lg transition ${
                activeModule === 'visitor'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Visitor Passes
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Passes</p>
              <p className="text-2xl font-bold text-gray-900">{activePasses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Used Today</p>
              <p className="text-2xl font-bold text-gray-900">{usedPasses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Passes</p>
              <p className="text-2xl font-bold text-gray-900">{passes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {activeModule === 'student' ? 'Active Passes' : 'Active Visitor Passes'}
        </h2>
        {activePasses.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Shield size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No active passes at the moment</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activePasses.map((pass) => (
              <div
                key={pass.id}
                className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-2xl border-2 border-green-500 shadow-lg relative"
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(pass.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds((s) => [...s, pass.id]);
                      else setSelectedIds((s) => s.filter((x) => x !== pass.id));
                    }}
                    className="absolute left-4 top-4 z-10 w-4 h-4"
                  />
                )}
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-green-500 text-white">
                    ACTIVE
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="animate-pulse w-2 h-2 rounded-full bg-green-500"></div>
                    <button
                      onClick={() => {
                        setPreviewPass(pass);
                        setShowPrintPreview(true);
                      }}
                      className="absolute right-4 top-4 bg-white p-2 rounded-full border shadow-sm z-20"
                      title="Print preview"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="2" ry="2" /></svg>
                    </button>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <div className="bg-white p-3 inline-block rounded-xl shadow-md group relative">
                    <div id={`qr-${pass.id}`}>
                      <QRCode value={pass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${pass.id}`} size={140} />
                    </div>
                    <button
                      onClick={() => {
                        const qrEl = document.getElementById(`qr-${pass.id}`);
                        if (!qrEl) return;
                        const svg = qrEl.innerHTML;
                        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Pass</title><style>body{display:flex;align-items:center;justify-content:center;margin:0;padding:24px} .qr{display:inline-block;padding:8px;border-radius:8px}</style></head><body><div class="qr">${svg}</div></body></html>`;
                        const win = window.open('', '_blank');
                        if (!win) return;
                        win.document.open();
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                        setTimeout(() => {
                          try { win.print(); } catch (e) { }
                          try { win.close(); } catch (e) { }
                        }, 300);
                      }}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-2 rounded-full border shadow-sm z-20"
                      title="Print pass"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="2" ry="2" /></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-gray-900 text-lg">
                    {activeModule === 'student' ? pass.student_name : pass.name}
                  </div>
                  <div className="text-sm text-gray-600 font-mono">
                    {activeModule === 'student' ? pass.student_suid : `Pass ID: ${pass.pass_id}`}
                  </div>
                  
                  <div className="text-sm text-gray-700 bg-white p-3 rounded-lg mt-2 space-y-1">
                    <div>
                      <strong>{activeModule === 'student' ? 'Reason:' : 'Purpose:'}</strong>{' '}
                      {activeModule === 'student' ? pass.reason : pass.purpose}
                    </div>
                    {activeModule === 'visitor' && (
                      <>
                        <div className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                          <strong>Address:</strong> {pass.address}
                        </div>
                        <div className="text-xs text-gray-500">
                          <strong>Email:</strong> {pass.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          <strong>Phone:</strong> {pass.phone_number}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock size={12} /> Expires: {new Date(pass.valid_until).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="text-xs text-gray-400">
                    Issued by: {pass.issued_by_name}
                  </div>
                  
                  {(activeModule === 'student' ? canEditStudent : canEditVisitor) && (
                    <button
                      onClick={() => {
                        setPassToCancel(pass);
                        setCancelReason('');
                        setCancelError('');
                        setShowCancelModal(true);
                      }}
                      className="w-full mt-3 px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-semibold transition text-center"
                    >
                      {activeModule === 'student' ? 'Cancel Pass' : 'Cancel Visitor Pass'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Used Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {activeModule === 'student' ? 'Recently Used Passes' : 'Recently Used Visitor Passes'}
        </h2>
        {usedPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes used yet</div>
        ) : (
          <div className="space-y-3">
            {usedPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                onClick={activeModule === 'visitor' ? () => {
                  setPreviewPass(pass);
                  setShowPrintPreview(true);
                } : undefined}
                className={`flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50 ${activeModule === 'visitor' ? 'hover:bg-gray-100/70 transition cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {activeModule === 'visitor' ? (
                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
                      <div id={`qr-used-${pass.id}`}>
                        <QRCode value={pass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${pass.id}`} size={64} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <CheckCircle size={20} className="text-gray-600" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-gray-900">
                      {activeModule === 'student' ? pass.student_name : pass.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {activeModule === 'student' ? pass.reason : pass.purpose}
                    </div>
                    {activeModule === 'visitor' && (
                      <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                        <span><strong>Phone:</strong> {pass.phone_number}</span>
                        <span>•</span>
                        <span><strong>Email:</strong> {pass.email}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Scanned by {pass.scanned_by_name || 'Staff'} • {new Date(pass.scanned_at || pass.updated_at || pass.requested_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase px-3 py-1 rounded-full bg-gray-200">
                    USED
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminated Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {activeModule === 'student' ? 'Terminated Passes' : 'Terminated Visitor Passes'}
        </h2>
        {terminatedPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes terminated yet</div>
        ) : (
          <div className="space-y-3">
            {terminatedPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                onClick={activeModule === 'visitor' ? () => {
                  setPreviewPass(pass);
                  setShowPrintPreview(true);
                } : undefined}
                className={`flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50 ${activeModule === 'visitor' ? 'hover:bg-red-100/60 transition cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {activeModule === 'visitor' ? (
                    <div className="bg-white p-2 rounded-lg border border-red-200 shadow-sm flex-shrink-0">
                      <div id={`qr-term-${pass.id}`}>
                        <QRCode value={pass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${pass.id}`} size={64} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Shield size={20} className="text-red-600" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-gray-900">
                      {activeModule === 'student' ? pass.student_name : pass.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {activeModule === 'student' ? pass.reason : pass.purpose}
                    </div>
                    {activeModule === 'visitor' && (
                      <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                        <span><strong>Phone:</strong> {pass.phone_number}</span>
                        <span>•</span>
                        <span><strong>Email:</strong> {pass.email}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Terminated on {new Date(pass.updated_at || pass.requested_at).toLocaleString()}
                      {pass.cancellation_reason ? ` • Reason: ${pass.cancellation_reason}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-500 uppercase px-3 py-1 rounded-full bg-red-100">
                    TERMINATED
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expired Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {activeModule === 'student' ? 'Expired Passes' : 'Expired Visitor Passes'}
        </h2>
        {expiredPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes expired yet</div>
        ) : (
          <div className="space-y-3">
            {expiredPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                onClick={activeModule === 'visitor' ? () => {
                  setPreviewPass(pass);
                  setShowPrintPreview(true);
                } : undefined}
                className={`flex items-center justify-between p-4 border border-orange-100 rounded-lg bg-orange-50 ${activeModule === 'visitor' ? 'hover:bg-orange-100/60 transition cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {activeModule === 'visitor' ? (
                    <div className="bg-white p-2 rounded-lg border border-orange-200 shadow-sm flex-shrink-0">
                      <div id={`qr-exp-${pass.id}`}>
                        <QRCode value={pass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${pass.id}`} size={64} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock size={20} className="text-orange-600" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-gray-900">
                      {activeModule === 'student' ? pass.student_name : pass.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {activeModule === 'student' ? pass.reason : pass.purpose}
                    </div>
                    {activeModule === 'visitor' && (
                      <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                        <span><strong>Phone:</strong> {pass.phone_number}</span>
                        <span>•</span>
                        <span><strong>Email:</strong> {pass.email}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Expired on {new Date(pass.valid_until).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-500 uppercase px-3 py-1 rounded-full bg-orange-100">
                    EXPIRED
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {
        showPrintPreview && previewPass && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-gray-900">Print Preview</h3>
                <div className="text-sm text-gray-500">
                  Pass ID: {activeModule === 'student' ? previewPass.id : previewPass.pass_id}
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="bg-white p-3 rounded-xl shadow-md">
                  <div id={`qr-${previewPass.id}-preview`}>
                    <QRCode value={previewPass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${previewPass.id}`} size={160} />
                  </div>
                </div>
                <div className="flex-1 text-gray-900">
                  <div className="font-bold text-lg">
                    {activeModule === 'student' ? previewPass.student_name : previewPass.name}
                  </div>
                  <div className="text-sm text-gray-600 font-mono">
                    {activeModule === 'student' ? previewPass.student_suid : `Pass ID: ${previewPass.pass_id}`}
                  </div>
                  <div className="mt-3 text-sm">
                    <strong>{activeModule === 'student' ? 'Reason:' : 'Purpose:'}</strong>{' '}
                    {activeModule === 'student' ? previewPass.reason : previewPass.purpose}
                  </div>
                  
                  {activeModule === 'visitor' && (
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                      <div><strong>Address:</strong> {previewPass.address}</div>
                      <div><strong>Email:</strong> {previewPass.email}</div>
                      <div><strong>Phone:</strong> {previewPass.phone_number}</div>
                    </div>
                  )}

                  <div className="mt-3 text-sm text-gray-500">
                    <div><strong>Issued:</strong> {new Date(previewPass.issued_at || previewPass.requested_at).toLocaleString()}</div>
                    <div><strong>Expires:</strong> {new Date(previewPass.valid_until).toLocaleString()}</div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        const qrEl = document.getElementById(`qr-${previewPass.id}`) || document.getElementById(`qr-${previewPass.id}-preview`);
                        const svg = qrEl ? qrEl.innerHTML : '';
                        const issuedAt = new Date(previewPass.issued_at || previewPass.requested_at).toLocaleString();
                        const expiresAt = new Date(previewPass.valid_until).toLocaleString();
                        
                        let html = '';
                        if (activeModule === 'student') {
                          html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Pass</title><style>body{display:flex;align-items:center;justify-content:center;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111} .card{width:360px;border:1px solid #e6e6e6;padding:16px;border-radius:10px} .qr{display:flex;justify-content:center;padding:8px;background:#fff;border-radius:8px}</style></head><body><div class="card"><div class="qr">${svg}</div><div style="margin-top:12px;font-size:13px;color:#444"><div><b>Student:</b> ${previewPass.student_name} (${previewPass.student_suid})</div><div><b>Reason:</b> ${previewPass.reason}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${previewPass.id}</div></div></div></body></html>`;
                        } else {
                          html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Visitor Pass</title><style>body{display:flex;align-items:center;justify-content:center;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111} .card{width:360px;border:1px solid #e6e6e6;padding:16px;border-radius:10px} .qr{display:flex;justify-content:center;padding:8px;background:#fff;border-radius:8px}</style></head><body><div class="card"><div class="qr">${svg}</div><div style="margin-top:12px;font-size:13px;color:#444"><div><b>Visitor:</b> ${previewPass.name}</div><div><b>Purpose:</b> ${previewPass.purpose}</div><div><b>Phone:</b> ${previewPass.phone_number}</div><div><b>Email:</b> ${previewPass.email}</div><div><b>Address:</b> ${previewPass.address}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${previewPass.pass_id}</div></div></div></body></html>`;
                        }
                        
                        const win = window.open('', '_blank');
                        if (!win) return;
                        win.document.open();
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                        setTimeout(() => {
                          try { win.print(); } catch (e) { }
                          try { win.close(); } catch (e) { }
                        }, 400);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => setShowPrintPreview(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium"
                    >
                      Cancel
                    </button>
                    {(activeModule === 'student' ? canEditStudent : canEditVisitor) && (
                      <button
                        onClick={async () => {
                          try {
                            const apiPrefix = activeModule === 'student' ? '/gatepass/passes' : '/gatepass/visitors';
                            await api.post(`${apiPrefix}/${previewPass.id}/terminate/`);
                            setShowPrintPreview(false);
                            fetchData();
                          } catch (err) {
                            alert('Failed to terminate pass');
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium"
                      >
                        Terminate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={activeModule === 'student' ? 'Issue Gate Pass' : 'Record Visitor'}
        size="lg"
      >
        <div className="space-y-4 text-gray-900">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {activeModule === 'student' ? (
            <>
              {/* Student Search and Filters */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Student <span className="text-red-500">*</span>
                </label>
                
                {/* Grade and Div Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All Grades</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.grade_name}>
                          Grade {g.grade_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All Divs</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.section_letter}>
                          Div {s.section_letter}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Box */}
                <input
                  type="text"
                  placeholder="Search by student name, roll number, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Scrollable Student List */}
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 bg-gray-50">
                  {loadingStudents ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Loading students...
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No matching students found
                    </div>
                  ) : (
                    filteredStudents.map((student) => {
                      const isSelected = formData.student === student.suid;
                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, student: student.suid })}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold' 
                              : 'hover:bg-gray-100 text-gray-800'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{student.full_name}</p>
                            <p className="text-xs text-gray-500">
                              ID: {student.suid} • Class: {student.current_class || 'Unassigned'} 
                              {student.roll_number ? ` • Roll No: ${student.roll_number}` : ''}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle size={16} className="text-indigo-600" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Reason Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Medical Emergency, Family Function"
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Expiry Time Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={formData.expiry_time}
                  onChange={(e) => setFormData({ ...formData, expiry_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Specify the time when this gate pass will expire.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Visitor Form Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={visitorFormData.name}
                  onChange={(e) => setVisitorFormData({ ...visitorFormData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={visitorFormData.address}
                  onChange={(e) => setVisitorFormData({ ...visitorFormData, address: e.target.value })}
                  placeholder="e.g. 123 Main St, Springfield"
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose of Visit <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={visitorFormData.purpose}
                  onChange={(e) => setVisitorFormData({ ...visitorFormData, purpose: e.target.value })}
                  placeholder="e.g. Guest Lecture, Vendor Meeting"
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={visitorFormData.email}
                    onChange={(e) => setVisitorFormData({ ...visitorFormData, email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={visitorFormData.phone_number}
                    onChange={(e) => setVisitorFormData({ ...visitorFormData, phone_number: e.target.value })}
                    placeholder="e.g. +1234567890"
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Out Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={visitorFormData.expiry_time}
                  onChange={(e) => setVisitorFormData({ ...visitorFormData, expiry_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Specify the expected departure time for the visitor.
                </p>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (activeModule === 'student'
                  ? !formData.student || !formData.reason || !formData.expiry_time
                  : !visitorFormData.name || !visitorFormData.address || !visitorFormData.purpose || !visitorFormData.email || !visitorFormData.phone_number || !visitorFormData.expiry_time)
              }

              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Recording...
                </>
              ) : activeModule === 'student' ? (
                'Generate Pass'
              ) : (
                'Record Visitor'
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={activeModule === 'student' ? 'Cancel Student Gate Pass' : 'Cancel Visitor Pass'}
        size="md"
      >
        <div className="space-y-4 text-gray-900">
          {cancelError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {cancelError}
            </div>
          )}

          <div>
            <p className="text-sm text-gray-600 mb-3">
              Are you sure you want to cancel the pass for{' '}
              <strong className="text-gray-900">
                {passToCancel && (activeModule === 'student' ? passToCancel.student_name : passToCancel.name)}
              </strong>
              ? This action cannot be undone.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Cancellation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Provide a detailed reason for cancellation..."
              className="w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleCancelSubmit}
              disabled={cancelling || !cancelReason.trim()}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {cancelling ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Cancelling...
                </>
              ) : (
                'Cancel Pass'
              )}
            </button>
          </div>
        </div>
      </Modal>

      </div>
    </PermissionGate>
  );
}
