'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Search, ArrowLeft, Clock, Calendar, UserPlus, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import Modal from '@/components/Modal';

export default function VisitorLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown data
  const [people, setPeople] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const [formData, setFormData] = useState({
    visitor_type: 'STUDENT',
    student: '',
    teacher: '',
    visitor_name: '',
    purpose: '',
    date: new Date().toISOString().split('T')[0],
    entry_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    exit_time: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchPeople();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/library/visitor-logs/');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    setLoadingPeople(true);
    try {
      const [studentsRes, teachersRes] = await Promise.all([
        api.get('/students/'),
        api.get('/teachers/profiles/')
      ]);
      
      const students = studentsRes.data.map((s: any) => ({
        id: s.id,
        name: s.full_name_display || `${s.first_name} ${s.last_name}`,
        type: 'STUDENT',
        display: `${s.full_name_display || s.first_name} (Student)`
      }));

      const teachers = teachersRes.data.map((t: any) => ({
        id: t.id,
        name: t.full_name || `${t.user.first_name} ${t.user.last_name}`,
        type: 'TEACHER',
        display: `${t.full_name || t.user.first_name} (Teacher)`
      }));

      setPeople([...students, ...teachers]);
    } catch (err) {
      console.error('Failed to fetch people', err);
    } finally {
      setLoadingPeople(false);
    }
  };

  const handlePersonSelect = (personId: string) => {
    const person = people.find(p => p.id.toString() === personId);
    if (person) {
      setFormData({
        ...formData,
        visitor_type: person.type,
        student: person.type === 'STUDENT' ? person.id : '',
        teacher: person.type === 'TEACHER' ? person.id : '',
        visitor_name: person.name
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.visitor_name || !formData.purpose || !formData.entry_time) {
      setError('Please fill all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/library/visitor-logs/', formData);
      setShowModal(false);
      resetForm();
      fetchLogs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to record entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      visitor_type: 'STUDENT',
      student: '',
      teacher: '',
      visitor_name: '',
      purpose: '',
      date: new Date().toISOString().split('T')[0],
      entry_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      exit_time: ''
    });
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const name = log.visitor_name?.toLowerCase() || '';
      const purpose = log.purpose?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return name.includes(search) || purpose.includes(search);
    });
  }, [logs, searchTerm]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/library" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">👥 Visitor Log</h1>
            <p className="text-slate-500 font-medium">Daily library usage and attendance.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <UserPlus size={20} /> Mark Entry
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 ring-1 ring-slate-100">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name or purpose..." 
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
              <th className="px-6 py-4">Visitor</th>
              <th className="px-6 py-4">Timing</th>
              <th className="px-6 py-4">Purpose</th>
              <th className="px-6 py-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-10 text-center">
                  <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-400 font-medium italic">
                  No visitor records found.
                </td>
              </tr>
            ) : filteredLogs.map((log, i) => (
              <tr key={i} className="hover:bg-indigo-50/20 transition group">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-bold text-slate-900">{log.visitor_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{log.visitor_type}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1 text-blue-600">
                      <Clock size={14} /> {log.entry_time}
                    </div>
                    {log.exit_time && (
                      <>
                        <div className="text-slate-300">→</div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock size={14} /> {log.exit_time}
                        </div>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    {log.purpose.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Calendar size={14} /> {log.date}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="👥 Mark Library Entry"
      >
        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-2">
              <X size={14} /> {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Visitor</label>
            <select 
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              onChange={(e) => handlePersonSelect(e.target.value)}
              value={formData.student || formData.teacher || ''}
            >
              <option value="">Choose a student or teacher...</option>
              {people.map(p => (
                <option key={`${p.type}-${p.id}`} value={p.id}>{p.display}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Date</label>
              <input 
                type="date"
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Entry Time</label>
              <input 
                type="time"
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                value={formData.entry_time}
                onChange={(e) => setFormData({...formData, entry_time: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Leaving Time (Optional)</label>
            <input 
              type="time"
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={formData.exit_time}
              onChange={(e) => setFormData({...formData, exit_time: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Purpose of Visit</label>
            <textarea 
              placeholder="e.g. Reference, Issue Book, Self Study..."
              className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium h-24 resize-none"
              value={formData.purpose}
              onChange={(e) => setFormData({...formData, purpose: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={() => { setShowModal(false); resetForm(); }}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Record Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

