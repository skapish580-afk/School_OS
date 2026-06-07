'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, Users, DollarSign, ToggleLeft, ToggleRight, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface School {
  id: number;
  name: string;
  code: string;
  board: string;
}

interface Subscription {
  id: number;
  school: number;
  school_details: School;
  plan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  start_date: string;
  end_date: string;
  max_students: number;
  max_teachers: number;
  days_remaining: number;
  suspended_by: number | null;
  suspension_reason: string;
}

interface FeatureAccess {
  id: number;
  school: number;
  school_name: string;
  feature: string;
  feature_display: string;
  is_enabled: boolean;
}

interface UsageSummary {
  total_students: number;
  total_teachers: number;
  attendance_entries: number;
  invoices_created: number;
  gate_passes: number;
  transfers: number;
}

export default function PlatformAdminPage() {
  const [activeTab, setActiveTab] = useState<'schools' | 'features' | 'usage'>('schools');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [features, setFeatures] = useState<FeatureAccess[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [onboardData, setOnboardData] = useState({
    name: '',
    code: '',
    board: 'CBSE',
    plan: 'FREE',
    max_students: 50,
    max_teachers: 10,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      fetchFeatures(selectedSchool);
      fetchUsage(selectedSchool);
    }
  }, [selectedSchool]);

  const fetchSubscriptions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('http://localhost:8000/api/v1/platform/subscriptions/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptions(response.data);
      if (response.data.length > 0 && !selectedSchool) {
        setSelectedSchool(response.data[0].school);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const fetchFeatures = async (schoolId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://localhost:8000/api/v1/platform/features/school_matrix/?school_id=${schoolId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFeatures(response.data);
    } catch (error) {
      console.error('Error fetching features:', error);
    }
  };

  const fetchUsage = async (schoolId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(
        `http://localhost:8000/api/v1/platform/metrics/school_summary/?school_id=${schoolId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsage(response.data);
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  const onboardSchool = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        'http://localhost:8000/api/v1/platform/subscriptions/onboard_school/',
        onboardData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('School onboarded successfully!');
      setShowOnboardModal(false);
      fetchSubscriptions();
      setOnboardData({ name: '', code: '', board: 'CBSE', plan: 'FREE', max_students: 50, max_teachers: 10 });
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.error || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const suspendSchool = async (subscriptionId: number) => {
    const reason = prompt('Suspension reason:');
    if (!reason) return;

    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/platform/subscriptions/${subscriptionId}/suspend/`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('School suspended');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error suspending school:', error);
    }
  };

  const reactivateSchool = async (subscriptionId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/platform/subscriptions/${subscriptionId}/reactivate/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('School reactivated');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error reactivating school:', error);
    }
  };

  const toggleFeature = async (featureId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        `http://localhost:8000/api/v1/platform/features/${featureId}/toggle/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFeatures(selectedSchool!);
    } catch (error) {
      console.error('Error toggling feature:', error);
    }
  };

  const selectedSubscription = subscriptions.find(s => s.school === selectedSchool);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Admin</h1>
            <p className="text-gray-600 mt-2">Multi-school management & subscriptions</p>
          </div>
          <button
            onClick={() => setShowOnboardModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Onboard School
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Schools</div>
                <div className="text-2xl font-bold text-gray-900">{subscriptions.length}</div>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Active</div>
                <div className="text-2xl font-bold text-green-600">
                  {subscriptions.filter(s => s.status === 'ACTIVE').length}
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Suspended</div>
                <div className="text-2xl font-bold text-red-600">
                  {subscriptions.filter(s => s.status === 'SUSPENDED').length}
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-2xl font-bold text-purple-600">$0</div>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* School Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Selected School</label>
          <select
            value={selectedSchool || ''}
            onChange={(e) => setSelectedSchool(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {subscriptions.map(sub => (
              <option key={sub.school} value={sub.school}>
                {sub.school_details.name} ({sub.plan} - {sub.status})
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {['schools', 'features', 'usage'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Schools Tab */}
            {activeTab === 'schools' && (
              <div>
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
                      <tr key={sub.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sub.school_details.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.school_details.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sub.plan === 'ENTERPRISE' ? 'bg-purple-100 text-purple-800' :
                              sub.plan === 'PREMIUM' ? 'bg-blue-100 text-blue-800' :
                                sub.plan === 'BASIC' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                            }`}>
                            {sub.plan}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              sub.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sub.max_students} students / {sub.max_teachers} teachers
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {sub.days_remaining !== null ? `${sub.days_remaining} days` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          {sub.status === 'ACTIVE' ? (
                            <button
                              onClick={() => suspendSchool(sub.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => reactivateSchool(sub.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && selectedSchool && (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  {features.map(feature => (
                    <div key={feature.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{feature.feature_display}</div>
                        <div className="text-sm text-gray-500">{feature.feature}</div>
                      </div>
                      <button
                        onClick={() => toggleFeature(feature.id)}
                        className="focus:outline-none"
                      >
                        {feature.is_enabled ? (
                          <ToggleRight className="h-8 w-8 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-gray-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Tab */}
            {activeTab === 'usage' && usage && (
              <div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Students</div>
                    <div className="text-2xl font-bold text-blue-600">{Math.round(usage.total_students)}</div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Teachers</div>
                    <div className="text-2xl font-bold text-green-600">{Math.round(usage.total_teachers)}</div>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Attendance Entries</div>
                    <div className="text-2xl font-bold text-purple-600">{usage.attendance_entries}</div>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Invoices</div>
                    <div className="text-2xl font-bold text-orange-600">{usage.invoices_created}</div>
                  </div>

                  <div className="bg-pink-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Gate Passes</div>
                    <div className="text-2xl font-bold text-pink-600">{usage.gate_passes}</div>
                  </div>

                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Transfers</div>
                    <div className="text-2xl font-bold text-indigo-600">{usage.transfers}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onboard Modal */}
      {showOnboardModal && (
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
                  <option value="FREE">Free</option>
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="ENTERPRISE">Enterprise</option>
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
      )}
    </div>
  );
}
