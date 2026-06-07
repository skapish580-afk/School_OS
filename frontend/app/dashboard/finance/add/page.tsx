'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useSettings } from '@/lib/SettingsContext';
import { 
  ArrowLeft, Search, CheckCircle, User, 
  Calendar, DollarSign, Loader2, AlertTriangle, X, 
  Receipt, Clock, FileText, ChevronRight, Info,
  IndianRupee, Shield, History, CreditCard, AlertCircle,
  GraduationCap, Building, Check
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

interface StudentFeeProfile {
  student: any;
  current_assignment: any;
  installments: FeeInstallment[];
  recent_invoices: any[];
  payment_history: any[];
  summary: {
    total_fees: number;
    total_paid: number;
    total_pending: number;
    next_due_date: string | null;
    next_due_amount: number;
  };
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const { settings } = useSettings();
  
  // Data State
  const [students, setStudents] = useState<any[]>([]);
  const [feeCategories, setFeeCategories] = useState<any[]>([]);
  
  // Form State
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<FeeInstallment | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Student Fee Profile State
  const [feeProfile, setFeeProfile] = useState<StudentFeeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showFeeHistory, setShowFeeHistory] = useState(false);
  
  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  
  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  
  // Invoice Mode
  const [invoiceMode, setInvoiceMode] = useState<'installment' | 'custom'>('installment');

  // --- HELPER: SAFE NAME GETTER ---
  const getStudentName = (s: any) => s?.full_name || s?.user?.full_name || `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || "Unknown";

  // 1. Fetch Data
  useEffect(() => {
    const loadData = async () => {
        try {
            const [studentRes, feeRes] = await Promise.all([
                api.get('/students/'),
                api.get('/finance/categories/')
            ]);
            setStudents(Array.isArray(studentRes.data) ? studentRes.data : studentRes.data.results || []);
            setFeeCategories(Array.isArray(feeRes.data) ? feeRes.data : feeRes.data.results || []);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  // 2. Fetch Student Fee Profile when student selected
  const fetchStudentFeeProfile = useCallback(async (studentId: number) => {
    setLoadingProfile(true);
    setFeeProfile(null);
    try {
      const res = await api.get(`/finance/student-fee-profile/${studentId}/`);
      setFeeProfile(res.data);
      
      // Auto-select next unpaid installment
      if (res.data.installments) {
        const nextUnpaid = res.data.installments.find((i: FeeInstallment) => i.status !== 'PAID');
        if (nextUnpaid) {
          setSelectedInstallment(nextUnpaid);
          setDueDate(nextUnpaid.due_date);
        }
      }
    } catch (e) {
      console.error("Failed to load fee profile", e);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent?.id) {
      fetchStudentFeeProfile(selectedStudent.id);
    } else {
      setFeeProfile(null);
      setSelectedInstallment(null);
    }
  }, [selectedStudent, fetchStudentFeeProfile]);

  // 3. Check for Duplicate Invoice
  const checkDuplicate = useCallback(async () => {
    if (!selectedStudent?.id) return;
    
    setCheckingDuplicate(true);
    try {
      const res = await api.post('/finance/invoices/check_duplicate/', {
        student_id: selectedStudent.id,
        categories: selectedCategories.map(c => c.id),
        installment_id: selectedInstallment?.id
      });
      setDuplicateWarning(res.data.has_duplicate ? res.data : null);
    } catch (e) {
      console.error("Failed to check duplicate", e);
    } finally {
      setCheckingDuplicate(false);
    }
  }, [selectedStudent, selectedCategories, selectedInstallment]);

  // Check for duplicates when selection changes
  useEffect(() => {
    if (selectedStudent && (selectedCategories.length > 0 || selectedInstallment)) {
      const timer = setTimeout(checkDuplicate, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedStudent, selectedCategories, selectedInstallment, checkDuplicate]);

  // 4. SMART SEARCH LOGIC 🔍
  const filteredStudents = students.filter(s => {
    if (!search) return true;

    const query = search.toLowerCase().trim();
    const firstName = (s.first_name || '').toLowerCase();
    const lastName = (s.last_name || '').toLowerCase();
    const fullName = getStudentName(s).toLowerCase();
    const suid = (s.suid || '').toLowerCase();
    const currentClass = (s.current_class || '').toLowerCase();
    const normalizedQuery = query.replace(/[-\s]/g, '');
    const normalizedClass = currentClass.replace(/[-\s]/g, '');
    
    if (fullName.includes(query) || firstName.includes(query) || lastName.includes(query)) return true;
    if (suid.includes(query)) return true;
    if (currentClass.includes(query) || normalizedClass.includes(normalizedQuery)) return true;
    
    const gradeMatch = query.match(/^(grade\s*)?(\d+)$/i);
    if (gradeMatch && currentClass.startsWith(gradeMatch[2])) return true;
    
    const sectionMatch = query.match(/^(section\s*)?([a-z])$/i);
    if (sectionMatch && currentClass.endsWith(sectionMatch[2])) return true;
    
    return false;
  });

  // 5. Toggle Fee Selection
  const toggleCategory = (category: any) => {
      if (selectedCategories.find(c => c.id === category.id)) {
          setSelectedCategories(selectedCategories.filter(c => c.id !== category.id));
      } else {
          setSelectedCategories([...selectedCategories, category]);
      }
  };

  // 6. Calculate Total
  const totalAmount = invoiceMode === 'installment' && selectedInstallment 
    ? parseFloat(selectedInstallment.balance || selectedInstallment.amount)
    : selectedCategories.reduce((sum, cat) => sum + parseFloat(cat.amount), 0);

  // 7. Handle Submit with Confirmations
  const handleSubmitClick = () => {
    if (!selectedStudent || (!selectedInstallment && selectedCategories.length === 0) || !dueDate) {
      alert("Please select a student, fee(s), and a due date.");
      return;
    }
    
    // Check if duplicate protection is enabled and we have a warning
    if (settings?.prevent_duplicate_billing && duplicateWarning) {
      alert("Duplicate billing detected! Please resolve the existing invoice first.");
      return;
    }
    
    // Check if confirmation is required
    if (settings?.require_billing_confirmation) {
      setConfirmStep(1);
      setShowConfirmModal(true);
    } else {
      submitInvoice();
    }
  };

  const handleConfirmStep = () => {
    if (confirmStep === 1) {
      setConfirmStep(2);
    } else {
      setShowConfirmModal(false);
      submitInvoice();
    }
  };

  const submitInvoice = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        student: selectedStudent.id,
        total_amount: totalAmount,
        due_date: dueDate
      };
      
      if (invoiceMode === 'installment' && selectedInstallment) {
        payload.installment = selectedInstallment.id;
      } else {
        payload.categories = selectedCategories.map(c => c.id);
      }
      
      await api.post('/finance/invoices/', payload);
      router.push('/dashboard/finance');
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to create invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center">
        <Loader2 className="animate-spin w-12 h-12 mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
        
      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="text-emerald-600" size={22} />
                Generate Invoice
              </h1>
              <p className="text-gray-500 text-sm">Create a new fee invoice for a student</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
          {/* LEFT: MAIN FORM */}
          <div className="lg:col-span-7 space-y-6">
              
            {/* 1. Student Picker */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-blue-600"/>
                </div>
                Select Student
              </h3>
              
              {selectedStudent ? (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-white text-lg uppercase shadow-lg shadow-blue-200">
                      {getStudentName(selectedStudent)[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg">{getStudentName(selectedStudent)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-blue-600 font-mono bg-blue-100 px-2 py-0.5 rounded">{selectedStudent.suid}</span>
                        {selectedStudent.current_class && (
                          <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <GraduationCap size={12} /> {selectedStudent.current_class}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setSelectedStudent(null); setSelectedInstallment(null); setSelectedCategories([]); }}
                    className="text-sm font-bold text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search by name, SUID, or class..." 
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.slice(0, 20).map(student => (
                        <button 
                          key={student.id} 
                          onClick={() => setSelectedStudent(student)}
                          className="w-full flex items-center justify-between p-3 hover:bg-blue-50 rounded-xl transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 uppercase">
                              {getStudentName(student)[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 group-hover:text-blue-700">{getStudentName(student)}</div>
                              <div className="text-xs text-gray-400 font-mono">{student.suid}</div>
                            </div>
                          </div>
                          {student.current_class && (
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg group-hover:bg-blue-100 group-hover:text-blue-600">
                              {student.current_class}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No students found matching "{search}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Invoice Mode Toggle (only show if student has fee assignment) */}
            {selectedStudent && feeProfile?.current_assignment && (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => { setInvoiceMode('installment'); setSelectedCategories([]); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      invoiceMode === 'installment' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Calendar size={16} /> From Payment Schedule
                  </button>
                  <button
                    onClick={() => { setInvoiceMode('custom'); setSelectedInstallment(null); }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      invoiceMode === 'custom' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <DollarSign size={16} /> Custom Fee Selection
                  </button>
                </div>
              </div>
            )}

            {/* 3A. Installment Selection (if fee assignment exists) */}
            {selectedStudent && invoiceMode === 'installment' && feeProfile?.installments && feeProfile.installments.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar size={16} className="text-purple-600"/>
                  </div>
                  Select Installment
                </h3>
                
                <div className="space-y-3">
                  {feeProfile.installments.map((installment) => {
                    const isPaid = installment.status === 'PAID';
                    const isSelected = selectedInstallment?.id === installment.id;
                    const isOverdue = !isPaid && new Date(installment.due_date) < new Date();
                    
                    return (
                      <button
                        key={installment.id}
                        onClick={() => {
                          if (!isPaid) {
                            setSelectedInstallment(installment);
                            setDueDate(installment.due_date);
                          }
                        }}
                        disabled={isPaid}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          isPaid 
                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                            : isSelected
                              ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                              : isOverdue
                                ? 'border-red-200 bg-red-50 hover:border-red-300'
                                : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                            isPaid ? 'bg-emerald-100 text-emerald-600' :
                            isOverdue ? 'bg-red-100 text-red-600' :
                            isSelected ? 'bg-purple-200 text-purple-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {isPaid ? <Check size={20} /> : `Q${installment.installment_number}`}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              Installment {installment.installment_number}
                            </div>
                            <div className="text-xs text-gray-500">
                              Due: {new Date(installment.due_date).toLocaleDateString()}
                              {isOverdue && !isPaid && (
                                <span className="text-red-600 font-semibold ml-2">OVERDUE</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            ₹{parseFloat(installment.amount).toLocaleString()}
                          </div>
                          {isPaid && (
                            <span className="text-xs text-emerald-600 font-semibold">PAID</span>
                          )}
                          {!isPaid && parseFloat(installment.paid_amount) > 0 && (
                            <span className="text-xs text-amber-600 font-semibold">
                              ₹{parseFloat(installment.balance).toLocaleString()} due
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3B. Custom Fee Categories Selection */}
            {selectedStudent && (invoiceMode === 'custom' || !feeProfile?.current_assignment) && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign size={16} className="text-green-600"/>
                  </div>
                  Select Fee Categories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {feeCategories.map(cat => {
                    const isSelected = selectedCategories.find(c => c.id === cat.id);
                    return (
                      <button 
                        key={cat.id} 
                        onClick={() => toggleCategory(cat)}
                        className={`p-4 rounded-xl border-2 text-left transition-all flex justify-between items-center ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' 
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{cat.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{cat.description || "Fee category"}</div>
                        </div>
                        <div className="font-bold text-gray-900">₹{parseFloat(cat.amount).toLocaleString()}</div>
                      </button>
                    );
                  })}
                  {feeCategories.length === 0 && (
                    <div className="col-span-2 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-400 text-sm">No fee categories found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="text-amber-600" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800">Potential Duplicate Detected!</h4>
                  <p className="text-amber-700 text-sm mt-1">
                    An existing {duplicateWarning.invoice_status} invoice was found for this student with similar fees.
                    Invoice #{duplicateWarning.invoice_number} - ₹{duplicateWarning.invoice_amount}
                  </p>
                  {settings?.prevent_duplicate_billing && (
                    <p className="text-amber-600 text-xs mt-2 font-semibold">
                      ⚠️ Duplicate billing protection is enabled. You cannot proceed with this invoice.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: STUDENT FEE PROFILE & SUMMARY */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Student Fee Profile Card */}
            {selectedStudent && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <History size={18} /> Fee Profile
                    </h3>
                    <button 
                      onClick={() => setShowFeeHistory(!showFeeHistory)}
                      className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
                    >
                      {showFeeHistory ? 'Hide History' : 'Show History'}
                    </button>
                  </div>
                </div>
                
                {loadingProfile ? (
                  <div className="p-8 text-center">
                    <Loader2 className="animate-spin w-8 h-8 mx-auto text-blue-500" />
                    <p className="text-gray-500 text-sm mt-2">Loading profile...</p>
                  </div>
                ) : feeProfile ? (
                  <div className="p-6 space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-xs text-emerald-600 font-semibold">Total Paid</p>
                        <p className="text-xl font-bold text-emerald-700">₹{feeProfile.summary.total_paid.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-red-600 font-semibold">Pending</p>
                        <p className="text-xl font-bold text-red-700">₹{feeProfile.summary.total_pending.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Current Assignment */}
                    {feeProfile.current_assignment && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Current Fee Assignment</p>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800">{feeProfile.current_assignment.fee_schedule_name}</span>
                          <span className="text-sm text-gray-600">₹{parseFloat(feeProfile.current_assignment.net_payable || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Recent Invoices */}
                    {showFeeHistory && feeProfile.recent_invoices && feeProfile.recent_invoices.length > 0 && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500 font-semibold uppercase mb-3">Recent Invoices</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {feeProfile.recent_invoices.map((inv: any) => (
                            <div key={inv.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                              <div>
                                <span className="font-mono text-gray-600">{inv.invoice_number}</span>
                                <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                  inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                                  inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {inv.status}
                                </span>
                              </div>
                              <span className="font-semibold">₹{parseFloat(inv.total_amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Info className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 text-sm">No fee assignment found</p>
                    <p className="text-gray-400 text-xs">Use custom fee selection</p>
                  </div>
                )}
              </div>
            )}

            {/* Invoice Summary Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-lg sticky top-24">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Receipt size={18} className="text-emerald-600" />
                  Invoice Summary
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Student</span>
                    <span className="font-medium text-gray-900 truncate max-w-[150px]">
                      {selectedStudent ? getStudentName(selectedStudent) : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Invoice Date</span>
                    <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                    {invoiceMode === 'installment' && selectedInstallment ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Installment {selectedInstallment.installment_number}</span>
                        <span className="font-medium">₹{parseFloat(selectedInstallment.balance || selectedInstallment.amount).toLocaleString()}</span>
                      </div>
                    ) : (
                      selectedCategories.map(cat => (
                        <div key={cat.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{cat.name}</span>
                          <span className="font-medium">₹{parseFloat(cat.amount).toLocaleString()}</span>
                        </div>
                      ))
                    )}
                    {!selectedInstallment && selectedCategories.length === 0 && (
                      <div className="text-xs text-gray-400 italic text-center py-2">No fees selected</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-gray-200 pt-4">
                    <span className="font-bold text-gray-800">Total Amount</span>
                    <span className="font-bold text-2xl text-emerald-600">₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                      <input 
                        type="date" 
                        className="w-full pl-12 p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSubmitClick}
                    disabled={submitting || !selectedStudent || (!selectedInstallment && selectedCategories.length === 0) || !dueDate || (settings?.prevent_duplicate_billing && duplicateWarning)}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <><Loader2 className="animate-spin" size={20} /> Generating...</>
                    ) : checkingDuplicate ? (
                      <><Loader2 className="animate-spin" size={20} /> Checking...</>
                    ) : (
                      <><CheckCircle size={20} /> Generate Invoice</>
                    )}
                  </button>
                  
                  {settings?.require_billing_confirmation && (
                    <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                      <Shield size={12} /> Confirmation required before generation
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className={`px-6 py-5 ${confirmStep === 1 ? 'bg-amber-500' : 'bg-emerald-500'} text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {confirmStep === 1 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {confirmStep === 1 ? 'Confirm Invoice Details' : 'Final Confirmation'}
                    </h3>
                    <p className="text-white/80 text-sm">Step {confirmStep} of 2</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Student</span>
                  <span className="font-bold text-gray-900">{getStudentName(selectedStudent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-bold text-emerald-600 text-xl">₹{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Due Date</span>
                  <span className="font-bold text-gray-900">{new Date(dueDate).toLocaleDateString()}</span>
                </div>
              </div>

              {confirmStep === 1 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-800 text-sm">
                    <strong>Please verify</strong> that all invoice details are correct. 
                    This invoice will be recorded in the system.
                  </p>
                </div>
              )}

              {confirmStep === 2 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-emerald-800 text-sm">
                    <strong>Final step!</strong> Click confirm to generate the invoice. 
                    This action cannot be undone.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStep}
                  className={`flex-1 py-3 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                    confirmStep === 1 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'bg-emerald-500 hover:bg-emerald-600'
                  }`}
                >
                  {confirmStep === 1 ? (
                    <>Proceed <ChevronRight size={18} /></>
                  ) : (
                    <><CheckCircle size={18} /> Confirm & Generate</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}