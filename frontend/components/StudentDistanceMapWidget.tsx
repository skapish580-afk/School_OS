'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { Loader2, MapPin, Search, Filter } from 'lucide-react';
import { DashboardWidget } from './DashboardWidgets';
import { useSettings } from '@/lib/SettingsContext';
import Link from 'next/link';

// Dynamically import the map view to avoid Next.js SSR issues
const MapView = dynamic(() => import('./StudentProximityMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-sm text-gray-500 font-medium">Loading Map Assets...</span>
      </div>
    </div>
  )
});

// Haversine distance formula in kilometers
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function StudentDistanceMapWidget() {
  const { settings, loading: settingsLoading } = useSettings();
  const [school, setSchool] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Radius States
  const [radiusOption, setRadiusOption] = useState<string>('');
  const [customRadiusInput, setCustomRadiusInput] = useState<string>('1.5');
  
  // Filtering States
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [highlightedStudent, setHighlightedStudent] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [schoolRes, studentsRes] = await Promise.all([
          api.get('/schools/settings/my_settings/'),
          api.get('/students/?status=ACTIVE')
        ]);
        setSchool(schoolRes.data);
        setStudents(studentsRes.data);
      } catch (err) {
        console.error('Failed to load map data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentSchool = school || settings;
  const hasCoordinates = currentSchool?.school_latitude !== null && 
                         currentSchool?.school_longitude !== null && 
                         currentSchool?.school_latitude !== undefined && 
                         currentSchool?.school_longitude !== undefined;

  // School coordinates for calculations
  const schoolLocation = useMemo(() => {
    const lat = currentSchool?.school_latitude ? parseFloat(currentSchool.school_latitude) : 19.0760;
    const lon = currentSchool?.school_longitude ? parseFloat(currentSchool.school_longitude) : 72.8777;
    return { lat, lon };
  }, [currentSchool]);

  // Determine active radius value in km
  const activeRadius = useMemo(() => {
    if (!radiusOption) return null;
    if (radiusOption === 'Custom') {
      const parsed = parseFloat(customRadiusInput);
      if (isNaN(parsed) || parsed <= 0) return null;
      return Math.min(parsed, 100);
    }
    return Number(radiusOption);
  }, [radiusOption, customRadiusInput]);

  // Calculate distance for all students
  const studentsWithDistance = useMemo(() => {
    return students.map(student => {
      if (!student.latitude || !student.longitude) {
        return { ...student, distance: Infinity };
      }
      const distance = getHaversineDistance(
        schoolLocation.lat,
        schoolLocation.lon,
        parseFloat(student.latitude),
        parseFloat(student.longitude)
      );
      return { ...student, distance };
    });
  }, [students, schoolLocation]);

  // Filter students within active radius circle
  const studentsWithinRadius = useMemo(() => {
    if (activeRadius === null) return [];
    return studentsWithDistance.filter(student => student.distance <= activeRadius);
  }, [studentsWithDistance, activeRadius]);

  // Generate unique grades and sections for dropdown options
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach(s => {
      if (s.current_class && s.current_class !== 'Unassigned') {
        const grade = s.current_class.split('-')[0];
        if (grade) grades.add(grade);
      }
    });
    return Array.from(grades).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [students]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    students.forEach(s => {
      if (s.current_class && s.current_class !== 'Unassigned') {
        const section = s.current_class.split('-')[1];
        if (section) sections.add(section);
      }
    });
    return Array.from(sections).sort();
  }, [students]);

  // Filter students falling within radius based on Grade & Section selections
  const filteredStudents = useMemo(() => {
    return studentsWithinRadius.filter(student => {
      if (!student.current_class || student.current_class === 'Unassigned') {
        return !selectedGrade && !selectedSection;
      }
      const [grade, section] = student.current_class.split('-');
      const matchesGrade = !selectedGrade || grade === selectedGrade;
      const matchesSection = !selectedSection || section === selectedSection;
      return matchesGrade && matchesSection;
    });
  }, [studentsWithinRadius, selectedGrade, selectedSection]);

  // Sort filtered students by distance (closest first) for clean listing
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => a.distance - b.distance);
  }, [filteredStudents]);

  const headerActions = (
    <div className="flex items-center gap-2 text-xs md:text-sm">
      <select
        value={radiusOption}
        onChange={(e) => {
          setRadiusOption(e.target.value);
          setHighlightedStudent(null);
        }}
        className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer transition-colors"
      >
        <option value="">Select the Radius of Circle</option>
        <option value="2">2</option>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="Custom">Custom</option>
      </select>
    </div>
  );

  return (
    <DashboardWidget
      title="Student Proximity Map"
      icon={<MapPin size={18} className="text-blue-500" />}
      headerActions={headerActions}
    >
      {loading || settingsLoading ? (
        <div className="h-[400px] flex items-center justify-center bg-gray-50/50 rounded-xl border border-gray-100">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm text-gray-500 font-medium">Calculating School Coordinates...</span>
          </div>
        </div>
      ) : !hasCoordinates ? (
        <div className="h-[400px] flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-3">
            <MapPin size={24} />
          </div>
          <h4 className="font-bold text-slate-800 mb-1 text-base">School Coordinates Missing</h4>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            To use the student proximity map, please configure the school's latitude and longitude in the settings panel.
          </p>
          <Link
            href="/dashboard/settings"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm"
          >
            Go to Settings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Custom Radius input bar */}
          {radiusOption === 'Custom' && (
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-wrap items-center justify-between gap-3 transition-all duration-300">
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-semibold text-blue-900">Custom Radius:</span>
                <input
                  type="number"
                  value={customRadiusInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== '' && parseFloat(val) > 100) {
                      setCustomRadiusInput('100');
                    } else {
                      setCustomRadiusInput(val);
                    }
                    setHighlightedStudent(null);
                  }}
                  min="0.1"
                  max="100"
                  step="0.1"
                  placeholder="Enter radius in km (max 100)"
                  className="w-28 bg-white border border-blue-200 text-gray-800 py-1 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-xs md:text-sm"
                />
                <span className="text-xs md:text-sm text-blue-700 font-bold">km</span>
              </div>
              <p className="text-[11px] text-blue-600 font-medium">
                Enter radius in kilometers (e.g., 1.5, 4.2, 12, max 100) to calculate proximity.
              </p>
            </div>
          )}

          {/* Interactive Split Layout / Full Map Layout */}
          {activeRadius !== null ? (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
              {/* Left Column (70%): Map */}
              <div className="lg:col-span-7">
                <MapView 
                  school={currentSchool} 
                  students={sortedStudents} 
                  radius={activeRadius} 
                  highlightedStudent={highlightedStudent}
                />
              </div>

              {/* Right Column (30%): Student List and Filters */}
              <div className="lg:col-span-3 flex flex-col h-[400px]">
                {/* Dynamic Filters */}
                <div className="mb-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs uppercase tracking-wider mb-2">
                    <Filter size={12} className="text-blue-500" />
                    <span>Filter Inside Circle</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select
                        value={selectedGrade}
                        onChange={(e) => {
                          setSelectedGrade(e.target.value);
                          setHighlightedStudent(null);
                        }}
                        className="w-full bg-white border border-gray-200 text-gray-700 py-1.5 px-2 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">All Grades</option>
                        {uniqueGrades.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={selectedSection}
                        onChange={(e) => {
                          setSelectedSection(e.target.value);
                          setHighlightedStudent(null);
                        }}
                        className="w-full bg-white border border-gray-200 text-gray-700 py-1.5 px-2 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">All Sections</option>
                        {uniqueSections.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* List Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Nearby Students ({sortedStudents.length})
                  </span>
                  {sortedStudents.length > 0 && (
                    <span className="text-[10px] text-gray-500 font-medium">Click row to locate</span>
                  )}
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                  {sortedStudents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <p className="text-xs text-slate-400 font-semibold">No students matched these criteria within the radius.</p>
                    </div>
                  ) : (
                    sortedStudents.map(student => {
                      const isSelected = highlightedStudent?.id === student.id;
                      return (
                        <div
                          key={student.id}
                          onClick={() => setHighlightedStudent(student)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/10'
                              : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-slate-50 text-gray-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold text-xs truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                              {student.full_name}
                            </p>
                            <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                              Class: {student.current_class || 'Unassigned'}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-blue-500 text-white' : 'bg-green-50 text-green-700'
                            }`}>
                              {student.distance.toFixed(2)} km
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Full Width View when no radius selection is active
            <div className="w-full">
              <MapView 
                school={currentSchool} 
                students={[]} 
                radius={null} 
              />
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  );
}
