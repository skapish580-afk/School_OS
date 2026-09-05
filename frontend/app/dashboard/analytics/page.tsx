'use client';

import { useState } from 'react';
import { Sparkles, BarChart3, TrendingUp, PieChart, BrainCircuit, Bell } from 'lucide-react';

export default function AnalyticsPage() {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-blue-50/30 to-teal-50/40 relative overflow-hidden rounded-3xl">
      {/* Background Decorative Orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-300/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl w-full text-center space-y-8 py-10">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-100/80 border border-cyan-200 text-cyan-800 text-xs font-bold shadow-sm backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-cyan-600 animate-spin" style={{ animationDuration: '3s' }} />
          <span>MODULE IN DEVELOPMENT</span>
        </div>

        {/* Hero Icon Badge */}
        <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-cyan-600 to-teal-600 p-0.5 shadow-2xl shadow-cyan-500/25">
          <div className="w-full h-full bg-white dark:bg-gray-900 rounded-[22px] flex items-center justify-center">
            <BarChart3 className="w-12 h-12 text-cyan-600" />
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Analytics & Insights <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">Coming Soon</span>
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-xl mx-auto font-normal leading-relaxed">
            We are engineering powerful analytics tools with AI-driven academic trends, interactive performance charts, and automated administrative intelligence.
          </p>
        </div>

        {/* Feature Teasers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-gray-150 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Predictive Models</h3>
            <p className="text-xs text-gray-500 mt-1">Smart forecasts identifying student academic growth and attendance risks early.</p>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-gray-150 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Interactive Dashboards</h3>
            <p className="text-xs text-gray-500 mt-1">Customizable metrics for tracking subject performance across all sections.</p>
          </div>

          <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-gray-150 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Financial Intelligence</h3>
            <p className="text-xs text-gray-500 mt-1">Deep visual breakdowns of fee collection, revenue trends, and salary expenses.</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setSubscribed(!subscribed)}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            {subscribed ? 'Notification Preference Saved!' : 'Notify Me Upon Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}
