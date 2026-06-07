'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Library, Search, ArrowLeft, Loader2, CheckCircle2, Plus, Calendar, Book } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

export default function StockRegisterPage() {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [editingAudit, setEditingAudit] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    isbn: '',
    audit_date: new Date().toISOString().split('T')[0],
    condition: 'GOOD',
    copies_count: 0,
    is_verified: false
  });

  useEffect(() => {
    fetchAudits();
  }, []);

  const fetchAudits = async () => {
    try {
      const res = await api.get('/library/audits/');
      setAudits(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (audit: any) => {
    setEditingAudit(audit);
    setFormData({
      isbn: audit.book_isbn || '',
      audit_date: audit.audit_date,
      condition: audit.condition,
      copies_count: audit.copies_count,
      is_verified: audit.is_verified
    });
    setShowAuditModal(true);
  };

  const handleAuditSubmit = async () => {
    if (!formData.isbn || !formData.copies_count) {
      setError('Please fill all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (editingAudit) {
        await api.put(`/library/audits/${editingAudit.id}/`, formData);
      } else {
        await api.post('/library/audits/', formData);
      }
      setShowAuditModal(false);
      resetForm();
      fetchAudits();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save audit.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingAudit(null);
    setFormData({
      isbn: '',
      audit_date: new Date().toISOString().split('T')[0],
      condition: 'GOOD',
      copies_count: 0,
      is_verified: false
    });
  };

  const filteredAudits = audits.filter(audit => 
    audit.book_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/library" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">📋 Stock Register</h1>
            <p className="text-slate-500 font-medium">Physical inventory and condition tracking.</p>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAuditModal(true); }}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <Plus size={20} /> New Audit
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 ring-1 ring-slate-100">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by book title..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.1em]">
            <tr>
              <th className="px-6 py-4">Book Details</th>
              <th className="px-6 py-4">Audit Date</th>
              <th className="px-6 py-4">Condition (Copies)</th>
              <th className="px-6 py-4">Verification</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center">
                  <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                </td>
              </tr>
            ) : filteredAudits.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400 font-medium italic">
                  No audit records found.
                </td>
              </tr>
            ) : filteredAudits.map((audit, i) => (
              <tr key={i} className="hover:bg-indigo-50/20 transition group">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-slate-900">{audit.book_title}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Audit ID: #{audit.id}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                  {audit.audit_date}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-tight ${
                      audit.condition === 'GOOD' ? 'bg-green-100 text-green-700' : 
                      audit.condition === 'WORN' ? 'bg-amber-100 text-amber-700' : 
                      audit.condition === 'DAMAGED' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {audit.condition}
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {audit.copies_count} / {audit.total_copies}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`flex items-center gap-2 ${audit.is_verified ? 'text-green-600' : 'text-slate-400'}`}>
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {audit.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleEdit(audit)}
                    className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest hover:text-indigo-800 transition"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showAuditModal}
        onClose={() => { setShowAuditModal(false); resetForm(); }}
        title={editingAudit ? "✏️ Edit Stock Audit" : "📝 New Stock Audit"}
      >
        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">ISBN Number *</label>
            <div className="relative">
              <Book size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Enter book ISBN..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.isbn}
                onChange={(e) => setFormData({...formData, isbn: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Audit Date *</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="date" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.audit_date}
                onChange={(e) => setFormData({...formData, audit_date: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Condition *</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
              >
                <option value="GOOD">Good</option>
                <option value="WORN">Worn</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Number of Copies *</label>
              <input 
                type="number" 
                placeholder="Count"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.copies_count}
                onChange={(e) => setFormData({...formData, copies_count: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input 
              type="checkbox" 
              id="is_verified"
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              checked={formData.is_verified}
              onChange={(e) => setFormData({...formData, is_verified: e.target.checked})}
            />
            <label htmlFor="is_verified" className="text-sm font-bold text-slate-600">Mark as Verified</label>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => setShowAuditModal(false)}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleAuditSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:bg-indigo-300 shadow-lg shadow-indigo-100"
            >
              {submitting ? 'Recording...' : 'Save Audit'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

