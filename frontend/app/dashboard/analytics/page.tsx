'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  Calendar, Activity, Loader2, ArrowUp, ArrowDown, CheckCircle
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch multiple analytics endpoints
      const [studentsRes, enrollmentsRes, financeRes, attendanceRes, settingsRes] = await Promise.all([
        api.get('/students/'),
        api.get('/enrollments/student-enrollments/'),
        api.get('/finance/invoices/'),
        api.get('/attendance/'),
        api.get('/schools/settings/my_settings/')
      ]);
      
      const students = studentsRes.data;
      const enrollments = enrollmentsRes.data;
      const invoices = financeRes.data;
      const settings = settingsRes.data;
      
      // Calculate analytics
      const activeEnrollments = enrollments.filter((e: any) => e.status === 'ACTIVE');
      const graduatedEnrollments = enrollments.filter((e: any) => e.status === 'GRADUATED');
      
      const totalStudents = activeEnrollments.length;
      const totalAlumni = graduatedEnrollments.length;
      const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
      const paidInvoices = invoices.filter((inv: any) => inv.status === 'PAID').length;
      const pendingInvoices = invoices.filter((inv: any) => inv.status === 'UNPAID').length;
      const showAlumni = settings.show_alumni_stats;
      
      // Grade distribution
      const gradeDistribution: any = {};
      students.forEach((s: any) => {
        const grade = s.current_class?.split('-')[0] || 'Unknown';
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      });
      
      const gradeData = Object.keys(gradeDistribution).map(grade => ({
        grade: `Grade ${grade}`,
        students: gradeDistribution[grade]
      }));
      
      // Payment status
      const paymentData = [
        { name: 'Paid', value: paidInvoices, color: '#10b981' },
        { name: 'Pending', value: pendingInvoices, color: '#f59e0b' },
        { name: 'Partial', value: invoices.filter((i: any) => i.status === 'PARTIAL').length, color: '#3b82f6' }
      ];
      
      setAnalytics({
        totalStudents,
        totalAlumni,
        showAlumni,
        totalRevenue,
        paidInvoices,
        pendingInvoices,
        gradeData,
        paymentData
      });
    } catch (error) {
      console.error('Failed to fetch analytics', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-600 mt-1">Data-driven insights for better decision making</p>
      </div>

      {/* Key Metrics */}
      <div className={`grid grid-cols-1 ${analytics.showAlumni ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6`}>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users size={24} />
            <ArrowUp size={18} />
          </div>
          <div className="text-3xl font-bold mb-1">{analytics.totalStudents}</div>
          <div className="text-blue-100 text-sm">Active Students</div>
        </div>
        
        {analytics.showAlumni && (
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Users size={24} />
              <CheckCircle size={18} />
            </div>
            <div className="text-3xl font-bold mb-1">{analytics.totalAlumni}</div>
            <div className="text-indigo-100 text-sm">Alumni</div>
          </div>
        )}
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} />
            <TrendingUp size={18} />
          </div>
          <div className="text-3xl font-bold mb-1">₹{(analytics.totalRevenue / 1000).toFixed(0)}K</div>
          <div className="text-green-100 text-sm">Total Revenue</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Activity size={24} />
            <ArrowUp size={18} />
          </div>
          <div className="text-3xl font-bold mb-1">{analytics.paidInvoices}</div>
          <div className="text-purple-100 text-sm">Paid Invoices</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar size={24} />
            <ArrowDown size={18} />
          </div>
          <div className="text-3xl font-bold mb-1">{analytics.pendingInvoices}</div>
          <div className="text-orange-100 text-sm">Pending Fees</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            Student Distribution by Grade
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.gradeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="students" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-green-600" />
            Invoice Payment Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.paymentData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {analytics.paymentData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">📊 Key Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold mb-1">
              {((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(0)}%
            </div>
            <div className="text-indigo-100 text-sm">Collection Rate</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold mb-1">
              {analytics.gradeData.length > 0 ? Math.max(...analytics.gradeData.map((g: any) => g.students)) : 0}
            </div>
            <div className="text-indigo-100 text-sm">Largest Grade</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold mb-1">
              ₹{analytics.totalStudents > 0 ? (analytics.totalRevenue / analytics.totalStudents).toFixed(0) : 0}
            </div>
            <div className="text-indigo-100 text-sm">Avg. Fee per Student</div>
          </div>
        </div>
      </div>
    </div>
  );
}
