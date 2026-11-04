import { NextRequest, NextResponse } from "next/server";
import { dispatchEmergencyAlert } from "@/lib/emergencyAlert";
import { isCheckInAlreadyAlerted, alertedCheckIns } from "@/lib/checkInWorker";

// Tracks active SOS emergency sessions per user
// userId -> { startTime: number, result: unknown }
const activeSosSessions = new Map<string, { startTime: number; result: unknown }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, location, triggerReason = "manual", activity, checkInId, action } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 1. Handle SOS Cancellation action (resets active SOS so user can trigger again later)
    if (action === "cancel") {
      activeSosSessions.delete(userId);
      console.log(`[SOS API] Active SOS session cleared for user: ${userId}`);
      return NextResponse.json({ success: true, cancelled: true });
    }

    if (!location) {
      return NextResponse.json(
        { error: "Missing location coordinates" },
        { status: 400 }
      );
    }

    const isCheckInMissed = triggerReason === "check_in_missed";

    // 2. Case A: Missed Check-In Alert -> Strictly sent ONCE per check-in ID
    if (isCheckInMissed && checkInId) {
      const alreadyAlerted = await isCheckInAlreadyAlerted(checkInId);
      if (alreadyAlerted) {
        console.log(
          `[SOS API] Deduplication check: Check-in ${checkInId} already alerted once. Skipping duplicate calls and emails.`
        );
        return NextResponse.json({
          success: true,
          alreadyAlerted: true,
          message: "Emergency alert has already been sent once for this missed check-in.",
          calls: { triggered: 0, total: 0 },
          emails: { sent: 0, failed: 0 },
        });
      }

      // Lock checkInId in memory before dispatch
      alertedCheckIns.add(checkInId);
    }

    // 3. Case B: Manual or Shake SOS Trigger -> Strictly sent ONCE until user cancels and triggers again
    if (!isCheckInMissed) {
      const existingSession = activeSosSessions.get(userId);
      if (existingSession) {
        console.log(
          `[SOS API] Deduplication check: User ${userId} already has an active SOS. Calls and emails were already sent once.`
        );
        return NextResponse.json({
          ...(existingSession.result as object),
          alreadyActive: true,
          message: "SOS alert is already active. Call and email were already sent once.",
        });
      }
    }

    // 4. Dispatch the emergency alert (Brevo email + Africa's Talking voice call)
    const result = await dispatchEmergencyAlert({
      userId,
      location,
      triggerReason,
      activity,
      checkInId,
    });

    // Record active SOS session if this was a manual or shake SOS
    if (!isCheckInMissed) {
      activeSosSessions.set(userId, {
        startTime: Date.now(),
        result,
      });
    }

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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (userId) {
      activeSosSessions.delete(userId);
    }
    return NextResponse.json({ success: true, cancelled: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
