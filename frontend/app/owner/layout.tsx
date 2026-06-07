'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated and is platform admin
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');

        if (!token) {
            router.push('/login');
            return;
        }

        if (userStr) {
            const user = JSON.parse(userStr);
            if (user.user_type !== 'PLATFORM_ADMIN') {
                // Not a platform admin, redirect to appropriate dashboard
                if (user.role === 'TEACHER') {
                    router.push('/teachers');
                } else {
                    router.push('/dashboard');
                }
                return;
            }
        }

        setLoading(false);
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {children}
        </div>
    );
}
