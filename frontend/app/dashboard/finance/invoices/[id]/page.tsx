'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FileText, DollarSign, CreditCard, ArrowLeft, Plus, Calendar, User, AlertCircle, X, Trash2 } from 'lucide-react'
import Modal from '@/components/Modal'
import api from '@/lib/api'
import { usePermissionContext } from '@/lib/rbac-context'


interface Transaction {
  id: number
  amount: number
  payment_mode: string
  reference_id: string
  date: string
  collected_by_name: string
}

interface Invoice {
  id: number
  invoice_number: string
  student: number
  student_name: string
  student_suid: string
  total_amount: number
  paid_amount: number
  balance_due: number
  status: string
  due_date: string
  transactions: Transaction[]
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    mode: 'CASH',
    reference: ''
  })
  const [saving, setSaving] = useState(false)
  const [breakdowns, setBreakdowns] = useState<Array<{ amount: string; particulars: string }>>([{ amount: '', particulars: '' }])

  const { hasPermission, isAdmin } = usePermissionContext();
  const canDeleteInvoice = isAdmin || hasPermission('finance.generate_invoice');

  const openPaymentModal = () => {
    if (!invoice) return;
    setPaymentForm({
      amount: invoice.balance_due.toString(),
      mode: 'CASH',
      reference: ''
    });
    setBreakdowns([{ amount: '', particulars: '' }]);
    setShowPaymentModal(true);
  };

  const handleAddBreakdown = () => {
    setBreakdowns([...breakdowns, { amount: '', particulars: '' }]);
  };

  const handleRemoveBreakdown = (index: number) => {
    const next = [...breakdowns];
    next.splice(index, 1);
    setBreakdowns(next);
  };

  const handleUpdateBreakdown = (index: number, key: 'amount' | 'particulars', value: string) => {
    const next = [...breakdowns];
    next[index][key] = value;
    setBreakdowns(next);
  };

  useEffect(() => {
    fetchInvoice()
  }, [params.id])

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/finance/invoices/${params.id}/`)
      setInvoice(res.data)
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    if (!window.confirm(`Are you sure you want to delete Invoice ${invoice.invoice_number}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/finance/invoices/${invoice.id}/`);
      alert('Invoice deleted successfully!');
      router.push('/dashboard/finance');
    } catch (err: any) {
      console.error('Failed to delete invoice', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to delete invoice.';
      alert(msg);
    }
  };

  const handleRecordPayment = async () => {
    if (!invoice) return

    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const extraAmount = amount - invoice.balance_due;
    let notes = '';
    if (extraAmount > 0) {
      const validBreakdowns = breakdowns.filter(b => b.amount && b.particulars);
      if (validBreakdowns.length > 0) {
        notes = "Record of extra amount collected:\n" + 
                validBreakdowns.map(b => `- Particulars: ${b.particulars}, Amount: ₹${parseFloat(b.amount).toLocaleString()}`).join('\n');
      }
    }

    const payload = {
      ...paymentForm,
      notes: notes
    };

    setSaving(true)
    try {
      await api.post(`/finance/invoices/${params.id}/record_payment/`, payload)
      alert('Payment recorded successfully!')
      setShowPaymentModal(false)
      setPaymentForm({ amount: '', mode: 'CASH', reference: '' })
      setBreakdowns([{ amount: '', particulars: '' }])
      fetchInvoice()
    } catch (error: any) {
      console.error('Error recording payment:', error)
      const msg = error?.response?.data?.error || 'Failed to record payment';
      alert(`Error: ${msg}`)
    } finally {
      setSaving(false)
    }
  }


  const modalExtraAmount = invoice ? parseFloat(paymentForm.amount || '0') - invoice.balance_due : 0;
  const modalTotalAllocated = modalExtraAmount > 0 ? breakdowns.reduce((sum, b) => sum + (parseFloat(b.amount || '0') || 0), 0) : 0;
  const isPaymentSubmitDisabled = saving || !paymentForm.amount || (modalExtraAmount > 0 && Math.abs(modalTotalAllocated - modalExtraAmount) >= 0.01);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800'
      case 'UNPAID':
        return 'bg-orange-100 text-orange-800'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'CASH':
        return 'bg-blue-100 text-blue-800'
      case 'UPI':
        return 'bg-purple-100 text-purple-800'
      case 'CHEQUE':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const isOverdue = invoice && new Date(invoice.due_date) < new Date() && invoice.status !== 'PAID'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading invoice...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Invoice not found</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
            <p className="text-gray-600 mt-1">
              {invoice.student_name} • {invoice.student_suid}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(invoice.status)}`}>
            {invoice.status}
          </span>
          {invoice.status !== 'PAID' && (
            <button
              onClick={openPaymentModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Record Payment
            </button>
          )}
          {canDeleteInvoice && (
            <button
              onClick={handleDeleteInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm"
              title="Delete Invoice"
            >
              <Trash2 className="w-4 h-4" />
              Delete Invoice
            </button>
          )}
        </div>
      </div>


      {/* Alert for overdue */}
      {isOverdue && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">This invoice is overdue!</p>
            <p className="text-sm text-red-700 mt-1">
              Due date was {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Invoice Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(invoice.total_amount)}</p>
            </div>
            <FileText className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Paid Amount</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(invoice.paid_amount)}</p>
            </div>
            <CreditCard className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Balance Due</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(invoice.balance_due)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Due Date</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            </div>
            <Calendar className="w-10 h-10 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
        </div>

        {invoice.transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No payments recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Mode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collected By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(txn.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentModeColor(txn.payment_mode)}`}>
                        {txn.payment_mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {txn.reference_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {txn.collected_by_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Payment"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="Enter amount"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-600 mt-1">
              Balance due: {formatCurrency(invoice.balance_due)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
            <select
              value={paymentForm.mode}
              onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI / Online</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference ID {paymentForm.mode !== 'CASH' && '*'}
            </label>
            <input
              type="text"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              placeholder={paymentForm.mode === 'CHEQUE' ? 'Cheque Number' : paymentForm.mode === 'UPI' ? 'UPI Transaction ID' : 'Optional reference'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Extra Amount Breakdown Panel */}
          {modalExtraAmount > 0 && (
            <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                Record what the extra amount collected represents.
              </p>
              <div className="text-xs text-amber-700 bg-amber-100/50 p-2 rounded-lg mb-2 flex justify-between">
                <span>Extra Amount: <strong>₹{modalExtraAmount.toLocaleString()}</strong></span>
                <span>Allocated: <strong className={modalTotalAllocated > modalExtraAmount ? "text-red-600 font-bold" : "text-amber-800"}>₹{modalTotalAllocated.toLocaleString()}</strong></span>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-amber-200 text-amber-800 uppercase tracking-wider font-bold">
                      <th className="pb-2 w-1/3">Amount</th>
                      <th className="pb-2 w-7/12">Particulars</th>
                      <th className="pb-2 w-1/12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdowns.map((b, index) => (
                      <tr key={index} className="border-b border-amber-100/30">
                        <td className="py-2 pr-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                            <input
                              type="number"
                              placeholder="0"
                              className="w-full pl-5 pr-1 py-1.5 bg-white border border-gray-200 rounded outline-none focus:ring-1 focus:ring-amber-500"
                              value={b.amount}
                              onChange={e => handleUpdateBreakdown(index, 'amount', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            placeholder="Reason / Particulars"
                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded outline-none focus:ring-1 focus:ring-amber-500"
                            value={b.particulars}
                            onChange={e => handleUpdateBreakdown(index, 'particulars', e.target.value)}
                          />
                        </td>
                        <td className="py-2 text-right">
                          {breakdowns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBreakdown(index)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={handleAddBreakdown}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1 mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add more breakdowns
              </button>
              
              {Math.abs(modalTotalAllocated - modalExtraAmount) >= 0.01 && (
                <p className="text-xs text-red-600 font-medium">
                  Total breakdown amounts must exactly equal the extra amount of ₹{modalExtraAmount.toLocaleString()} (Current sum: ₹{modalTotalAllocated.toLocaleString()}).
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordPayment}
              disabled={isPaymentSubmitDisabled}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
