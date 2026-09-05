'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { Bus, MapPin, Navigation, Clock, Users, Loader2, Search, ArrowRight, Trash2, Edit2, Plus, CheckCircle, Route as RouteIcon, Lock } from 'lucide-react';
import Modal from '@/components/Modal';
import dynamic from 'next/dynamic';
import { usePermissionContext } from '@/lib/rbac-context';

// Dynamic import for Leaflet map component to avoid SSR issues
const MapComponent = dynamic(() => import('./MapComponent'), { 
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={48} />
    </div>
  )
});

export default function TransportPage() {
  const { permissions, hasPermission, isAdmin } = usePermissionContext();
  const [routes, setRoutes] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBusModalOpen, setIsBusModalOpen] = useState(false);
  const [isAssignRouteModalOpen, setIsAssignRouteModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Interactive Route Marking states
  const [isInteractiveRouteMode, setIsInteractiveRouteMode] = useState(false);
  const [customWaypoints, setCustomWaypoints] = useState<[number, number][]>([]);

  const [busForm, setBusForm] = useState({
    id: null as number | null,
    registration_number: '',
    school_bus_number: '',
    vehicle_type: 'Bus',
    capacity: 40,
    driver_name: '',
    driver_phone: '',
    student_ids: [] as string[]
  });

  const [routeAssignment, setRouteAssignment] = useState({
    route_id: ''
  });

  // Transport Attendance states
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceVehicle, setAttendanceVehicle] = useState<any>(null);
  const [attendanceDate, setAttendanceDate] = useState('');
  const [attendanceJourney, setAttendanceJourney] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [reachingSchool, setReachingSchool] = useState(false);
  const [leavingSchool, setLeavingSchool] = useState(false);
  const [isAttendanceLocked, setIsAttendanceLocked] = useState(false);
  const [attendanceLockReason, setAttendanceLockReason] = useState('');
  const [attendanceError, setAttendanceError] = useState('');

  useEffect(() => {
    fetchData();
    fetchStudents();
    fetchSchool();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, vRes] = await Promise.allSettled([
        api.get('/transport/routes/'),
        api.get('/transport/vehicles/')
      ]);
      if (rRes.status === 'fulfilled') setRoutes(rRes.value.data);
      if (vRes.status === 'fulfilled') setVehicles(vRes.value.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students/');
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchool = async () => {
    try {
      const res = await api.get('/schools/settings/my_settings/');
      setSchool(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setBusForm({
      id: null,
      registration_number: '',
      school_bus_number: '',
      vehicle_type: 'Bus',
      capacity: 40,
      driver_name: '',
      driver_phone: '',
      student_ids: []
    });
    setIsBusModalOpen(true);
  };

  const handleOpenEditModal = (vehicle: any) => {
    setIsEditing(true);
    setBusForm({
      id: vehicle.id,
      registration_number: vehicle.registration_number,
      school_bus_number: vehicle.school_bus_number || '',
      vehicle_type: vehicle.vehicle_type || 'Bus',
      capacity: vehicle.capacity || 40,
      driver_name: vehicle.driver_name || '',
      driver_phone: vehicle.driver_phone || '',
      student_ids: vehicle.assigned_student_ids || []
    });
    setIsBusModalOpen(true);
  };

  const handleSaveBus = async () => {
    if (loading) return;
    try {
      setLoading(true);
      let vehicleId = busForm.id;
      const activeSchoolId = school?.id || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('school') : null);

      const payload: any = {
        registration_number: busForm.registration_number,
        school_bus_number: busForm.school_bus_number,
        vehicle_type: busForm.vehicle_type,
        capacity: busForm.capacity,
        driver_name: busForm.driver_name,
        driver_phone: busForm.driver_phone
      };

      if (activeSchoolId) {
        payload.school = activeSchoolId;
      }

      if (isEditing && vehicleId) {
        await api.patch(`/transport/vehicles/${vehicleId}/`, payload);
      } else {
        const vehicleRes = await api.post('/transport/vehicles/', payload);
        vehicleId = vehicleRes.data.id;
      }
      
      if (vehicleId) {
        await api.post(`/transport/vehicles/${vehicleId}/assign_students/`, {
          student_ids: busForm.student_ids
        });
      }
      
      setIsBusModalOpen(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.registration_number?.[0] || 
                     err.response?.data?.error || 
                     err.response?.data?.detail || 
                     err.message || 
                     'Error saving bus';
      alert(errMsg);
    } finally {
      fetchData();
      fetchStudents();
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bus?')) return;
    try {
      await api.delete(`/transport/vehicles/${id}/`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const [orderedStudents, setOrderedStudents] = useState<any[]>([]);

  const handleMoveStudent = (index: number, direction: 'up' | 'down') => {
    const newOrdered = [...orderedStudents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrdered.length) return;
    
    const temp = newOrdered[index];
    newOrdered[index] = newOrdered[targetIndex];
    newOrdered[targetIndex] = temp;
    setOrderedStudents(newOrdered);
  };

  const handleStartAssignRoute = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setShowRoute(true);
    const existingWps = vehicle.route_waypoints || vehicle.route?.waypoints;
    if (Array.isArray(existingWps) && existingWps.length > 0) {
      setCustomWaypoints(existingWps as [number, number][]);
    } else {
      setCustomWaypoints([]);
    }
    setIsInteractiveRouteMode(true);
  };

  const handleAddWaypoint = (point: [number, number]) => {
    setCustomWaypoints(prev => [...prev, point]);
  };

  const handleUndoWaypoint = () => {
    setCustomWaypoints(prev => prev.slice(0, -1));
  };

  const handleClearWaypoints = () => {
    setCustomWaypoints([]);
  };

  const handleFinishRouteMarking = () => {
    setIsInteractiveRouteMode(false);
    setIsAssignRouteModalOpen(true);
  };

  const handleCancelRouteMarking = () => {
    setIsInteractiveRouteMode(false);
    setCustomWaypoints([]);
  };

  const handleAssignRoute = async () => {
    if (!selectedVehicle) return;
    try {
      setLoading(true);
      let routeId = typeof selectedVehicle.route === 'object' ? selectedVehicle.route?.id : selectedVehicle.route;

      // Update/Create route with custom marked waypoints if admin marked waypoints on map
      if (customWaypoints && customWaypoints.length > 0) {
        if (routeId) {
          await api.patch(`/transport/routes/${routeId}/`, {
            waypoints: customWaypoints
          });
        } else {
          const routeRes = await api.post('/transport/routes/', {
            name: `Route - ${selectedVehicle.registration_number}`,
            waypoints: customWaypoints
          });
          routeId = routeRes.data.id;
          await api.patch(`/transport/vehicles/${selectedVehicle.id}/`, {
            route: routeId
          });
        }
      }
      
      // Update student pickup order
      await api.post(`/transport/vehicles/${selectedVehicle.id}/assign_students/`, {
        student_ids: orderedStudents.map(s => s.id)
      });

      setIsAssignRouteModalOpen(false);
      setSelectedVehicle(null);
      setIsInteractiveRouteMode(false);
      setCustomWaypoints([]);
      await fetchData();
      await fetchStudents();
    } catch (err) {
      console.error('Failed to save route and sequence:', err);
      alert('Error saving route and pickup sequence.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceData = async (vehicleId: number, date: string, journey: string) => {
    setLoadingAttendance(true);
    setAttendanceError('');
    setIsAttendanceLocked(false);
    setAttendanceLockReason('');
    try {
      const res = await api.get(`/transport/vehicles/${vehicleId}/get_attendance/`, {
        params: { date, journey }
      });
      if (Array.isArray(res.data)) {
        setAttendanceRecords(res.data);
        setIsAttendanceLocked(false);
        setAttendanceLockReason('');
      } else {
        setAttendanceRecords(res.data.records || []);
        setIsAttendanceLocked(!!res.data.is_locked);
        setAttendanceLockReason(res.data.lock_reason || '');
      }
    } catch (err) {
      console.error(err);
      setAttendanceError('Failed to fetch bus attendance data.');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleArriveAtStudent = async (studentId: number) => {
    if (!attendanceVehicle || isAttendanceLocked) return;
    try {
      const res = await api.post(`/transport/vehicles/${attendanceVehicle.id}/arrive_at_student/`, {
        student_id: studentId,
        date: attendanceDate
      });
      
      // Automatically mark student status as PRESENT in local modal records
      setAttendanceRecords(prev => prev.map(rec => {
        if (rec.student_id === studentId) {
          return { ...rec, status: 'PRESENT' };
        }
        return rec;
      }));

      // Refetch vehicle fleet data to update live map coordinates & timestamp tooltips
      await fetchData();
      await fetchStudents();

      // Update selected vehicle if it matches attendance vehicle
      if (selectedVehicle && selectedVehicle.id === attendanceVehicle.id) {
        setSelectedVehicle((prev: any) => ({
          ...prev,
          current_latitude: res.data.current_latitude,
          current_longitude: res.data.current_longitude,
          last_ping: res.data.last_ping
        }));
      }
    } catch (err: any) {
      console.error('Failed to update arrival location:', err);
      alert(err.response?.data?.error || 'Failed to update bus arrival location.');
    }
  };

  const handleReachSchool = async () => {
    if (!attendanceVehicle || isAttendanceLocked) return;
    try {
      setReachingSchool(true);
      const res = await api.post(`/transport/vehicles/${attendanceVehicle.id}/reach_school/`, {
        date: attendanceDate,
        journey: attendanceJourney,
        records: attendanceRecords
      });

      if (res.data.is_locked) {
        setIsAttendanceLocked(true);
        setAttendanceLockReason(res.data.lock_reason || 'Bus has reached school for this date.');
      }

      // Refetch vehicle fleet data to update live map coordinates & timestamp tooltips
      await fetchData();
      await fetchStudents();

      // Update selected vehicle if it matches attendance vehicle
      if (selectedVehicle && selectedVehicle.id === attendanceVehicle.id) {
        setSelectedVehicle((prev: any) => ({
          ...prev,
          current_latitude: res.data.current_latitude,
          current_longitude: res.data.current_longitude,
          last_ping: res.data.last_ping
        }));
      }
    } catch (err: any) {
      console.error('Failed to update school arrival location:', err);
      alert(err.response?.data?.error || 'Failed to update bus arrival location to school.');
    } finally {
      setReachingSchool(false);
    }
  };

  const handleLeaveSchool = async () => {
    if (!attendanceVehicle || isAttendanceLocked) return;
    try {
      setLeavingSchool(true);
      const res = await api.post(`/transport/vehicles/${attendanceVehicle.id}/leave_school/`, {
        date: attendanceDate
      });

      // Refetch vehicle fleet data to update live map coordinates & timestamp tooltips
      await fetchData();
      await fetchStudents();

      // Update selected vehicle if it matches attendance vehicle
      if (selectedVehicle && selectedVehicle.id === attendanceVehicle.id) {
        setSelectedVehicle((prev: any) => ({
          ...prev,
          current_latitude: res.data.current_latitude,
          current_longitude: res.data.current_longitude,
          last_ping: res.data.last_ping
        }));
      }
    } catch (err: any) {
      console.error('Failed to update school departure location:', err);
      alert(err.response?.data?.error || 'Failed to update bus departure location from school.');
    } finally {
      setLeavingSchool(false);
    }
  };

  const handleOpenAttendanceModal = (vehicle: any) => {
    setAttendanceVehicle(vehicle);
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60 * 1000);
    const todayStr = local.toISOString().split('T')[0];
    setAttendanceDate(todayStr);
    setAttendanceJourney('MORNING');
    setIsAttendanceModalOpen(true);
    fetchAttendanceData(vehicle.id, todayStr, 'MORNING');
  };

  const handleSaveAttendance = async () => {
    if (!attendanceVehicle) return;
    setSavingAttendance(true);
    setAttendanceError('');
    try {
      await api.post(`/transport/vehicles/${attendanceVehicle.id}/mark_attendance/`, {
        date: attendanceDate,
        journey: attendanceJourney,
        records: attendanceRecords
      });
      setIsAttendanceModalOpen(false);
      setAttendanceVehicle(null);
      setAttendanceRecords([]);
    } catch (err) {
      console.error(err);
      setAttendanceError('Failed to save bus attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  useEffect(() => {
    if (isAttendanceModalOpen && attendanceVehicle && attendanceDate && attendanceJourney) {
      fetchAttendanceData(attendanceVehicle.id, attendanceDate, attendanceJourney);
    }
  }, [attendanceDate, attendanceJourney, isAttendanceModalOpen, attendanceVehicle]);

  const handleSelectVehicle = async (vehicle: any) => {
    if (isInteractiveRouteMode) return; // Ignore selecting other vehicles during interactive mode
    setSelectedVehicle(vehicle);
    setShowRoute(false);
    fetchStudents();
  };

  const activeVehicles = vehicles.filter(v => v.last_ping).length || vehicles.length;
  
  // Get students for selected vehicle, sorted by order
  const assignedStudents = useMemo(() => {
    if (!selectedVehicle) return [];
    return students
      .filter(s => s.transport_assignment && s.transport_assignment.vehicle == selectedVehicle.id && (s.status === 'ACTIVE' || s.status === 'TEMPORARY' || !s.status))
      .sort((a, b) => (a.transport_assignment.order || 0) - (b.transport_assignment.order || 0));
  }, [selectedVehicle, students]);

  // Route positions for Polyline
  const routePositions = useMemo(() => {
    if (!showRoute || !selectedVehicle || !school) return [];

    // Extract route ID
    const routeId = typeof selectedVehicle.route === 'object' ? selectedVehicle.route?.id : selectedVehicle.route;
    const matchingRoute = routes.find(r => r.id === routeId);

    // Check custom waypoints on selectedVehicle, nested route, or matching route from state
    const customWps = selectedVehicle.route_waypoints || selectedVehicle.route?.waypoints || matchingRoute?.waypoints;
    if (Array.isArray(customWps) && customWps.length > 0) {
      return customWps as [number, number][];
    }

    // Default fallback: connect student locations in sequence to school campus
    const positions: [number, number][] = assignedStudents
      .filter(s => s.latitude && s.longitude)
      .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]);
    
    if (school.school_latitude && school.school_longitude) {
      positions.push([parseFloat(school.school_latitude), parseFloat(school.school_longitude)]);
    }
    return positions;
  }, [showRoute, assignedStudents, school, selectedVehicle, routes]);

  useEffect(() => {
    if (isAssignRouteModalOpen && selectedVehicle) {
      setOrderedStudents([...assignedStudents]);
      setRouteAssignment({ route_id: selectedVehicle.route || '' });
    }
  }, [isAssignRouteModalOpen, selectedVehicle, assignedStudents]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">🚍 Transport & GPS</h1>
          <p className="text-slate-500">Real-time fleet tracking and bus management.</p>
        </div>
        {(isAdmin || hasPermission('transport.edit_bus')) && (
          <button 
            onClick={handleOpenAddModal}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus size={20} />
            Add New Bus
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Buses', value: activeVehicles, icon: Bus, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Routes', value: routes.length, icon: Navigation, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Buses', value: vehicles.length, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Drivers', value: vehicles.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className={`p-3 ${stat.bg} ${stat.color} rounded-xl shadow-inner`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Fleet Map */}
        <div className={`lg:col-span-2 bg-white rounded-3xl border ${isInteractiveRouteMode ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'} shadow-sm overflow-hidden flex flex-col transition-all`}>
          {isInteractiveRouteMode ? (
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Navigation size={18} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Interactive Route Marking Mode</h4>
                  <p className="text-xs text-blue-100">
                    Click anywhere on map to mark waypoints for <strong>{selectedVehicle?.registration_number}</strong> ({customWaypoints.length} waypoints marked)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {customWaypoints.length > 0 && (
                  <>
                    <button 
                      onClick={handleUndoWaypoint}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                    >
                      Undo
                    </button>
                    <button 
                      onClick={handleClearWaypoints}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                    >
                      Clear
                    </button>
                  </>
                )}
                <button 
                  onClick={handleFinishRouteMarking}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-lg transition flex items-center gap-1.5"
                >
                  <CheckCircle size={16} /> Finish
                </button>
                <button 
                  onClick={handleCancelRouteMarking}
                  className="px-3 py-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {selectedVehicle ? `Tracking: ${selectedVehicle.registration_number}` : 'Live Fleet Map'}
                {selectedVehicle && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                    {assignedStudents.length} Students ({assignedStudents.filter(s => s.latitude && s.longitude).length} Mapped)
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
                <span className="flex items-center gap-1.5 text-[10px] text-green-600 font-black uppercase tracking-widest bg-green-50 px-2.5 py-1 rounded-full ring-1 ring-green-100">
                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" /> Live
                </span>
                {selectedVehicle && (
                  <div className="flex gap-2 items-center">
                    {(isAdmin || hasPermission('transport.view_route')) && (
                      <button 
                        onClick={() => setShowRoute(!showRoute)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                          showRoute ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border hover:bg-gray-50'
                        }`}
                      >
                        <Navigation size={14} /> {showRoute ? 'Hide Route' : 'Show Route'}
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setSelectedVehicle(null);
                        setShowRoute(false);
                      }}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl font-bold uppercase text-slate-600 transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-[500px] bg-slate-50 relative">
            <MapComponent 
              school={school}
              selectedVehicle={selectedVehicle}
              assignedStudents={assignedStudents}
              routePositions={routePositions}
              vehicles={vehicles}
              isInteractiveMode={isInteractiveRouteMode}
              customWaypoints={customWaypoints}
              onAddWaypoint={handleAddWaypoint}
            />
          </div>
        </div>

        {/* Available Buses List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-lg text-slate-900">Available buses</h3>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto max-h-[440px]">
            {loading && vehicles.length === 0 ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse" />)
            ) : vehicles.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No buses defined</p>
            ) : (
              vehicles.map(vehicle => (
                <div 
                  key={vehicle.id} 
                  onClick={() => handleSelectVehicle(vehicle)}
                  className={`p-4 rounded-2xl border transition-all group cursor-pointer ${
                    selectedVehicle?.id === vehicle.id 
                      ? 'border-blue-600 bg-blue-50 shadow-md' 
                      : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{vehicle.registration_number}</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                          #{vehicle.school_bus_number || 'N/A'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">
                        {vehicle.route_name ? `Route: ${vehicle.route_name}` : 'No Route Assigned'}
                      </p>
                    </div>
                    {(isAdmin || hasPermission('transport.edit_bus')) && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(vehicle);
                          }}
                          className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg"
                          title="Edit Details"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVehicle(vehicle.id);
                          }}
                          className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg"
                          title="Delete Bus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      <span className="flex items-center gap-1"><Users size={12} className="text-blue-500" /> {vehicle.assigned_students_count || 0} Students</span>
                    </div>
                    <div className="flex gap-2">
                      {(isAdmin || hasPermission('transport.view_route')) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVehicle(vehicle);
                            setShowRoute(true);
                          }}
                          className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1 hover:bg-blue-700 transition"
                        >
                          <RouteIcon size={10} /> View Route
                        </button>
                      )}
                      {(isAdmin || hasPermission('transport.assign_route') || hasPermission('transport.edit_bus')) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartAssignRoute(vehicle);
                          }}
                          disabled={isInteractiveRouteMode}
                          className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold hover:bg-amber-200 transition disabled:opacity-40"
                        >
                          {vehicle.route ? 'Re-assign Route' : 'Assign Route'}
                        </button>
                      )}
                      {(() => {
                        const userPermsArray = Array.from(permissions?.permissions || []);
                        const hasSpecificBusPerms = userPermsArray.some(p => p.startsWith('transport.mark_attendance_'));
                        const canMarkThisBus = isAdmin || (
                          hasSpecificBusPerms 
                            ? hasPermission(`transport.mark_attendance_${vehicle.id}`)
                            : hasPermission('transport.mark_attendance')
                        );
                        return canMarkThisBus ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAttendanceModal(vehicle);
                            }}
                            className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1 hover:bg-green-700 transition"
                          >
                            Mark attendance
                          </button>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bus Modal (Add/Edit) */}
      {isBusModalOpen && (
        <Modal
          title={isEditing ? `Edit Bus: ${busForm.registration_number}` : "Add New Bus"}
          onClose={() => setIsBusModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Bus Number (Reg.)</label>
                <input 
                  type="text" 
                  value={busForm.registration_number}
                  onChange={(e) => setBusForm({...busForm, registration_number: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                  placeholder="e.g. MH-12-AB-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">School Bus Number</label>
                <input 
                  type="text" 
                  value={busForm.school_bus_number}
                  onChange={(e) => setBusForm({...busForm, school_bus_number: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                  placeholder="e.g. Bus-01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Capacity</label>
                <input 
                  type="number" 
                  value={busForm.capacity}
                  onChange={(e) => setBusForm({...busForm, capacity: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Vehicle Type</label>
                <select 
                  value={busForm.vehicle_type}
                  onChange={(e) => setBusForm({...busForm, vehicle_type: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                >
                  <option value="Bus">Bus</option>
                  <option value="Van">Van</option>
                  <option value="Minibus">Minibus</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Driver Details</label>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Driver Name"
                  value={busForm.driver_name}
                  onChange={(e) => setBusForm({...busForm, driver_name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                />
                <input 
                  type="text" 
                  placeholder="Driver Phone"
                  value={busForm.driver_phone}
                  onChange={(e) => setBusForm({...busForm, driver_phone: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Assign Students</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {students.map(student => (
                  <label key={student.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                    <input 
                      type="checkbox" 
                      checked={busForm.student_ids.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBusForm({...busForm, student_ids: [...busForm.student_ids, student.id]});
                        } else {
                          setBusForm({...busForm, student_ids: busForm.student_ids.filter(id => id !== student.id)});
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{student.full_name}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{student.suid}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button 
              onClick={handleSaveBus}
              disabled={loading || !busForm.registration_number}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-slate-300 shadow-lg shadow-blue-100"
            >
              {loading ? 'Saving...' : (isEditing ? 'Update Bus Details' : 'Create Bus & Assign Students')}
            </button>
          </div>
        </Modal>
      )}

      {/* Set Pickup Sequence Modal */}
      {isAssignRouteModalOpen && (
        <Modal
          title={`Set Pickup Sequence: ${selectedVehicle?.registration_number}`}
          onClose={() => {
            setIsAssignRouteModalOpen(false);
            setCustomWaypoints([]);
          }}
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700 font-medium">
              Reorder students below to define the exact sequence of pickups for <strong>{selectedVehicle?.registration_number}</strong>.
              {customWaypoints.length > 0 ? (
                <span className="block mt-1 font-bold text-emerald-700">
                  ✓ Custom route marked with {customWaypoints.length} waypoints on map.
                </span>
              ) : (
                <span className="block mt-1 text-slate-500">
                  (No custom route waypoints marked; map will display student locations connected to school campus in pickup sequence order.)
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Pickup Sequence</label>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-1 space-y-1 bg-slate-50">
                {orderedStudents.length === 0 ? (
                  <p className="text-center text-[10px] text-slate-400 py-4">No students assigned to this bus</p>
                ) : (
                  orderedStudents.map((student, idx) => (
                    <div key={student.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-slate-900">{student.full_name}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{student.suid}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleMoveStudent(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 disabled:opacity-20"
                        >
                          <Navigation size={14} />
                        </button>
                        <button 
                          onClick={() => handleMoveStudent(idx, 'down')}
                          disabled={idx === orderedStudents.length - 1}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 disabled:opacity-20"
                        >
                          <Navigation size={14} className="rotate-180" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={handleAssignRoute}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-slate-300 shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin text-white" size={18} /> : 'Save Route & Sequence'}
            </button>
          </div>
        </Modal>
      )}

      {/* Mark Bus Attendance Modal */}
      {isAttendanceModalOpen && (
        <Modal
          title={`Bus Attendance: ${attendanceVehicle?.registration_number} (${attendanceVehicle?.school_bus_number || 'N/A'})`}
          onClose={() => {
            setIsAttendanceModalOpen(false);
            setAttendanceVehicle(null);
            setAttendanceRecords([]);
          }}
          size="lg"
        >
          <div className="space-y-4 text-slate-800">
            {isAttendanceLocked && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900 text-xs font-bold shadow-sm">
                <Lock size={18} className="text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-extrabold text-xs block text-amber-950">Attendance Locked / Uneditable</span>
                  <span className="font-semibold text-[11px] text-amber-800">{attendanceLockReason}</span>
                </div>
              </div>
            )}

            {attendanceError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                {attendanceError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Journey Direction
                </label>
                <select
                  value={attendanceJourney}
                  onChange={(e) => setAttendanceJourney(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-semibold"
                >
                  <option value="MORNING">Morning (Bringing to School)</option>
                  <option value="AFTERNOON">Afternoon (Dropping Home)</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs font-bold uppercase tracking-tight">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">SUID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3 text-center">Live Location</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-slate-700 font-medium normal-case">
                    {loadingAttendance ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center">
                          <Loader2 className="animate-spin text-blue-600 inline mr-2" size={16} />
                          Loading students...
                        </td>
                      </tr>
                    ) : attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No students assigned to this bus
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr className="bg-amber-50/50 font-bold border-b-2 border-slate-200">
                          <td className="px-4 py-3 font-mono text-[10px] text-amber-600 font-black">
                            START
                          </td>
                          <td className="px-4 py-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span className="text-base">🏫</span> School Campus
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              type="button"
                              onClick={handleLeaveSchool}
                              disabled={isAttendanceLocked || leavingSchool}
                              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition shadow-sm mx-auto disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Click to set bus location to School Campus departure point"
                            >
                              {leavingSchool ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                              Left School
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center text-[10px] text-amber-600 font-extrabold tracking-wider uppercase">
                            ORIGIN
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs font-semibold italic">
                            Bus departed from school campus
                          </td>
                        </tr>
                        {attendanceRecords.map((record, index) => (
                          <tr key={record.student_id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono text-[10px] text-slate-400 font-bold uppercase">
                              {record.student_suid}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {record.student_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                type="button"
                                onClick={() => handleArriveAtStudent(record.student_id)}
                                disabled={isAttendanceLocked || !record.latitude || !record.longitude}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition disabled:opacity-30 disabled:cursor-not-allowed mx-auto shadow-sm"
                                title={record.latitude && record.longitude ? "Click to set bus location to student stop" : "No GPS coordinates set for student"}
                              >
                                <MapPin size={11} className="text-emerald-600" />
                                Arrived here
                              </button>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                  type="button"
                                  disabled={isAttendanceLocked}
                                  onClick={() => {
                                    const updated = [...attendanceRecords];
                                    updated[index].status = 'PRESENT';
                                    setAttendanceRecords(updated);
                                  }}
                                  className={`px-3 py-1 rounded-md text-[10px] font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    record.status === 'PRESENT'
                                      ? 'bg-green-600 text-white shadow-sm'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  PRESENT
                                </button>
                                <button
                                  type="button"
                                  disabled={isAttendanceLocked}
                                  onClick={() => {
                                    const updated = [...attendanceRecords];
                                    updated[index].status = 'ABSENT';
                                    setAttendanceRecords(updated);
                                  }}
                                  className={`px-3 py-1 rounded-md text-[10px] font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    record.status === 'ABSENT'
                                      ? 'bg-red-600 text-white shadow-sm'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  ABSENT
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                disabled={isAttendanceLocked}
                                value={record.remarks}
                                onChange={(e) => {
                                  const updated = [...attendanceRecords];
                                  updated[index].remarks = e.target.value;
                                  setAttendanceRecords(updated);
                                }}
                                placeholder="Add a remark (optional)..."
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                    {attendanceRecords.length > 0 && (
                      <tr className="bg-blue-50/50 font-bold border-t-2 border-slate-200">
                        <td className="px-4 py-3 font-mono text-[10px] text-blue-600 font-black">
                          CAMPUS
                        </td>
                        <td className="px-4 py-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span className="text-base">🏫</span> School Campus
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            type="button"
                            onClick={handleReachSchool}
                            disabled={isAttendanceLocked || reachingSchool}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition shadow-sm mx-auto disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Click to set bus location to School Campus"
                          >
                            {reachingSchool ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                            Reached School
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center text-[10px] text-blue-600 font-extrabold tracking-wider uppercase">
                          DESTINATION
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-semibold italic">
                          Updates live bus marker to School Campus
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAttendanceModalOpen(false);
                  setAttendanceVehicle(null);
                  setAttendanceRecords([]);
                }}
                className="w-full px-4 py-2.5 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition font-bold text-sm text-center"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
