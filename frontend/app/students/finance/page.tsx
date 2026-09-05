'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCard, Receipt, CheckCircle2, Clock, 
  ShieldCheck, AlertCircle, Wallet, Info, Lock
} from 'lucide-react';
import api from '@/lib/api';

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  description: string;
  category: string;
  subtotal: number;
  discount_amount: number;
  late_fee: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  invoice_date: string;
  due_date: string;
  paid_date?: string | null;
  status: string;
  status_display: string;
  is_paid: boolean;
}

export default function StudentFinancePage() {
  const [financeData, setFinanceData] = useState<any>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/invoices/student_invoices/');
      setFinanceData(res.data);
      setInvoices(res.data?.invoices || []);
    } catch (err) {
      console.error('Failed to load student finance data', err);
      setFinanceData(null);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const totalFeeAmount = financeData?.total_fee_amount ?? 0;
  const amountPaid = financeData?.amount_paid ?? 0;
  const pendingBalance = financeData?.pending_balance ?? 0;
  const paymentCoverage = financeData?.payment_coverage ?? 100.0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
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
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <CreditCard size={24} />
            </div>
            Finance & Fees Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official fee invoices generated for your account by School Admin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-2xl text-right">
            <span className="text-xs text-emerald-700 font-bold block">Account Status</span>
            <span className="text-sm font-extrabold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 size={16} /> {pendingBalance === 0 ? 'Clear (No Balance Due)' : 'Pending Balance Due'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Total Fee Amount</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">₹{totalFeeAmount.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Total school fee invoices</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Amount Paid</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 mt-3">₹{amountPaid.toLocaleString('en-IN')}</p>
          <p className="text-xs text-emerald-700 mt-1 font-medium">{paymentCoverage}% cleared</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Pending Balance</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">₹{pendingBalance.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">Outstanding balance</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-sm font-semibold">
            <span>Payment Coverage</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-600 to-emerald-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, paymentCoverage))}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600 block text-right">{paymentCoverage}% Completed</span>
          </div>
        </div>
      </div>

      {/* Fee Invoices Table (View-Only) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt size={20} className="text-indigo-600" /> Fee Invoices
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">List of all invoices generated by your school for your current enrollment.</p>
          </div>
          <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            {invoices.length} {invoices.length === 1 ? 'Invoice' : 'Invoices'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-semibold text-sm">
            Fetching school fee invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Info size={28} className="mx-auto text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">No Invoices Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No fee invoices have been generated by School Admin for your account yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Invoice Number</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Amount Paid</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'PAID' || inv.is_paid;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold font-mono text-slate-900">{inv.invoice_number}</td>
                      <td className="py-4 px-4 font-semibold text-slate-800">{inv.description}</td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">
                          {inv.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-900">₹{inv.total_amount.toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 font-bold text-emerald-600">₹{(inv.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-4 text-xs text-slate-500">{inv.due_date || '-'}</td>

                      <td className="py-4 px-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                            <CheckCircle2 size={13} /> Paid
                          </span>
                        ) : inv.status === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-200">
                            <Clock size={13} /> Partial (₹{inv.paid_amount.toLocaleString('en-IN')} Paid)
                          </span>
                        ) : inv.status === 'OVERDUE' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-200">
                            <AlertCircle size={13} /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
                            <Clock size={13} /> Unpaid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
