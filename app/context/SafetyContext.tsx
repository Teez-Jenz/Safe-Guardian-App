"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface ActiveCheckIn {
  id: string;
  activity: string;
  expected_duration_minutes: number;
  started_at: string;
  status: string;
}

interface SafetyContextType {
  sosActive: boolean;
  activeCheckIn: ActiveCheckIn | null;
  startSos: (coords: { latitude: number; longitude: number; address?: string }) => Promise<void>;
  stopSos: () => Promise<void>;
  startCheckIn: (activity: string, duration: number) => Promise<void>;
  stopCheckIn: () => Promise<void>;
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

        if (statusData?.status === "danger") {
          setSosActive(true);
        } else {
          // Check LocalStorage as fallback
          const localSos = localStorage.getItem("sos_active");
          if (localSos === "true") {
            setSosActive(true);
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

    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse-geocode coordinates using Overpass API
        let address = "";
        try {
          address = await getAddressFromOverpass(latitude, longitude);
        } catch {
          address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        }

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
      },
      (error) => {
        console.error("Failed to fetch geolocation in background:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
  const startSos = async (loc: { latitude: number; longitude: number; address?: string }) => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId) {
      console.error("SOS failed: No active user session.");
      return;
    }
    setSosActive(true);
    localStorage.setItem("sos_active", "true");

    try {
      // 1. Insert into public.sos_alerts (SOS history)
      await supabase.from("sos_alerts").insert({
        user_id: curUserId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.address || "",
      });

      // 2. Call local SOS API to notify trusted contacts via Resend
      await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: curUserId,
          location: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address,
          },
        }),
      });

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
      await supabase.from("route_history").insert({
        user_id: curUserId,
        label: `🚨 SOS Triggered - near ${loc.address || "coordinates"}`,
        recorded_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error triggering SOS state:", err);
    }
  };

  // 5. Action: Stop SOS
  const stopSos = async () => {
    const curUserId = await getOrFetchUserId();
    if (!curUserId) return;
    setSosActive(false);
    localStorage.removeItem("sos_active");

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

  // 7. Action: Stop Check-In
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
        startSos,
        stopSos,
        startCheckIn,
        stopCheckIn,
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
