'use client';

import { useState, useEffect } from 'react';
import { 
  Library, ShieldCheck, Lock, BookOpen, Clock, 
  CheckCircle2, AlertCircle, FileText, DollarSign, Calendar, Info, Loader2
} from 'lucide-react';
import api from '@/lib/api';

interface BorrowedBook {
  id: string;
  book_title: string;
  author: string;
  isbn: string;
  accession_number: string;
  category: string;
  issue_date: string;
  due_date: string;
  return_date?: string | null;
  status: string;
  return_condition?: string;
  fine_amount: number;
  fine_collected: boolean;
}

interface VisitorLog {
  id: string;
  date: string;
  entry_time: string;
  exit_time?: string | null;
  purpose: string;
}

interface FineRecord {
  id: string;
  book_title: string;
  fine_amount: number;
  fine_collected: boolean;
  status: string;
  reason: string;
  date: string;
}

export default function TeacherLibraryPage() {
  const [libraryData, setLibraryData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'books' | 'visits' | 'fines'>('books');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLibraryData();
  }, []);

  const fetchLibraryData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/library/logs/teacher_library/');
      setLibraryData(res.data);
    } catch (err) {
      console.error('Failed to fetch teacher library data', err);
      setLibraryData(null);
    } finally {
      setLoading(false);
    }
  };

  const books: BorrowedBook[] = libraryData?.borrowed_books || [];
  const visitorLogs: VisitorLog[] = libraryData?.visitor_logs || [];
  const fines: FineRecord[] = libraryData?.fines || [];
  const totalFines = libraryData?.total_fines || 0;
  const isCleared = libraryData?.cleared ?? true;

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" /> View-Only Access
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-extrabold flex items-center gap-1">
              <Lock size={11} /> School Admin Synced
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Library size={24} />
            </div>
            Library Account & Borrowing Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your borrowed books, visitor logs, and library fines/fees.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-100 px-5 py-2.5 rounded-2xl text-right">
            <span className="text-xs text-emerald-700 font-bold block">Clearance Status</span>
            <span className="text-sm font-black text-emerald-900 flex items-center gap-1">
              <CheckCircle2 size={16} /> {isCleared ? 'Cleared (No Hold)' : 'Clearance Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('books')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'books'
              ? 'border-emerald-600 text-emerald-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen size={18} /> Borrowed Books ({books.length})
        </button>

        <button
          onClick={() => setActiveTab('visits')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'visits'
              ? 'border-emerald-600 text-emerald-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={18} /> Visitor Logs ({visitorLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('fines')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'fines'
              ? 'border-emerald-600 text-emerald-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign size={18} /> Fines & Fees ({fines.length})
        </button>
      </div>

      {/* TAB 1: Borrowed Books */}
      {activeTab === 'books' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen size={20} className="text-emerald-600" /> Borrowed & Returned Books
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">All books borrowed by you from the school library.</p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
              <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading borrowed books history...
            </div>
          ) : books.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Info size={28} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">No Books Borrowed</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You have not borrowed any books from the school library yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Book Title & Author</th>
                    <th className="py-3.5 px-4">Accession / ISBN</th>
                    <th className="py-3.5 px-4">Issue Date</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Return Date</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {books.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div>{b.book_title}</div>
                        <div className="text-xs text-slate-400 font-normal">by {b.author}</div>
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-slate-700">
                        <div>{b.accession_number}</div>
                        <div className="text-slate-400 text-[11px]">{b.isbn}</div>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">{b.issue_date}</td>
                      <td className="py-4 px-4 text-xs text-slate-600 font-semibold">{b.due_date}</td>
                      <td className="py-4 px-4 text-xs text-slate-500">{b.return_date || '-'}</td>
                      <td className="py-4 px-4">
                        {b.status === 'RETURNED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                            Returned
                          </span>
                        ) : b.status === 'ISSUED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                            Currently Issued
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200">
                            {b.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Visitor Logs */}
      {activeTab === 'visits' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock size={20} className="text-emerald-600" /> Library Visitor Logs
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Historical records of your entries to the school library.</p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
              <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading library visitor logs...
            </div>
          ) : visitorLogs.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Info size={28} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">No Visitor Logs Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No entry/exit logs have been recorded for your library visits.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Visit Date</th>
                    <th className="py-3.5 px-4">Entry Time</th>
                    <th className="py-3.5 px-4">Exit Time</th>
                    <th className="py-3.5 px-4">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {visitorLogs.map((vl) => (
                    <tr key={vl.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900 text-xs font-mono">{vl.date}</td>
                      <td className="py-4 px-4 text-xs font-semibold text-emerald-700">{vl.entry_time}</td>
                      <td className="py-4 px-4 text-xs text-slate-500">{vl.exit_time || '-'}</td>
                      <td className="py-4 px-4 text-xs text-slate-700">{vl.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Fines & Fees */}
      {activeTab === 'fines' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-600" /> Library Fines & Late Fees
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Overdue borrowing fines and book condition charges.</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold block uppercase">Total Fines Incurred</span>
              <span className="text-lg font-black text-rose-700">₹{totalFines.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500 font-semibold text-sm">
              <Loader2 className="animate-spin text-emerald-600" size={20} /> Loading fines & fees records...
            </div>
          ) : fines.length === 0 ? (
            <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-800">No Fines or Late Fees</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You have zero library fines or late fee penalties on your account!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Book Title</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Fine Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {fines.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900">{f.book_title}</td>
                      <td className="py-4 px-4 text-xs text-slate-600">{f.reason}</td>
                      <td className="py-4 px-4 font-extrabold text-slate-900">₹{f.fine_amount.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4">
                        {f.fine_collected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-full border border-rose-200">
                            Unpaid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
