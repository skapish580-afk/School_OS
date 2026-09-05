'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import { 
  ArrowLeft, User, Calendar, DollarSign, Loader2, 
  CheckCircle, Clock, AlertTriangle, FileText, Receipt,
  CreditCard, History, TrendingUp, Download, IndianRupee,
  GraduationCap, Phone, Mail, ChevronRight, Building,
  Wallet, PieChart, RefreshCw, Award
} from 'lucide-react';

interface FeeInstallment {
  id: number;
  installment_number: number;
  due_date: string;
  amount: string;
  status: string;
  paid_amount: string;
  balance: string;
}

interface PaymentRecord {
  id: number;
  date: string;
  amount: string;
  mode: string;
  reference: string;
  invoice_number: string;
  notes?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  total_amount: string;
  paid_amount: string;
  balance_due: string;
  status: string;
  due_date: string;
  created_at: string;
}

export default function StudentFeeProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments' | 'installments'>('overview');

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/finance/student-fee-profile/${id}/`);
      setProfile(res.data);
    } catch (e) {
      console.error("Failed to load student fee profile", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600 font-medium">Loading Fee Profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 mb-4">Could not load fee profile for this student.</p>
          <button 
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { student, current_assignment, installments, recent_invoices, payment_history, summary } = profile;
  const studentName = student?.full_name || `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Unknown Student';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
                  {studentName[0]}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{studentName}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{student?.suid}</span>
                    {student?.current_class && (
                      <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <GraduationCap size={12} /> {student.current_class}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchProfile}
                className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              >
                <RefreshCw size={20} />
              </button>
              <Link href={`/dashboard/finance/add?student=${id}`}>
                <button className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center gap-2">
                  <Receipt size={18} /> New Invoice
                </button>
              </Link>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: PieChart },
              { id: 'invoices', label: 'Invoices', icon: FileText },
              { id: 'payments', label: student?.is_rte_student ? 'Reimbursements' : 'Payments', icon: CreditCard },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Stats Cards */}
            {student?.is_rte_student ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Fees</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-2">₹{summary?.total_fees?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                      <IndianRupee className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">RTE Fee Waiver</p>
                      <h3 className="text-2xl font-bold text-indigo-600 mt-2">₹{summary?.total_pending?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Award className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Reimbursements</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-2">₹{summary?.total_paid?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                      <Wallet className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Scheme Status</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-2">Active</h3>
                      <p className="text-xs text-gray-400 mt-1">RTE Government Scheme</p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-200">
                      <CheckCircle className="text-white" size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Fees</p>
                      <h3 className="text-2xl font-bold text-gray-900 mt-2">₹{summary?.total_fees?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                      <IndianRupee className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Paid</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-2">₹{summary?.total_paid?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                      <CheckCircle className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Pending</p>
                      <h3 className="text-2xl font-bold text-red-600 mt-2">₹{summary?.total_pending?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                      <Clock className="text-white" size={20} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Next Due</p>
                      <h3 className="text-lg font-bold text-gray-900 mt-2">
                        {summary?.next_due_date ? new Date(summary.next_due_date).toLocaleDateString() : 'N/A'}
                      </h3>
                      {summary?.next_due_amount > 0 && (
                        <p className="text-amber-600 text-sm font-semibold">₹{summary.next_due_amount.toLocaleString()}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                      <Calendar className="text-white" size={20} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Current Fee Assignment */}
            {current_assignment && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Current Fee Assignment</h3>
                </div>
                <div className="p-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-purple-50 rounded-xl p-4">
                      <p className="text-xs text-purple-600 font-semibold uppercase">Payment Schedule</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{current_assignment.fee_schedule_name}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-xs text-blue-600 font-semibold uppercase">Academic Year</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{current_assignment.academic_year_name || 'Current Year'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <p className="text-xs text-emerald-600 font-semibold uppercase">Net Payable</p>
                      <p className="text-lg font-bold text-emerald-700 mt-1">₹{parseFloat(current_assignment.net_payable || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Recent Invoices */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Recent Invoices</h3>
                  <button 
                    onClick={() => setActiveTab('invoices')}
                    className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:text-blue-700"
                  >
                    View all <ChevronRight size={16} />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {recent_invoices && recent_invoices.length > 0 ? (
                    recent_invoices.slice(0, 5).map((inv: Invoice) => (
                      <div key={inv.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-600' :
                            inv.status === 'OVERDUE' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {inv.status === 'PAID' ? <CheckCircle size={18} /> : <FileText size={18} />}
                          </div>
                          <div>
                            <p className="font-mono text-sm text-gray-600">{inv.invoice_number}</p>
                            <p className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">₹{parseFloat(inv.total_amount).toLocaleString()}</p>
                          <span className={`text-xs font-semibold ${
                            inv.status === 'PAID' ? 'text-emerald-600' :
                            inv.status === 'OVERDUE' ? 'text-red-600' :
                            'text-amber-600'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No invoices yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Payments / Reimbursements */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">
                    {student?.is_rte_student ? "Recent Reimbursements" : "Recent Payments"}
                  </h3>
                  <button 
                    onClick={() => setActiveTab('payments')}
                    className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:text-blue-700"
                  >
                    View all <ChevronRight size={16} />
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {payment_history && payment_history.length > 0 ? (
                    payment_history.slice(0, 5).map((payment: PaymentRecord) => (
                      <div key={payment.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            {student?.is_rte_student ? <Wallet size={18} /> : <CreditCard size={18} />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {student?.is_rte_student ? "State Reimbursement" : payment.mode}
                            </p>
                            <p className="text-xs text-gray-400">{new Date(payment.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">+₹{parseFloat(payment.amount).toLocaleString()}</p>
                          {payment.reference && (
                            <p className="text-xs text-gray-400 font-mono">{payment.reference}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-gray-400">
                      {student?.is_rte_student ? (
                        <>
                          <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No reimbursements yet</p>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No payments yet</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">All Invoices</h3>
            </div>
            {recent_invoices && recent_invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-xs uppercase text-gray-500 font-semibold">
                      <th className="px-6 py-4 text-left">Invoice #</th>
                      <th className="px-6 py-4 text-left">Date</th>
                      <th className="px-6 py-4 text-left">Amount</th>
                      <th className="px-6 py-4 text-left">Paid</th>
                      <th className="px-6 py-4 text-left">Due Date</th>
                      <th className="px-6 py-4 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recent_invoices.map((inv: Invoice) => (
                      <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-gray-600">{inv.invoice_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">₹{parseFloat(inv.total_amount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-emerald-600 font-semibold">₹{parseFloat(inv.paid_amount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                            inv.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                            inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-400">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No invoices found</p>
                <p className="text-sm mt-1">Create an invoice to get started</p>
              </div>
            )}
          </div>
        )}

        {/* Payments / Reimbursements Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {student?.is_rte_student ? "Reimbursement History" : "Payment History"}
              </h3>
            </div>
            {payment_history && payment_history.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {payment_history.map((payment: PaymentRecord) => (
                  <div key={payment.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        {student?.is_rte_student ? <Wallet size={20} /> : <CreditCard size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {student?.is_rte_student ? "State Reimbursement" : payment.mode}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{new Date(payment.date).toLocaleDateString()}</span>
                          {payment.invoice_number && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs font-mono text-gray-500">{payment.invoice_number}</span>
                            </>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-1.5 whitespace-pre-line font-medium leading-relaxed max-w-xs text-left">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-emerald-600">+₹{parseFloat(payment.amount).toLocaleString()}</p>
                      {payment.reference && (
                        <p className="text-xs text-gray-400 font-mono">Ref: {payment.reference}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-400">
                {student?.is_rte_student ? (
                  <>
                    <Wallet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No reimbursements recorded</p>
                    <p className="text-sm mt-1">Reimbursements will appear here once recorded</p>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No payments recorded</p>
                    <p className="text-sm mt-1">Payments will appear here once recorded</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
