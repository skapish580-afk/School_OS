'use client';

import React from 'react';
import { useFeatures } from '@/lib/FeatureContext';
import { ShieldAlert, Lock } from 'lucide-react';
import Link from 'next/link';

interface FeatureGuardProps {
    feature: string;
    subFeature?: string;
    children: React.ReactNode;
}

export default function FeatureGuard({ feature, subFeature, children }: FeatureGuardProps) {
    const { isFeatureEnabled, loading } = useFeatures();

    if (loading) {
        return <div className="p-10 flex justify-center text-gray-500">Loading permissions...</div>;
    }

    if (isFeatureEnabled(feature, subFeature)) {
        return <>{children}</>;
    }

    // Feature Disabled UI
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-xl border border-gray-200 m-6">
            <div className="bg-red-100 p-4 rounded-full mb-6 relative">
                <Lock className="w-12 h-12 text-red-600" />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h1>
            <p className="text-gray-600 max-w-md mb-8">
                The <strong>{feature}</strong> module is currently disabled for your school.
                This feature may need to be upgraded or reactivated by your administrator.
            </p>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-sm w-full">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 justify-center">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Contact Support
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    To enable this feature, please contact the School OS Super Admin team immediately.
                </p>
                <div className="space-y-2">
                    <div className="text-sm font-medium text-blue-600 bg-blue-50 py-2 px-3 rounded">
                        support@school-os.com
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 font-medium text-sm">
                    ← Return to Dashboard
                </Link>
            </div>
        </div>
    );
}
