'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SimpleOwnerLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('owner@schoolos.com');
    const [password, setPassword] = useState('Owner123!');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log('1. Attempting login...');

            // Step 1: Login
            const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!loginResponse.ok) {
                throw new Error(`Login failed: ${loginResponse.status}`);
            }

            const loginData = await loginResponse.json();
            console.log('2. Login successful, got tokens');

            // Store tokens
            localStorage.setItem('access_token', loginData.access);
            localStorage.setItem('refresh_token', loginData.refresh);

            // Step 2: Get user profile
            console.log('3. Fetching user profile...');
            const profileResponse = await fetch('http://localhost:8000/api/v1/auth/me/', {
                headers: { Authorization: `Bearer ${loginData.access}` },
            });

            if (!profileResponse.ok) {
                throw new Error(`Profile fetch failed: ${profileResponse.status}`);
            }

            const userData = await profileResponse.json();
            console.log('4. User data:', userData);

            // Store user data
            localStorage.setItem('user', JSON.stringify(userData));

            // Step 3: Redirect based on user type
            if (userData.user_type === 'PLATFORM_ADMIN') {
                console.log('5. Redirecting to /owner...');
                router.push('/owner');
            } else {
                console.log('5. Not a platform admin, redirecting to dashboard');
                router.push('/dashboard');
            }

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">Platform Owner Login</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Logging in...' : 'Login as Platform Owner'}
                    </button>
                </form>

                <div className="mt-6 p-4 bg-gray-50 rounded text-sm">
                    <p className="font-semibold mb-2">Test Credentials:</p>
                    <p>Email: owner@schoolos.com</p>
                    <p>Password: Owner123!</p>
                </div>
            </div>
        </div>
    );
}
