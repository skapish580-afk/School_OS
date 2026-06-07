'use client';

import { useState } from 'react';
import axios from 'axios';
import { Check } from 'lucide-react';

interface Step6Props {
    schoolId: string;
    onComplete: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

const FEATURES = [
    // Core (Always ON)
    { code: 'STUDENTS', name: 'Student Management', category: 'Core', required: true },
    { code: 'TEACHERS', name: 'Teacher Management', category: 'Core', required: true },
    { code: 'ATTENDANCE', name: 'Attendance', category: 'Core', required: true },
    { code: 'ANNOUNCEMENTS', name: 'Announcements', category: 'Core', required: true },

    // Optional Modules
    { code: 'FINANCE', name: 'Fees & Billing', category: 'Finance' },
    { code: 'ONLINE_PAYMENTS', name: 'Online Payments', category: 'Finance' },
    { code: 'EXAMS', name: 'Exams & Report Cards', category: 'Academics' },
    { code: 'HOMEWORK', name: 'Homework', category: 'Academics' },
    { code: 'TRANSPORT', name: 'Transport', category: 'Operations' },
    { code: 'HOSTEL', name: 'Hostel', category: 'Operations' },
    { code: 'LIBRARY', name: 'Library', category: 'Operations' },
    { code: 'INVENTORY', name: 'Inventory', category: 'Operations' },
    { code: 'TIMETABLE', name: 'Timetable Automation', category: 'Academics' },
    { code: 'LIVE_CLASSES', name: 'Live Classes', category: 'Academics' },
    { code: 'AI_ANALYTICS', name: 'AI Analytics', category: 'Advanced' },
    { code: 'HEALTH', name: 'Health Center', category: 'Welfare' },
    { code: 'GATE_PASS', name: 'Gate Pass', category: 'Welfare' },
    { code: 'ACHIEVEMENTS', name: 'Achievements', category: 'Welfare' },
    { code: 'DISCIPLINE', name: 'Discipline', category: 'Welfare' },
];

export function Step6Features({ schoolId, onComplete, setLoading, setError }: Step6Props) {
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
        'STUDENTS', 'TEACHERS', 'ATTENDANCE', 'ANNOUNCEMENTS', 'EXAMS', 'FINANCE'
    ]);

    const toggleFeature = (code: string) => {
        const feature = FEATURES.find(f => f.code === code);
        if (feature?.required) return; // Can't toggle required features

        if (selectedFeatures.includes(code)) {
            setSelectedFeatures(selectedFeatures.filter(f => f !== code));
        } else {
            setSelectedFeatures([...selectedFeatures, code]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step6/',
                {
                    school_id: schoolId,
                    features: selectedFeatures,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                onComplete();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to enable features');
        } finally {
            setLoading(false);
        }
    };

    const categories = [...new Set(FEATURES.map(f => f.category))];

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                    <strong>Modular SaaS Model:</strong> Select the features you want to enable for this school.
                    Core features are always enabled. You can change these later.
                </p>
            </div>

            {categories.map(category => (
                <div key={category} className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {FEATURES.filter(f => f.category === category).map(feature => {
                            const isSelected = selectedFeatures.includes(feature.code);
                            const isRequired = feature.required;

                            return (
                                <button
                                    key={feature.code}
                                    type="button"
                                    onClick={() => toggleFeature(feature.code)}
                                    disabled={isRequired}
                                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${isSelected
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                        } ${isRequired ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                        }`}>
                                        {isSelected && <Check className="h-4 w-4 text-white" />}
                                    </div>
                                    <div className="text-left">
                                        <div className="font-medium text-gray-900">{feature.name}</div>
                                        {isRequired && (
                                            <div className="text-xs text-blue-600">Always enabled</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                    <strong>Selected:</strong> {selectedFeatures.length} features
                </p>
            </div>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
                Enable Features & Continue
            </button>
        </form>
    );
}
