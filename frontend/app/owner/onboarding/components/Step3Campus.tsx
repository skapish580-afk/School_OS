'use client';

import { useState } from 'react';
import axios from 'axios';

interface Step3Props {
    schoolId: string;
    onComplete: (campusId: string) => void;
    onSkip: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

export function Step3Campus({ schoolId, onComplete, onSkip, setLoading, setError }: Step3Props) {
    const [formData, setFormData] = useState({
        name: 'Main Campus',
        code: 'MAIN',
        address: '',
        is_primary: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step3/',
                {
                    school_id: schoolId,
                    ...formData,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                onComplete(response.data.campus_id);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create campus');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-purple-900">
                    <strong>Optional Step:</strong> Even if you have a single campus, creating a "Main Campus"
                    enables future expansion without database migration. You can skip this step and add campuses later.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campus Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Main Campus"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Campus Code <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="MAIN"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campus Address <span className="text-red-500">*</span>
                </label>
                <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123 Main Street, Area, City - 400001"
                />
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    id="is_primary"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_primary" className="text-sm text-gray-700">
                    Mark as primary campus
                </label>
            </div>

            <div className="flex gap-3">
                <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Create Campus & Continue
                </button>
                <button
                    type="button"
                    onClick={onSkip}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Skip
                </button>
            </div>
        </form>
    );
}
