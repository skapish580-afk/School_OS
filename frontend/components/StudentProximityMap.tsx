'use client';

import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default icon paths in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

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

interface MapProps {
  school: any;
  students: any[];
  radius: number | null;
  highlightedStudent?: any;
}

export default function StudentProximityMap({ school, students, radius, highlightedStudent }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const markersMapRef = useRef<Record<string, L.Marker>>({});

  // Parse school location (default to Mumbai if not available)
  const schoolLocation = useMemo(() => {
    const lat = school?.school_latitude ? parseFloat(school.school_latitude) : 19.0760;
    const lon = school?.school_longitude ? parseFloat(school.school_longitude) : 72.8777;
    return { lat, lon };
  }, [school]);

  // Filter students within radius using Haversine
  const nearbyStudents = useMemo(() => {
    if (radius === null) return [];
    return students
      .filter(student => {
        if (!student.latitude || !student.longitude) return false;
        const distance = getHaversineDistance(
          schoolLocation.lat,
          schoolLocation.lon,
          parseFloat(student.latitude),
          parseFloat(student.longitude)
        );
        // Attach calculated distance for displaying in popup
        (student as any).calculatedDistance = distance;
        return distance <= radius;
      });
  }, [students, schoolLocation, radius]);

  // Handle zooming/panning to highlighted student
  useEffect(() => {
    if (highlightedStudent && mapRef.current) {
      const marker = markersMapRef.current[highlightedStudent.id];
      if (marker) {
        mapRef.current.setView(marker.getLatLng(), 15);
        marker.openPopup();
      }
    }
  }, [highlightedStudent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Initialize Map if not already done
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView([schoolLocation.lat, schoolLocation.lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      markersGroupRef.current = L.layerGroup().addTo(mapRef.current);
    } else {
      mapRef.current.setView([schoolLocation.lat, schoolLocation.lon], mapRef.current.getZoom());
    }

    const markersGroup = markersGroupRef.current!;
    markersGroup.clearLayers();
    markersMapRef.current = {}; // reset marker mappings

    // Red pointer icon for school location
    const schoolIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add school marker
    L.marker([schoolLocation.lat, schoolLocation.lon], { icon: schoolIcon })
      .bindPopup(`
        <div style="font-family: inherit; padding: 4px; min-width: 180px;">
          <div style="font-weight: 800; color: #b91c1c; font-size: 14px;">${school?.school_name || 'School'}</div>
          <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 2px;">School Location</div>
          <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
            ${school?.school_address || 'No address specified'}
          </div>
        </div>
      `)
      .addTo(markersGroup);

    // Remove old circle if it exists
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    // Blue pointer icon for students
    const studentIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // If radius is selected, draw circle and student markers
    if (radius !== null) {
      // Draw circle (radius in meters)
      circleRef.current = L.circle([schoolLocation.lat, schoolLocation.lon], {
        color: '#2563eb', // Indigo-600
        fillColor: '#3b82f6', // Blue-500
        fillOpacity: 0.15,
        radius: radius * 1000,
        weight: 2
      }).addTo(mapRef.current);

      // Add student markers
      nearbyStudents.forEach(student => {
        const studentLat = parseFloat(student.latitude);
        const studentLon = parseFloat(student.longitude);
        const distanceStr = student.calculatedDistance.toFixed(2);

        const marker = L.marker([studentLat, studentLon], { icon: studentIcon })
          .bindPopup(`
            <div style="font-family: inherit; padding: 4px; min-width: 150px;">
              <div style="font-weight: 800; color: #1e3a8a; font-size: 13px;">${student.full_name}</div>
              <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 2px;">
                SUID: ${student.suid}
              </div>
              <div style="color: #047857; font-weight: 800; font-size: 11px; margin-top: 4px;">
                Distance: ${distanceStr} km
              </div>
              <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
                ${student.address || 'No address specified'}
              </div>
            </div>
          `)
          .addTo(markersGroup);

        markersMapRef.current[student.id] = marker;
      });

      // Fit map bounds to show school and all students inside the radius
      if (nearbyStudents.length > 0) {
        const bounds = L.latLngBounds([
          [schoolLocation.lat, schoolLocation.lon],
          ...nearbyStudents.map(s => [parseFloat(s.latitude), parseFloat(s.longitude)] as [number, number])
        ]);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else {
        // Just fit the circle bounds
        mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
      }
    } else {
      // No radius: reset view to show school at default zoom
      mapRef.current.setView([schoolLocation.lat, schoolLocation.lon], 13);
    }

  }, [schoolLocation, nearbyStudents, radius, school]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden shadow-inner border border-gray-100 z-0">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
