"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import LiveTrackingMap, { MapBreadcrumb } from "@/app/components/LiveTrackingMap";
import {
  FiPhoneCall,
  FiMapPin,
  FiCompass,
  FiClock,
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiRefreshCw,
  FiActivity,
  FiNavigation,
} from "react-icons/fi";
import { HiOutlineExclamationCircle } from "react-icons/hi2";

interface TrackingUser {
  id: string;
  name: string;
  phone: string;
}

interface TrackingData {
  success: boolean;
  user: TrackingUser;
  isActive: boolean;
  startedAt: string;
  resolvedAt?: string | null;
  currentLocation: {
    latitude: number;
    longitude: number;
    address: string;
    accuracy?: number;
    speed?: number;
    updatedAt: string;
  };
  initialLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  breadcrumbs: MapBreadcrumb[];
  totalUpdates: number;
  error?: string;
}

// Haversine formula to compute distance in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LiveTrackingPage() {
  const params = useParams();
  const rawId = (params?.id as string) || "";

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  const fetchTrackingData = useCallback(async (isManualRefresh = false) => {
    if (!rawId) return;
    if (isManualRefresh) setIsRefreshing(true);

    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(rawId)}`);
      if (res.ok) {
        const json: TrackingData = await res.json();
        setData(json);
        setLastFetchTime(Date.now());
        setSecondsAgo(0);
      }
    } catch (err) {
      console.warn("[LiveTrackPage] Fetch error:", err);
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, [rawId]);

  // Initial load
  useEffect(() => {
    fetchTrackingData();
  }, [fetchTrackingData]);

  // Real-time polling loop every 5 seconds (active tracking)
  useEffect(() => {
    if (!rawId) return;

    // Only poll if emergency is still active or initial data not yet resolved
    const intervalTime = data?.isActive ? 5000 : 15000;
    const pollTimer = setInterval(() => {
      fetchTrackingData();
    }, intervalTime);

    return () => clearInterval(pollTimer);
  }, [rawId, data?.isActive, fetchTrackingData]);

  // "Seconds ago" ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetchTime) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastFetchTime]);

  // Calculate cumulative distance moved
  const totalDistance = useMemo(() => {
    if (!data?.breadcrumbs || data.breadcrumbs.length < 2) return 0;
    let distance = 0;
    for (let i = 1; i < data.breadcrumbs.length; i++) {
      const prev = data.breadcrumbs[i - 1];
      const cur = data.breadcrumbs[i];
      distance += calculateDistanceKm(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
    }
    return distance;
  }, [data?.breadcrumbs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="w-14 h-14 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-xl font-bold tracking-wide">Connecting to Live GPS Stream...</h1>
        <p className="text-gray-400 text-sm mt-2">Retrieving real-time coordinates from SafeAlert Guardian</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <HiOutlineExclamationCircle className="text-5xl text-red-500 mb-3" />
        <h1 className="text-2xl font-bold text-gray-800">Tracking Session Unavailable</h1>
        <p className="text-gray-600 mt-2 max-w-md">
          Unable to find an active emergency broadcast for this ID. The alert may have expired or been resolved.
        </p>
      </div>
    );
  }

  const { user, isActive, currentLocation, initialLocation, breadcrumbs, startedAt, resolvedAt } = data;
  const lat = currentLocation.latitude;
  const lon = currentLocation.longitude;

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
  const drivingDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* Top Emergency Status Header */}
      <header
        className={`w-full text-white px-4 py-6 md:px-8 shadow-xl transition-colors duration-500 ${
          isActive
            ? "bg-gradient-to-r from-red-600 via-red-700 to-rose-700"
            : "bg-gradient-to-r from-gray-800 to-slate-900"
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                isActive ? "bg-white/20 animate-pulse" : "bg-emerald-500/20"
              }`}
            >
              {isActive ? (
                <HiOutlineExclamationCircle className="text-3xl text-white" />
              ) : (
                <FiCheckCircle className="text-3xl text-emerald-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs uppercase font-extrabold px-3 py-0.5 rounded-full tracking-wider ${
                    isActive
                      ? "bg-white text-red-700 animate-pulse"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {isActive ? "🔴 BROADCASTING LIVE" : "✅ EMERGENCY RESOLVED"}
                </span>
                <span className="text-xs text-white/80">
                  {isActive
                    ? `Live signal updated ${secondsAgo}s ago`
                    : `Resolved at ${new Date(resolvedAt || "").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
                {user.name}&apos;s Live Emergency Track
              </h1>

              <p className="text-sm text-white/90 mt-0.5">
                {isActive
                  ? "Continuous live GPS tracking is active. Real-time movements are plotted automatically below."
                  : "The victim has confirmed their safety and deactivated the emergency SOS."}
              </p>
            </div>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => fetchTrackingData(true)}
              disabled={isRefreshing}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 backdrop-blur-sm cursor-pointer"
            >
              <FiRefreshCw className={isRefreshing ? "animate-spin" : ""} />
              <span>{isRefreshing ? "Syncing..." : "Refresh Map"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-6 space-y-6">
        {/* Real-time Interactive Map View */}
        <section className="bg-white rounded-3xl p-4 md:p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FiActivity className="text-red-600 text-lg" />
              <h2 className="text-base font-bold text-gray-900">Live Satellite Movement Map</h2>
            </div>
            <div className="text-xs text-gray-500 font-medium">
              OpenStreetMap Satellite Engine • High Accuracy
            </div>
          </div>

          <LiveTrackingMap
            currentLocation={currentLocation}
            initialLocation={initialLocation}
            breadcrumbs={breadcrumbs}
            userName={user.name}
            isActive={isActive}
          />
        </section>

        {/* Live Metrics Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Address */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
              <FiMapPin className="text-red-600 text-base" />
              <span>Latest Position</span>
            </div>
            <p className="font-bold text-gray-900 text-sm mt-2 line-clamp-2">
              {currentLocation.address || "Waiting for GPS fix..."}
            </p>
            <span className="text-[11px] text-gray-400 font-mono mt-1">
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </span>
          </div>

          {/* Distance Traveled */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
              <FiNavigation className="text-blue-600 text-base" />
              <span>Distance Tracked</span>
            </div>
            <p className="font-extrabold text-gray-900 text-2xl mt-1">
              {totalDistance > 1
                ? `${totalDistance.toFixed(2)} km`
                : `${Math.round(totalDistance * 1000)} meters`}
            </p>
            <span className="text-[11px] text-gray-400 mt-1">
              From origin point ({breadcrumbs.length} updates recorded)
            </span>
          </div>

          {/* Emergency Started */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
              <FiClock className="text-amber-600 text-base" />
              <span>SOS Initiated</span>
            </div>
            <p className="font-bold text-gray-900 text-sm mt-2">
              {new Date(startedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <span className="text-[11px] text-gray-400 mt-1">
              {new Date(startedAt).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Tracking Status */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
              <FiShield className="text-emerald-600 text-base" />
              <span>Live Engine State</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isActive ? "bg-red-500 animate-ping" : "bg-emerald-500"
                }`}
              />
              <span className="font-bold text-gray-900 text-sm">
                {isActive ? "Pinging Every 5s" : "Tracking Terminated"}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">
              {isActive ? "Continuous GPS Watching" : "Victim Marked Safe"}
            </span>
          </div>
        </section>

        {/* Action Toolbar */}
        <section className="bg-white p-6 rounded-3xl shadow-md border border-gray-200 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Emergency Actions & Assistance</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Call Victim */}
            {user.phone ? (
              <a
                href={`tel:${user.phone}`}
                className="flex items-center justify-center gap-2 p-4 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-sm transition shadow-sm"
              >
                <FiPhoneCall className="text-lg text-emerald-400" />
                <span>Call {user.name.split(" ")[0]}</span>
              </a>
            ) : null}

            {/* Turn-by-turn driving directions */}
            <a
              href={drivingDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-sm"
            >
              <FiCompass className="text-lg" />
              <span>Drive to Location →</span>
            </a>

            {/* Open Google Maps */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-sm"
            >
              <FiMapPin className="text-lg" />
              <span>Open in Google Maps</span>
            </a>

            {/* Emergency Hotline */}
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition shadow-sm"
            >
              <FiAlertTriangle className="text-lg" />
              <span>Call Police (112)</span>
            </a>
          </div>
        </section>

        {/* Movement Breadcrumb Trail Log */}
        {breadcrumbs.length > 0 && (
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-1">
              Movement Breadcrumb History ({breadcrumbs.length} updates)
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Chronological log of coordinates recorded by victim&apos;s GPS during this emergency.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...breadcrumbs].reverse().map((b, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        idx === 0 ? "bg-red-600 animate-pulse" : "bg-gray-400"
                      }`}
                    />
                    <span className="font-semibold text-gray-800 line-clamp-1">
                      {b.address || `${b.latitude.toFixed(5)}, ${b.longitude.toFixed(5)}`}
                    </span>
                  </div>
                  <span className="text-gray-400 text-[11px] shrink-0 font-mono">
                    {new Date(b.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

