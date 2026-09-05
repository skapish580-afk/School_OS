'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
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
  isInteractiveMode?: boolean;
  customWaypoints?: [number, number][];
  onAddWaypoint?: (point: [number, number]) => void;
}

export default function LeafletMap({ 
  school, 
  selectedVehicle, 
  assignedStudents, 
  routePositions, 
  vehicles,
  isInteractiveMode = false,
  customWaypoints = [],
  onAddWaypoint
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const [ticker, setTicker] = useState(0);

  // Live timer interval to update "Updated: {duration} ago" relative time tooltips every 10s in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const center: [number, number] = useMemo(() => {
    if (school?.school_latitude && school?.school_longitude) {
      return [parseFloat(school.school_latitude), parseFloat(school.school_longitude)];
    }
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

    const map = mapRef.current!;

    // Map Click Listener for Interactive Mode
    if (isInteractiveMode) {
      if (containerRef.current) {
        containerRef.current.style.cursor = 'crosshair';
      }
      
      const handleMapClick = (e: L.LeafletMouseEvent) => {
        if (onAddWaypoint) {
          onAddWaypoint([e.latlng.lat, e.latlng.lng]);
        }
      };

      map.on('click', handleMapClick);

      return () => {
        map.off('click', handleMapClick);
        if (containerRef.current) {
          containerRef.current.style.cursor = '';
        }
      };
    } else {
      if (containerRef.current) {
        containerRef.current.style.cursor = '';
      }
    }
  }, [school, center, isInteractiveMode, onAddWaypoint]);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    const markers = markersRef.current;
    markers.clearLayers();

    // School Marker
    if (school?.school_latitude && school?.school_longitude) {
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
            <div style="font-weight: 800; color: #b91c1c; font-size: 14px;">${school.school_name || 'School Campus'}</div>
            <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Principal Location</div>
            <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; pt-2 mt-2">
              ${school.school_address || 'No address provided'}
            </div>
          </div>
        `)
        .addTo(markers);
    }

    // Interactive Custom Waypoint Markers
    if (isInteractiveMode && customWaypoints.length > 0) {
      customWaypoints.forEach((pt, idx) => {
        const wpIcon = L.divIcon({
          className: 'custom-wp-icon',
          html: `
            <div style="position: relative;">
              <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" style="width: 25px; height: 41px;" />
              <div style="position: absolute; top: 10px; left: 0; width: 25px; text-align: center; color: white; font-weight: 900; font-size: 11px; font-family: sans-serif; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                W${idx + 1}
              </div>
            </div>
          `,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });

        L.marker(pt, { icon: wpIcon })
          .bindPopup(`<b>Route Waypoint #${idx + 1}</b><br/>Lat: ${pt[0].toFixed(5)}, Lng: ${pt[1].toFixed(5)}`)
          .addTo(markers);
      });
    }

    // Student Markers (Render whenever vehicle is selected, including interactive route marking mode)
    if (selectedVehicle) {
      assignedStudents.forEach((student, index) => {
        if (student.latitude && student.longitude) {
          const stopNumber = index + 1;
          const studentAddress = [student.address_line1, student.address_line2, student.city, student.address]
            .filter(Boolean)
            .join(', ') || 'No address recorded';

          const popupContent = `
            <div style="font-family: inherit; padding: 2px; min-width: 160px;">
              <div style="font-weight: 800; color: #0f172a; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span style="background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 900;">Stop #${stopNumber}</span>
                <span>${student.full_name || student.student_name || 'Student'}</span>
              </div>
              <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; margin-top: 4px;">
                ID: ${student.suid || 'N/A'}
              </div>
              <div style="color: #334155; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 4px;">
                <strong style="color: #1e293b;">Pickup Address:</strong><br/>
                ${studentAddress}
              </div>
            </div>
          `;

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

    // Helper to format relative time duration ago
    const formatTimeAgo = (dateStr: string | null) => {
      if (!dateStr) return 'No pings recorded';
      const lastPing = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.max(0, Math.floor((now.getTime() - lastPing.getTime()) / 1000));

      if (diffInSeconds < 10) return 'just now';
      if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
      
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    };

    // Vehicle Markers (Render for selected vehicle or all fleet vehicles)
    const vehiclesToRender = selectedVehicle 
      ? [selectedVehicle] 
      : (!isInteractiveMode ? vehicles : []);

    vehiclesToRender.forEach(v => {
      if (v.current_latitude && v.current_longitude) {
        const timeAgoStr = formatTimeAgo(v.last_ping);
        const popupContent = `
          <div style="font-family: inherit; padding: 2px;">
            <div style="font-weight: 800; color: #0f172a; font-size: 14px;">
              🚍 ${v.registration_number}
              ${v.school_bus_number ? `<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 9999px; margin-left: 4px;">#${v.school_bus_number}</span>` : ''}
            </div>
            <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
              ${v.route_name ? `Route: ${v.route_name}` : 'Fleet Bus'}
            </div>
            <div style="color: #2563eb; font-size: 11px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
              Updated: ${timeAgoStr}
            </div>
          </div>
        `;

        const busIcon = L.divIcon({
          className: 'custom-bus-icon',
          html: `
            <div style="position: relative;">
              <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png" style="width: 25px; height: 41px;" />
              <div style="position: absolute; top: 8px; left: 0; width: 25px; text-align: center; color: #78350f; font-weight: 900; font-size: 12px; font-family: sans-serif;">
                🚍
              </div>
            </div>
          `,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });

        L.marker([parseFloat(v.current_latitude), parseFloat(v.current_longitude)], { icon: busIcon })
          .bindPopup(popupContent)
          .addTo(markers);
      }
    });

    // Route Polyline
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (isInteractiveMode && customWaypoints.length > 1) {
      routeRef.current = L.polyline(customWaypoints, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(mapRef.current);
    } else if (!isInteractiveMode && routePositions.length > 1) {
      routeRef.current = L.polyline(routePositions, { color: '#2563eb', weight: 4, opacity: 0.85, dashArray: '5, 10' }).addTo(mapRef.current);
    }

  }, [school, selectedVehicle, assignedStudents, routePositions, vehicles, isInteractiveMode, customWaypoints, ticker]);

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
    <div ref={containerRef} className="w-full h-full z-0 relative" style={{ minHeight: '500px' }} />
  );
}
