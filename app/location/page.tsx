"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // adjust path to wherever your supabase.ts lives

type Status = "safe" | "warning" | "danger" | "unknown";

type RouteStop = {
  id: string;
  label: string;
  recorded_at: string;
};

type CheckInLog = {
  id: string;
  activity: string;
  expected_duration_minutes: number;
  started_at: string;
  status: string;
};

type SosAlertLog = {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  triggered_at: string;
};

const STATUS_STYLES: Record<Status, { label: string; color: string }> = {
  safe: { label: "Safe", color: "text-emerald-600" },
  warning: { label: "Warning", color: "text-amber-600" },
  danger: { label: "Emergency", color: "text-red-600" },
  unknown: { label: "Unknown", color: "text-gray-500" },
};

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-gray-50 px-6 py-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("unknown");
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [routeHistory, setRouteHistory] = useState<RouteStop[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInLog[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlertLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Get the logged-in user, then load their initial data
  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch("/api/session");
        if (!sessionRes.ok) {
          setLoading(false);
          return;
        }
        const sessionData = await sessionRes.json();
        const curUserId = sessionData.session?.userId;

        if (!curUserId) {
          setLoading(false);
          return;
        }

        setUserId(curUserId);

        const [{ data: statusRow }, { data: routeRows }, { data: checkInRows }, { data: sosRows }] = await Promise.all([
          supabase
            .from("safety_status")
            .select("status, last_seen")
            .eq("user_id", curUserId)
            .single(),
          supabase
            .from("route_history")
            .select("id, label, recorded_at")
            .eq("user_id", curUserId)
            .order("recorded_at", { ascending: false })
            .limit(20),
          supabase
            .from("check_ins")
            .select("id, activity, expected_duration_minutes, started_at, status")
            .eq("user_id", curUserId)
            .order("started_at", { ascending: false }),
          supabase
            .from("sos_alerts")
            .select("id, latitude, longitude, address, triggered_at")
            .eq("user_id", curUserId)
            .order("triggered_at", { ascending: false }),
        ]);

        if (statusRow) {
          setStatus(statusRow.status);
          setLastSeen(statusRow.last_seen);
        }
        if (routeRows) {
          setRouteHistory(routeRows);
        }
        if (checkInRows) {
          setCheckIns(checkInRows);
        }
        if (sosRows) {
          setSosAlerts(sosRows);
        }
      } catch (err) {
        console.error("Failed to load location dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Subscribe to realtime updates once we know who the user is
  useEffect(() => {
    if (!userId) return;

    const statusChannel = supabase
      .channel(`safety_status:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "safety_status",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { status: Status; last_seen: string };
          if (!row) return;
          setStatus(row.status);
          setLastSeen(row.last_seen);
        },
      )
      .subscribe();

    const routeChannel = supabase
      .channel(`route_history:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "route_history",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as RouteStop;
          setRouteHistory((prev) => [row, ...prev]);
        },
      )
      .subscribe();

    const checkInChannel = supabase
      .channel(`check_ins:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "check_ins",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          supabase
            .from("check_ins")
            .select("id, activity, expected_duration_minutes, started_at, status")
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .then(({ data }) => {
              if (data) setCheckIns(data);
            });
        }
      )
      .subscribe();

    const sosAlertsChannel = supabase
      .channel(`sos_alerts:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sos_alerts",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as SosAlertLog;
          setSosAlerts((prev) => [row, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(routeChannel);
      supabase.removeChannel(checkInChannel);
      supabase.removeChannel(sosAlertsChannel);
    };
  }, [userId]);

  const statusInfo = STATUS_STYLES[status] ?? STATUS_STYLES.unknown;

  const formattedLastSeen = lastSeen
    ? new Date(lastSeen).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "N/A";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl p-8 text-gray-500">Loading…</div>
    );
  }

  return (
    <main className="w-full min-h-screen bg-gray-50 p-8">
      <div className="w-full rounded-3xl bg-white p-8 shadow-sm border border-gray-300">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">
            Emergency Dashboard
          </h1>
          <p className="text-gray-500">Monitor your safety status</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <StatCard label="Status">
            <span className={`text-xl font-bold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </StatCard>

          <StatCard label="Last Seen">
            <span className="text-xl font-bold text-gray-900">
              {formattedLastSeen}
            </span>
          </StatCard>
        </div>

        {/* Responsive Lists Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Route History */}
          <div className="rounded-2xl bg-gray-50 px-6 py-5 border border-gray-100 flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-3">Live Route History</h2>

            {routeHistory.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">No route history yet</p>
            ) : (
              <ul className="space-y-2 mt-1 overflow-y-auto max-h-96 pr-1">
                {routeHistory.map((stop) => (
                  <li
                    key={stop.id}
                    className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm border border-gray-200/50 shadow-sm"
                  >
                    <span className="text-gray-800 line-clamp-2 pr-2">{stop.label}</span>
                    <span className="text-gray-400 text-xs shrink-0">
                      {new Date(stop.recorded_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Safety Check-in History */}
          <div className="rounded-2xl bg-gray-50 px-6 py-5 border border-gray-100 flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-3">Check-In History</h2>

            {checkIns.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">No check-ins logged yet</p>
            ) : (
              <ul className="space-y-2 mt-1 overflow-y-auto max-h-96 pr-1">
                {checkIns.map((ci) => {
                  const statusColors: Record<string, string> = {
                    active: "bg-amber-100 text-amber-800 border-amber-200",
                    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
                    missed: "bg-red-100 text-red-800 border-red-200",
                  };
                  return (
                    <li
                      key={ci.id}
                      className="flex flex-col gap-1.5 rounded-lg bg-white px-4 py-3 text-sm border border-gray-200/50 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-gray-800">{ci.activity}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[ci.status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
                          {ci.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
                        <span>Duration: {ci.expected_duration_minutes}m</span>
                        <span>
                          {new Date(ci.started_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })} at {new Date(ci.started_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* SOS Alerts History */}
          <div className="rounded-2xl bg-gray-50 px-6 py-5 border border-gray-100 flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-3 text-red-600">🚨 SOS Trigger Log</h2>

            {sosAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">No SOS alerts triggered yet</p>
            ) : (
              <ul className="space-y-2 mt-1 overflow-y-auto max-h-96 pr-1">
                {sosAlerts.map((sos) => (
                  <li
                    key={sos.id}
                    className="flex flex-col gap-1.5 rounded-lg bg-red-50/30 px-4 py-3 text-sm border border-red-100 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-red-700">🚨 SOS Alert</span>
                      <span className="text-xs text-gray-500">
                        {new Date(sos.triggered_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-700 font-medium leading-relaxed">{sos.address || "Address unavailable"}</span>
                    <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-red-100/50 pt-1.5 mt-0.5">
                      <span>Coords: {sos.latitude.toFixed(5)}, {sos.longitude.toFixed(5)}</span>
                      <a
                        href={`https://www.google.com/maps?q=${sos.latitude},${sos.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-600 underline font-semibold"
                      >
                        View Map
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
