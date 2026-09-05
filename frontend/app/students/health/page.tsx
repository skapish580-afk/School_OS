'use client';

import { useState, useEffect } from 'react';
import { 
  HeartPulse, ShieldCheck, Stethoscope, Info
} from 'lucide-react';
import api from '@/lib/api';

interface ClinicVisit {
  id: string;
  visit_date: string;
  symptom: string;
  treatment_given: string;
  sent_home: boolean;
  nurse_name: string;
}

export default function StudentHealthPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/health/profiles/student_health/');
      setHealthData(res.data);
    } catch (err) {
      console.error('Failed to fetch student health data', err);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  const visits: ClinicVisit[] = healthData?.visits || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-rose-600" /> View-Only Access
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
              <HeartPulse size={24} />
            </div>
            Health & Medical Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Your official clinic visit history managed by School Infirmary.
          </p>
        </div>
      </div>

      {/* Clinic Visits Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Stethoscope size={20} className="text-rose-600" /> School Infirmary & Clinic Visits Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical records of your visits to the school nurse or infirmary.
            </p>
          </div>
          <span className="text-xs font-extrabold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            {visits.length} {visits.length === 1 ? 'Visit' : 'Visits'}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 font-semibold text-sm">
            Loading clinic visit records...
          </div>
        ) : visits.length === 0 ? (
          <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Info size={28} className="mx-auto text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">No Clinic Visits Logged</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No infirmary or clinic visit logs have been recorded for your account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Visit Date</th>
                  <th className="py-3.5 px-4">Symptom</th>
                  <th className="py-3.5 px-4">Treatment Given</th>
                  <th className="py-3.5 px-4">Attending Nurse</th>
                  <th className="py-3.5 px-4">Sent Home</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900 font-mono text-xs">
                      {new Date(v.visit_date).toLocaleDateString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-800">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-lg border border-amber-200/60">
                        {v.symptom}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-700 text-xs">{v.treatment_given}</td>
                    <td className="py-4 px-4 font-medium text-slate-600 text-xs">{v.nurse_name}</td>
                    <td className="py-4 px-4">
                      {v.sent_home ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 font-extrabold text-xs rounded-full border border-rose-200">
                          Yes (Sent Home)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                          No (Returned to Class)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
