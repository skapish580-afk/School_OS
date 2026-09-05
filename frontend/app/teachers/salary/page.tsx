'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, ShieldCheck, Lock, Calendar, Minus, 
  CheckCircle2, AlertCircle, Info, Loader2, FileText, User
} from 'lucide-react';
import api from '@/lib/api';

interface DeductionRecord {
  id: string;
  month: string;
  amount: number | string;
  description: string;
  recorded_by_name?: string;
  created_at: string;
}

interface SalaryData {
  teacher_name: string;
  tuid: string;
  month: string;
  base_salary: number;
  total_month_deduction: number;
  net_payable_salary: number;
  total_all_time_deduction: number;
  month_deductions: DeductionRecord[];
  deduction_history: DeductionRecord[];
}

export default function TeacherSalaryPage() {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSalaryData(selectedMonth);
  }, [selectedMonth]);

  const fetchSalaryData = async (month: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/finance/salary-deductions/my_salary/?month=${month}`);
      setSalaryData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch salary data', err);
      setError('Failed to load salary and deduction records.');
    } finally {
      setLoading(false);
    }
  };

  const formattedBaseSalary = salaryData
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(salaryData.base_salary)
    : '₹0';

  const formattedNetSalary = salaryData
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(salaryData.net_payable_salary)
    : '₹0';

  const formattedMonthDeduction = salaryData
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(salaryData.total_month_deduction)
    : '₹0';

  const formattedAllTimeDeduction = salaryData
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(salaryData.total_all_time_deduction)
    : '₹0';

  const history = salaryData?.deduction_history || [];
  const monthDeductions = salaryData?.month_deductions || [];

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
              <Lock size={11} /> Finance Module Synced
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign size={24} />
            </div>
            Salary & Pay Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your base salary, deduction history, and net payable salary.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-2xl">
          <Calendar size={18} className="text-slate-500 ml-2" />
          <span className="text-xs font-bold text-slate-500 uppercase">Select Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={36} />
          <span className="text-slate-500 font-semibold text-sm">Loading salary and deduction ledger...</span>
        </div>
      ) : error ? (
        <div className="p-8 max-w-lg mx-auto bg-rose-50 border border-rose-200 rounded-2xl text-center">
          <AlertCircle size={36} className="text-rose-600 mx-auto mb-2" />
          <h3 className="text-base font-bold text-rose-900 mb-1">Failed to Load Salary Data</h3>
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Monthly Base Salary */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Monthly Base Salary
              </span>
              <span className="text-2xl font-black text-slate-900">
                {formattedBaseSalary}
              </span>
              <p className="text-xs text-slate-500 mt-1">Gross salary specified in profile</p>
            </div>

            {/* Total Month Deductions */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Deductions ({selectedMonth})
              </span>
              <span className="text-2xl font-black text-rose-600">
                −{formattedMonthDeduction}
              </span>
              <p className="text-xs text-slate-500 mt-1">{monthDeductions.length} deduction(s) for this month</p>
            </div>

            {/* Net Payable Salary (Highlighted) */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-md shadow-emerald-200">
              <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider block mb-1">
                Net Payable ({selectedMonth})
              </span>
              <span className="text-3xl font-black text-white">
                {formattedNetSalary}
              </span>
              <p className="text-xs text-emerald-100 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Base salary minus month deductions
              </p>
            </div>

            {/* All-Time Deductions */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Total All-Time Deductions
              </span>
              <span className="text-2xl font-black text-slate-700">
                −{formattedAllTimeDeduction}
              </span>
              <p className="text-xs text-slate-500 mt-1">{history.length} total deduction record(s)</p>
            </div>

          </div>

          {/* Deduction History Section */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Minus size={20} className="text-rose-600" /> Deduction History & Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed ledger of all salary deductions recorded by School Admin Finance.
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-800">No Salary Deductions Recorded</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You have zero salary deductions recorded on your account.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Month</th>
                      <th className="py-3.5 px-4">Description / Reason</th>
                      <th className="py-3.5 px-4">Deduction Amount</th>
                      <th className="py-3.5 px-4">Date Recorded</th>
                      <th className="py-3.5 px-4">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {history.map((d) => (
                      <tr 
                        key={d.id} 
                        className={`transition-colors ${d.month === selectedMonth ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-4 px-4 font-bold text-slate-900 font-mono text-xs">
                          {d.month}
                          {d.month === selectedMonth && (
                            <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-full uppercase">
                              Current Filter
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-slate-800 max-w-xs">
                          {d.description}
                        </td>
                        <td className="py-4 px-4 font-black text-rose-600">
                          −₹{parseFloat(String(d.amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-500 font-mono">
                          {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600">
                          {d.recorded_by_name || 'School Admin'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
