import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { dispatchEmergencyAlert } from "@/lib/emergencyAlert";

// In-memory set of check-in IDs that have already been alerted
export const alertedCheckIns = new Set<string>();

let isSweeping = false;
let isWorkerRunning = false;

/**
 * Checks whether a check-in has already been alerted (in memory or in sos_alerts database)
 */
export async function isCheckInAlreadyAlerted(checkInId: string): Promise<boolean> {
  if (!checkInId) return false;
  if (alertedCheckIns.has(checkInId)) return true;

  try {
    const tag = `[checkin:${checkInId}]`;
    const { data } = await supabaseAdmin
      .from("sos_alerts")
      .select("id")
      .ilike("address", `%${tag}%`)
      .limit(1);

    if (data && data.length > 0) {
      alertedCheckIns.add(checkInId);
      return true;
    }
  } catch (err) {
    console.warn("[CheckInWorker] Error checking sos_alerts tag:", err);
  }

  return false;
}

/**
 * Finds all active check-ins whose timer has elapsed and triggers the emergency SOS.
 * Ensures each check-in is alerted EXACTLY ONCE:
 * - Checks against in-memory alerted set and sos_alerts table
 * - Automatically locks check-in ID before alerting
 * - Ignores stale check-ins older than 12 hours
 */
export async function processOverdueCheckIns(): Promise<{
  processed: number;
  results: Array<{
    checkInId: string;
    userId: string;
    activity: string;
    success: boolean;
    skipped?: boolean;
    reason?: string;
  }>;
}> {
  if (isSweeping) {
    return { processed: 0, results: [] };
  }
  isSweeping = true;

  try {
    const { data: activeCheckIns, error } = await supabaseAdmin
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
    // Only check-ins that are overdue AND expired within the last 12 hours
    const overdueCheckIns = activeCheckIns.filter((ci) => {
      const startedTime = new Date(ci.started_at).getTime();
      const durationMs = (ci.expected_duration_minutes || 0) * 60 * 1000;
      const expireTime = startedTime + durationMs;
      // Must be past expiration time
      if (now < expireTime) return false;
      // Stale check-ins expired more than 12 hours ago are ignored from auto-dialing
      if (now - expireTime > 12 * 60 * 60 * 1000) return false;
      return true;
    });

    if (overdueCheckIns.length === 0) {
      return { processed: 0, results: [] };
    }

    console.log(
      `[CheckInWorker] Checking ${overdueCheckIns.length} overdue check-in(s) for single alert dispatch...`
    );

    const results = [];

    for (const checkIn of overdueCheckIns) {
      // 1. Deduplication check: Has this check-in already been alerted?
      const alreadyAlerted = await isCheckInAlreadyAlerted(checkIn.id);
      if (alreadyAlerted) {
        // Silently mark as missed if DB allows
        try {
          await supabaseAdmin
            .from("check_ins")
            .update({ status: "missed" })
            .eq("id", checkIn.id);
        } catch {}

        results.push({
          checkInId: checkIn.id,
          userId: checkIn.user_id,
          activity: checkIn.activity,
          success: true,
          skipped: true,
          reason: "Already alerted once",
        });
        continue;
      }

      // 2. Lock check-in ID in memory immediately before dispatch to prevent concurrent sweeps
      alertedCheckIns.add(checkIn.id);

      try {
        // Update status in Supabase if permitted
        try {
          await supabaseAdmin
            .from("check_ins")
            .update({ status: "missed" })
            .eq("id", checkIn.id);
        } catch {}

        // Fetch user's latest known coordinates & address
        let lat = 0;
        let lon = 0;
        let address = "Approximate location unavailable";

        const { data: latestSos } = await supabaseAdmin
          .from("sos_alerts")
          .select("latitude, longitude, address")
          .eq("user_id", checkIn.user_id)
          .order("triggered_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSos && (latestSos.latitude || latestSos.longitude)) {
          lat = latestSos.latitude;
          lon = latestSos.longitude;
          address = (latestSos.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`)
            .replace(/\[checkin:.*?\]/g, "")
            .trim();
        }

        // Dispatch emergency alert (Africa's Talking call + Brevo email) EXACTLY ONCE
        const alertRes = await dispatchEmergencyAlert({
          userId: checkIn.user_id,
          location: {
            latitude: lat,
            longitude: lon,
            address,
          },
          triggerReason: "check_in_missed",
          activity: checkIn.activity,
          checkInId: checkIn.id,
        });

        console.log(
          `[CheckInWorker] Exactly-once background alert completed for user ${checkIn.user_id} (checkIn: ${checkIn.id}): Calls dialed: ${alertRes.calls.triggered}, Emails sent: ${alertRes.emails.sent}`
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
          reason: itemErr instanceof Error ? itemErr.message : String(itemErr),
        });
      }
    }

    return { processed: results.length, results };
  } finally {
    isSweeping = false;
  }
}

/**
 * Starts an in-memory background worker inside the Node.js server process.
 * Runs on a safe 60-second interval to check for overdue check-ins when user is logged out.
 */
export function startBackgroundCheckInWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log("[CheckInWorker] Starting background check-in timer worker (60s interval)...");

  // Initial sweep after brief delay
  setTimeout(() => {
    processOverdueCheckIns().catch((err) =>
      console.error("[CheckInWorker] Initial sweep error:", err)
    );
  }, 5000);

  // Periodic sweep every 60 seconds (NOT 10s)
  setInterval(() => {
    processOverdueCheckIns().catch((err) =>
      console.error("[CheckInWorker] Periodic sweep error:", err)
    );
  }, 60000);
}
