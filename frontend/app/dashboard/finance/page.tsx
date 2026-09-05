'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { 
  Plus, Search, DollarSign, CreditCard, FileText, CheckCircle, Clock, 
  AlertCircle, Loader2, X, Users, TrendingUp, Calendar, Receipt,
  ChevronRight, Filter, Eye, Settings, IndianRupee, Wallet, PieChart,
  AlertTriangle, ArrowRight, GraduationCap, Building, BookOpen, History,
  Award, Percent, Banknote, LayoutGrid, Trash2, Minus
} from 'lucide-react';
import PermissionGate, { IfPermission } from '@/components/PermissionGate';
import { useResourcePermissions, usePermissionContext } from '@/lib/rbac-context';
import { useSettings } from '@/lib/SettingsContext';
import { toast } from 'react-hot-toast';

// Helper function to format currency in a compact way (L for Lakhs, Cr for Crores)
const formatCurrency = (amount: number, compact = false): string => {
  if (compact) {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(2)}L`;
  }
  return amount.toLocaleString('en-IN');
};

interface Ledger {
  id: string;
  student: string;
  student_name: string;
  student_suid: string;
  grade_name: string;
  academic_year: string;
  total_charges: string;
  total_payments: string;
  current_balance: string;
  total_fines?: string;
  is_cleared: boolean;
  is_rte_student?: boolean;
  total_reimbursements?: number;
}

interface DashboardData {
  total_students: number;
  students_assigned: number;
  total_fee_assigned: string;
  total_collected: string;
  total_outstanding: string;
  collection_rate: string;
  pending_invoices: number;
  overdue_invoices: number;
  pending_discounts: number;
  monthly_collection: Array<{month: string; total: string}>;
  collection_by_category: Array<{category: string; total: string}>;
  grade_wise_collection: Array<{grade: string; total_charges: string; total_payments: string}>;
}

export default function FinancePage() {
  const { settings, formatAcademicYear } = useSettings();
  const currentAcademicYear = settings?.current_academic_year || '';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [schoolId, setSchoolId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'ledgers' | 'assignments' | 'schedules' | 'structures' | 'salary'>('overview');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ledgerGradeFilter, setLedgerGradeFilter] = useState('ALL');
  const [ledgerYearFilter, setLedgerYearFilter] = useState('ALL');
  
  // RBAC Permissions
  const { hasPermission, isAdmin } = usePermissionContext();

  const { canView: canViewInvoices, canCreate, canEdit } = useResourcePermissions('finance', 'invoice');
  const { canCreate: canRecordPayment } = useResourcePermissions('finance', 'payment');
  const canCollectFee = hasPermission('finance.collect_fee');

  const canViewOverview = hasPermission('finance.view_overview');
  const canGenerateInvoice = hasPermission('finance.generate_invoice');
  const canManageCategories = hasPermission('finance.manage_categories');
  const canBulkAssign = hasPermission('finance.bulk_assign');
  const canAllocatePlan = hasPermission('finance.allocate_plan');
  const canApplyLateFees = hasPermission('finance.apply_late_fees');

  const canViewLedgers = hasPermission('finance.view_ledger');
  const canViewStructures = hasPermission('finance.view_fee_structure');
  const canViewAssignments = hasPermission('finance.view_fee_assignment');
  const canViewSchedules = hasPermission('finance.view_fee_schedule');
  const canViewSalary = hasPermission('finance.view_salary');
  const canManageSchedules = hasPermission('finance.edit_fee_schedule');

  const tabs = [
    ...(canViewOverview ? [{ id: 'overview', label: 'Overview', icon: PieChart }] : []),
    ...(canViewLedgers ? [{ id: 'ledgers', label: 'Student Ledgers', icon: BookOpen }] : []),
    ...(canViewStructures ? [{ id: 'structures', label: 'Fee Packages', icon: LayoutGrid }] : []),
    ...(canViewInvoices ? [{ id: 'invoices', label: 'Invoices', icon: FileText }] : []),
    ...(canViewAssignments ? [{ id: 'assignments', label: 'Fee Assignments', icon: Users }] : []),
    ...(canViewSchedules ? [{ id: 'schedules', label: 'Payment Plans', icon: Calendar }] : []),
    ...(canViewSalary ? [{ id: 'salary', label: 'Salary', icon: Banknote }] : []),
  ];

  useEffect(() => {
    if (!loading && tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id as any);
    }
  }, [loading, tabs, activeTab]);
  
  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', mode: 'CASH', reference: '' });
  const [breakdowns, setBreakdowns] = useState<Array<{ amount: string; particulars: string }>>([{ amount: '', particulars: '' }]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<any>(null);
  const [showViewStructureModal, setShowViewStructureModal] = useState(false);
  
  // Schedule Creation States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ name: '', installments: '' });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  
  // Bulk Assign States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [newStructure, setNewStructure] = useState({
    name: '',
    grade: '',
    academic_year: currentAcademicYear,
    tuition_fee: 0,
    admission_fee: 0,
    exam_fee: 0,
    lab_fee: 0,
    library_fee: 0,
    sports_fee: 0,
    computer_fee: 0,
    transport_fee: 0,
    misc_fee: 0,
    development_fee: 0
  });

  const [grades, setGrades] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [bulkForm, setBulkForm] = useState({
    grade_id: '',
    section_id: '',
    fee_structure_id: '',
    fee_schedule_id: '',
    academic_year: currentAcademicYear,
    override_existing: false
  });
  const [bulkLoadingData, setBulkLoadingData] = useState(false);
  const [showLateFeeModal, setShowLateFeeModal] = useState(false);
  const [lateFeeLoading, setLateFeeLoading] = useState(false);
  const [lateFeeForm, setLateFeeForm] = useState({
    grade_id: '',
    late_fee_amount: ''
  });
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);

  // === Concession & RTE Reimbursement State ===
  const [concessionStepActive, setConcessionStepActive] = useState(false);
  const [concessionSelections, setConcessionSelections] = useState<Record<string, string>>({});
  const [showReimbursementModal, setShowReimbursementModal] = useState(false);
  const [reimbursementTarget, setReimbursementTarget] = useState<any>(null);
  const [reimbursementForm, setReimbursementForm] = useState({
    amount: '',
    date_received: '',
    mode_of_payment: 'BANK_TRANSFER',
    transaction_id: ''
  });
  const [reimbursementLoading, setReimbursementLoading] = useState(false);
  const [reimbursementError, setReimbursementError] = useState('');

  // === Allocate Payment Structure State ===
  const [showAllocateStructureModal, setShowAllocateStructureModal] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    grade_id: '',
    section_id: '',
    fee_schedule_id: '',
    student_id: 'ALL',
    academic_year: currentAcademicYear,
    override_existing: false
  });
  const [installmentStepActive, setInstallmentStepActive] = useState(false);
  const [customInstallments, setCustomInstallments] = useState<{amount: string, due_date: string}[]>([]);
  const [allocatedYearStudents, setAllocatedYearStudents] = useState<any[]>([]);
  const [bulkYearStudents, setBulkYearStudents] = useState<any[]>([]);
  const [concessionSummaryInfo, setConcessionSummaryInfo] = useState<{
    totalPackageFee: number;
    concessionAmount: number;
    netPayable: number;
    studentName?: string;
  } | null>(null);

  useEffect(() => {
    const activeSchoolId = schoolId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('school') : null);
    if (allocateForm.academic_year) {
      const params: any = { status: 'ACTIVE', academic_year: allocateForm.academic_year };
      if (activeSchoolId) params.school = activeSchoolId;
      api.get('/students/', { params }).then(res => {
        setAllocatedYearStudents(Array.isArray(res.data) ? res.data : res.data.results || []);
      }).catch(() => setAllocatedYearStudents([]));
    } else {
      setAllocatedYearStudents(allStudents);
    }
  }, [allocateForm.academic_year, schoolId, allStudents]);

  useEffect(() => {
    const activeSchoolId = schoolId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('school') : null);
    if (bulkForm.academic_year) {
      const params: any = { status: 'ACTIVE', academic_year: bulkForm.academic_year };
      if (activeSchoolId) params.school = activeSchoolId;
      api.get('/students/', { params }).then(res => {
        setBulkYearStudents(Array.isArray(res.data) ? res.data : res.data.results || []);
      }).catch(() => setBulkYearStudents([]));
    } else {
      setBulkYearStudents(allStudents);
    }
  }, [bulkForm.academic_year, schoolId, allStudents]);

  // === Salary Tab State ===
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [deductTarget, setDeductTarget] = useState<any>(null);
  const [deductForm, setDeductForm] = useState({ amount: '', description: '' });
  const [deductLoading, setDeductLoading] = useState(false);
  const [deductError, setDeductError] = useState('');
  const [deductions, setDeductions] = useState<any[]>([]);
  const [salarySearch, setSalarySearch] = useState('');
  useEffect(() => {
    // First fetch school ID, then fetch all data
    const initializePage = async () => {
      try {
        const settingsRes = await api.get('/schools/settings/my_settings/');
        const fetchedSchoolId = settingsRes.data.school || '';
        setSchoolId(fetchedSchoolId);
        await fetchAllData(fetchedSchoolId);
      } catch (error) {
        console.error('Error fetching school settings:', error);
        setLoading(false);
      }
    };
    initializePage();
  }, []);

  // Fetch staff when salary tab is active or month changes
  useEffect(() => {
    if (activeTab !== 'salary') return;
    const fetchStaff = async () => {
      setStaffLoading(true);
      try {
        const [teachersRes, deductRes] = await Promise.all([
          api.get('/teachers/profiles/'),
          api.get(`/finance/salary-deductions/?month=${salaryMonth}`),
        ]);
        const teachers = teachersRes.data.results || teachersRes.data || [];
        setStaffList(Array.isArray(teachers) ? teachers : []);
        const deductList = deductRes.data.results || deductRes.data || [];
        setDeductions(Array.isArray(deductList) ? deductList : []);
      } catch (err) {
        console.error('Failed to fetch staff or deductions', err);
      } finally {
        setStaffLoading(false);
      }
    };
    fetchStaff();
  }, [activeTab, salaryMonth]);

  const fetchAllData = async (schoolIdParam?: string) => {
    const currentSchoolId = schoolIdParam || schoolId;
    if (!currentSchoolId) {
      setLoading(false);
      return;
    }
    try {
      const [invoicesRes, assignmentsRes, schedulesRes, ledgersRes, dashboardRes, gradesRes, structuresRes, academicYearsRes, studentsRes] = await Promise.all([
        api.get('/finance/invoices/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/finance/assignments/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/finance/schedules/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/finance/ledgers/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/finance/dashboard/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/academics/grades/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/finance/structures/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/enrollments/academic-years/', { params: { school: currentSchoolId } }).catch(() => null),
        api.get('/students/', { params: { school: currentSchoolId, status: 'ACTIVE' } }).catch(() => null)
      ]);
      if (invoicesRes) setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : invoicesRes.data.results || []);
      if (assignmentsRes) setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : assignmentsRes.data.results || []);
      if (schedulesRes) setSchedules(Array.isArray(schedulesRes.data) ? schedulesRes.data : schedulesRes.data.results || []);
      if (ledgersRes) setLedgers(Array.isArray(ledgersRes.data) ? ledgersRes.data : ledgersRes.data.results || []);
      if (dashboardRes) setDashboardData(dashboardRes.data);
      if (gradesRes) setGrades(Array.isArray(gradesRes.data) ? gradesRes.data : gradesRes.data.results || []);
      if (structuresRes) setFeeStructures(Array.isArray(structuresRes.data) ? structuresRes.data : structuresRes.data.results || []);
      if (academicYearsRes) setAcademicYears(Array.isArray(academicYearsRes.data) ? academicYearsRes.data : academicYearsRes.data.results || []);
      if (studentsRes) setAllStudents(Array.isArray(studentsRes.data) ? studentsRes.data : studentsRes.data.results || []);
    } catch (e) {
      console.error("Failed to load finance data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBreakdown = () => {
    setBreakdowns([...breakdowns, { amount: '', particulars: '' }]);
  };

  const getScheduleTypeFromInstallments = (installments: number): string => {
    switch (installments) {
      case 1: return 'YEARLY';
      case 2: return 'HALF_YEARLY';
      case 4: return 'QUARTERLY';
      case 6: return 'BI_MONTHLY';
      case 12: return 'MONTHLY';
      default: return 'CUSTOM';
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.name || !scheduleForm.installments) return;
    setScheduleLoading(true);
    try {
      const installmentsNum = parseInt(scheduleForm.installments);
      const scheduleType = getScheduleTypeFromInstallments(installmentsNum);
      
      const payload = {
        school: schoolId,
        name: scheduleForm.name,
        installments_per_year: installmentsNum,
        schedule_type: scheduleType,
        description: `${scheduleForm.name} with ${installmentsNum} installments per year.`,
        is_active: true,
      };
      
      const res = await api.post('/finance/schedules/', payload);
      setSchedules([...schedules, res.data]);
      setShowScheduleModal(false);
      setScheduleForm({ name: '', installments: '' });
      toast.success('Payment plan created successfully!');
    } catch (err) {
      console.error("Failed to create payment plan", err);
      toast.error("Failed to create payment plan. Please check inputs.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Are you sure you want to delete the payment plan "${scheduleName}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/finance/schedules/${scheduleId}/`);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      toast.success(`Payment plan "${scheduleName}" deleted successfully.`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete payment plan.';
      toast.error(msg);
    }
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

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    setPaymentLoading(true);
    try {
      const extraAmount = parseFloat(paymentForm.amount || '0') - parseFloat(selectedInvoice.balance_due || '0');
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
      await api.post(`/finance/invoices/${selectedInvoice.id}/record_payment/`, payload);
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', mode: 'CASH', reference: '' });
      setBreakdowns([{ amount: '', particulars: '' }]);
      fetchAllData();
    } catch (e) {
      alert("Failed to record payment.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCreateStructure = async () => {
    if (!newStructure.name.trim()) {
      alert('Please enter a Package Name.');
      return;
    }
    if (!newStructure.grade) {
      alert('Please select a Target Grade.');
      return;
    }
    if (!newStructure.academic_year) {
      alert('Please select an Academic Year.');
      return;
    }

    setStructureLoading(true);
    try {
      if (isEditMode && editingStructureId) {
        await api.patch(`/finance/structures/${editingStructureId}/`, {
          ...newStructure,
          school: schoolId
        });
        alert('Fee package updated successfully!');
      } else {
        await api.post('/finance/structures/', {
          ...newStructure,
          school: schoolId
        });
        alert('Fee package created successfully!');
      }
      
      setShowStructureModal(false);
      // Reset form
      setNewStructure({
        name: '',
        grade: '',
        academic_year: academicYears.length > 0 ? academicYears[0].year_code : '',
        tuition_fee: 0, admission_fee: 0, exam_fee: 0, lab_fee: 0,
        library_fee: 0, sports_fee: 0, computer_fee: 0, transport_fee: 0,
        misc_fee: 0, development_fee: 0
      });
      setIsEditMode(false);
      setEditingStructureId(null);
      fetchAllData();
    } catch (e: any) {
      const errData = e.response?.data;
      if (errData && typeof errData === 'object') {
        // Show field-level errors from DRF
        const messages = Object.entries(errData)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n');
        alert(`Validation Error:\n${messages}`);
      } else {
        alert('Failed to create fee package.');
      }
    } finally {
      setStructureLoading(false);
    }
  };

  const handleDeleteStructure = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the fee package "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/finance/structures/${id}/`);
      alert('Fee package deleted successfully!');
      fetchAllData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete fee package. It might be assigned to students.');
    }
  };

  // Filter students when grade or academic year changes
  useEffect(() => {
    const base = bulkYearStudents.length > 0 || bulkForm.academic_year ? bulkYearStudents : allStudents;
    if (!bulkForm.grade_id) {
      setFilteredStudents(base);
    } else {
      setFilteredStudents(base.filter(s => s.grade_config === bulkForm.grade_id));
    }
    
    // Auto-select structure for the grade
    const gradeStructure = feeStructures.find(fs => fs.grade === bulkForm.grade_id);
    if (gradeStructure) {
      setBulkForm(prev => ({ ...prev, fee_structure_id: gradeStructure.id }));
    } else {
      setBulkForm(prev => ({ ...prev, fee_structure_id: '' }));
    }
  }, [bulkForm.grade_id, bulkYearStudents, allStudents, feeStructures, bulkForm.academic_year]);

  const handleBulkAssign = async () => {
    if (!bulkForm.academic_year) {
      alert("Please select an Academic Year.");
      return;
    }

    let finalStructureId = bulkForm.fee_structure_id;
    if (!finalStructureId) {
      const gradeStructure = feeStructures.find(fs => fs.grade === bulkForm.grade_id);
      if (gradeStructure) {
        finalStructureId = gradeStructure.id;
      } else if (feeStructures.length > 0) {
        finalStructureId = feeStructures[0].id;
      }
    }

    if (!finalStructureId) {
      alert("No Fee Structure found for the selected Grade. Please create a Fee Package first.");
      return;
    }

    // Identify target students and filter those with fee concessions
    const base = bulkYearStudents.length > 0 || bulkForm.academic_year ? bulkYearStudents : allStudents;
    const targetStudents = (bulkForm as any).student_id && (bulkForm as any).student_id !== 'ALL'
      ? base.filter(s => s.id === (bulkForm as any).student_id)
      : (bulkForm.grade_id ? base.filter(s => s.grade_config === bulkForm.grade_id) : base);

    const concessionStudents = targetStudents.filter(s => s.fee_concession_applicable && parseFloat(s.fee_concession_amount) > 0);

    if (concessionStudents.length > 0 && !concessionStepActive) {
      setConcessionStepActive(true);
      // Auto-select tuition_fee for each concession student
      const initialSelections: Record<string, string> = {};
      concessionStudents.forEach(student => {
        initialSelections[student.id] = 'tuition_fee';
      });
      setConcessionSelections(initialSelections);
      return;
    }

    setBulkLoadingData(true);
    try {
      const studentId = (bulkForm as any).student_id;
      const payload: any = {
        fee_structure_id: finalStructureId,
        academic_year: bulkForm.academic_year,
        override_existing: bulkForm.override_existing,
        concession_selections: concessionSelections
      };
      
      // Only include grade_id if a specific grade is selected
      if (bulkForm.grade_id) {
        payload.grade_id = bulkForm.grade_id;
      }
      
      // Only include student_ids if a specific student is selected
      if (studentId && studentId !== 'ALL') {
        payload.student_ids = [studentId];
      }
      
      console.log('Bulk assign payload:', JSON.stringify(payload, null, 2));
      await api.post('/finance/assignments/bulk_assign/', payload);
      alert("Bulk assignment completed successfully!");
      setShowBulkModal(false);
      setConcessionStepActive(false);
      fetchAllData();
    } catch (e: any) {
      console.error('Bulk assign error:', e.response?.data);
      alert("Failed to perform bulk assignment.");
    } finally {
      setBulkLoadingData(false);
    }
  };

  const handleAllocateStructure = async () => {
    if (!allocateForm.academic_year) {
      alert("Please select an Academic Year.");
      return;
    }
    if (!allocateForm.fee_schedule_id) {
      alert("Please select a Payment Structure.");
      return;
    }

    // Find the selected schedule object by UUID
    const selectedSchedule = schedules.find(s => s.id === allocateForm.fee_schedule_id);
    const scheduleType = selectedSchedule?.schedule_type || 'YEARLY';
    const N = selectedSchedule?.installments_per_year || 1;

    if (scheduleType !== 'YEARLY' && !installmentStepActive) {
      // Switch to custom installments view/step
      setInstallmentStepActive(true);

      // Pre-populate dates based on schedule type
      const startYear = parseInt(allocateForm.academic_year.split('-')[0]) || new Date().getFullYear();
      const dates: string[] = [];
      if (scheduleType === 'MONTHLY') {
        for (let i = 0; i < 12; i++) {
          const d = new Date(startYear, 3 + i, 15);
          dates.push(d.toISOString().split('T')[0]);
        }
      } else if (scheduleType === 'QUARTERLY') {
        for (let i = 0; i < 4; i++) {
          const d = new Date(startYear, 3 + (i * 3), 15);
          dates.push(d.toISOString().split('T')[0]);
        }
      } else if (scheduleType === 'HALF_YEARLY') {
        dates.push(new Date(startYear, 3, 15).toISOString().split('T')[0]);
        dates.push(new Date(startYear, 9, 15).toISOString().split('T')[0]);
      } else if (scheduleType === 'BI_MONTHLY') {
        for (let i = 0; i < 6; i++) {
          const d = new Date(startYear, 3 + (i * 2), 15);
          dates.push(d.toISOString().split('T')[0]);
        }
      } else {
        // CUSTOM or any unknown type - generate N evenly spaced installments
        for (let i = 0; i < N; i++) {
          const monthOffset = Math.floor((i * 12) / N);
          const d = new Date(startYear, 3 + monthOffset, 15);
          dates.push(d.toISOString().split('T')[0]);
        }
      }

      // Pre-populate amounts
      let targetStudent: any = null;
      if (allocateForm.student_id && allocateForm.student_id !== 'ALL') {
        targetStudent = allocatedYearStudents.find(s => String(s.id) === String(allocateForm.student_id)) 
                     || allStudents.find(s => String(s.id) === String(allocateForm.student_id));
      }

      const targetGradeId = allocateForm.grade_id || (targetStudent ? (targetStudent.grade_config || targetStudent.grade_config_id) : '');

      let struct = feeStructures.find(fs => String(fs.grade) === String(targetGradeId) || String(fs.grade_id) === String(targetGradeId));
      if (!struct && feeStructures.length > 0) {
        struct = feeStructures[0];
      }
      const total = struct ? parseFloat(struct.total_annual_fee) : 0;

      // Check if target student has a fee concession!
      let concession = 0;
      let targetName = '';
      if (targetStudent) {
        targetName = targetStudent.full_name || targetStudent.suid;
        if (targetStudent.fee_concession_applicable && parseFloat(targetStudent.fee_concession_amount) > 0) {
          concession = parseFloat(targetStudent.fee_concession_amount);
        }
      }

      const netPayable = Math.max(0, total - concession);
      const amtPerInstallment = netPayable > 0 ? (netPayable / N).toFixed(2) : '0';

      setConcessionSummaryInfo({
        totalPackageFee: total,
        concessionAmount: concession,
        netPayable: netPayable,
        studentName: targetName
      });

      const prepopulated = dates.map(dateStr => ({
        amount: amtPerInstallment,
        due_date: dateStr
      }));
      setCustomInstallments(prepopulated);
      return;
    }

    if (scheduleType !== 'YEARLY' && installmentStepActive) {
      const currentTotal = customInstallments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
      const maxAllowed = concessionSummaryInfo ? concessionSummaryInfo.netPayable : 0;

      if (customInstallments.some(inst => (parseFloat(inst.amount) || 0) < 0)) {
        alert("Installment amounts cannot be negative.");
        return;
      }

      if (maxAllowed > 0 && currentTotal > maxAllowed + 0.05) {
        alert(`The total of all installments (₹${currentTotal.toFixed(2)}) cannot exceed the net payable amount (₹${maxAllowed.toFixed(2)}). Please adjust the installment amounts.`);
        return;
      }
    }

    setStructureLoading(true);
    try {
      const payload: any = {
        fee_schedule: allocateForm.fee_schedule_id,
        schedule_type: scheduleType,
        academic_year: allocateForm.academic_year,
        override_existing: allocateForm.override_existing,
        custom_installments: scheduleType !== 'YEARLY' ? customInstallments.map(c => ({
          amount: parseFloat(c.amount) || 0,
          due_date: c.due_date
        })) : []
      };
      
      if (allocateForm.grade_id) {
        payload.grade_id = allocateForm.grade_id;
      }
      
      if (allocateForm.student_id && allocateForm.student_id !== 'ALL') {
        payload.student_ids = [allocateForm.student_id];
      }
      
      await api.post('/finance/assignments/bulk_allocate_schedule/', payload);
      alert("Payment structures allocated successfully!");
      setShowAllocateStructureModal(false);
      setInstallmentStepActive(false);
      fetchAllData();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to allocate payment structures.");
    } finally {
      setStructureLoading(false);
    }
  };

  const handleApplyLateFee = async () => {
    if (!lateFeeForm.grade_id) {
      alert("Please select a Grade.");
      return;
    }
    if (!lateFeeForm.late_fee_amount || parseFloat(lateFeeForm.late_fee_amount) <= 0) {
      alert("Please enter a positive late fee amount.");
      return;
    }

    setLateFeeLoading(true);
    try {
      const payload = {
        grade_id: lateFeeForm.grade_id,
        late_fee_amount: parseFloat(lateFeeForm.late_fee_amount)
      };
      
      const response = await api.post('/finance/invoices/apply_grade_late_fee/', payload);
      alert(response.data.message || `Successfully applied late fee of ₹${payload.late_fee_amount}.`);
      setShowLateFeeModal(false);
      setLateFeeForm({ grade_id: '', late_fee_amount: '' });
      fetchAllData();
    } catch (e: any) {
      console.error('Apply late fee error:', e.response?.data);
      const errMsg = e.response?.data?.error || "Failed to apply late fees.";
      alert(errMsg);
    } finally {
      setLateFeeLoading(false);
    }
  };

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentForm({ amount: invoice.balance_due, mode: 'CASH', reference: '' }); 
    setBreakdowns([{ amount: '', particulars: '' }]);
    setShowPaymentModal(true);
  };

  const handleDeleteInvoice = async (inv: any) => {
    if (!window.confirm(`Are you sure you want to delete Invoice ${inv.invoice_number}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/finance/invoices/${inv.id}/`);
      alert('Invoice deleted successfully!');
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
    } catch (err: any) {
      console.error('Failed to delete invoice', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to delete invoice.';
      alert(msg);
    }
  };


  const totalCollected = invoices.reduce((sum, inv) => sum + (parseFloat(inv.paid_amount) || 0), 0);
  const modalExtraAmount = selectedInvoice ? parseFloat(paymentForm.amount || '0') - parseFloat(selectedInvoice.balance_due || '0') : 0;
  const modalTotalAllocated = modalExtraAmount > 0 ? breakdowns.reduce((sum, b) => sum + (parseFloat(b.amount || '0') || 0), 0) : 0;
  const isPaymentSubmitDisabled = paymentLoading || !paymentForm.amount || (modalExtraAmount > 0 && Math.abs(modalTotalAllocated - modalExtraAmount) >= 0.01);
  const totalPending = invoices.filter(i => (i.effective_status ?? i.status) === 'UNPAID').reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
  const overdueInvoicesCount = invoices.filter(inv => (inv.effective_status ?? inv.status) === 'OVERDUE').length;
  const totalOverdueSum = invoices.filter(i => (i.effective_status ?? i.status) === 'OVERDUE').reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0);
  const totalStudentsAssigned = new Set(ledgers.map(l => l.student)).size;
  const collectionRateValue = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : 0;

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      (inv.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.student_suid || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || (inv.effective_status ?? inv.status) === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center">
        <Loader2 className="animate-spin w-12 h-12 mx-auto text-blue-600 mb-4" />
        <p className="text-gray-600 font-medium">Loading Financial Data...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
      
      {/* ===== HEADER ===== */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                  <IndianRupee className="text-white" size={20} />
                </div>
                Finance Management
              </h1>
              <p className="text-gray-500 text-sm mt-1">Manage fees, invoices, and payments</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link href="/dashboard/settings">
                <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                  <Settings size={20} />
                </button>
              </Link>
              
              {canCreate && (
                <Link href="/dashboard/finance/add">
                  <button className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center gap-2">
                    <Plus size={18} /> New Invoice
                  </button>
                </Link>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${
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
        
        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && canViewOverview && (
          <div className="space-y-8">
            
            {/* Stats Grid - Using Dashboard Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Total Collected */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Total Collected</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2 truncate" title={`₹${formatCurrency(totalCollected)}`}>
                      ₹{formatCurrency(totalCollected, true)}
                    </h3>
                    <p className="text-emerald-600 text-sm font-medium mt-1 flex items-center gap-1">
                      <TrendingUp size={14} /> {collectionRateValue}% collection rate
                    </p>
                  </div>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                    <Wallet className="text-white" size={20} />
                  </div>
                </div>
              </div>

              {/* Pending Dues */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Pending Dues</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2 truncate" title={`₹${formatCurrency(totalPending)}`}>
                      ₹{formatCurrency(totalPending, true)}
                    </h3>
                    <p className="text-amber-600 text-sm font-medium mt-1 flex items-center gap-1">
                      <Clock size={14} /> {invoices.filter(i => (i.effective_status ?? i.status) === 'UNPAID').length} invoices pending
                    </p>
                  </div>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 flex-shrink-0">
                    <Clock className="text-white" size={20} />
                  </div>
                </div>
              </div>

              {/* Students Assigned */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Students Assigned</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2">{totalStudentsAssigned}</h3>
                    <p className="text-blue-600 text-sm font-medium mt-1 flex items-center gap-1">
                      <Users size={14} /> With fee schedules
                    </p>
                  </div>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
                    <Users className="text-white" size={20} />
                  </div>
                </div>
              </div>

              {/* Overdue */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Overdue Invoices</p>
                    <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-2 truncate" title={`₹${formatCurrency(totalOverdueSum)}`}>
                      ₹{formatCurrency(totalOverdueSum, true)}
                    </h3>
                    <p className="text-red-600 text-sm font-medium mt-1 flex items-center gap-1">
                      <AlertTriangle size={14} /> {overdueInvoicesCount} require attention
                    </p>
                  </div>
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 flex-shrink-0">
                    <AlertTriangle className="text-white" size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              
              {canGenerateInvoice && (
                <Link href="/dashboard/finance/add">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white hover:shadow-xl hover:shadow-emerald-200/50 transition-all cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Generate Invoice</h3>
                        <p className="text-emerald-100 text-sm mt-1">Create new invoice for student</p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <Receipt size={24} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-emerald-100 text-sm font-medium">
                      Get started <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )}

              {canManageCategories && (
                <Link href="/dashboard/finance/categories">
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">Fee Categories</h3>
                        <p className="text-gray-500 text-sm mt-1">Manage tuition, lab, transport fees</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <DollarSign size={24} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-blue-600 text-sm font-medium">
                      Configure <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )}

              {/* Bulk Assign Fees */}
              {canBulkAssign && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer group"
                     onClick={() => {
                       setBulkForm({
                         grade_id: '',
                         section_id: '',
                         fee_structure_id: '',
                         fee_schedule_id: '',
                         academic_year: academicYears.length > 0 ? academicYears[0].year_code : currentAcademicYear,
                         override_existing: false
                       });
                       setConcessionStepActive(false);
                       setConcessionSelections({});
                       setShowBulkModal(true);
                     }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Bulk Assign Fees</h3>
                      <p className="text-gray-500 text-sm mt-1">Assign fee packages to students</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
                      <GraduationCap size={24} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-purple-600 text-sm font-medium">
                    Assign now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}

              {/* Allocate Payment Structure */}
              {canAllocatePlan && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group"
                     onClick={() => {
                       setAllocateForm({
                         grade_id: '',
                         section_id: '',
                         fee_schedule_id: '',
                         student_id: 'ALL',
                         academic_year: academicYears.length > 0 ? academicYears[0].year_code : currentAcademicYear,
                         override_existing: false
                       });
                       setShowAllocateStructureModal(true);
                     }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Allocate Payment Plan</h3>
                      <p className="text-gray-500 text-sm mt-1">Assign installment schedules to students</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <Calendar size={24} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-blue-600 text-sm font-medium">
                    Allocate now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}

              {/* Bulk Apply Late Fee */}
              {canApplyLateFees && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-rose-300 hover:shadow-lg transition-all cursor-pointer group"
                     onClick={() => setShowLateFeeModal(true)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Apply Late Fees</h3>
                      <p className="text-gray-500 text-sm mt-1">Apply late fee to overdue grade invoices</p>
                    </div>
                    <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                      <Clock size={24} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-rose-600 text-sm font-medium">
                    Set amount <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}
            </div>

            {/* Recent Invoices Preview */}
            {canViewInvoices && (
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
                  {invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          (inv.effective_status ?? inv.status) === 'PAID' ? 'bg-emerald-100 text-emerald-600' :
                          (inv.effective_status ?? inv.status) === 'OVERDUE' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {(inv.effective_status ?? inv.status) === 'PAID' ? <CheckCircle size={20} /> : <Clock size={20} />}
                        </div>
                      <div>
                        <p className="font-semibold text-gray-900">{inv.student_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{inv.invoice_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{parseFloat(inv.total_amount).toLocaleString()}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        (inv.effective_status ?? inv.status) === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                        (inv.effective_status ?? inv.status) === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                        (inv.effective_status ?? inv.status) === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.effective_status ?? inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        )}

        {/* ===== INVOICES TAB ===== */}
        {activeTab === 'invoices' && canViewInvoices && (
          <div className="space-y-6">
            
            {/* Filters Bar */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by student name, SUID, or invoice #..." 
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                  {['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'].map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        statusFilter === status 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Invoice Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">No invoices found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-xs uppercase text-gray-500 font-semibold">
                        <th className="px-6 py-4 text-left">Invoice</th>
                        <th className="px-6 py-4 text-left">Student</th>
                        <th className="px-6 py-4 text-left">Amount</th>
                        <th className="px-6 py-4 text-left">Paid</th>
                        <th className="px-6 py-4 text-left">Due Date</th>
                        <th className="px-6 py-4 text-left">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm text-gray-600">{inv.invoice_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <Link href={`/dashboard/finance/student/${inv.student}`}>
                              <div className="hover:text-blue-600 cursor-pointer">
                                <p className="font-semibold text-gray-900">{inv.student_name || "Unknown"}</p>
                                <p className="text-xs text-gray-400 font-mono">{inv.student_suid}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">
                            ₹{parseFloat(inv.total_amount).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-emerald-600 font-semibold">
                            ₹{parseFloat(inv.paid_amount).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                              (inv.effective_status ?? inv.status) === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                              (inv.effective_status ?? inv.status) === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                              (inv.effective_status ?? inv.status) === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {inv.effective_status ?? inv.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(inv.effective_status ?? inv.status) !== 'PAID' && (canCollectFee || canRecordPayment) && (
                                <button 
                                  onClick={() => openPaymentModal(inv)}
                                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center gap-1.5"
                                >
                                  <CreditCard size={14} /> Collect
                                </button>
                              )}
                              {(inv.effective_status ?? inv.status) === 'PAID' && (
                                <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mr-1">
                                  <CheckCircle size={16} /> Paid
                                </div>
                              )}
                              {(isAdmin || canGenerateInvoice) && (
                                <button
                                  onClick={() => handleDeleteInvoice(inv)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all"
                                  title="Delete Invoice"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== STUDENT LEDGERS TAB ===== */}
        {activeTab === 'ledgers' && canViewLedgers && (
          <div className="space-y-6">
            

            {/* Ledger Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-100">Total Students</p>
                    <p className="text-2xl font-bold">{ledgers.filter((l, i, arr) => arr.findIndex(x => x.student === l.student) === i).length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-blue-100">Total Ledgers</p>
                    <p className="text-2xl font-bold">{ledgers.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-amber-100">Pending Balance</p>
                    <p className="text-2xl font-bold">{ledgers.filter(l => !l.is_cleared).length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-green-100">Cleared Ledgers</p>
                    <p className="text-2xl font-bold">{ledgers.filter(l => l.is_cleared).length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ledgers Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-gray-900">Student Fee Ledgers</h3>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">{ledgers.length} total</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search name or SUID..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  
                  <select
                    className="pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    value={ledgerGradeFilter}
                    onChange={(e) => setLedgerGradeFilter(e.target.value)}
                  >
                    <option value="ALL">All Grades</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.grade_name}>{g.grade_name}</option>
                    ))}
                  </select>

                  <select
                    className="pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                    value={ledgerYearFilter}
                    onChange={(e) => setLedgerYearFilter(e.target.value)}
                  >
                    <option value="ALL">All Years</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.year_code}>{y.year_code}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {ledgers.length === 0 ? (
                <div className="p-12 text-center">
                  <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No ledgers found</p>
                  <p className="text-sm text-gray-400 mt-1">Fee ledgers will appear here when students have fee assignments</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Student</th>
                        <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                        <th className="text-left p-4 text-xs font-semibold text-gray-500 uppercase">Academic Year</th>
                        <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">Total Charges</th>
                        <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">Payments</th>
                        <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                        <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">RTE Concession/Waiver</th>
                        <th className="text-right p-4 text-xs font-semibold text-gray-500 uppercase">Reimbursements</th>
                        <th className="text-center p-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="text-center p-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgers
                        .filter(ledger => {
                          const matchesSearch = !search || 
                            ledger.student_name?.toLowerCase().includes(search.toLowerCase()) ||
                            ledger.student_suid?.toLowerCase().includes(search.toLowerCase());
                          
                          const matchesGrade = ledgerGradeFilter === 'ALL' || ledger.grade_name === ledgerGradeFilter;
                          const matchesYear = ledgerYearFilter === 'ALL' || ledger.academic_year === ledgerYearFilter;
                          
                          return matchesSearch && matchesGrade && matchesYear;
                        })
                        .slice(0, 20)
                        .map(ledger => (
                        <tr key={ledger.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                                {ledger.student_name?.[0] || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{ledger.student_name}</p>
                                <p className="text-xs text-gray-500">{ledger.student_suid}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-600">{ledger.grade_name || '-'}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                              {formatAcademicYear(ledger.academic_year)}
                            </span>
                          </td>
                          <td className="p-4 text-right font-medium text-gray-900">
                            ₹{(parseFloat(ledger.total_charges || '0') + parseFloat(ledger.total_fines || '0')).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-right font-medium text-emerald-600">
                            {ledger.is_rte_student ? (
                              <span className="text-gray-400 font-normal">-</span>
                            ) : (
                              `₹${parseFloat(ledger.total_payments || '0').toLocaleString('en-IN')}`
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-gray-900">
                            {ledger.is_rte_student ? (
                              <span className="text-gray-400 font-normal">-</span>
                            ) : (
                              `₹${((parseFloat(ledger.total_charges || '0') + parseFloat(ledger.total_fines || '0')) - parseFloat(ledger.total_payments || '0')).toLocaleString('en-IN')}`
                            )}
                          </td>
                          <td className="p-4 text-right font-semibold text-indigo-600">
                            {ledger.is_rte_student ? (
                              `₹${(parseFloat(ledger.total_charges || '0') + parseFloat(ledger.total_fines || '0') - (ledger.total_reimbursements || 0)).toLocaleString('en-IN')}`
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-semibold text-emerald-600">
                            {ledger.is_rte_student ? (
                              `₹${(ledger.total_reimbursements || 0).toLocaleString('en-IN')}`
                            ) : (
                              <span className="text-gray-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {ledger.is_cleared ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg inline-flex items-center gap-1">
                                <CheckCircle size={12} /> Cleared
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg inline-flex items-center gap-1">
                                <Clock size={12} /> Pending
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {ledger.is_rte_student && (
                                <button
                                  onClick={() => {
                                    setReimbursementTarget(ledger);
                                    setReimbursementForm({
                                      amount: '',
                                      date_received: new Date().toISOString().split('T')[0],
                                      mode_of_payment: 'BANK_TRANSFER',
                                      transaction_id: ''
                                    });
                                    setReimbursementError('');
                                    setShowReimbursementModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-extrabold hover:bg-emerald-100 border border-emerald-150 transition-colors inline-flex items-center gap-1 shadow-sm"
                                >
                                  <DollarSign size={14} /> Record Reimbursement
                                </button>
                              )}
                              <Link href={`/dashboard/finance/ledger/${ledger.student}`}>
                                <button className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors inline-flex items-center gap-1">
                                  <History size={14} /> View History
                                </button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== FEE STRUCTURES TAB ===== */}
        {activeTab === 'structures' && canViewStructures && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Fee Packages</h2>
                <p className="text-gray-500 text-sm">Define grade-wise fee structures for the academic year</p>
              </div>
              <button 
                onClick={() => {
                  setNewStructure({
                    name: '',
                    grade: '',
                    academic_year: academicYears.length > 0 ? academicYears[0].year_code : '',
                    tuition_fee: 0, admission_fee: 0, exam_fee: 0, lab_fee: 0,
                    library_fee: 0, sports_fee: 0, computer_fee: 0, transport_fee: 0,
                    misc_fee: 0, development_fee: 0
                  });
                  setIsEditMode(false);
                  setEditingStructureId(null);
                  setShowStructureModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={18} /> New Package
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Package Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Grade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Year</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Total Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {feeStructures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <LayoutGrid size={40} className="text-gray-200" />
                          <p>No fee packages defined yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : feeStructures.map((structure: any) => (
                    <tr key={structure.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800">{structure.name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{structure.grade_name || 'All Grades'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatAcademicYear(structure.academic_year)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-blue-600">₹{parseFloat(structure.total_annual_fee || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              setSelectedStructure(structure);
                              setShowViewStructureModal(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setNewStructure({
                                name: structure.name,
                                grade: structure.grade,
                                academic_year: structure.academic_year,
                                tuition_fee: parseFloat(structure.tuition_fee),
                                admission_fee: parseFloat(structure.admission_fee),
                                exam_fee: parseFloat(structure.exam_fee),
                                lab_fee: parseFloat(structure.lab_fee),
                                library_fee: parseFloat(structure.library_fee),
                                sports_fee: parseFloat(structure.sports_fee),
                                computer_fee: parseFloat(structure.computer_fee),
                                transport_fee: parseFloat(structure.transport_fee),
                                misc_fee: parseFloat(structure.misc_fee),
                                development_fee: parseFloat(structure.development_fee)
                              });
                              setEditingStructureId(structure.id);
                              setIsEditMode(true);
                              setShowStructureModal(true);
                            }}
                            className="text-gray-400 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition-colors"
                            title="Edit Package"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStructure(structure.id, structure.name)}
                            className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete Package"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== ASSIGNMENTS TAB ===== */}
        {activeTab === 'assignments' && canViewAssignments && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-900">Student Fee Assignments</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setBulkForm({
                        grade_id: '',
                        section_id: '',
                        fee_structure_id: '',
                        fee_schedule_id: '',
                        academic_year: academicYears.length > 0 ? academicYears[0].year_code : currentAcademicYear,
                        override_existing: false
                      });
                      setConcessionStepActive(false);
                      setConcessionSelections({});
                      setShowBulkModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-650 hover:bg-purple-750 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    <Plus size={18} /> New Bulk Assignment
                  </button>
                  <button 
                    onClick={() => {
                      setAllocateForm({
                        grade_id: '',
                        section_id: '',
                        fee_schedule_id: '',
                        student_id: 'ALL',
                        academic_year: academicYears.length > 0 ? academicYears[0].year_code : currentAcademicYear,
                        override_existing: false
                      });
                      setShowAllocateStructureModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Calendar size={18} /> Allocate Payment Plan
                  </button>
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Students with assigned fee schedules. Click on a student to view their complete fee profile.
              </p>
              
              <div className="grid gap-4">
                {assignments.map(assignment => (
                  <div key={assignment.id} className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between">
                    <Link href={`/dashboard/finance/student/${assignment.student}`} className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0">
                        {assignment.student_name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{assignment.student_name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-mono">{assignment.student_suid}</span>
                          <span className="mx-2">•</span>
                          {assignment.fee_schedule_name}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-gray-900">₹{parseFloat(assignment.net_payable || 0).toLocaleString()}</p>
                        <p className="text-xs">
                          <span className="text-emerald-600 font-semibold">₹{parseFloat(assignment.total_paid || 0).toLocaleString()}</span>
                          <span className="text-gray-400"> paid</span>
                        </p>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`Are you sure you want to delete the fee assignment for ${assignment.student_name}? This will remove the assigned fee structure, pending installments, and uncollected invoices.`)) return;
                          try {
                            await api.delete(`/finance/assignments/${assignment.id}/`);
                            toast.success("Fee assignment deleted successfully!");
                            fetchAllData();
                          } catch (err: any) {
                            toast.error("Failed to delete fee assignment: " + (err.response?.data?.error || err.message));
                          }
                        }}
                        title="Delete Fee Assignment"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== SCHEDULES TAB ===== */}
        {activeTab === 'schedules' && canViewSchedules && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">Payment Schedules</h3>
                  <p className="text-gray-500 text-sm">
                    Different payment plans available for students (Quarterly, Half-Yearly, Annual, etc.)
                  </p>
                </div>
                {canManageSchedules && (
                  <button 
                    onClick={() => setShowScheduleModal(true)} 
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center gap-2 text-sm"
                  >
                    <Plus size={16} /> New Payment Plan
                  </button>
                )}
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schedules.map(schedule => (
                  <div key={schedule.id} className={`p-5 rounded-xl border-2 ${
                    schedule.is_default ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">{schedule.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{schedule.schedule_type_display}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {schedule.is_default && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            DEFAULT
                          </span>
                        )}
                        {canManageSchedules && !schedule.is_default && (
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                            title="Delete payment plan"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Installments/Year</span>
                        <span className="font-semibold text-gray-900">{schedule.installments_per_year}</span>
                      </div>
                      {schedule.discount_percentage > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Discount</span>
                          <span className="font-semibold text-emerald-600">{schedule.discount_percentage}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== NEW PAYMENT PLAN MODAL ===== */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">New Payment Plan</h3>
                    <p className="text-blue-100 text-sm">Create a recurring payment plan</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {/* Modal Body / Form */}
            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Plan Name
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Quarterly Payment Plan"
                  value={scheduleForm.name}
                  onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Number of Installments
                </label>
                <input 
                  type="number"
                  required
                  min="1"
                  max="12"
                  placeholder="e.g. 4"
                  value={scheduleForm.installments}
                  onChange={e => setScheduleForm({...scheduleForm, installments: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleLoading || !scheduleForm.name || !scheduleForm.installments}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {scheduleLoading ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" /> Creating...
                    </>
                  ) : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== PAYMENT MODAL ===== */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Record Payment</h3>
                    <p className="text-emerald-100 text-sm">{selectedInvoice.invoice_number}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Student Info */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {selectedInvoice.student_name?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedInvoice.student_name}</p>
                    <p className="text-xs text-gray-500 font-mono">{selectedInvoice.student_suid}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Balance Due</span>
                  <span className="text-2xl font-bold text-red-600">₹{parseFloat(selectedInvoice.balance_due).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Amount to Collect</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
                    <input 
                      type="number" 
                      className="w-full pl-10 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-2xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Payment Mode</label>
                    <select 
                      className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      value={paymentForm.mode}
                      onChange={e => setPaymentForm({...paymentForm, mode: e.target.value})}
                    >
                      <option value="CASH">💵 Cash</option>
                      <option value="UPI">📱 UPI / Online</option>
                      <option value="CHEQUE">📝 Cheque</option>
                      <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                      <option value="CARD">💳 Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Reference ID</label>
                    <input 
                      type="text" 
                      placeholder="Transaction ID"
                      className="w-full p-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      value={paymentForm.reference}
                      onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                    />
                  </div>
                </div>
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
                    <Plus size={14} /> Add more breakdowns
                  </button>
                  
                  {Math.abs(modalTotalAllocated - modalExtraAmount) >= 0.01 && (
                    <p className="text-xs text-red-600 font-medium">
                      Total breakdown amounts must exactly equal the extra amount of ₹{modalExtraAmount.toLocaleString()} (Current sum: ₹{modalTotalAllocated.toLocaleString()}).
                    </p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button 
                onClick={handleRecordPayment}
                disabled={isPaymentSubmitDisabled}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentLoading ? (
                  <><Loader2 className="animate-spin" size={20} /> Processing...</>
                ) : (
                  <><CheckCircle size={20} /> Confirm Payment</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK ASSIGN MODAL ===== */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Bulk Assign Fee Package</h3>
                    <p className="text-blue-100 text-sm">Assign grade-wise fee structures to students</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowBulkModal(false);
                    setConcessionStepActive(false);
                  }} 
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {concessionStepActive ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 text-sm">
                    <p className="font-bold">Concession Adjustments Required</p>
                    <p className="text-xs mt-0.5">Please choose which fee type the concession should be deducted from for each student.</p>
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                    {(() => {
                      const targetStudents = (bulkForm as any).student_id && (bulkForm as any).student_id !== 'ALL'
                        ? allStudents.filter(s => s.id === (bulkForm as any).student_id)
                        : (bulkForm.grade_id ? allStudents.filter(s => s.grade_config === bulkForm.grade_id) : allStudents);
                      const concessionStudents = targetStudents.filter(s => s.fee_concession_applicable && parseFloat(s.fee_concession_amount) > 0);
                      
                      // Resolve structure
                      let structId = bulkForm.fee_structure_id;
                      if (!structId) {
                        const gs = feeStructures.find(fs => fs.grade === bulkForm.grade_id);
                        if (gs) structId = gs.id;
                      }
                      const selectedStructureObj = feeStructures.find(fs => fs.id === structId);

                      const feeFields = [
                        { name: 'tuition_fee', label: 'Tuition Fee' },
                        { name: 'admission_fee', label: 'Admission Fee' },
                        { name: 'exam_fee', label: 'Exam Fee' },
                        { name: 'lab_fee', label: 'Lab Fee' },
                        { name: 'library_fee', label: 'Library Fee' },
                        { name: 'sports_fee', label: 'Sports Fee' },
                        { name: 'computer_fee', label: 'Computer Fee' },
                        { name: 'transport_fee', label: 'Transport Fee' },
                        { name: 'misc_fee', label: 'Miscellaneous Fee' },
                        { name: 'development_fee', label: 'Development Fee' }
                      ].filter(field => selectedStructureObj && parseFloat(selectedStructureObj[field.name]) > 0);

                      return concessionStudents.map(student => (
                        <div key={student.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800 text-sm">{student.full_name}</span>
                            <span className="bg-emerald-50 text-emerald-700 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                              Concession: ₹{parseFloat(student.fee_concession_amount).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div>
                            <select
                              value={concessionSelections[student.id] || 'tuition_fee'}
                              onChange={e => setConcessionSelections(prev => ({ ...prev, [student.id]: e.target.value }))}
                              className="w-full p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                            >
                              {feeFields.map(field => (
                                <option key={field.name} value={field.name}>
                                  {field.label} (₹{parseFloat(selectedStructureObj[field.name]).toLocaleString('en-IN')})
                                </option>
                              ))}
                              {feeFields.length === 0 && (
                                <option value="tuition_fee">Tuition Fee</option>
                              )}
                            </select>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="flex gap-3 mt-4 pt-2">
                    <button
                      onClick={() => setConcessionStepActive(false)}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleBulkAssign}
                      disabled={bulkLoading}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      {bulkLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      Confirm & Assign
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Target Grade</label>
                      <select 
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        value={bulkForm.grade_id}
                        onChange={e => setBulkForm({...bulkForm, grade_id: e.target.value, section_id: ''})}
                      >
                        <option value="">All Grades</option>
                        {Array.isArray(grades) && grades.map(g => (
                          <option key={g.id} value={g.id}>{g.grade_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Academic Year</label>
                      <select 
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        value={bulkForm.academic_year}
                        onChange={e => setBulkForm({...bulkForm, academic_year: e.target.value})}
                      >
                        <option value="">Select Year</option>
                        {academicYears.map(year => (
                          <option key={year.id} value={year.year_code}>{year.year_code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Students</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={(bulkForm as any).student_id || 'ALL'}
                      onChange={e => setBulkForm({...bulkForm, [ 'student_id' as any ]: e.target.value})}
                    >
                      <option value="ALL">
                        {filteredStudents.length === 0 
                          ? 'No students enrolled in selected academic year' 
                          : `All Students ${bulkForm.grade_id ? 'in Grade' : ''} (${filteredStudents.length})`}
                      </option>
                      {filteredStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name || s.suid}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
                    <input 
                      type="checkbox" 
                      id="override"
                      checked={bulkForm.override_existing}
                      onChange={e => setBulkForm({...bulkForm, override_existing: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <label htmlFor="override" className="font-medium">
                      Override existing assignments for this academic year
                    </label>
                  </div>

                  <button 
                    onClick={handleBulkAssign}
                    disabled={bulkLoading || !bulkForm.academic_year}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkLoading ? (
                      <><Loader2 className="animate-spin" size={20} /> Processing...</>
                    ) : (
                      <><Users size={20} /> Start Bulk Assignment</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ALLOCATE PAYMENT PLAN MODAL ===== */}
      {showAllocateStructureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Allocate Payment Plan</h3>
                    <p className="text-blue-100 text-sm">Assign installment structures to students</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowAllocateStructureModal(false);
                    setInstallmentStepActive(false);
                  }} 
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {installmentStepActive ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">Customize Installment Schedule</p>
                      {concessionSummaryInfo && concessionSummaryInfo.concessionAmount > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md border border-emerald-200">
                          Fee Concession Applied
                        </span>
                      )}
                    </div>
                    {concessionSummaryInfo ? (
                      <div className="text-xs text-blue-700 space-y-0.5 pt-1">
                        {concessionSummaryInfo.studentName && (
                          <p className="font-semibold text-gray-800">Student: {concessionSummaryInfo.studentName}</p>
                        )}
                        <p>
                          <span>Package Fee: ₹{concessionSummaryInfo.totalPackageFee.toLocaleString()}</span>
                          {concessionSummaryInfo.concessionAmount > 0 && (
                            <span className="text-emerald-700 font-semibold"> - Concession: ₹{concessionSummaryInfo.concessionAmount.toLocaleString()}</span>
                          )}
                          <span className="font-bold text-gray-900"> = Net Payable: ₹{concessionSummaryInfo.netPayable.toLocaleString()}</span>
                        </p>
                        <p className="text-[11px] text-blue-600">Calculated: ₹{(concessionSummaryInfo.netPayable / (customInstallments.length || 1)).toFixed(2)} per installment across {customInstallments.length} periods</p>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-600 mt-0.5">Define amount and due date for each installment.</p>
                    )}
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                    {customInstallments.map((inst, index) => (
                      <div key={index} className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-150">
                        <span className="text-xs font-bold text-gray-500 w-8">#{index + 1}</span>
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Amount (₹)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={inst.amount}
                            onChange={e => {
                              const updated = [...customInstallments];
                              updated[index].amount = e.target.value;
                              setCustomInstallments(updated);
                            }}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Due Date</label>
                          <input 
                            type="date" 
                            value={inst.due_date}
                            onChange={e => {
                              const updated = [...customInstallments];
                              updated[index].due_date = e.target.value;
                              setCustomInstallments(updated);
                            }}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const currentTotal = customInstallments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
                    const maxAllowed = concessionSummaryInfo ? concessionSummaryInfo.netPayable : 0;
                    const isExceeded = maxAllowed > 0 && currentTotal > maxAllowed + 0.05;

                    return (
                      <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-colors ${
                        isExceeded ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}>
                        <span>Installments Total: ₹{currentTotal.toFixed(2)}</span>
                        <span>
                          {isExceeded 
                            ? `⚠️ Exceeds limit by ₹${(currentTotal - maxAllowed).toFixed(2)}` 
                            : `Max Allowed: ₹${maxAllowed.toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setInstallmentStepActive(false)}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAllocateStructure}
                      disabled={structureLoading}
                      className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      {structureLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      Allocate
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Target Grade</label>
                      <select 
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        value={allocateForm.grade_id}
                        onChange={e => setAllocateForm({...allocateForm, grade_id: e.target.value, section_id: ''})}
                      >
                        <option value="">All Grades</option>
                        {Array.isArray(grades) && grades.map(g => (
                          <option key={g.id} value={g.id}>{g.grade_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Academic Year</label>
                      <select 
                        className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        value={allocateForm.academic_year}
                        onChange={e => setAllocateForm({...allocateForm, academic_year: e.target.value})}
                      >
                        <option value="">Select Year</option>
                        {academicYears.map(year => (
                          <option key={year.id} value={year.year_code}>{year.year_code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Students</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={allocateForm.student_id}
                      onChange={e => setAllocateForm({...allocateForm, student_id: e.target.value})}
                    >
                      <option value="ALL">
                        {allocatedYearStudents.length === 0
                          ? 'No students enrolled in selected academic year'
                          : `All Students ${allocateForm.grade_id ? 'in Grade' : ''} (${allocatedYearStudents.length})`}
                      </option>
                      {allocatedYearStudents
                        .filter(s => !allocateForm.grade_id || s.grade_config === allocateForm.grade_id)
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.full_name || s.suid}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Payment Structure</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={allocateForm.fee_schedule_id}
                      onChange={e => setAllocateForm({...allocateForm, fee_schedule_id: e.target.value})}
                    >
                      <option value="">Select Schedule</option>
                      {schedules.filter(s => s.is_active !== false).map(schedule => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.name}{schedule.installments_per_year ? ` (${schedule.installments_per_year} Installment${schedule.installments_per_year > 1 ? 's' : ''})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
                    <input 
                      type="checkbox" 
                      id="override-allocate"
                      checked={allocateForm.override_existing}
                      onChange={e => setAllocateForm({...allocateForm, override_existing: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <label htmlFor="override-allocate" className="font-medium">
                      Override existing assignments for this academic year
                    </label>
                  </div>

                  <button 
                    onClick={handleAllocateStructure}
                    disabled={structureLoading || !allocateForm.academic_year || !allocateForm.fee_schedule_id}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {structureLoading ? (
                      <><Loader2 className="animate-spin" size={20} /> Allocating...</>
                    ) : (
                      <><Calendar size={20} /> Allocate Payment Structure</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK APPLY LATE FEE MODAL ===== */}
      {showLateFeeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-500 to-red-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Apply Late Fees</h3>
                    <p className="text-rose-100 text-sm">Add late fee to overdue invoices</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLateFeeModal(false)} 
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Target Grade</label>
                <select 
                  className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  value={lateFeeForm.grade_id}
                  onChange={e => setLateFeeForm({...lateFeeForm, grade_id: e.target.value})}
                >
                  <option value="">Select Target Grade</option>
                  {Array.isArray(grades) && grades.map(g => (
                    <option key={g.id} value={g.id}>{g.grade_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Late Fee Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="Enter late fee amount (e.g. 500)"
                    className="w-full pl-10 p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all"
                    value={lateFeeForm.late_fee_amount}
                    onChange={e => setLateFeeForm({...lateFeeForm, late_fee_amount: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100 text-rose-800 text-sm">
                <AlertCircle className="flex-shrink-0 text-rose-600" size={18} />
                <p className="font-medium">
                  This will apply the fee only to invoices of the selected grade that are currently marked as <strong>OVERDUE</strong>.
                </p>
              </div>

              <button 
                onClick={handleApplyLateFee}
                disabled={lateFeeLoading || !lateFeeForm.grade_id || !lateFeeForm.late_fee_amount}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-rose-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lateFeeLoading ? (
                  <><Loader2 className="animate-spin" size={20} /> Applying...</>
                ) : (
                  <><Clock size={20} /> Apply Late Fees</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowStructureModal(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <LayoutGrid size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{isEditMode ? 'Edit Fee Package' : 'Define Fee Package'}</h3>
                    <p className="text-blue-100 text-sm">{isEditMode ? 'Update existing fee structure' : 'Create a new grade-wise fee structure'}</p>
                  </div>
                </div>
                <button onClick={() => setShowStructureModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Package Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Grade 10 Annual Fee 2025-26"
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={newStructure.name}
                      onChange={e => setNewStructure({...newStructure, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Target Grade</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={newStructure.grade}
                      onChange={e => setNewStructure({...newStructure, grade: e.target.value})}
                    >
                      <option value="">Select Grade</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.grade_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Academic Year</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      value={newStructure.academic_year}
                      onChange={e => setNewStructure({...newStructure, academic_year: e.target.value})}
                    >
                      <option value="">Select Year</option>
                      {academicYears.map(year => (
                        <option key={year.id} value={year.year_code}>{year.year_code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-800 mb-4">Fee Breakdown (₹)</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      { key: 'tuition_fee', label: 'Tuition Fee' },
                      { key: 'admission_fee', label: 'Admission Fee (One-time)' },
                      { key: 'exam_fee', label: 'Exam Fee' },
                      { key: 'lab_fee', label: 'Lab Fee' },
                      { key: 'library_fee', label: 'Library Fee' },
                      { key: 'sports_fee', label: 'Sports Fee' },
                      { key: 'computer_fee', label: 'Computer Fee' },
                      { key: 'transport_fee', label: 'Transport Fee' },
                      { key: 'development_fee', label: 'Development Fund' },
                      { key: 'misc_fee', label: 'Miscellaneous' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">{field.label}</label>
                        <input 
                          type="number" 
                          min="0"
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          value={(newStructure as any)[field.key]}
                          onChange={e => setNewStructure({...newStructure, [field.key]: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl flex justify-between items-center">
                  <span className="text-sm font-bold text-blue-800">Total Annual Amount</span>
                  <span className="text-xl font-black text-blue-600">
                    ₹{Object.entries(newStructure)
                      .filter(([k]) => k.endsWith('_fee'))
                      .reduce((sum, [_, v]) => sum + (v as number), 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={handleCreateStructure}
                disabled={structureLoading || !newStructure.name || !newStructure.grade}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {structureLoading ? (
                  <><Loader2 className="animate-spin" size={20} /> {isEditMode ? 'Updating...' : 'Creating...'}</>
                ) : (
                  <>{isEditMode ? <Settings size={20} /> : <Plus size={20} />} {isEditMode ? 'Update Fee Package' : 'Create Fee Package'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Fee Structure Modal */}
      {showViewStructureModal && selectedStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowViewStructureModal(false)} />
          <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedStructure.name}</h3>
                    <p className="text-blue-100 text-sm">Package Details • {formatAcademicYear(selectedStructure.academic_year)}</p>
                  </div>
                </div>
                <button onClick={() => setShowViewStructureModal(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Target Grade</p>
                  <p className="font-bold text-gray-800">{selectedStructure.grade_name || 'All Grades'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Academic Year</p>
                  <p className="font-bold text-gray-800">{formatAcademicYear(selectedStructure.academic_year)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-800 mb-2 px-1">Fee Breakdown</h4>
                <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                  {[
                    { key: 'tuition_fee', label: 'Tuition Fee' },
                    { key: 'admission_fee', label: 'Admission Fee' },
                    { key: 'exam_fee', label: 'Exam Fee' },
                    { key: 'lab_fee', label: 'Lab Fee' },
                    { key: 'library_fee', label: 'Library Fee' },
                    { key: 'sports_fee', label: 'Sports Fee' },
                    { key: 'computer_fee', label: 'Computer Fee' },
                    { key: 'transport_fee', label: 'Transport Fee' },
                    { key: 'development_fee', label: 'Development Fund' },
                    { key: 'misc_fee', label: 'Miscellaneous' },
                  ].map(field => {
                    const value = parseFloat(selectedStructure[field.key] || 0);
                    if (value <= 0) return null;
                    return (
                      <div key={field.key} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <span className="text-sm text-gray-600">{field.label}</span>
                        <span className="font-bold text-gray-900">₹{value.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between px-2">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Annual Package</p>
                  <p className="text-2xl font-black text-blue-600">₹{parseFloat(selectedStructure.total_annual_fee || 0).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setShowViewStructureModal(false)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SALARY TAB ===== */}
      {activeTab === 'salary' && canViewSalary && (
        <div className="space-y-6">

          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
            <div className="relative">
              <h2 className="text-2xl font-bold flex items-center gap-3"><Banknote size={28} /> Staff Salary Management</h2>
              <p className="text-violet-100 mt-1 text-sm">View and manage monthly salary deductions for teaching and non-teaching staff.</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-gray-600 whitespace-nowrap">Month:</label>
              <input
                type="month"
                value={salaryMonth}
                onChange={e => setSalaryMonth(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50 font-mono font-bold"
              />
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search staff..."
                value={salarySearch}
                onChange={e => setSalarySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Stats Row */}
          {(() => {
            const teaching = staffList.filter(s => s.teacher_type === 'TEACHING');
            const nonTeaching = staffList.filter(s => s.teacher_type === 'NON_TEACHING');
            const totalPayroll = staffList.reduce((sum, s) => sum + (parseFloat(s.salary) || 0), 0);
            const totalDeducted = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
            const netPayroll = totalPayroll - totalDeducted;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Teaching Staff</p>
                  <p className="text-2xl font-black text-gray-800 mt-1">{teaching.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Non-Teaching Staff</p>
                  <p className="text-2xl font-black text-gray-800 mt-1">{nonTeaching.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gross Payroll</p>
                  <p className="text-2xl font-black text-violet-700 mt-1">₹{totalPayroll.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Net Payroll (after deductions)</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">₹{netPayroll.toLocaleString('en-IN')}</p>
                </div>
              </div>
            );
          })()}

          {/* Staff Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Staff Salary Register</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {salaryMonth ? `Showing deductions for ${new Date(salaryMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}` : 'All deductions'}
              </p>
            </div>

            {staffLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-violet-500" size={36} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Staff Member</th>
                      <th className="px-6 py-3">TUID</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3 text-right">Monthly Salary</th>
                      <th className="px-6 py-3 text-right">Deducted ({salaryMonth})</th>
                      <th className="px-6 py-3 text-right">Net Payable</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {staffList
                      .filter(s => {
                        if (!salarySearch) return true;
                        const q = salarySearch.toLowerCase();
                        return (
                          (s.full_name || '').toLowerCase().includes(q) ||
                          (s.tuid || '').toLowerCase().includes(q) ||
                          (s.email || '').toLowerCase().includes(q)
                        );
                      })
                      .map(staff => {
                        const grossSalary = parseFloat(staff.salary) || 0;
                        const staffDeductions = deductions.filter(d => d.teacher === staff.id);
                        const totalDeducted = staffDeductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                        const netPayable = grossSalary - totalDeducted;
                        return (
                          <tr key={staff.id} className="hover:bg-violet-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {(staff.full_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-800">{staff.full_name || '—'}</p>
                                  <p className="text-xs text-gray-400">{staff.email || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{staff.tuid}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                staff.teacher_type === 'TEACHING'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {staff.teacher_type === 'TEACHING' ? 'Teaching' : 'Non-Teaching'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {grossSalary > 0 ? (
                                <span className="font-bold text-gray-800">₹{grossSalary.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-gray-400 italic text-xs">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {totalDeducted > 0 ? (
                                <span className="font-bold text-red-600">−₹{totalDeducted.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-black text-base ${
                                netPayable >= grossSalary ? 'text-emerald-600' : 'text-orange-600'
                              }`}>
                                ₹{netPayable.toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => {
                                  setDeductTarget(staff);
                                  setDeductForm({ amount: '', description: '' });
                                  setDeductError('');
                                  setDeductModalOpen(true);
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-red-100 hover:border-red-200 flex items-center gap-1.5 mx-auto"
                              >
                                <Minus size={13} /> Deduct Salary
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {staffList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                          <Users size={40} className="mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No staff found</p>
                          <p className="text-xs mt-1">Add staff in the Teachers module first</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Deductions History */}
          {deductions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Deduction History — {salaryMonth}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {deductions.map(d => (
                  <div key={d.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Minus size={14} className="text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{d.teacher_name}</p>
                        <p className="text-xs text-gray-400 truncate">{d.description}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-red-600">−₹{parseFloat(d.amount).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== DEDUCT SALARY MODAL ===== */}
      {deductModalOpen && deductTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 border-b border-red-100 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <Minus size={18} className="text-red-500" /> Deduct Salary
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  For <strong>{deductTarget.full_name}</strong> · {salaryMonth}
                </p>
                {deductTarget.salary && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Monthly salary: ₹{parseFloat(deductTarget.salary).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDeductModalOpen(false)}
                className="p-1.5 hover:bg-red-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {deductError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertCircle size={16} /> {deductError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Amount to Deduct (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={deductForm.amount}
                  onChange={e => setDeductForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50 font-bold"
                  placeholder="Enter deduction amount"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Description / Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={deductForm.description}
                  onChange={e => setDeductForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50 resize-none"
                  placeholder="e.g. Absent without leave on 3rd July"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setDeductModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                disabled={deductLoading || !deductForm.amount || !deductForm.description || !deductForm.description.trim()}
                onClick={async () => {
                  if (!deductForm.amount || !deductForm.description || !deductForm.description.trim()) {
                    setDeductError('Both Amount to Deduct and Description / Reason are mandatory fields.');
                    return;
                  }
                  const amt = parseFloat(deductForm.amount);
                  if (isNaN(amt) || amt <= 0) {
                    setDeductError('Enter a valid positive amount.');
                    return;
                  }
                  if (deductTarget.salary && amt > parseFloat(deductTarget.salary)) {
                    setDeductError(`Deduction cannot exceed monthly salary (₹${parseFloat(deductTarget.salary).toLocaleString('en-IN')}).`);
                    return;
                  }
                  setDeductLoading(true);
                  setDeductError('');
                  try {
                    await api.post('/finance/salary-deductions/', {
                      teacher: deductTarget.id,
                      month: salaryMonth,
                      amount: amt,
                      description: deductForm.description,
                    });
                    setDeductModalOpen(false);
                    // Refresh deductions
                    const deductRes = await api.get(`/finance/salary-deductions/?month=${salaryMonth}`);
                    const deductList = deductRes.data.results || deductRes.data || [];
                    setDeductions(Array.isArray(deductList) ? deductList : []);
                  } catch (err: any) {
                    const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to record deduction.';
                    setDeductError(msg);
                  } finally {
                    setDeductLoading(false);
                  }
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-red-200"
              >
                {deductLoading ? <Loader2 className="animate-spin" size={18} /> : <Minus size={18} />}
                Deduct
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== RECORD REIMBURSEMENT MODAL ===== */}
      {showReimbursementModal && reimbursementTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-emerald-100 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-500" /> Record Reimbursement
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  For RTE Student: <strong>{reimbursementTarget.student_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowReimbursementModal(false)}
                className="p-1.5 hover:bg-emerald-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {reimbursementError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertCircle size={16} /> {reimbursementError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={reimbursementForm.amount}
                  onChange={e => setReimbursementForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 font-bold"
                  placeholder="Enter reimbursed amount"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Date Received</label>
                <input
                  type="date"
                  value={reimbursementForm.date_received}
                  onChange={e => setReimbursementForm(f => ({ ...f, date_received: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Mode of Payment</label>
                <select
                  value={reimbursementForm.mode_of_payment}
                  onChange={e => setReimbursementForm(f => ({ ...f, mode_of_payment: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 font-semibold"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / Online</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Debit/Credit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Transaction ID / Reference (optional)</label>
                <input
                  type="text"
                  value={reimbursementForm.transaction_id}
                  onChange={e => setReimbursementForm(f => ({ ...f, transaction_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 font-mono"
                  placeholder="e.g. TXN98765432"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowReimbursementModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                disabled={reimbursementLoading || !reimbursementForm.amount || !reimbursementForm.date_received}
                onClick={async () => {
                  const amt = parseFloat(reimbursementForm.amount);
                  if (isNaN(amt) || amt <= 0) {
                    setReimbursementError('Please enter a valid positive amount.');
                    return;
                  }
                  setReimbursementLoading(true);
                  setReimbursementError('');
                  try {
                    await api.post('/finance/assignments/record_reimbursement/', {
                      student_id: reimbursementTarget.student,
                      amount: amt,
                      date_received: reimbursementForm.date_received,
                      mode_of_payment: reimbursementForm.mode_of_payment,
                      transaction_id: reimbursementForm.transaction_id
                    });
                    setShowReimbursementModal(false);
                    alert('Reimbursement recorded successfully!');
                    fetchAllData();
                  } catch (err: any) {
                    const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to record reimbursement.';
                    setReimbursementError(msg);
                  } finally {
                    setReimbursementLoading(false);
                  }
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
              >
                {reimbursementLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}