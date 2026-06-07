"use client";

import { useState, useEffect } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { useFeatures } from '@/lib/FeatureContext';
import api from '@/lib/api';
import { Plus, Scan, CheckCircle, Shield, Clock } from 'lucide-react';
import QRCode from 'react-qr-code';
import Modal from '@/components/Modal';

export default function GatePassPage() {
  const [passes, setPasses] = useState<any[]>([]);
  const { settings } = useSettings();
  const { isFeatureEnabled } = useFeatures();
  
  const [showModal, setShowModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewPass, setPreviewPass] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({ student: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const res = await api.get('/gatepass/passes/');
      setPasses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/gatepass/passes/', formData);
      setShowModal(false);
      setFormData({ student: '', reason: '' });
      fetchData();
    } catch (err) {
      setError('Failed to issue gate pass');
    } finally {
      setSubmitting(false);
    }
  };


  const isDigitalPassEnabled = isFeatureEnabled('GATE_PASS', 'digital_pass');
  const isPrintPassEnabled = isFeatureEnabled('GATE_PASS', 'print_pass');

  const fields = [
    { name: 'student', label: 'Student ID', type: 'text', required: true },
    { name: 'reason', label: 'Reason', type: 'text', required: true }
  ];

  const activePasses = passes.filter((p: any) => p.status === 'ACTIVE' || p.status === 'DRAFT');
  const usedPasses = passes.filter((p: any) => p.status === 'USED');
  const expiredPasses = passes.filter((p: any) => p.status === 'EXPIRED');
  const terminatedPasses = passes.filter((p: any) => p.status === 'CANCELLED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isDigitalPassEnabled ? '🎫 Digital Gate Pass' : 'Gate Pass Records'}
          </h1>
          <p className="text-gray-600 mt-1">Issue and scan student passes</p>
        </div>
        <div className="flex gap-3 items-center">

          <button
            onClick={() => {
              setFormData({ student: '', reason: '' });
              setShowModal(true);
            }}
            className="bg-black hover:bg-gray-800 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            <Plus size={20} /> Issue Pass
          </button>

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
                      const pass = passes.find((p: any) => p.id === id);
                      const el = document.getElementById(`qr-${id}`);
                      const svg = el ? el.innerHTML : '';
                      if (!pass) return;
                      const issuedAt = new Date(pass.issued_at).toLocaleString();
                      const expiresAt = new Date(pass.valid_until).toLocaleString();
                      const part = `<div style="width:320px;border:1px solid #e6e6e6;padding:12px;margin:8px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#111"><div style="text-align:center;padding:8px;background:#fff;border-radius:6px">${svg}</div><div style="margin-top:8px;font-size:13px;color:#444"><div><b>Student:</b> ${pass.student_name} (${pass.student_suid})</div><div><b>Reason:</b> ${pass.reason}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${pass.id}</div></div></div>`;
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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Active Passes</h2>
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
                  <div className="font-bold text-gray-900 text-lg">{pass.student_name}</div>
                  <div className="text-sm text-gray-600 font-mono">{pass.student_suid}</div>
                  <div className="text-sm text-gray-700 bg-white p-3 rounded-lg mt-2">
                    <strong>Reason:</strong> {pass.reason}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Used Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recently Used Passes</h2>
        {usedPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes used yet</div>
        ) : (
          <div className="space-y-3">
            {usedPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <CheckCircle size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{pass.student_name}</div>
                    <div className="text-sm text-gray-600">{pass.reason}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Scanned by {pass.scanned_by_name} • {new Date(pass.scanned_at).toLocaleString()}
                    </div>
                    {pass.failed_attempts > 0 && (
                      <div className="text-xs text-red-600 mt-1 font-bold flex items-center gap-1">
                        <Shield size={12} /> {pass.failed_attempts} Failed Attempts Recorded
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-500 uppercase px-3 py-1 rounded-full bg-gray-200">
                  USED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminated Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Terminated Passes</h2>
        {terminatedPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes terminated yet</div>
        ) : (
          <div className="space-y-3">
            {terminatedPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-red-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Shield size={20} className="text-red-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{pass.student_name}</div>
                    <div className="text-sm text-gray-600">{pass.reason}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Terminated on {new Date(pass.updated_at || pass.requested_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-500 uppercase px-3 py-1 rounded-full bg-red-100">
                  TERMINATED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expired Passes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Expired Passes</h2>
        {expiredPasses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No passes expired yet</div>
        ) : (
          <div className="space-y-3">
            {expiredPasses.slice(0, 10).map((pass) => (
              <div
                key={pass.id}
                className="flex items-center justify-between p-4 border border-orange-100 rounded-lg bg-orange-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Clock size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{pass.student_name}</div>
                    <div className="text-sm text-gray-600">{pass.reason}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Expired on {new Date(pass.valid_until).toLocaleString()}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-orange-500 uppercase px-3 py-1 rounded-full bg-orange-100">
                  EXPIRED
                </span>
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
                <div className="text-sm text-gray-500">Pass ID: {previewPass.id}</div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="bg-white p-3 rounded-xl shadow-md">
                  <div id={`qr-${previewPass.id}-preview`}>
                    <QRCode value={previewPass.qr_payload || `${window.location.origin}/verify-pass/?pass_id=${previewPass.id}`} size={160} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg">{previewPass.student_name}</div>
                  <div className="text-sm text-gray-600 font-mono">{previewPass.student_suid}</div>
                  <div className="mt-3 text-sm text-gray-700"><strong>Reason:</strong> {previewPass.reason}</div>
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
                        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Pass</title><style>body{display:flex;align-items:center;justify-content:center;margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111} .card{width:360px;border:1px solid #e6e6e6;padding:16px;border-radius:10px} .qr{display:flex;justify-content:center;padding:8px;background:#fff;border-radius:8px}</style></head><body><div class="card"><div class="qr">${svg}</div><div style="margin-top:12px;font-size:13px;color:#444"><div><b>Student:</b> ${previewPass.student_name} (${previewPass.student_suid})</div><div><b>Reason:</b> ${previewPass.reason}</div><div><b>Issued:</b> ${issuedAt}</div><div><b>Expires:</b> ${expiresAt}</div><div><b>Pass ID:</b> ${previewPass.id}</div></div></div></body></html>`;
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => setShowPrintPreview(false)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api.post(`/gatepass/passes/${previewPass.id}/terminate/`);
                          setShowPrintPreview(false);
                          fetchData();
                        } catch (err) {
                          alert('Failed to terminate pass');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg"
                    >
                      Terminate
                    </button>
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
        title="Issue Gate Pass"
        fields={fields}
        formData={formData}
        onFormChange={(field, value) => setFormData({ ...formData, [field]: value })}
        onSubmit={handleSubmit}
        loading={submitting}
        error={error}
        submitButtonText="Generate Pass"
        color="indigo"
      />

    </div >
  );
}
