'use client';

// Steps 7, 8, 9 - Optional steps with skip functionality

interface OptionalStepProps {
    schoolId: string;
    onComplete: () => void;
    onSkip: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

export function Step7Fees({ schoolId, onComplete, onSkip }: OptionalStepProps) {
    return (
        <div className="text-center py-12">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-purple-900 mb-4">Fees & Payment Configuration</h3>
                <p className="text-gray-700 mb-6">
                    Configure fee structures, payment cycles, and billing rules for your school.
                </p>
                <p className="text-sm text-gray-600 mb-8">
                    You can set up fees later from the Finance module in the school admin dashboard.
                </p>
                <button
                    onClick={onSkip}
                    className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                    Skip for Now
                </button>
            </div>
        </div>
    );
}

export function Step8RBAC({ schoolId, onComplete, onSkip }: OptionalStepProps) {
    return (
        <div className="text-center py-12">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-purple-900 mb-4">Roles & Permissions (RBAC)</h3>
                <p className="text-gray-700 mb-6">
                    Set up custom roles and permissions for different user types in your school.
                </p>
                <p className="text-sm text-gray-600 mb-8">
                    Default roles (Principal, Teacher, Accountant, etc.) are already configured.
                    You can customize them later.
                </p>
                <button
                    onClick={onSkip}
                    className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                    Skip for Now
                </button>
            </div>
        </div>
    );
}

export function Step9Branding({ schoolId, onComplete, onSkip }: OptionalStepProps) {
    return (
        <div className="text-center py-12">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-purple-900 mb-4">Branding & Communication</h3>
                <p className="text-gray-700 mb-6">
                    Customize your school's theme colors, logo, and communication templates.
                </p>
                <p className="text-sm text-gray-600 mb-8">
                    You can configure branding settings later from the school settings page.
                </p>
                <button
                    onClick={onSkip}
                    className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                    Skip for Now
                </button>
            </div>
        </div>
    );
}
