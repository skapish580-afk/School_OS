'use client';

import { useState } from 'react';
import axios from 'axios';

interface Step10Props {
    schoolId: string;
    onComplete: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
}

export function Step10Legal({ schoolId, onComplete, setLoading, setError }: Step10Props) {
    const [formData, setFormData] = useState({
        registration_number: '',
        gst_number: '',
        agreement_accepted: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.agreement_accepted) {
            setError('You must accept the terms and conditions to proceed');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await axios.post(
                'http://localhost:8000/api/v1/owner/onboarding/step10/',
                {
                    school_id: schoolId,
                    ...formData,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                onComplete();
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save legal information');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900">
                    <strong>Important:</strong> Please provide accurate legal and compliance information.
                    This information may be required for regulatory purposes.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        School Registration Number
                    </label>
                    <input
                        type="text"
                        value={formData.registration_number}
                        onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="REG123456"
                    />
                    <p className="text-xs text-gray-500 mt-1">Official school registration number</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        GST Number
                    </label>
                    <input
                        type="text"
                        value={formData.gst_number}
                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="27AABCU9603R1ZM"
                        maxLength={15}
                    />
                    <p className="text-xs text-gray-500 mt-1">If applicable (India)</p>
                </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto mb-4">
                    <div className="text-sm text-gray-700 space-y-3">
                        <p><strong>1. Service Agreement</strong></p>
                        <p>By using SchoolOS, you agree to our terms of service and privacy policy.</p>

                        <p><strong>2. Data Protection</strong></p>
                        <p>We are committed to protecting your school's data and student information in accordance with applicable data protection laws.</p>

                        <p><strong>3. Subscription & Billing</strong></p>
                        <p>Your subscription will be billed according to the plan you select. You can upgrade or downgrade at any time.</p>

                        <p><strong>4. Support & Updates</strong></p>
                        <p>We provide regular updates and support to ensure smooth operation of the platform.</p>

                        <p><strong>5. Termination</strong></p>
                        <p>Either party may terminate this agreement with 30 days notice. Your data will be available for export for 90 days after termination.</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        id="agreement"
                        checked={formData.agreement_accepted}
                        onChange={(e) => setFormData({ ...formData, agreement_accepted: e.target.checked })}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        required
                    />
                    <label htmlFor="agreement" className="text-sm text-gray-700">
                        I have read and agree to the Terms & Conditions, Privacy Policy, and Data Protection Agreement.
                        I confirm that I have the authority to enter into this agreement on behalf of the school.
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                </div>
            </div>

            <button
                type="submit"
                disabled={!formData.agreement_accepted}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Accept & Continue
            </button>
        </form>
    );
}
