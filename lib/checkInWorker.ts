import { supabase } from "@/lib/supabase";
import { dispatchEmergencyAlert } from "@/lib/emergencyAlert";

let isSweeping = false;
let isWorkerRunning = false;

/**
 * Finds all active check-ins whose timer has elapsed and triggers the emergency SOS.
 * Can be called by internal background intervals, cron routes, or on-demand sweeps.
 */
export async function processOverdueCheckIns(): Promise<{
  processed: number;
  results: Array<{ checkInId: string; userId: string; activity: string; success: boolean }>;
}> {
  if (isSweeping) {
    return { processed: 0, results: [] };
  }
  isSweeping = true;

  try {
    const { data: activeCheckIns, error } = await supabase
      .from("check_ins")
      .select("id, user_id, activity, expected_duration_minutes, started_at, status")
      .eq("status", "active");

    if (error) {
      console.error("[CheckInWorker] Error querying active check-ins:", error);
      return { processed: 0, results: [] };
    }

    if (!activeCheckIns || activeCheckIns.length === 0) {
      return { processed: 0, results: [] };
    }

    const now = Date.now();
    const overdueCheckIns = activeCheckIns.filter((ci) => {
      const startedTime = new Date(ci.started_at).getTime();
      const durationMs = ci.expected_duration_minutes * 60 * 1000;
      return now >= startedTime + durationMs;
    });

    if (overdueCheckIns.length === 0) {
      return { processed: 0, results: [] };
    }

    console.log(
      `[CheckInWorker] Found ${overdueCheckIns.length} overdue check-in(s) in background. Processing alerts...`
    );

    const results = [];

    for (const checkIn of overdueCheckIns) {
      try {
        // 1. Immediately update status in Supabase to 'missed' to prevent duplicate execution
        await supabase
          .from("check_ins")
          .update({ status: "missed" })
          .eq("id", checkIn.id);

        // 2. Fetch the user's latest known coordinates & address
        let lat = 0;
        let lon = 0;
        let address = "Approximate location unavailable";

        const { data: latestSos } = await supabase
          .from("sos_alerts")
          .select("latitude, longitude, address")
          .eq("user_id", checkIn.user_id)
          .order("triggered_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSos && (latestSos.latitude || latestSos.longitude)) {
          lat = latestSos.latitude;
          lon = latestSos.longitude;
          address = latestSos.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        } else {
          const { data: latestRoute } = await supabase
            .from("route_history")
            .select("label")
            .eq("user_id", checkIn.user_id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestRoute?.label) {
            address = latestRoute.label;
          }
        }

        // 3. Dispatch the SOS (rings Africa's Talking phone calls & delivers Brevo email)
        const alertRes = await dispatchEmergencyAlert({
          userId: checkIn.user_id,
          location: {
            latitude: lat,
            longitude: lon,
            address,
          },
          triggerReason: "check_in_missed",
          activity: checkIn.activity,
        });

        console.log(
          `[CheckInWorker] Background alert completed for user ${checkIn.user_id}: Calls dialed: ${alertRes.calls.triggered}, Emails sent: ${alertRes.emails.sent}`
        );

        results.push({
          checkInId: checkIn.id,
          userId: checkIn.user_id,
          activity: checkIn.activity,
          success: true,
        });
      } catch (itemErr) {
        console.error(
          `[CheckInWorker] Failed to process overdue check-in ${checkIn.id}:`,
          itemErr
        );
        results.push({
          checkInId: checkIn.id,
          userId: checkIn.user_id,
          activity: checkIn.activity,
          success: false,
        });
      }
    }

    return { processed: results.length, results };
  } finally {
    isSweeping = false;
  }
}

/**
 * Starts an in-memory background interval inside the Node.js server process.
 * Runs every 10 seconds to detect any check-ins that expire while user is logged out.
 */
export function startBackgroundCheckInWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log("[CheckInWorker] Starting background check-in timer worker (10s interval)...");

  // Initial sweep immediately on start
  processOverdueCheckIns().catch((err) =>
    console.error("[CheckInWorker] Initial sweep error:", err)
  );

  // Periodic sweep every 10 seconds
  setInterval(() => {
    processOverdueCheckIns().catch((err) =>
      console.error("[CheckInWorker] Periodic sweep error:", err)
    );
  }, 10000);
}

