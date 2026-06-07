'use client';

import { useState } from 'react';
import axios from 'axios';

interface Step2Props {
    schoolId: string;
    onComplete: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

export function Step2OwnerAdmin({ schoolId, onComplete, setLoading, setError }: Step2Props) {
    const [formData, setFormData] = useState({
        owner_name: '',
        owner_email: '',
        mobile_number: '',
        password: '',
        send_invite: false,
    });

    const [createdPassword, setCreatedPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step2/',
                {
                    school_id: schoolId,
                    ...formData,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                if (response.data.password) {
                    setCreatedPassword(response.data.password);
                }
                setTimeout(() => onComplete(), 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create admin');
        } finally {
            setLoading(false);
        }
    };

    if (createdPassword) {
        return (
            <div className="text-center py-12">
                <div className="bg-green-50 border-2 border-green-500 rounded-xl p-8 max-w-md mx-auto">
                    <h3 className="text-2xl font-bold text-green-900 mb-4">Admin Created Successfully!</h3>
                    <div className="bg-white rounded-lg p-6 mb-4">
                        <p className="text-sm text-gray-600 mb-2">Email:</p>
                        <p className="text-lg font-mono font-bold text-gray-900 mb-4">{formData.owner_email}</p>
                        <p className="text-sm text-gray-600 mb-2">Password:</p>
                        <p className="text-lg font-mono font-bold text-blue-600">{createdPassword}</p>
                    </div>
                    <p className="text-sm text-gray-600">Please save these credentials securely!</p>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Owner Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.owner_name}
                        onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        required
                        value={formData.owner_email}
                        onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="john@school.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Number
                    </label>
                    <input
                        type="tel"
                        value={formData.mobile_number}
                        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+919876543210"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Secure password"
                        minLength={8}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                    <strong>Note:</strong> This user will have full administrative access to the school.
                    They cannot be deleted and will have complete control over all school operations.
                </p>
            </div>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
                Create Admin & Continue
            </button>
        </form>
    );
}
