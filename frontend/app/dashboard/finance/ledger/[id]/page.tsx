'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, User, School, Calendar, IndianRupee, Receipt,
  ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle,
  Loader2, TrendingUp, TrendingDown, BookOpen, CreditCard, Wallet,
  FileText, Download, Filter, Search, History, Award
} from 'lucide-react';
import { useSettings } from '@/lib/SettingsContext';

interface LedgerEntry {
  id: string;
  entry_type: string;
  date: string;
  description: string;
  category: string;
  amount: string;
  balance_after: string;
  reference_number: string;
  payment_mode?: string;
  notes: string;
}

interface Ledger {
  id: string;
  academic_year: string;
  total_charges: string;
  total_payments: string;
  total_discounts: string;
  total_fines: string;
  current_balance: string;
  opening_balance: string;
  is_cleared: boolean;
  is_rte_student?: boolean;
  total_reimbursements?: number;
  entries: LedgerEntry[];
}

interface StudentHistory {
  student_id: string;
  student_name: string;
  student_suid: string;
  current_grade: string;
  is_rte_student?: boolean;
  ledgers: Ledger[];
  lifetime_total_charges: string;
  lifetime_total_payments: string;
  lifetime_balance: string;
}

export default function StudentLedgerHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const { formatAcademicYear } = useSettings();

  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [filterYear, setFilterYear] = useState<string>('all');

  useEffect(() => {
    if (studentId) {
      fetchLedgerHistory();
    }
  }, [studentId]);

  const fetchLedgerHistory = async () => {
    try {
      const res = await api.get(`/finance/ledgers/student_history/?student=${studentId}`);
      setHistory(res.data);
      // Auto-expand current year
      if (res.data.ledgers?.length > 0) {
        const currentYear = res.data.ledgers[res.data.ledgers.length - 1].academic_year;
        setExpandedYears(new Set([currentYear]));
      }
    } catch (e) {
      console.error('Failed to fetch ledger history', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (year: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'CHARGE': return 'bg-red-100 text-red-700';
      case 'PAYMENT': return 'bg-emerald-100 text-emerald-700';
      case 'DISCOUNT': return 'bg-blue-100 text-blue-700';
      case 'FINE': return 'bg-orange-100 text-orange-700';
      case 'REFUND': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'CHARGE': return <Receipt size={16} />;
      case 'PAYMENT': return <CreditCard size={16} />;
      case 'DISCOUNT': return <Award size={16} />;
      case 'FINE': return <AlertTriangle size={16} />;
      case 'REFUND': return <TrendingDown size={16} />;
      default: return <FileText size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600 font-medium">Loading Ledger History...</p>
        </div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <p className="text-gray-600 font-medium">No ledger data found</p>
          <Link href="/dashboard/finance">
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Back to Finance
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const filteredLedgers = filterYear === 'all' 
    ? history.ledgers 
    : history.ledgers.filter(l => l.academic_year === filterYear);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
                    <History className="text-white" size={20} />
                  </div>
                  Fee Ledger History
                </h1>
                <p className="text-gray-500 text-sm mt-1">Complete financial history for {history.student_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Years</option>
                {history.ledgers.map(l => (
                  <option key={l.academic_year} value={l.academic_year}>{formatAcademicYear(l.academic_year)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Student Info Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {history.student_name[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{history.student_name}</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="font-mono">{history.student_suid}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <School size={14} /> {history.current_grade || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <Link href={`/dashboard/finance/student/${studentId}`}>
              <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                View Fee Profile
              </button>
            </Link>
          </div>
        </div>

        {/* Lifetime Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Years</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{history.ledgers.length}</h3>
                <p className="text-blue-600 text-sm font-medium mt-1">Academic years</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Calendar className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Lifetime Fees</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  ₹{parseFloat(history.lifetime_total_charges).toLocaleString()}
                </h3>
                <p className="text-gray-500 text-sm font-medium mt-1">Total charged</p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-slate-400 to-slate-600 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                <Receipt className="text-white" size={24} />
              </div>
            </div>
          </div>

          {history.is_rte_student ? (
            <>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">RTE Fee Waiver</p>
                    <h3 className="text-3xl font-bold text-indigo-600 mt-2">
                      ₹{(parseFloat(history.lifetime_total_charges) - history.ledgers.reduce((acc, l) => acc + (l.total_reimbursements || 0), 0)).toLocaleString('en-IN')}
                    </h3>
                    <p className="text-indigo-600 text-sm font-medium mt-1">Concession / Waiver</p>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Award className="text-white" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Reimbursements</p>
                    <h3 className="text-3xl font-bold text-emerald-600 mt-2">
                      ₹{history.ledgers.reduce((acc, l) => acc + (l.total_reimbursements || 0), 0).toLocaleString('en-IN')}
                    </h3>
                    <p className="text-emerald-600 text-sm font-medium mt-1">Collected from state</p>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Wallet className="text-white" size={24} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Paid</p>
                    <h3 className="text-3xl font-bold text-emerald-600 mt-2">
                      ₹{parseFloat(history.lifetime_total_payments).toLocaleString()}
                    </h3>
                    <p className="text-emerald-600 text-sm font-medium mt-1 flex items-center gap-1">
                      <CheckCircle size={14} /> {((parseFloat(history.lifetime_total_payments) / parseFloat(history.lifetime_total_charges)) * 100).toFixed(0)}% paid
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Wallet className="text-white" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Current Balance</p>
                    <h3 className={`text-3xl font-bold mt-2 ${parseFloat(history.lifetime_balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      ₹{parseFloat(history.lifetime_balance).toLocaleString()}
                    </h3>
                    <p className={`text-sm font-medium mt-1 ${parseFloat(history.lifetime_balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {parseFloat(history.lifetime_balance) > 0 ? 'Outstanding' : 'Fully paid'}
                    </p>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                    parseFloat(history.lifetime_balance) > 0 
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200' 
                      : 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-200'
                  }`}>
                    {parseFloat(history.lifetime_balance) > 0 ? <Clock className="text-white" size={24} /> : <CheckCircle className="text-white" size={24} />}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Year-wise Ledgers */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-gray-900">Year-wise Fee Records</h3>
          
          {filteredLedgers.map((ledger) => (
            <div key={ledger.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Year Header */}
              <button
                onClick={() => toggleYear(ledger.academic_year)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    ledger.is_cleared 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-amber-100 text-amber-600'
                  }`}>
                    {ledger.is_cleared ? <CheckCircle size={24} /> : <Clock size={24} />}
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-900">{formatAcademicYear(ledger.academic_year)}</h4>
                    <p className="text-sm text-gray-500">
                      ₹{parseFloat(ledger.total_charges).toLocaleString()} charged • 
                      {history.is_rte_student ? (
                        `₹${(ledger.total_reimbursements || 0).toLocaleString()} reimbursed`
                      ) : (
                        `₹${parseFloat(ledger.total_payments).toLocaleString()} paid`
                      )}
                      {!history.is_rte_student && parseFloat(ledger.total_discounts) > 0 && ` • ₹${parseFloat(ledger.total_discounts).toLocaleString()} discount`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {history.is_rte_student ? (
                      <p className="font-bold text-indigo-600">
                        Waiver: ₹{(parseFloat(ledger.total_charges) - (ledger.total_reimbursements || 0)).toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <p className={`font-bold ${parseFloat(ledger.current_balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        Balance: ₹{parseFloat(ledger.current_balance).toLocaleString()}
                      </p>
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      ledger.is_cleared ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {ledger.is_cleared ? 'CLEARED' : 'PENDING'}
                    </span>
                  </div>
                  {expandedYears.has(ledger.academic_year) ? (
                    <ChevronDown className="text-gray-400" size={20} />
                  ) : (
                    <ChevronRight className="text-gray-400" size={20} />
                  )}
                </div>
              </button>

              {/* Ledger Entries */}
              {expandedYears.has(ledger.academic_year) && ledger.entries && ledger.entries.length > 0 && (
                <div className="border-t border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        {history.is_rte_student ? (
                          <tr className="text-xs uppercase text-gray-500 font-semibold">
                            <th className="px-6 py-3 text-left">Date</th>
                            <th className="px-6 py-3 text-left">Type</th>
                            <th className="px-6 py-3 text-left">Description</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                            <th className="px-6 py-3 text-right">Fee Waiver</th>
                            <th className="px-6 py-3 text-right">Reimbursements</th>
                          </tr>
                        ) : (
                          <tr className="text-xs uppercase text-gray-500 font-semibold">
                            <th className="px-6 py-3 text-left">Date</th>
                            <th className="px-6 py-3 text-left">Type</th>
                            <th className="px-6 py-3 text-left">Description</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                            <th className="px-6 py-3 text-right">Balance</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledger.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                                history.is_rte_student && entry.entry_type === 'PAYMENT'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : getEntryTypeColor(entry.entry_type)
                              }`}>
                                {history.is_rte_student && entry.entry_type === 'PAYMENT' ? <Wallet size={16} /> : getEntryIcon(entry.entry_type)}
                                {history.is_rte_student && entry.entry_type === 'PAYMENT' ? 'REIMBURSEMENT' : entry.entry_type}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <p className="text-sm font-medium text-gray-900">
                                {history.is_rte_student && entry.entry_type === 'PAYMENT'
                                  ? `Reimbursement Received (${entry.payment_mode?.replace('_', ' ') || 'BANK TRANSFER'})`
                                  : entry.description}
                              </p>
                              {entry.reference_number && (
                                <p className="text-xs text-gray-400 font-mono">
                                  {entry.reference_number.startsWith('RCP-') ? 'Receipt: ' : 'Transaction ID: '}
                                  {entry.reference_number}
                                </p>
                              )}
                              {entry.notes && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-1.5 whitespace-pre-line font-medium leading-relaxed max-w-xs">
                                  {entry.notes}
                                </p>
                              )}
                            </td>
                            <td className={`px-6 py-3 text-right font-semibold ${
                              ['PAYMENT', 'DISCOUNT', 'REFUND'].includes(entry.entry_type) 
                                ? 'text-emerald-600' 
                                : 'text-red-600'
                            }`}>
                              {['PAYMENT', 'DISCOUNT', 'REFUND'].includes(entry.entry_type) ? '-' : '+'}
                              ₹{parseFloat(entry.amount).toLocaleString()}
                            </td>
                            {history.is_rte_student ? (
                              <>
                                <td className="px-6 py-3 text-right text-sm text-indigo-600 font-semibold">
                                  {entry.entry_type === 'CHARGE' ? `₹${parseFloat(entry.balance_after).toLocaleString()}` : '-'}
                                </td>
                                <td className="px-6 py-3 text-right text-sm text-emerald-600 font-semibold">
                                  {entry.entry_type === 'PAYMENT' ? `₹${parseFloat(entry.amount).toLocaleString()}` : '-'}
                                </td>
                              </>
                            ) : (
                              <td className="px-6 py-3 text-right text-sm text-gray-600">
                                ₹{parseFloat(entry.balance_after).toLocaleString()}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {expandedYears.has(ledger.academic_year) && (!ledger.entries || ledger.entries.length === 0) && (
                <div className="border-t border-gray-100 p-8 text-center text-gray-500">
                  No detailed entries available for this year
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
