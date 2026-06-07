'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Building2, Users, DollarSign, TrendingUp, AlertTriangle,
    CheckCircle, Settings, FileText, BarChart3, RefreshCw, Trash2
} from 'lucide-react';
import { useNotification } from '@/lib/NotificationContext';

// Types
interface School {
    id: string;
    name: string;
    code: string;
    board: string;
}

interface Subscription {
    id: string;
    school: string;
    school_details: School;
    plan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    start_date: string;
    end_date: string | null;
    max_students: number;
    max_teachers: number;
    days_remaining: number | null;
    suspended_by: string | null;
    suspended_at: string | null;
    suspension_reason: string;
}

interface SchoolAdmin {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    school_id: string | null;
    school_name: string;
    is_active: boolean;
    date_joined: string;
    last_login: string | null;
}

interface FeatureToggle {
    id: string;
    school: string;
    school_name: string;
    feature: string;
    feature_display: string;
    is_enabled: boolean;
    sub_features?: Record<string, boolean>;
}

interface PlatformStats {
    total_schools: number;
    active_schools: number;
    suspended_schools: number;
    expired_schools: number;
    total_students: number;
    total_teachers: number;
    total_revenue: number;
    free_plan_count: number;
    basic_plan_count: number;
    premium_plan_count: number;
    enterprise_plan_count: number;
}

interface AuditLog {
    id: string;
    action: string;
    action_display: string;
    school_name: string | null;
    performed_by_name: string;
    description: string;
    created_at: string;
}

type TabType = 'overview' | 'schools' | 'admins' | 'features' | 'subscriptions' | 'analytics' | 'audit';

export default function OwnerDashboard() {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
    const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
    const [features, setFeatures] = useState<FeatureToggle[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { showNotification } = useNotification();


    // Modals
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);

    // Forms
    const [onboardData, setOnboardData] = useState({
        name: '',
        code: '',
        board: 'CBSE',
        plan: 'FREE',
        max_students: 50,
        max_teachers: 10,
    });

    const [adminData, setAdminData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        school: '',
        password: '',
    });

    const API_BASE = 'http://localhost:8000/api/v1/owner';
    const getHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('access_token')}`
    });

    useEffect(() => {
        fetchPlatformStats();
        fetchSubscriptions();
        fetchSchoolAdmins();
        fetchAuditLogs();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            fetchFeatures(selectedSchool);
        }
    }, [selectedSchool]);

    const fetchPlatformStats = async () => {
        try {
            const response = await axios.get(`${API_BASE}/stats/`, { headers: getHeaders() });
            setPlatformStats(response.data);
        } catch (error) {
            console.error('Error fetching platform stats:', error);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            const response = await axios.get(`${API_BASE}/schools/`, { headers: getHeaders() });
            setSubscriptions(response.data);
            if (response.data.length > 0 && !selectedSchool) {
                setSelectedSchool(response.data[0].school);
            }
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        }
    };

    const fetchSchoolAdmins = async () => {
        try {
            const response = await axios.get(`${API_BASE}/admins/`, { headers: getHeaders() });
            setSchoolAdmins(response.data);
        } catch (error) {
            console.error('Error fetching school admins:', error);
        }
    };

    const fetchFeatures = async (schoolId: string) => {
        try {
            const response = await axios.get(
                `${API_BASE}/features/school_features/?school_id=${schoolId}`,
                { headers: getHeaders() }
            );
            setFeatures(response.data);
        } catch (error) {
            console.error('Error fetching features:', error);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const response = await axios.get(`${API_BASE}/audit/`, { headers: getHeaders() });
            setAuditLogs(response.data.slice(0, 50));
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    };

    const onboardSchool = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/schools/onboard/`, onboardData, { headers: getHeaders() });
            await axios.post(`${API_BASE}/schools/onboard/`, onboardData, { headers: getHeaders() });
            showNotification('School onboarded successfully!');
            setShowOnboardModal(false);
            fetchSubscriptions();
            fetchPlatformStats();
            setOnboardData({ name: '', code: '', board: 'CBSE', plan: 'FREE', max_students: 50, max_teachers: 10 });
        } catch (error: any) {
            showNotification(`Error: ${error.response?.data?.error || error.response?.data?.code?.[0] || 'Unknown error'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const createSchoolAdmin = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/admins/`, adminData, { headers: getHeaders() });
            await axios.post(`${API_BASE}/admins/`, adminData, { headers: getHeaders() });
            showNotification('School admin created successfully!');
            setShowAdminModal(false);
            fetchSchoolAdmins();
            setAdminData({ email: '', first_name: '', last_name: '', phone_number: '', school: '', password: '' });
        } catch (error: any) {
            showNotification(`Error: ${error.response?.data?.email?.[0] || error.response?.data?.error || 'Unknown error'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const suspendSchool = async (subscriptionId: string) => {
        const reason = prompt('Suspension reason:');
        if (!reason) return;
        try {
            await axios.post(`${API_BASE}/schools/${subscriptionId}/suspend/`, { reason }, { headers: getHeaders() });
            showNotification('School suspended');
            fetchSubscriptions();
        } catch (error) {
            console.error('Error suspending school:', error);
        }
    };

    const activateSchool = async (subscriptionId: string) => {
        try {
            await axios.post(`${API_BASE}/schools/${subscriptionId}/activate/`, {}, { headers: getHeaders() });
            showNotification('School activated');
            fetchSubscriptions();
        } catch (error) {
            console.error('Error activating school:', error);
        }
    };

    const toggleFeature = async (featureId: string) => {
        try {
            await axios.post(`${API_BASE}/features/${featureId}/toggle/`, {}, { headers: getHeaders() });
            if (selectedSchool) fetchFeatures(selectedSchool);
        } catch (error) {
            console.error('Error toggling feature:', error);
        }
    };

    const toggleSubFeature = async (featureId: string, subFeatureKey: string, enabled: boolean) => {
        try {
            await axios.post(`${API_BASE}/features/${featureId}/toggle_sub_feature/`,
                { sub_feature: subFeatureKey, enabled },
                { headers: getHeaders() }
            );
            if (selectedSchool) fetchFeatures(selectedSchool);
        } catch (error) {
            console.error('Error toggling sub-feature:', error);
            showNotification('Failed to toggle sub-feature', 'error');
        }
    };

    const FEATURE_DEFINITIONS = {
        // Core Modules
        STUDENTS: [
            { key: 'student_profiles', label: 'Student Profiles' },
            { key: 'bulk_import', label: 'Bulk Data Import' },
            { key: 'id_card_generation', label: 'ID Card Generator' },
            { key: 'alumni_records', label: 'Alumni Records' },
            { key: 'document_vault', label: 'Digital Document Vault' }
        ],
        TEACHERS: [
            { key: 'teacher_profiles', label: 'Teacher Profiles' },
            { key: 'attendance_tracking', label: 'Staff Attendance' },
            { key: 'workload_management', label: 'Workload Management' },
            { key: 'payroll_integration', label: 'Payroll Integration' }
        ],
        ATTENDANCE: [
            { key: 'digital_attendance', label: 'Digital Attendance' },
            { key: 'biometric_sync', label: 'Biometric Sync' },
            { key: 'sms_alerts', label: 'Absentee SMS Alerts' },
            { key: 'leave_management', label: 'Leave Management' },
            { key: 'holiday_calendar', label: 'Holiday Calendar' }
        ],
        ANNOUNCEMENTS: [
            { key: 'broadcast_msg', label: 'Broadcast Messages' },
            { key: 'digital_circulars', label: 'Digital Circulars' },
            { key: 'media_gallery', label: 'Media Gallery' }
        ],

        // Operations
        FINANCE: [
            { key: 'fee_collection', label: 'Fee Collection' },
            { key: 'online_payments', label: 'Online Payment Gateway' },
            { key: 'invoice_generation', label: 'Automated Invoices' },
            { key: 'expenses', label: 'Expense Management' },
            { key: 'payroll', label: 'Payroll' },
            { key: 'financial_reports', label: 'Financial Reports' }
        ],
        TRANSPORT: [
            { key: 'route_management', label: 'Route Management' },
            { key: 'gps_tracking', label: 'Live GPS Tracking' },
            { key: 'vehicle_maintenance', label: 'Vehicle Maintenance' },
            { key: 'driver_management', label: 'Driver Management' },
            { key: 'transport_fees', label: 'Transport Fee Collection' }
        ],
        HOSTEL: [
            { key: 'room_allocation', label: 'Room Allocation' },
            { key: 'mess_management', label: 'Mess & Menu Management' },
            { key: 'outing_requests', label: 'Outing Request System' },
            { key: 'inventory_check', label: 'Room Inventory Check' }
        ],
        INVENTORY: [
            { key: 'asset_tracking', label: 'Asset Tracking' },
            { key: 'stock_management', label: 'Stock Management' },
            { key: 'purchase_orders', label: 'Purchase Orders' },
            { key: 'supplier_management', label: 'Supplier Management' }
        ],

        // Academics
        EXAMS: [
            { key: 'exam_scheduling', label: 'Exam Scheduling' },
            { key: 'marks_entry', label: 'Marks Entry' },
            { key: 'report_cards', label: 'Report Card Generation' },
            { key: 'online_exams', label: 'Online Exams (CBT)' },
            { key: 'result_analysis', label: 'Result Analysis' }
        ],
        TIMETABLE: [
            { key: 'auto_generator', label: 'Auto-Generator' },
            { key: 'teacher_substitution', label: 'Teacher Substitution' },
            { key: 'class_scheduling', label: 'Class Scheduling' }
        ],
        HOMEWORK: [
            { key: 'digital_assignments', label: 'Digital Assignments' },
            { key: 'submission_tracking', label: 'Submission Tracking' },
            { key: 'resource_sharing', label: 'Resource Sharing' }
        ],
        LIBRARY: [
            { key: 'book_catalog', label: 'Book Catalog (OPAC)' },
            { key: 'circulation', label: 'Circulation (Issue/Return)' },
            { key: 'ebooks', label: 'E-Books & Digital Resources' },
            { key: 'fine_management', label: 'Fine Management' }
        ],
        LIVE_CLASSES: [
            { key: 'zoom_integration', label: 'Zoom Integration' },
            { key: 'google_meet', label: 'Google Meet Integration' },
            { key: 'attendance_sync', label: 'Live Class Attendance' },
            { key: 'recorded_sessions', label: 'Recorded Sessions' }
        ],

        // Health & Safety
        HEALTH: [
            { key: 'health_pass', label: 'Health Pass' },
            { key: 'medical_history', label: 'Medical History' },
            { key: 'checkup_records', label: 'Checkup Records' },
            { key: 'vaccination_tracking', label: 'Vaccination Tracking' },
            { key: 'medical_incident', label: 'Incident Reporting' }
        ],
        GATE_PASS: [
            { key: 'digital_pass', label: 'Digital Gate Pass' },
            { key: 'visitor_management', label: 'Visitor Management' },
            { key: 'qr_scanner', label: 'QR Scanner Entry' },
            { key: 'parent_authorization', label: 'Parent Authorization' }
        ],

        // Advanced Features
        AI_ANALYTICS: [
            { key: 'student_performance', label: 'Student Performance AI' },
            { key: 'dropout_risk', label: 'Dropout Risk Analysis' },
            { key: 'revenue_forecasting', label: 'Revenue Forecasting' },
            { key: 'teacher_effectiveness', label: 'Teacher Effectiveness' }
        ],
        CERTIFICATES: [
            { key: 'id_card_generator', label: 'ID Card Generator' },
            { key: 'transfer_certificate', label: 'Transfer Certificate' },
            { key: 'bonafide_certificate', label: 'Bonafide Certificate' },
            { key: 'custom_builder', label: 'Custom Certificate Builder' }
        ],
        DATA_EXPORTS: [
            { key: 'excel_export', label: 'Excel Exports' },
            { key: 'pdf_reports', label: 'PDF Reports' },
            { key: 'api_access', label: 'API Access' }
        ],
        NOTIFICATIONS: [
            { key: 'sms_gateway', label: 'SMS Gateway' },
            { key: 'email_notifications', label: 'Email Notifications' },
            { key: 'whatsapp_integration', label: 'WhatsApp Integration' },
            { key: 'push_notifications', label: 'Mobile Push Notifications' }
        ],
        ACHIEVEMENTS: [
            { key: 'sports_records', label: 'Sports Records' },
            { key: 'academic_awards', label: 'Academic Awards' },
            { key: 'hall_of_fame', label: 'Hall of Fame' }
        ],
        DISCIPLINE: [
            { key: 'incident_logs', label: 'Incident Logs' },
            { key: 'action_tracking', label: 'Action Tracking' },
            { key: 'notes', label: 'Discipline Notes' }
        ],
        ONLINE_PAYMENTS: [
            { key: 'payment_gateway', label: 'Gateway Configuration' },
            { key: 'transaction_history', label: 'Transaction History' }
        ]
    };

    const deactivateAdmin = async (adminId: string) => {
        if (!confirm('Are you sure you want to deactivate this admin?')) return;
        try {
            await axios.delete(`${API_BASE}/admins/${adminId}/`, { headers: getHeaders() });
            showNotification('Admin deactivated');
            fetchSchoolAdmins();
        } catch (error) {
            console.error('Error deactivating admin:', error);
        }
    };

    const resetAdminPassword = async (adminId: string) => {
        const newPassword = prompt('Enter new password:');
        if (!newPassword) return;
        try {
            await axios.post(`${API_BASE}/admins/${adminId}/reset_password/`, { password: newPassword }, { headers: getHeaders() });
            showNotification('Password reset successfully');
        } catch (error) {
            console.error('Error resetting password:', error);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: TrendingUp },
        { id: 'schools', label: 'Schools', icon: Building2 },
        { id: 'admins', label: 'School Admins', icon: Users },
        { id: 'features', label: 'Features', icon: Settings },
        { id: 'subscriptions', label: 'Subscriptions', icon: DollarSign },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'audit', label: 'Audit Logs', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                            <Building2 className="h-10 w-10 text-blue-600" />
                            Platform Owner Dashboard
                        </h1>
                        <p className="text-gray-600 mt-2">Complete platform management & control</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAdminModal(true)}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
                        >
                            <Users className="h-5 w-5" />
                            Create Admin
                        </button>
                        <button
                            onClick={() => window.location.href = '/owner/onboarding'}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                        >
                            <Building2 className="h-5 w-5" />
                            Onboard New School
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {platformStats && (
                    <div className="grid grid-cols-5 gap-4 mb-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-600 font-medium">Total Schools</div>
                                    <div className="text-3xl font-bold text-gray-900 mt-1">{platformStats.total_schools}</div>
                                </div>
                                <Building2 className="h-10 w-10 text-blue-500" />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-600 font-medium">Active</div>
                                    <div className="text-3xl font-bold text-green-600 mt-1">{platformStats.active_schools}</div>
                                </div>
                                <CheckCircle className="h-10 w-10 text-green-500" />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-600 font-medium">Suspended</div>
                                    <div className="text-3xl font-bold text-red-600 mt-1">{platformStats.suspended_schools}</div>
                                </div>
                                <AlertTriangle className="h-10 w-10 text-red-500" />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-600 font-medium">Total Students</div>
                                    <div className="text-3xl font-bold text-purple-600 mt-1">{platformStats.total_students}</div>
                                </div>
                                <Users className="h-10 w-10 text-purple-500" />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-gray-600 font-medium">Total Teachers</div>
                                    <div className="text-3xl font-bold text-indigo-600 mt-1">{platformStats.total_teachers}</div>
                                </div>
                                <Users className="h-10 w-10 text-indigo-500" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                    <div className="border-b border-gray-200">
                        <nav className="flex -mb-px overflow-x-auto">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as TabType)}
                                        className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && platformStats && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-gray-900">Platform Overview</h2>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                                        <h3 className="text-lg font-semibold text-blue-900 mb-4">Quick Stats</h3>
                                        <div className="space-y-2 text-blue-800">
                                            <p>• {subscriptions.length} schools onboarded</p>
                                            <p>• {schoolAdmins.length} school administrators</p>
                                            <p>• {schoolAdmins.filter(a => a.is_active).length} active admins</p>
                                            <p>• {platformStats.total_students} total students</p>
                                            <p>• {platformStats.total_teachers} total teachers</p>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                                        <h3 className="text-lg font-semibold text-green-900 mb-4">Plan Distribution</h3>
                                        <div className="space-y-2 text-green-800">
                                            <p>• FREE: {platformStats.free_plan_count} schools</p>
                                            <p>• BASIC: {platformStats.basic_plan_count} schools</p>
                                            <p>• PREMIUM: {platformStats.premium_plan_count} schools</p>
                                            <p>• ENTERPRISE: {platformStats.enterprise_plan_count} schools</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Schools Tab */}
                        {activeTab === 'schools' && (
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Schools Management</h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Limits</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {subscriptions.map(sub => (
                                                <tr key={sub.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {sub.school_details.name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.school_details.code}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${sub.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
                                                            sub.plan === 'PREMIUM' ? 'bg-blue-100 text-blue-800' :
                                                                sub.plan === 'BASIC' ? 'bg-green-100 text-green-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {sub.plan}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                            sub.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {sub.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {sub.max_students}S / {sub.max_teachers}T
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {sub.days_remaining !== null ? `${sub.days_remaining} days` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                        {sub.status === 'ACTIVE' ? (
                                                            <button
                                                                onClick={() => suspendSchool(sub.id)}
                                                                className="text-red-600 hover:text-red-900 font-medium"
                                                            >
                                                                Suspend
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => activateSchool(sub.id)}
                                                                className="text-green-600 hover:text-green-900 font-medium"
                                                            >
                                                                Activate
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* School Admins Tab */}
                        {activeTab === 'admins' && (
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">School Administrators</h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {schoolAdmins.map(admin => (
                                                <tr key={admin.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {admin.first_name} {admin.last_name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{admin.email}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{admin.school_name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${admin.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {admin.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                                        <button
                                                            onClick={() => resetAdminPassword(admin.id)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Reset Password"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deactivateAdmin(admin.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Deactivate"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Features Tab */}
                        {activeTab === 'features' && (
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Feature Control</h2>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Select School</label>
                                    <select
                                        value={selectedSchool || ''}
                                        onChange={(e) => setSelectedSchool(e.target.value)}
                                        className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        {subscriptions.map(sub => (
                                            <option key={sub.school} value={sub.school}>
                                                {sub.school_details.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {features.map(feature => {
                                        const subFeatures = FEATURE_DEFINITIONS[feature.feature as keyof typeof FEATURE_DEFINITIONS] || [];
                                        return (
                                            <div key={feature.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${feature.is_enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                                            {feature.is_enabled ? <CheckCircle size={20} /> : <Settings size={20} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900">{feature.feature_display}</div>
                                                            <div className="text-xs text-gray-500">{feature.feature}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleFeature(feature.id)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${feature.is_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                    >
                                                        <span
                                                            className={`${feature.is_enabled ? 'translate-x-6' : 'translate-x-1'
                                                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Sub-features (Only if enabled) */}
                                                {feature.is_enabled && subFeatures.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sub-Features</div>
                                                        {subFeatures.map(sub => {
                                                            const isSubEnabled = feature.sub_features?.[sub.key] !== false; // Default True
                                                            return (
                                                                <div key={sub.key} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50 rounded">
                                                                    <span className="text-sm text-gray-600">{sub.label}</span>
                                                                    <button
                                                                        onClick={() => toggleSubFeature(feature.id, sub.key, !isSubEnabled)}
                                                                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isSubEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                                                    >
                                                                        <span
                                                                            className={`${isSubEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                                                                } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {/* No Sub-features message */}
                                                {feature.is_enabled && subFeatures.length === 0 && (
                                                    <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 italic">
                                                        No sub-features available
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Subscriptions Tab */}
                        {activeTab === 'subscriptions' && (
                            <div className="text-center py-12">
                                <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Management</h2>
                                <p className="text-gray-600">Detailed subscription management coming soon</p>
                            </div>
                        )}

                        {/* Analytics Tab */}
                        {activeTab === 'analytics' && (
                            <div className="text-center py-12">
                                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Platform Analytics</h2>
                                <p className="text-gray-600">Usage trends, revenue tracking, and school comparisons coming soon</p>
                            </div>
                        )}

                        {/* Audit Logs Tab */}
                        {activeTab === 'audit' && (
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Audit Logs</h2>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {auditLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {log.action_display}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.school_name || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.performed_by_name}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">{log.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Onboard School Modal */}
            {
                showOnboardModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-bold mb-4">Onboard New School</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                                    <input
                                        type="text"
                                        value={onboardData.name}
                                        onChange={(e) => setOnboardData({ ...onboardData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School Code</label>
                                    <input
                                        type="text"
                                        value={onboardData.code}
                                        onChange={(e) => setOnboardData({ ...onboardData, code: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
                                    <select
                                        value={onboardData.board}
                                        onChange={(e) => setOnboardData({ ...onboardData, board: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="CBSE">CBSE</option>
                                        <option value="ICSE">ICSE</option>
                                        <option value="IGCSE">IGCSE</option>
                                        <option value="IB">IB</option>
                                        <option value="STATE">STATE</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                                    <select
                                        value={onboardData.plan}
                                        onChange={(e) => setOnboardData({ ...onboardData, plan: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="FREE">FREE</option>
                                        <option value="BASIC">BASIC</option>
                                        <option value="PREMIUM">PREMIUM</option>
                                        <option value="ENTERPRISE">ENTERPRISE</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
                                        <input
                                            type="number"
                                            value={onboardData.max_students}
                                            onChange={(e) => setOnboardData({ ...onboardData, max_students: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Teachers</label>
                                        <input
                                            type="number"
                                            value={onboardData.max_teachers}
                                            onChange={(e) => setOnboardData({ ...onboardData, max_teachers: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setShowOnboardModal(false)}
                                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onboardSchool}
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                                >
                                    {loading ? 'Creating...' : 'Create School'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Admin Modal */}
            {
                showAdminModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h2 className="text-xl font-bold mb-4">Create School Admin</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={adminData.email}
                                        onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={adminData.first_name}
                                            onChange={(e) => setAdminData({ ...adminData, first_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={adminData.last_name}
                                            onChange={(e) => setAdminData({ ...adminData, last_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={adminData.phone_number}
                                        onChange={(e) => setAdminData({ ...adminData, phone_number: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                                    <select
                                        value={adminData.school}
                                        onChange={(e) => setAdminData({ ...adminData, school: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="">Select School</option>
                                        {subscriptions.map(sub => (
                                            <option key={sub.school} value={sub.school}>
                                                {sub.school_details.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={adminData.password}
                                        onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        placeholder="Leave blank for default"
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-6">
                                <button
                                    onClick={() => setShowAdminModal(false)}
                                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createSchoolAdmin}
                                    disabled={loading}
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                                >
                                    {loading ? 'Creating...' : 'Create Admin'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
