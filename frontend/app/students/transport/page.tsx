'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Bus, ShieldCheck, Lock, MapPin, Navigation, 
  Phone, Clock, UserCheck, Info, Radio, CalendarCheck,
  CheckCircle2, XCircle, Sun, Moon, AlertCircle
} from 'lucide-react';
import api from '@/lib/api';

const StudentTransportMap = dynamic(() => import('./StudentTransportMap'), { ssr: false });

export default function StudentTransportPage() {
  const [transportData, setTransportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransportData(true);
    // Poll every 8 seconds for real-time bus location & ping updates
    const pollInterval = setInterval(() => {
      fetchTransportData(false);
    }, 8000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchTransportData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.get('/transport/assignments/student_transport/');
      setTransportData(res.data);
    } catch (err) {
      console.error('Failed to fetch student transport data', err);
      if (isInitial) setTransportData(null);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const isAssigned = transportData?.is_assigned;
  const bus = transportData?.bus;
  const route = transportData?.route;
  const stop = transportData?.stop;
  const school = transportData?.school;
  const busStops = transportData?.bus_stops || [];
  const allStops = transportData?.all_stops || [];
  const routePositions = transportData?.route_positions || [];
  const recentAttendance = transportData?.recent_attendance || [];

  // Attendance summary calculations
  const morningRecords = recentAttendance.filter((a: any) => a.journey === 'MORNING');
  const afternoonRecords = recentAttendance.filter((a: any) => a.journey === 'AFTERNOON');

  const morningPresentCount = morningRecords.filter((a: any) => a.status === 'PRESENT').length;
  const afternoonPresentCount = afternoonRecords.filter((a: any) => a.status === 'PRESENT').length;

  const morningRate = morningRecords.length > 0 
    ? Math.round((morningPresentCount / morningRecords.length) * 100) 
    : 100;
  const afternoonRate = afternoonRecords.length > 0 
    ? Math.round((afternoonPresentCount / afternoonRecords.length) * 100) 
    : 100;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck size={13} className="text-blue-600" /> View-Only Access
            </span>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-extrabold flex items-center gap-1">
              <Lock size={11} /> School Admin Synced
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Bus size={24} />
            </div>
            Transport & School Bus Allocation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assigned school bus, pickup/drop-off stop timings, driver contact info, live GPS map tracking, and daily bus attendance logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-blue-50 border border-blue-100 px-5 py-2.5 rounded-2xl text-right">
            <span className="text-xs text-blue-700 font-bold block">Assigned Bus</span>
            <span className="text-xl font-black text-blue-800">
              {isAssigned ? bus?.school_bus_number || bus?.registration_number : 'Not Allocated'}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-500 font-semibold text-sm">
          Fetching transport allocation details & map route...
        </div>
      ) : !isAssigned ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <Info size={36} className="mx-auto text-slate-400" />
          <h3 className="text-lg font-bold text-slate-800">No School Bus Assigned</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You currently have no transport allocation assigned by School Admin. If you require bus service, please contact school administration.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CARD 1: Assigned Bus Information */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                    <Bus size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">School Vehicle</h3>
                    <p className="text-xs text-slate-400">{bus?.vehicle_type || 'School Bus'}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                  Active Vehicle
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Bus Number / Registration</span>
                  <p className="text-base font-extrabold text-slate-900 font-mono">
                    {bus?.school_bus_number} <span className="text-xs font-normal text-slate-500">({bus?.registration_number})</span>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Vehicle Capacity</span>
                  <p className="text-sm font-bold text-slate-800">
                    {bus?.capacity} Passenger Seats
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-1">
                  <span className="text-xs font-bold text-blue-700 uppercase block">Driver Contact</span>
                  <p className="text-sm font-extrabold text-blue-900 flex items-center gap-1.5">
                    <UserCheck size={16} /> {bus?.driver_name}
                  </p>
                  <p className="text-xs font-mono font-bold text-blue-700 flex items-center gap-1 pt-0.5">
                    <Phone size={13} /> {bus?.driver_phone}
                  </p>
                </div>
              </div>
            </div>

            {/* CARD 2: Route & Stop Details & Live Map */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Navigation size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Route & Stop Schedule</h3>
                    <p className="text-xs text-slate-400">{route?.name || 'Assigned Transport Route'}</p>
                  </div>
                </div>
              </div>

              {/* Interactive Leaflet Map Display */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <StudentTransportMap
                  school={school}
                  bus={bus}
                  route={route}
                  busStops={busStops}
                  allStops={allStops}
                  routePositions={routePositions}
                  currentStudentSuid={transportData?.suid}
                  currentStudentName={transportData?.student_name}
                />
              </div>

              {/* Route Advisory Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <Radio size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">Route Advisory Notice</h4>
                    <p className="text-[11px] text-slate-300 font-medium leading-normal mt-0.5">
                      The Route of the bus as shown in the map may not be followed by the bus in case of heavy traffic, road closure due to construction etc.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800 shrink-0">
                  Live Polling
                </span>
              </div>

            </div>
          </div>

          {/* CARD 3: My Bus Attendance History */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <CalendarCheck size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">My Bus Attendance History</h3>
                  <p className="text-xs text-slate-400">Daily Morning & Afternoon bus boarding logs marked by Bus Staff</p>
                </div>
              </div>

              {recentAttendance.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-150 rounded-xl text-center">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-600 block">Morning Rate</span>
                    <span className="text-sm font-black text-emerald-800">{morningRate}%</span>
                  </div>
                  <div className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-150 rounded-xl text-center">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-600 block">Afternoon Rate</span>
                    <span className="text-sm font-black text-indigo-800">{afternoonRate}%</span>
                  </div>
                </div>
              )}
            </div>

            {recentAttendance.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200/80 space-y-2">
                <CalendarCheck size={40} className="mx-auto opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">No Bus Attendance Logs Marked Yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Your morning and afternoon bus boarding status marked by bus staff will automatically record and display here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-150">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Journey</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-left">Assigned Bus</th>
                      <th className="px-4 py-3 text-left">Remarks & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {recentAttendance.map((item: any) => {
                      const isMorning = item.journey === 'MORNING';
                      const isPresent = item.status === 'PRESENT';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isMorning 
                                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            }`}>
                              {isMorning ? <Sun size={12} className="text-amber-600" /> : <Moon size={12} className="text-indigo-600" />}
                              {isMorning ? 'Morning (To School)' : 'Afternoon (From School)'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black ${
                              isPresent 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {isPresent ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              {isPresent ? 'PRESENT' : 'ABSENT'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-800 font-bold whitespace-nowrap">
                            {item.bus_number}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500">
                            {item.remarks ? (
                              <span className="text-slate-700 font-semibold">{item.remarks}</span>
                            ) : (
                              <span className="text-slate-400 italic">No remarks</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
