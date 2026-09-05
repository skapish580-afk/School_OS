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

interface StudentTransportMapProps {
  school: any;
  bus: any;
  route: any;
  busStops: any[];
  allStops: any[];
  routePositions: [number, number][];
  currentStudentSuid?: string;
  currentStudentName?: string;
}

export default function StudentTransportMap({
  school,
  bus,
  route,
  busStops = [],
  allStops = [],
  routePositions = [],
  currentStudentSuid,
  currentStudentName
}: StudentTransportMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const hasFitBoundsRef = useRef(false);
  const [ticker, setTicker] = useState(0);

  // Live timer interval to update "Updated: {duration} ago" relative time tooltips every 10s
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isValidCoord = (lat: any, lng: any) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return false;
    if (numLat === 0 && numLng === 0) return false;
    return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
  };

  const center: [number, number] = useMemo(() => {
    if (isValidCoord(bus?.current_latitude, bus?.current_longitude)) {
      return [parseFloat(bus.current_latitude), parseFloat(bus.current_longitude)];
    }
    if (isValidCoord(school?.school_latitude, school?.school_longitude)) {
      return [parseFloat(school.school_latitude), parseFloat(school.school_longitude)];
    }
    if (busStops.length > 0 && isValidCoord(busStops[0].latitude, busStops[0].longitude)) {
      return [parseFloat(busStops[0].latitude), parseFloat(busStops[0].longitude)];
    }
    return [19.0760, 72.8777]; // Default fallback
  }, [bus, school, busStops]);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current).setView(center, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }
  }, [center]);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    const map = mapRef.current;
    const markers = markersRef.current;
    markers.clearLayers();

    const boundsPoints: [number, number][] = [];

    // 1. School Campus Marker (Red Marker)
    if (isValidCoord(school?.school_latitude, school?.school_longitude)) {
      const schoolPos: [number, number] = [parseFloat(school.school_latitude), parseFloat(school.school_longitude)];
      boundsPoints.push(schoolPos);

      const schoolIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      L.marker(schoolPos, { icon: schoolIcon })
        .bindPopup(`
          <div style="font-family: inherit; padding: 2px;">
            <div style="font-weight: 800; color: #b91c1c; font-size: 14px;">${school.school_name || 'School Campus'}</div>
            <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">School Campus</div>
          </div>
        `)
        .addTo(markers);
    }

    // 2. Sequence-Numbered Stop Markers (Highlighted for Logged-In Student)
    const stopsToRender = busStops.length > 0 ? busStops : allStops;
    stopsToRender.forEach((st, idx) => {
      if (isValidCoord(st.latitude, st.longitude)) {
        const stopPos: [number, number] = [parseFloat(st.latitude), parseFloat(st.longitude)];
        boundsPoints.push(stopPos);

        const seqNo = st.sequence_number || st.order || (idx + 1);

        const isCurrentStudent = Boolean(
          (currentStudentSuid && st.suid && String(st.suid).trim().toLowerCase() === String(currentStudentSuid).trim().toLowerCase()) ||
          (currentStudentName && st.student_name && String(st.student_name).trim().toLowerCase() === String(currentStudentName).trim().toLowerCase())
        );

        const stopPopupContent = `
          <div style="font-family: inherit; padding: 2px;">
            ${isCurrentStudent ? `<div style="background: #16a34a; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 900; margin-bottom: 6px; display: inline-block;">★ Your Allocated Stop</div>` : ''}
            <div style="font-weight: 800; color: #0f172a; font-size: 13px;">
              <span style="background: ${isCurrentStudent ? '#16a34a' : '#2563eb'}; color: white; padding: 2px 7px; border-radius: 6px; margin-right: 6px; font-weight: 900;">${seqNo}</span>
              ${st.student_name || st.stop_name || st.name || `Stop ${seqNo}`}
            </div>
            <div style="color: ${isCurrentStudent ? '#15803d' : '#1d4ed8'}; font-size: 11px; font-weight: 800; margin-top: 4px;">
              Pickup Sequence: #${seqNo}
            </div>
            ${st.suid ? `<div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 2px; margin-bottom: 2px;">SUID: ${st.suid}</div>` : ''}
            <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 4px;">
              <div><strong>Pickup Time:</strong> ${st.pickup_time || '-'}</div>
              <div><strong>Drop Time:</strong> ${st.drop_time || '-'}</div>
            </div>
          </div>
        `;

        const iconUrl = isCurrentStudent 
          ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
          : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';

        const numberedIcon = L.divIcon({
          className: isCurrentStudent ? 'custom-div-icon highlighted-student-icon' : 'custom-div-icon',
          html: `
            <div style="position: relative;">
              <img src="${iconUrl}" style="width: ${isCurrentStudent ? '27px' : '25px'}; height: ${isCurrentStudent ? '44px' : '41px'}; ${isCurrentStudent ? 'filter: drop-shadow(0 0 7px rgba(34, 197, 94, 0.9));' : ''}" />
              <div style="position: absolute; top: ${isCurrentStudent ? '11px' : '10px'}; left: 0; width: ${isCurrentStudent ? '27px' : '25px'}; text-align: center; color: white; font-weight: 900; font-size: 11px; font-family: sans-serif; text-shadow: 1px 1px 2px rgba(0,0,0,0.6);">
                ${seqNo}
              </div>
            </div>
          `,
          iconSize: isCurrentStudent ? [27, 44] : [25, 41],
          iconAnchor: isCurrentStudent ? [13, 44] : [12, 41],
          popupAnchor: [1, -34]
        });

        L.marker(stopPos, { icon: numberedIcon, zIndexOffset: isCurrentStudent ? 1000 : 0 })
          .bindPopup(stopPopupContent)
          .addTo(markers);
      }
    });


    // Helper for relative time duration ago
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

    // 3. Live Vehicle/Bus Marker (Gold Marker with 🚍 symbol & live relative duration tooltip)
    if (isValidCoord(bus?.current_latitude, bus?.current_longitude)) {
      const busPos: [number, number] = [parseFloat(bus.current_latitude), parseFloat(bus.current_longitude)];
      boundsPoints.push(busPos);

      const timeAgoStr = formatTimeAgo(bus.last_ping);

      const hasLeftSchool = bus?.has_left_school || bus?.current_status === 'LEFT_SCHOOL';
      const hasReachedSchool = bus?.has_reached_school || bus?.current_status === 'REACHED_SCHOOL' || (
        !hasLeftSchool &&
        isValidCoord(school?.school_latitude, school?.school_longitude) &&
        Math.abs(parseFloat(bus.current_latitude) - parseFloat(school.school_latitude)) < 0.0005 &&
        Math.abs(parseFloat(bus.current_longitude) - parseFloat(school.school_longitude)) < 0.0005
      );

      let arrivedStop = null;
      if (bus?.current_latitude && bus?.current_longitude && !hasLeftSchool && !hasReachedSchool) {
        const bLat = parseFloat(bus.current_latitude);
        const bLng = parseFloat(bus.current_longitude);
        arrivedStop = busStops.find(st => 
          isValidCoord(st.latitude, st.longitude) &&
          Math.abs(parseFloat(st.latitude) - bLat) < 0.0005 &&
          Math.abs(parseFloat(st.longitude) - bLng) < 0.0005
        );
      }

      const arrivedSeq = bus.arrived_stop_sequence || arrivedStop?.sequence_number;
      const arrivedStudentName = bus.arrived_student_name || arrivedStop?.student_name || arrivedStop?.stop_name;

      const busPopupContent = hasLeftSchool ? `
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-weight: 900; color: #d97706; font-size: 14px; display: flex; items-center; gap: 4px;">
            🚍 Left School
          </div>
          <div style="font-weight: 800; color: #0f172a; font-size: 12px; margin-top: 2px;">
            Bus #${bus.school_bus_number || bus.registration_number}
          </div>
          <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 4px;">
            <strong>School Address:</strong><br />
            ${school?.school_address || 'School Campus'}
          </div>
          <div style="color: #2563eb; font-size: 11px; font-weight: 800; margin-top: 4px;">
            Updated: ${timeAgoStr}
          </div>
        </div>
      ` : (hasReachedSchool ? `
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-weight: 900; color: #15803d; font-size: 14px; display: flex; items-center; gap: 4px;">
            🚍 Reached School
          </div>
          <div style="font-weight: 800; color: #0f172a; font-size: 12px; margin-top: 2px;">
            Bus #${bus.school_bus_number || bus.registration_number}
          </div>
          <div style="color: #475569; font-size: 11px; line-height: 1.4; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 4px;">
            <strong>School Address:</strong><br />
            ${school?.school_address || 'School Campus'}
          </div>
          <div style="color: #2563eb; font-size: 11px; font-weight: 800; margin-top: 4px;">
            Updated: ${timeAgoStr}
          </div>
        </div>
      ` : `
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 14px;">
            🚍 ${bus.school_bus_number || bus.registration_number}
            ${bus.registration_number ? `<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 9999px; margin-left: 4px;">${bus.registration_number}</span>` : ''}
          </div>
          ${arrivedSeq ? `
            <div style="color: #1d4ed8; font-weight: 900; font-size: 12px; margin-top: 4px; background: #eff6ff; padding: 4px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
              Arrived at Stop #${arrivedSeq} ${arrivedStudentName ? `(${arrivedStudentName})` : ''}
            </div>
            <div style="color: #1e40af; font-size: 11px; font-weight: 800; margin-top: 3px;">
              Pickup Sequence: #${arrivedSeq}
            </div>
          ` : `
            <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
              Route: ${route?.name || 'School Bus Route'}
            </div>
          `}
          <div style="color: #2563eb; font-size: 11px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
            Updated: ${timeAgoStr}
          </div>
        </div>
      `);



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

      L.marker(busPos, { icon: busIcon })
        .bindPopup(busPopupContent)
        .addTo(markers);

    }

    // 4. Route Polyline (Dashed Blue Line)
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    let validPositions = routePositions.filter(pt => isValidCoord(pt[0], pt[1]));
    if (validPositions.length < 2) {
      const fallbackPositions: [number, number][] = [];
      const stopsToUse = busStops.length > 0 ? busStops : allStops;
      stopsToUse.forEach(st => {
        if (isValidCoord(st.latitude, st.longitude)) {
          fallbackPositions.push([parseFloat(st.latitude), parseFloat(st.longitude)]);
        }
      });
      if (isValidCoord(school?.school_latitude, school?.school_longitude)) {
        fallbackPositions.push([parseFloat(school.school_latitude), parseFloat(school.school_longitude)]);
      }
      validPositions = fallbackPositions;
    }

    if (validPositions.length > 1) {
      routeRef.current = L.polyline(validPositions, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        dashArray: '6, 10'
      }).addTo(map);
    }


    // Auto Fit Bounds ONLY ONCE on initial load to prevent continuous auto-zooming out during polling/updates
    if (!hasFitBoundsRef.current && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 15 });
      hasFitBoundsRef.current = true;
    }

  }, [school, bus, route, busStops, allStops, routePositions, ticker]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden z-0 relative min-h-[420px]" />
  );
}
