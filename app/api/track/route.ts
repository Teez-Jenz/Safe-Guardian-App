import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface LiveLocationBreadcrumb {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
}

export interface LiveTrackingSession {
  userId: string;
  userName: string;
  userPhone: string;
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
  breadcrumbs: LiveLocationBreadcrumb[];
}

// Global in-memory cache for ultra-fast live tracking updates
const liveSessions = new Map<string, LiveTrackingSession>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("userId") || searchParams.get("id");

    if (!rawId) {
      return NextResponse.json({ error: "Missing userId or alert id" }, { status: 400 });
    }

    let targetUserId = rawId;

    // Check if rawId corresponds to an sos_alert id rather than userId
    const { data: alertMatch } = await supabaseAdmin
      .from("sos_alerts")
      .select("user_id")
      .eq("id", rawId)
      .maybeSingle();

    if (alertMatch?.user_id) {
      targetUserId = alertMatch.user_id;
    }

    // 1. Fetch user information
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, name, phone_number")
      .eq("id", targetUserId)
      .maybeSingle();

    const userName = user?.name || "Emergency Contact";
    const userPhone = user?.phone_number || "";

    // 2. Fetch all location breadcrumbs from Supabase sos_alerts
    const { data: alertsData, error: alertsError } = await supabaseAdmin
      .from("sos_alerts")
      .select("id, latitude, longitude, address, triggered_at")
      .eq("user_id", targetUserId)
      .order("triggered_at", { ascending: true })
      .limit(300);

    if (alertsError) {
      console.warn("[Tracking API] Error querying sos_alerts:", alertsError);
    }

    // Filter valid GPS coordinates (latitude or longitude != 0)
    const validAlerts = (alertsData || []).filter(
      (a) =>
        typeof a.latitude === "number" &&
        typeof a.longitude === "number" &&
        (a.latitude !== 0 || a.longitude !== 0)
    );

    // Breadcrumbs trail
    const breadcrumbs: LiveLocationBreadcrumb[] = validAlerts.map((a) => ({
      latitude: a.latitude,
      longitude: a.longitude,
      address: (a.address || "").replace(/\[checkin:.*?\]/g, "").trim(),
      timestamp: a.triggered_at,
    }));

    // In-memory session state
    const cachedSession = liveSessions.get(targetUserId);

    // Merge any newer in-memory breadcrumbs
    if (cachedSession?.breadcrumbs) {
      for (const b of cachedSession.breadcrumbs) {
        if (!breadcrumbs.some((existing) => existing.timestamp === b.timestamp)) {
          breadcrumbs.push(b);
        }
      }
      breadcrumbs.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    const latestBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    const initialBreadcrumb = breadcrumbs[0];

    // Determine if SOS is active:
    // If explicitly marked inactive in memory, false.
    // If cached as active, true.
    // If no cache, check if latest alert occurred within the last 3 hours.
    let isActive = false;
    let resolvedAt: string | null = null;

    if (cachedSession) {
      isActive = cachedSession.isActive;
      resolvedAt = cachedSession.resolvedAt || null;
    } else if (latestBreadcrumb) {
      const elapsedMs = Date.now() - new Date(latestBreadcrumb.timestamp).getTime();
      isActive = elapsedMs < 3 * 60 * 60 * 1000; // active within 3 hours
      if (!isActive) {
        resolvedAt = latestBreadcrumb.timestamp;
      }
    }

    const currentLocation = latestBreadcrumb
      ? {
          latitude: latestBreadcrumb.latitude,
          longitude: latestBreadcrumb.longitude,
          address: latestBreadcrumb.address || `${latestBreadcrumb.latitude.toFixed(5)}, ${latestBreadcrumb.longitude.toFixed(5)}`,
          updatedAt: latestBreadcrumb.timestamp,
        }
      : cachedSession?.currentLocation || {
          latitude: 0,
          longitude: 0,
          address: "Searching for satellite GPS signal...",
          updatedAt: new Date().toISOString(),
        };

    const startedAt = initialBreadcrumb?.timestamp || cachedSession?.startedAt || new Date().toISOString();

    return NextResponse.json({
      success: true,
      user: {
        id: targetUserId,
        name: userName,
        phone: userPhone,
      },
      isActive,
      startedAt,
      resolvedAt,
      currentLocation,
      initialLocation: initialBreadcrumb || currentLocation,
      breadcrumbs,
      totalUpdates: breadcrumbs.length,
    });
  } catch (err) {
    console.error("[Tracking API] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error fetching live track" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, latitude, longitude, address, accuracy, speed, action } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 1. Action: Resolve / Stop Emergency Tracking
    if (action === "resolve" || action === "stop") {
      const now = new Date().toISOString();
      const existing = liveSessions.get(userId);
      if (existing) {
        existing.isActive = false;
        existing.resolvedAt = now;
      } else {
        liveSessions.set(userId, {
          userId,
          userName: "Victim",
          userPhone: "",
          isActive: false,
          startedAt: now,
          resolvedAt: now,
          currentLocation: {
            latitude: Number(latitude) || 0,
            longitude: Number(longitude) || 0,
            address: address || "",
            updatedAt: now,
          },
          breadcrumbs: [],
        });
      }

      console.log(`[Tracking API] Emergency tracking resolved for user: ${userId}`);
      return NextResponse.json({ success: true, resolved: true, resolvedAt: now });
    }

    // 2. Action: Continuous Location Coordinate Upload
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const finalAddress =
      address && address.trim().length > 0
        ? address.trim()
        : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    // Upload new location point to Supabase sos_alerts table
    try {
      await supabaseAdmin.from("sos_alerts").insert({
        user_id: userId,
        latitude: lat,
        longitude: lon,
        address: finalAddress,
        triggered_at: timestamp,
      });
    } catch (insertErr) {
      console.warn("[Tracking API] Failed to upload coordinate to Supabase sos_alerts:", insertErr);
    }

    // Update in-memory session cache
    let session = liveSessions.get(userId);
    if (!session) {
      session = {
        userId,
        userName: "Victim",
        userPhone: "",
        isActive: true,
        startedAt: timestamp,
        resolvedAt: null,
        currentLocation: {
          latitude: lat,
          longitude: lon,
          address: finalAddress,
          accuracy: Number(accuracy) || undefined,
          speed: Number(speed) || undefined,
          updatedAt: timestamp,
        },
        breadcrumbs: [],
      };
      liveSessions.set(userId, session);
    } else {
      session.isActive = true;
      session.resolvedAt = null;
      session.currentLocation = {
        latitude: lat,
        longitude: lon,
        address: finalAddress,
        accuracy: Number(accuracy) || session.currentLocation.accuracy,
        speed: Number(speed) || session.currentLocation.speed,
        updatedAt: timestamp,
      };
    }

    // Append to breadcrumbs trail if different from last coordinate
    const last = session.breadcrumbs[session.breadcrumbs.length - 1];
    if (!last || last.latitude !== lat || last.longitude !== lon) {
      session.breadcrumbs.push({
        latitude: lat,
        longitude: lon,
        address: finalAddress,
        timestamp,
      });
      // Keep maximum 500 in-memory breadcrumbs
      if (session.breadcrumbs.length > 500) {
        session.breadcrumbs.shift();
      }
    }

    return NextResponse.json({
      success: true,
      recordedAt: timestamp,
      breadcrumbsCount: session.breadcrumbs.length,
    });
  } catch (err) {
    console.error("[Tracking API] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error recording tracking coordinates" },
      { status: 500 }
    );
  }
}

