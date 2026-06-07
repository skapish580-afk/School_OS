'use client';

import { useEffect, useRef, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// Fix for Leaflet marker icons in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

interface MapProps {
  school: any;
  selectedVehicle: any;
  assignedStudents: any[];
  routePositions: [number, number][];
  vehicles: any[];
}

export default function LeafletMap({ school, selectedVehicle, assignedStudents, routePositions, vehicles }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  const center: [number, number] = useMemo(() => {
    if (school?.latitude && school?.longitude) {
      return [parseFloat(school.latitude), parseFloat(school.longitude)];
    }
    return [19.0760, 72.8777]; // Default to Mumbai
  }, [school]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || !school) return;

    // Initialize Map if not already done
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    } else {
      mapRef.current.setView(center, 13);
    }

    const markers = markersRef.current!;
    markers.clearLayers();

    // School Marker
    if (school.school_latitude && school.school_longitude) {
      const schoolIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
      L.marker([parseFloat(school.school_latitude), parseFloat(school.school_longitude)], { icon: schoolIcon })
        .bindPopup(`
          <div style="font-family: inherit; padding: 2px;">
            <div style="font-weight: 800; color: #b91c1c; font-size: 14px;">${school.school_name || 'School'}</div>
            <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Principal Location</div>
            <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; pt-2 mt-2">
              ${school.school_address || 'No address provided'}
            </div>
          </div>
        `)
        .addTo(markers);
    }

    // Student Markers
    if (selectedVehicle) {
      assignedStudents.forEach((student, index) => {
        if (student.latitude && student.longitude) {
          const stopNumber = index + 1;
          const popupContent = `
            <div style="font-family: inherit; padding: 2px;">
              <div style="font-weight: 800; color: #0f172a; font-size: 14px;">
                <span style="background: #3b82f6; color: white; padding: 2px 6px; rounded: 4px; margin-right: 6px;">${stopNumber}</span>
                ${student.full_name}
              </div>
              <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; margin-top: 4px;">ID: ${student.suid}</div>
              <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; pt-2 mt-2">
                ${student.address || 'No address provided'}
              </div>
            </div>
          `;

          // Numbered Icon
          const numberedIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div style="position: relative;">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="width: 25px; height: 41px;" />
                <div style="position: absolute; top: 10px; left: 0; width: 25px; text-align: center; color: white; font-weight: 900; font-size: 11px; font-family: sans-serif; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                  ${stopNumber}
                </div>
              </div>
            `,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
          });

          L.marker([parseFloat(student.latitude), parseFloat(student.longitude)], { icon: numberedIcon })
            .bindPopup(popupContent)
            .addTo(markers);
        }
      });
    }

    // Vehicle Markers (if no vehicle selected)
    if (!selectedVehicle) {
      vehicles.forEach(v => {
        if (v.current_latitude) {
          L.marker([parseFloat(v.current_latitude), parseFloat(v.current_longitude)])
            .bindPopup(`<b>${v.registration_number}</b>`)
            .addTo(markers);
        }
      });
    }

    // Route Polyline
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (routePositions.length > 1) {
      routeRef.current = L.polyline(routePositions, { color: 'blue', weight: 3, opacity: 0.7, dashArray: '5, 10' }).addTo(mapRef.current);
    }

    return () => {
      // Cleanup is handled by mapRef check or full removal on unmount
    };
  }, [school, selectedVehicle, assignedStudents, routePositions, vehicles, center]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!school) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full z-0" style={{ minHeight: '500px' }} />
  );
}
