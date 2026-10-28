"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getBestLocation } from "@/lib/geolocation";

interface ActiveCheckIn {
  id: string;
  activity: string;
  expected_duration_minutes: number;
  started_at: string;
  status: string;
}

export interface SosAlertResult {
  success: boolean;
  senderName?: string;
  triggerReason?: string;
  activity?: string;
  notifiedContactsCount: number;
  emails: { sent: number; failed: number };
  calls: { triggered: number; total: number };
  location?: {
    latitude: number;
    longitude: number;
    address: string;
    googleMapsLink: string;
  };
  error?: string;
  emailError?: string;
}

interface SafetyContextType {
  sosActive: boolean;
  activeCheckIn: ActiveCheckIn | null;
  sosAlertResult: SosAlertResult | null;
  startSos: (
    coords: { latitude: number; longitude: number; address?: string },
    options?: { triggerReason?: string; activity?: string }
  ) => Promise<SosAlertResult | null>;
  stopSos: () => Promise<void>;
  startCheckIn: (activity: string, duration: number) => Promise<void>;
  stopCheckIn: () => Promise<void>;
  triggerCheckInOverdue: (checkIn?: ActiveCheckIn) => Promise<SosAlertResult | null>;
  userId: string | null;
}

const SafetyContext = createContext<SafetyContextType | undefined>(undefined);

const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // ✅ works
  "https://overpass.kumi.systems/api/interpreter", // fallback
];

interface OverpassElement {
  tags?: {
    name?: string;
    "addr:street"?: string;
    "addr:housenumber"?: string;
    "addr:suburb"?: string;
    "addr:city"?: string;
    highway?: string;
    place?: string;
  };
}

const getAddressFromOverpass = async (lat: number, lng: number): Promise<string> => {
  const query = `
    [out:json][timeout:15];
    (
      way(around:150, ${lat}, ${lng})["highway"]["name"];
      node(around:150, ${lat}, ${lng})["addr:street"];
      node(around:300, ${lat}, ${lng})["place"];
    );
    out tags;
  `;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) continue;

      const data = await response.json() as { elements?: OverpassElement[] };
      if (!data || !data.elements || data.elements.length === 0) continue;

      const elements = data.elements.filter((el): el is OverpassElement & { tags: NonNullable<OverpassElement["tags"]> } => !!el.tags);
      
      const withHouse = elements.find((el) => el.tags["addr:street"] && el.tags["addr:housenumber"]);
      if (withHouse) {
        const parts = [
          withHouse.tags["addr:housenumber"],
          withHouse.tags["addr:street"],
          withHouse.tags["addr:suburb"] || withHouse.tags["addr:city"]
        ].filter(Boolean);
        return parts.join(", ");
      }

      const withStreet = elements.find((el) => el.tags["addr:street"]);
      if (withStreet) {
        const parts = [
          withStreet.tags["addr:street"],
          withStreet.tags["addr:suburb"] || withStreet.tags["addr:city"]
        ].filter(Boolean);
        return parts.join(", ");
      }

      const withHighway = elements.find((el) => el.tags.highway && el.tags.name);
      if (withHighway && withHighway.tags.name) {
        return withHighway.tags.name;
      }

      const withPlace = elements.find((el) => el.tags.place && el.tags.name);
      if (withPlace && withPlace.tags.name) {
        return withPlace.tags.name;
      }
    } catch (err) {
      console.warn("Failed to fetch address from Overpass endpoint:", endpoint, err);
    }
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

export const SafetyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [sosActive, setSosActive] = useState<boolean>(false);
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [sosAlertResult, setSosAlertResult] = useState<SosAlertResult | null>(null);

  // 1. Initial State Load (from API session and LocalStorage/Database)
  useEffect(() => {
    const loadSessionAndState = async () => {
      try {
        const sessionRes = await fetch("/api/session");
        if (!sessionRes.ok) return;
        const sessionData = await sessionRes.json();
        const curUserId = sessionData.session?.userId;
        if (!curUserId) return;
        setUserId(curUserId);

        // Load SOS state from DB (safety_status)
        const { data: statusData } = await supabase
          .from("safety_status")
          .select("status")
          .eq("user_id", curUserId)
          .single();

        const isDanger =
          statusData?.status === "danger" ||
          localStorage.getItem("sos_active") === "true";

        if (isDanger) {
          setSosActive(true);
          const cachedResult = localStorage.getItem("sos_alert_result");
          if (cachedResult) {
            try {
              setSosAlertResult(JSON.parse(cachedResult));
            } catch (e) {
              console.warn("Failed to parse cached sos_alert_result:", e);
            }
          }
        }

        // Load Active Check-in from DB
        const { data: checkInData } = await supabase
          .from("check_ins")
          .select("id, activity, expected_duration_minutes, started_at, status")
          .eq("user_id", curUserId)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (checkInData) {
          setActiveCheckIn(checkInData);
        } else {
          // Check LocalStorage as fallback
          const localCheckIn = localStorage.getItem("active_check_in");
          if (localCheckIn) {
            setActiveCheckIn(JSON.parse(localCheckIn));
          }
        }
      } catch (err) {
        console.error("Failed to initialize safety state:", err);
      }
    };

    loadSessionAndState();
  }, []);

  // 2. Location Tracking and Address Geocoding Action
  const trackLocation = useCallback(async () => {
    if (!userId || (!sosActive && !activeCheckIn)) return;

    try {
      const loc = await getBestLocation();
      const latitude = loc.latitude;
      const longitude = loc.longitude;
      const address = loc.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      const statusVal = sosActive ? "danger" : activeCheckIn ? "warning" : "safe";

      // Update public.safety_status
      await supabase.from("safety_status").upsert(
        {
          user_id: userId,
          status: statusVal,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // Log to public.route_history
      const label = sosActive
        ? `🚨 SOS Active - near ${address}`
        : `⏱️ Check-in active (${activeCheckIn?.activity}) - near ${address}`;

      await supabase.from("route_history").insert({
        user_id: userId,
        label: label,
        recorded_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Background location tracking notice:", error);
    }
  }, [userId, sosActive, activeCheckIn]);

  // 3. Set up the background tracking loop (every 30 seconds)
  useEffect(() => {
    if (!userId) return;
    if (!sosActive && !activeCheckIn) return;

    // Track immediately on activation
    trackLocation();

    const timer = setInterval(() => {
      trackLocation();
    }, 30000);

    return () => clearInterval(timer);
  }, [userId, sosActive, activeCheckIn, trackLocation]);

  // Helper to resolve user ID on the fly if state hasn't synchronized yet
  const getOrFetchUserId = async (): Promise<string | null> => {
    if (userId) return userId;
    try {
      const sessionRes = await fetch("/api/session");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const curUserId = sessionData.session?.userId;
        if (curUserId) {
          setUserId(curUserId);
          return curUserId;
        }
      }
    } catch (e) {
      console.error("Error fetching user ID on the fly:", e);
    }
    return null;
  };

  // 4. Action: Start SOS
  const startSos = async (
    loc: { latitude: number; longitude: number; address?: string },
    options?: { triggerReason?: string; activity?: string }
  ): Promise<SosAlertResult | null> => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId) {
      console.error("SOS failed: No active user session.");
      return null;
    }
    setSosActive(true);
    localStorage.setItem("sos_active", "true");

    let finalAddress = loc.address;
    if (!finalAddress) {
      try {
        finalAddress = await getAddressFromOverpass(loc.latitude, loc.longitude);
      } catch {
        finalAddress = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
      }
    }

    const triggerReason = options?.triggerReason || "manual";
    const activity = options?.activity;

    try {
      // 1. Insert into public.sos_alerts (SOS history)
      await supabase.from("sos_alerts").insert({
        user_id: curUserId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: finalAddress || "",
      });

      // 2. Call local SOS API to notify trusted contacts via Brevo email and Africa's Talking Voice
      const sosRes = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: curUserId,
          location: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: finalAddress,
          },
          triggerReason,
          activity,
        }),
      });

      let alertData: SosAlertResult | null = null;
      if (sosRes.ok) {
        alertData = await sosRes.json();
        setSosAlertResult(alertData);
        try {
          localStorage.setItem("sos_alert_result", JSON.stringify(alertData));
        } catch {}
      } else {
        const stored = localStorage.getItem("sos_alert_result");
        if (stored) {
          try {
            alertData = JSON.parse(stored);
            setSosAlertResult(alertData);
          } catch {}
        }
      }

      // 3. Set safety status to danger
      await supabase.from("safety_status").upsert(
        {
          user_id: curUserId,
          status: "danger",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // 4. Log to route history
      const routeLabel = triggerReason === "check_in_missed"
        ? `⚠️ Missed Check-In Alert (${activity || "Activity"}) - Emergency Dispatched near ${finalAddress || "coordinates"}`
        : `🚨 SOS Triggered - near ${finalAddress || "coordinates"}`;

      await supabase.from("route_history").insert({
        user_id: curUserId,
        label: routeLabel,
        recorded_at: new Date().toISOString(),
      });

      return alertData;
    } catch (err) {
      console.error("Error triggering SOS state:", err);
      return null;
    }
  };

  // 5. Action: Stop SOS
  const stopSos = async () => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId) return;
    setSosActive(false);
    setSosAlertResult(null);
    localStorage.removeItem("sos_active");
    localStorage.removeItem("sos_alert_result");

    // If an active check-in had expired into missed status, also mark it completed
    if (activeCheckIn && (activeCheckIn.status === "missed" || activeCheckIn.status === "overdue")) {
      try {
        await supabase
          .from("check_ins")
          .update({ status: "completed" })
          .eq("id", activeCheckIn.id);
      } catch {}
      setActiveCheckIn(null);
      localStorage.removeItem("active_check_in");
    }

    try {
      // Reset safety status to safe
      await supabase.from("safety_status").upsert(
        {
          user_id: curUserId,
          status: "safe",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // Log cancel event to route history
      await supabase.from("route_history").insert({
        user_id: curUserId,
        label: "✅ SOS Cancelled / Safely Deactivated",
        recorded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error disabling SOS state:", err);
    }
  };

  // 6. Action: Start Check-In
  const startCheckIn = async (activity: string, duration: number) => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId) {
      throw new Error("You need to be signed in to start a check-in.");
    }

    try {
      const { data, error } = await supabase
        .from("check_ins")
        .insert({
          user_id: curUserId,
          activity,
          expected_duration_minutes: duration,
          started_at: new Date().toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setActiveCheckIn(data);
      localStorage.setItem("active_check_in", JSON.stringify(data));

      // Update safety status to warning
      await supabase.from("safety_status").upsert(
        {
          user_id: curUserId,
          status: "warning",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // Log check-in start event to route history
      await supabase.from("route_history").insert({
        user_id: curUserId,
        label: `⏱️ Started Check-in (${activity} for ${duration}m)`,
        recorded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error starting check-in:", err);
      throw err;
    }
  };

  // 7. Action: Trigger Missed Check-In Emergency Alert
  const triggeringCheckInRef = useRef<boolean>(false);

  const triggerCheckInOverdue = useCallback(
    async (checkInToAlert?: ActiveCheckIn): Promise<SosAlertResult | null> => {
      const targetCheckIn = checkInToAlert || activeCheckIn;
      if (!targetCheckIn) return null;

      // Prevent duplicate executions
      if (triggeringCheckInRef.current || targetCheckIn.status === "missed") {
        return null;
      }
      triggeringCheckInRef.current = true;

      const curUserId = await getOrFetchUserId();
      if (!curUserId) {
        triggeringCheckInRef.current = false;
        return null;
      }

      console.log(
        `[SafetyContext] Check-in overdue! Triggering emergency alert for activity: ${targetCheckIn.activity}`
      );

      // 1. Mark check-in record status as missed in Supabase
      try {
        await supabase
          .from("check_ins")
          .update({ status: "missed" })
          .eq("id", targetCheckIn.id);
      } catch (err) {
        console.warn("Failed to mark check-in as missed in Supabase:", err);
      }

      const updatedCheckIn = { ...targetCheckIn, status: "missed" };
      setActiveCheckIn(updatedCheckIn);
      try {
        localStorage.setItem("active_check_in", JSON.stringify(updatedCheckIn));
      } catch {}

      // 2. Resolve GPS coordinates
      let locCoords: { latitude: number; longitude: number; address?: string };
      try {
        const loc = await getBestLocation();
        locCoords = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
        };
      } catch {
        locCoords = { latitude: 0, longitude: 0, address: "Approximate location unavailable" };
      }

      // 3. Vibration alert if available
      try {
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([500, 200, 500, 200, 500]);
        }
      } catch {}

      // 4. Dispatch emergency SOS alert to Brevo email & Africa's Talking Voice
      const result = await startSos(locCoords, {
        triggerReason: "check_in_missed",
        activity: targetCheckIn.activity,
      });

      triggeringCheckInRef.current = false;
      return result;
    },
    [activeCheckIn, getOrFetchUserId, startSos]
  );

  // 8. Background Check-In Expiration Watcher
  useEffect(() => {
    if (!activeCheckIn || activeCheckIn.status !== "active") return;

    const checkExpiration = () => {
      const startedTime = new Date(activeCheckIn.started_at).getTime();
      const expectedDurationMs = activeCheckIn.expected_duration_minutes * 60 * 1000;
      const endTime = startedTime + expectedDurationMs;
      const remainingSec = Math.floor((endTime - Date.now()) / 1000);

      if (remainingSec <= 0) {
        triggerCheckInOverdue(activeCheckIn);
      }
    };

    // Check immediately upon mount/update
    checkExpiration();

    const interval = setInterval(checkExpiration, 1000);
    return () => clearInterval(interval);
  }, [activeCheckIn, triggerCheckInOverdue]);

  // 9. Action: Stop Check-In
  const stopCheckIn = async () => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId || !activeCheckIn) return;

    try {
      // Mark check-in record status as completed
      await supabase
        .from("check_ins")
        .update({ status: "completed" })
        .eq("id", activeCheckIn.id);

      const oldActivity = activeCheckIn.activity;
      setActiveCheckIn(null);
      localStorage.removeItem("active_check_in");

      // Also reset SOS if it was triggered by overdue check-in
      if (sosActive) {
        setSosActive(false);
        setSosAlertResult(null);
        localStorage.removeItem("sos_active");
        localStorage.removeItem("sos_alert_result");
      }

      // Reset safety status to safe
      await supabase.from("safety_status").upsert(
        {
          user_id: curUserId,
          status: "safe",
          last_seen: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      // Log check-in completion event to route history
      await supabase.from("route_history").insert({
        user_id: curUserId,
        label: `✅ Safely Checked In from ${oldActivity}`,
        recorded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error completing check-in:", err);
    }
  };

  return (
    <SafetyContext.Provider
      value={{
        sosActive,
        activeCheckIn,
        sosAlertResult,
        startSos,
        stopSos,
        startCheckIn,
        stopCheckIn,
        triggerCheckInOverdue,
        userId,
      }}
    >
      {children}
    </SafetyContext.Provider>
  );
};

export const useSafety = () => {
  const context = useContext(SafetyContext);
  if (context === undefined) {
    throw new Error("useSafety must be used within a SafetyProvider");
  }
  return context;
};
