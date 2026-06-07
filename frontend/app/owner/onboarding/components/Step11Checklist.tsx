'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, Circle, Loader2, Rocket } from 'lucide-react';

interface Step11Props {
    schoolId: string;
    onComplete: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

interface ChecklistItem {
    label: string;
    field: string;
    required: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
    { label: 'School Identity Configured', field: 'step_1_school_identity', required: true },
    { label: 'Owner & Admin Created', field: 'step_2_owner_admin', required: true },
    { label: 'Campus Setup', field: 'step_3_campus', required: false },
    { label: 'Academic Programs Configured', field: 'step_4_programs', required: true },
    { label: 'Curriculum Mapped', field: 'step_5_curriculum', required: false },
    { label: 'Features Enabled', field: 'step_6_features', required: true },
    { label: 'Fees Configured', field: 'step_7_fees', required: false },
    { label: 'RBAC Setup', field: 'step_8_rbac', required: false },
    { label: 'Branding Configured', field: 'step_9_branding', required: false },
    { label: 'Legal & Compliance', field: 'step_10_legal', required: true },
];

const GO_LIVE_ITEMS: ChecklistItem[] = [
    { label: 'At least one admin created', field: 'admin_created', required: true },
    { label: 'Academic programs created', field: 'programs_created', required: true },
    { label: 'Grades added to programs', field: 'grades_added', required: true },
    { label: 'Teachers added', field: 'teachers_added', required: false },
    { label: 'Students uploaded', field: 'students_uploaded', required: false },
    { label: 'Fee structure configured', field: 'fees_configured', required: false },
];

export function Step11Checklist({ schoolId, onComplete, setLoading, setError }: Step11Props) {
    const [checklist, setChecklist] = useState<any>(null);
    const [status, setStatus] = useState<any>(null);
    const [completing, setCompleting] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, [schoolId]);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.get(
                `http://localhost:8000/api/v1/owner/onboarding/${schoolId}/status/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStatus(response.data);
            setChecklist(response.data.checklist);
        } catch (err: any) {
            setError('Failed to load onboarding status');
        }
    };

    const handleGoLive = async () => {
        setError('');
        setCompleting(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                `http://localhost:8000/api/v1/owner/onboarding/${schoolId}/complete/`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setTimeout(() => onComplete(), 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to complete onboarding');
            setCompleting(false);
        }
    };

    if (!checklist || !status) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const canGoLive = status.can_go_live;
    const completionPercentage = status.completion_percentage;

    return (
        <div className="space-y-6">
            {/* Progress Summary */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-bold">Onboarding Progress</h3>
                        <p className="text-blue-100">Review your setup before going live</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">{completionPercentage}%</div>
                        <div className="text-blue-100 text-sm">Complete</div>
                    </div>
                </div>
                <div className="w-full bg-blue-400 rounded-full h-3">
                    <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${completionPercentage}%` }}
                    />
                </div>
            </div>

            {/* Onboarding Steps Checklist */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Onboarding Steps</h3>
                <div className="space-y-3">
                    {CHECKLIST_ITEMS.map((item) => {
                        const isComplete = checklist[item.field];
                        return (
                            <div key={item.field} className="flex items-center gap-3">
                                {isComplete ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                                )}
                                <span className={`text-sm ${isComplete ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {item.label}
                                    {item.required && !isComplete && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Go-Live Checklist */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Go-Live Checklist</h3>
                <div className="space-y-3">
                    {GO_LIVE_ITEMS.map((item) => {
                        const isComplete = checklist[item.field];
                        return (
                            <div key={item.field} className="flex items-center gap-3">
                                {isComplete ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                                )}
                                <span className={`text-sm ${isComplete ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {item.label}
                                    {item.required && !isComplete && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Status Messages */}
            {!canGoLive && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-900">
                        <strong>Not Ready:</strong> Please complete all mandatory steps (marked with *) before going live.
                    </p>
                </div>
            )}

            {canGoLive && !completing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-900">
                        <strong>Ready to Go Live!</strong> All mandatory steps are complete. Click below to activate the school.
                    </p>
                </div>
            )}

            {completing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                    <Rocket className="h-16 w-16 text-blue-600 mx-auto mb-4 animate-bounce" />
                    <h3 className="text-2xl font-bold text-blue-900 mb-2">Going Live...</h3>
                    <p className="text-blue-700">Activating your school on SchoolOS</p>
                </div>
            )}

            {/* Go Live Button */}
            {!completing && (
                <button
                    onClick={handleGoLive}
                    disabled={!canGoLive}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-bold text-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    <Rocket className="h-6 w-6" />
                    {canGoLive ? 'Go Live!' : 'Complete Required Steps First'}
                </button>
            )}
        </div>
    );
}
