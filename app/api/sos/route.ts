import { NextRequest, NextResponse } from "next/server";
import { dispatchEmergencyAlert } from "@/lib/emergencyAlert";

// In-memory de-duplication cache: tracks the timestamp of the last SOS request per user
const recentSosRequests = new Map<string, number>();
const lastSosResponses = new Map<string, unknown>();
const SOS_COOLDOWN_MS = 6_000; // 6-second cooldown per user

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, location, triggerReason, activity } = body;

    if (!userId || !location) {
      return NextResponse.json(
        { error: "Missing userId or location" },
        { status: 400 }
      );
    }

    const isCheckInMissed = triggerReason === "check_in_missed";

    // Rate Limiting / De-duplication check: if triggered recently (unless it's an urgent missed check-in)
    const now = Date.now();
    const lastRequestTime = recentSosRequests.get(userId);
    if (!isCheckInMissed && lastRequestTime && now - lastRequestTime < SOS_COOLDOWN_MS) {
      const prev = lastSosResponses.get(userId);
      if (prev) {
        return NextResponse.json(
          { ...(prev as object), rateLimited: true },
          { status: 200 }
        );
      }
    }
    recentSosRequests.set(userId, now);

    // Prune stale cache entries if map grows
    if (recentSosRequests.size > 500) {
      const cutoff = now - 10 * 60 * 1000;
      for (const [key, timestamp] of recentSosRequests.entries()) {
        if (timestamp < cutoff) {
          recentSosRequests.delete(key);
        }
      }
    }

    const result = await dispatchEmergencyAlert({
      userId,
      location,
      triggerReason,
      activity,
    });

    lastSosResponses.set(userId, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("SOS route error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
