"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiCrosshair, FiMaximize2, FiMapPin, FiNavigation } from "react-icons/fi";

export interface MapBreadcrumb {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
}

interface LiveTrackingMapProps {
  currentLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  initialLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  breadcrumbs: MapBreadcrumb[];
  userName: string;
  isActive: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

export default function LiveTrackingMap({
  currentLocation,
  initialLocation,
  breadcrumbs,
  userName,
  isActive,
}: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);

  // 1. Dynamically load Leaflet CSS and JS from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.L) {
      setIsLeafletLoaded(true);
      return;
    }

    // Inject Leaflet CSS
    const linkId = "leaflet-css-cdn";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    // Inject Leaflet JS
    const scriptId = "leaflet-js-cdn";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.crossOrigin = "";
      script.async = true;
      script.onload = () => {
        setIsLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
      existingScript.addEventListener("load", () => setIsLeafletLoaded(true));
    }
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!isLeafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const lat = currentLocation.latitude || 7.3002;
    const lon = currentLocation.longitude || 5.1382;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 16,
      zoomControl: false,
    });

    // Add CartoDB Positron / OSM tiles for crisp, high-visibility map rendering
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeafletLoaded]);

  // 3. Update Markers and Polyline Route Path
  useEffect(() => {
    if (!isLeafletLoaded || !mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = mapInstanceRef.current;
    const curLat = currentLocation.latitude;
    const curLon = currentLocation.longitude;

    if (!curLat && !curLon) return;

    // Create / Update Start Origin Marker if different from current
    if (initialLocation && (initialLocation.latitude !== curLat || initialLocation.longitude !== curLon)) {
      if (!startMarkerRef.current) {
        const startHtml = `
          <div style="background-color: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid white; font-weight: bold; font-size: 13px;">
            🏁
          </div>
        `;
        const startIcon = L.divIcon({
          html: startHtml,
          className: "start-origin-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        startMarkerRef.current = L.marker([initialLocation.latitude, initialLocation.longitude], {
          icon: startIcon,
        })
          .addTo(map)
          .bindPopup(`<strong>SOS Initiated Here</strong><br/><span style="font-size: 11px;">${initialLocation.address || "Origin"}</span>`);
      }
    }

    // Create / Update Live Victim Marker
    const pulseAnimation = isActive
      ? `
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: #ef4444; opacity: 0.75; animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <style>@keyframes ping { 75%, 100% { transform: scale(2.4); opacity: 0; } }</style>
      `
      : "";

    const victimMarkerHtml = `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        ${pulseAnimation}
        <div style="position: relative; width: 26px; height: 26px; border-radius: 50%; background-color: ${isActive ? "#dc2626" : "#4b5563"}; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px;">
          ${isActive ? "SOS" : "✓"}
        </div>
      </div>
    `;

    const victimIcon = L.divIcon({
      html: victimMarkerHtml,
      className: "live-victim-marker",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (!markerRef.current) {
      markerRef.current = L.marker([curLat, curLon], { icon: victimIcon })
        .addTo(map)
        .bindPopup(
          `<strong>${userName} (Live Position)</strong><br/><span style="font-size: 12px; color: #374151;">${currentLocation.address || `${curLat.toFixed(5)}, ${curLon.toFixed(5)}`}</span>`
        );
    } else {
      markerRef.current.setLatLng([curLat, curLon]);
      markerRef.current.setIcon(victimIcon);
    }

    // Create / Update Polyline Route Trail
    const latLngs = breadcrumbs.map((b) => [b.latitude, b.longitude]);
    if (latLngs.length > 0 && !latLngs.some(([lat, lon]) => lat === curLat && lon === curLon)) {
      latLngs.push([curLat, curLon]);
    }

    if (latLngs.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(latLngs, {
          color: "#dc2626",
          weight: 5,
          opacity: 0.85,
          lineJoin: "round",
          dashArray: isActive ? undefined : "6, 8",
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latLngs);
      }
    }

    // Auto-follow: Pan to victim position when new update arrives
    if (autoFollow) {
      map.panTo([curLat, curLon], { animate: true, duration: 0.8 });
    }
  }, [isLeafletLoaded, currentLocation, initialLocation, breadcrumbs, userName, isActive, autoFollow]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current || !currentLocation.latitude) return;
    setAutoFollow(true);
    mapInstanceRef.current.setView([currentLocation.latitude, currentLocation.longitude], 17, {
      animate: true,
    });
  };

  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const points = breadcrumbs.map((b) => [b.latitude, b.longitude]);
    if (currentLocation.latitude) {
      points.push([currentLocation.latitude, currentLocation.longitude]);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      setAutoFollow(false);
    }
  };

  return (
    <div className="relative w-full h-[450px] md:h-[550px] rounded-2xl overflow-hidden shadow-lg border border-gray-200">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Loading Overlay */}
      {!isLeafletLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center text-gray-500 z-10 gap-3">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide">Connecting to GPS Map Satellite...</p>
        </div>
      )}

      {/* Floating Map Controls */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-2 z-20">
        <button
          onClick={handleRecenter}
          title="Recenter on Victim's Live Location"
          className="p-3 bg-white text-gray-800 hover:text-red-600 rounded-xl shadow-md border border-gray-200 font-semibold text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <FiCrosshair className="text-lg text-red-600" />
          <span className="text-xs">Follow Victim</span>
        </button>

        {breadcrumbs.length > 1 && (
          <button
            onClick={handleFitBounds}
            title="View Entire Route Path"
            className="p-3 bg-white text-gray-800 hover:text-blue-600 rounded-xl shadow-md border border-gray-200 font-semibold text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <FiMaximize2 className="text-lg text-blue-600" />
            <span className="text-xs">Full Path</span>
          </button>
        )}
      </div>

      {/* Live Badge in Map */}
      <div className="absolute top-4 left-4 z-20">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-md text-xs font-bold tracking-wide backdrop-blur-md ${
            isActive
              ? "bg-red-600/90 text-white animate-pulse"
              : "bg-gray-800/80 text-white"
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isActive ? "bg-white animate-ping" : "bg-emerald-400"
            }`}
          />
          <span>{isActive ? "LIVE MOVEMENT ACTIVE" : "EMERGENCY RESOLVED"}</span>
        </div>
      </div>

      {/* Live Breadcrumbs Counter Indicator */}
      {breadcrumbs.length > 0 && (
        <div className="absolute bottom-5 left-5 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 shadow-sm flex items-center gap-2">
          <FiNavigation className="text-red-600" />
          <span>
            <strong>{breadcrumbs.length}</strong> location ping{breadcrumbs.length === 1 ? "" : "s"} tracked
          </span>
        </div>
      )}
    </div>
  );
}

