'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { Bus, MapPin, Navigation, Clock, Users, Loader2, Search, ArrowRight, Trash2, Edit2, Plus, Route as RouteIcon } from 'lucide-react';
import Modal from '@/components/Modal';
import dynamic from 'next/dynamic';

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

  useEffect(() => {
    fetchData();
    fetchStudents();
    fetchSchool();
  }, []);

  const fetchData = async () => {
    try {
      const [rRes, vRes] = await Promise.all([
        api.get('/transport/routes/'),
        api.get('/transport/vehicles/')
      ]);
      setRoutes(rRes.data);
      setVehicles(vRes.data);
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
    try {
      setLoading(true);
      let vehicleId = busForm.id;

      const payload = {
        registration_number: busForm.registration_number,
        school_bus_number: busForm.school_bus_number,
        vehicle_type: busForm.vehicle_type,
        capacity: busForm.capacity,
        driver_name: busForm.driver_name,
        driver_phone: busForm.driver_phone
      };

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
      fetchData();
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert('Error saving bus');
    } finally {
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

  const handleAssignRoute = async () => {
    try {
      setLoading(true);
      // Update vehicle's route
      await api.patch(`/transport/vehicles/${selectedVehicle.id}/`, {
        route: routeAssignment.route_id
      });
      
      // Update student pickup order
      await api.post(`/transport/vehicles/${selectedVehicle.id}/assign_students/`, {
        student_ids: orderedStudents.map(s => s.id)
      });

      setIsAssignRouteModalOpen(false);
      setSelectedVehicle(null);
      fetchData();
      fetchStudents();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVehicle = async (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setShowRoute(false);
    // Fetch latest students to ensure we have the most recent coordinates from their profiles
    fetchStudents();
  };

  const activeVehicles = vehicles.filter(v => v.last_ping).length || vehicles.length;
  
  // Get students for selected vehicle, sorted by order
  const assignedStudents = useMemo(() => {
    if (!selectedVehicle) return [];
    return students
      .filter(s => s.transport_assignment && s.transport_assignment.vehicle == selectedVehicle.id)
      .sort((a, b) => (a.transport_assignment.order || 0) - (b.transport_assignment.order || 0));
  }, [selectedVehicle, students]);

  // Route positions for Polyline
  const routePositions = useMemo(() => {
    if (!showRoute || !selectedVehicle || !school) return [];
    const positions: [number, number][] = assignedStudents
      .filter(s => s.latitude && s.longitude)
      .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]);
    
    if (school.school_latitude && school.school_longitude) {
      positions.push([parseFloat(school.school_latitude), parseFloat(school.school_longitude)]);
    }
    return positions;
  }, [showRoute, assignedStudents, school, selectedVehicle]);

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
        <button 
          onClick={handleOpenAddModal}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Bus
        </button>
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
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
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
                  <button 
                    onClick={() => setShowRoute(!showRoute)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      showRoute ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                  >
                    <Navigation size={14} /> {showRoute ? 'Hide Route' : 'Show Route'}
                  </button>
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
          <div className="flex-1 min-h-[500px] bg-slate-50 relative">
            <MapComponent 
              school={school}
              selectedVehicle={selectedVehicle}
              assignedStudents={assignedStudents}
              routePositions={routePositions}
              vehicles={vehicles}
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
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      <span className="flex items-center gap-1"><Users size={12} className="text-blue-500" /> {vehicle.assigned_students_count || 0} Students</span>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicle(vehicle);
                          setShowRoute(true);
                        }}
                        className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1"
                      >
                        <RouteIcon size={10} /> View Route
                      </button>
                      {!vehicle.route && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVehicle(vehicle);
                            setIsAssignRouteModalOpen(true);
                          }}
                          className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold"
                        >
                          Assign Route
                        </button>
                      )}
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

      {/* Assign Route Modal */}
      {isAssignRouteModalOpen && (
        <Modal
          title={`Assign Route & Sequence: ${selectedVehicle?.registration_number}`}
          onClose={() => setIsAssignRouteModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700 font-medium">
              Assign a route and reorder students below to define the sequence of pickups.
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Select Route</label>
              <select 
                value={routeAssignment.route_id}
                onChange={(e) => setRouteAssignment({ route_id: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
              >
                <option value="">No Route Assigned</option>
                {routes.map(route => (
                  <option key={route.id} value={route.id}>{route.name}</option>
                ))}
              </select>
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
                          <Plus size={14} className="rotate-45" style={{ transform: 'rotate(180deg)' }} />
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
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-slate-300 shadow-lg shadow-blue-100"
            >
              {loading ? 'Saving...' : 'Save Route & Sequence'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
