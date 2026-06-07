'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Banknote, Search, ArrowLeft, Loader2, User, Book, CreditCard, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function FinesLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/library/logs/');
      // Filtering for records returned with condition NOT GOOD, or already having a fine, or OVERDUE active issues
      const today = new Date().toISOString().split('T')[0];
      const logsWithFines = res.data.filter((log: any) => 
        (log.status === 'RETURNED' && log.return_condition !== 'GOOD' && log.return_condition !== null) || 
        (log.status === 'ISSUED' && log.due_date < today) ||
        parseFloat(log.calculated_fine) > 0 ||
        log.fine_amount > 0
      );
      setLogs(logsWithFines);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFine = async (logId: string, amount: number) => {
    try {
      await api.patch(`/library/logs/${logId}/`, {
        fine_collected: true,
        fine_amount: amount
      });
      fetchLogs();
    } catch (err) {
      console.error('Failed to collect fine', err);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.book_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/library" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">💰 Fines & Fee Records</h1>
            <p className="text-slate-500 font-medium">Tracking overdue charges and payments.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Pending Fines', value: `₹${logs.filter(l => !l.fine_collected).reduce((acc, l) => acc + parseFloat(l.calculated_fine), 0).toFixed(2)}`, icon: Banknote, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Collected', value: `₹${logs.filter(l => l.fine_collected).reduce((acc, l) => acc + parseFloat(l.fine_amount), 0).toFixed(2)}`, icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Unpaid Records', value: logs.filter(l => !l.fine_collected).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 ring-1 ring-slate-100">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by student or book..." 
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
              <th className="px-6 py-4">Borrower & Book</th>
              <th className="px-6 py-4">Condition</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Payment Status</th>
              <th className="px-6 py-4 text-right">Action</th>
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
                <td colSpan={5} className="p-10 text-center text-slate-400 font-medium italic">
                  No pending fines found.
                </td>
              </tr>
            ) : filteredLogs.map((log, i) => (
              <tr key={i} className={`transition group ${log.fine_collected ? 'bg-slate-50/50' : 'hover:bg-red-50/20'}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 uppercase">
                      {(log.student_name || log.teacher_name)?.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{log.student_name || log.teacher_name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{log.book_title}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-tight uppercase ${
                    log.status === 'ISSUED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {log.status === 'ISSUED' ? 'Overdue' : log.return_condition}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                    {log.return_date ? `Returned: ${log.return_date}` : `Due: ${log.due_date}`}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <p className={`text-lg font-black ${log.fine_collected ? 'text-slate-400' : 'text-red-600'}`}>
                    ₹{log.fine_collected ? parseFloat(log.fine_amount).toFixed(2) : parseFloat(log.calculated_fine).toFixed(2)}
                  </p>
                </td>
                <td className="px-6 py-4">
                  {log.fine_collected ? (
                    <span className="flex items-center gap-1.5 text-green-600 font-bold text-xs">
                      <CheckCircle size={14} /> Collected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-600 font-bold text-xs">
                      <Clock size={14} /> Pending
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {!log.fine_collected && (
                    <button 
                      onClick={() => handleCollectFine(log.id, parseFloat(log.calculated_fine))}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition shadow-md shadow-green-100 flex items-center gap-2 ml-auto"
                    >
                      <CreditCard size={14} /> Record Payment
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
