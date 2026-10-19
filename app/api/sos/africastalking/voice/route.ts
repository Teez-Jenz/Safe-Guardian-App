import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Africa's Talking Voice Callback Endpoint
 *
 * Configured in Africa's Talking dashboard as:
 * https://your-domain.com/api/sos/africastalking/voice
 *
 * Africa's Talking sends an HTTP POST request to this endpoint when:
 * 1. A recipient answers the call (isActive = 1) -> responds with Voice XML (<Response><Say voice="...">...</Say></Response>)
 * 2. The call session ends (isActive = 0) -> responds with empty Voice XML (<Response/>)
 *
 * NOTE: Africa's Talking XML does NOT support <Pause> tags. Using <Pause> causes a syntax
 * error that triggers AT's default fallback message ("Welcome to Africa's Talking services").
 */

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildVoiceXml(message: string): string {
  const safeMessage = escapeXml(message);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-C">${safeMessage}</Say>
  <Say voice="en-US-Standard-C">Repeating: Emergency SOS Alert. Please check your email immediately for live emergency GPS location details and directions.</Say>
</Response>`.trim();
}

export async function POST(req: NextRequest) {
  try {
    let isActive = "1";
    let callerNumber = "";
    let destinationNumber = "";
    let clientRequestId = "";
    let sessionId = "";

    const contentType = req.headers.get("content-type") || "";

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      isActive = formData.get("isActive")?.toString() || "1";
      callerNumber = formData.get("callerNumber")?.toString() || "";
      destinationNumber = formData.get("destinationNumber")?.toString() || "";
      clientRequestId = formData.get("clientRequestId")?.toString() || "";
      sessionId = formData.get("sessionId")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      isActive = String(json.isActive ?? "1");
      callerNumber = json.callerNumber || "";
      destinationNumber = json.destinationNumber || "";
      clientRequestId = json.clientRequestId || "";
      sessionId = json.sessionId || "";
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      isActive = params.get("isActive") || "1";
      callerNumber = params.get("callerNumber") || "";
      destinationNumber = params.get("destinationNumber") || "";
      clientRequestId = params.get("clientRequestId") || "";
      sessionId = params.get("sessionId") || "";
    }

    console.log(
      `[Africa's Talking Voice] Callback received: sessionId=${sessionId}, isActive=${isActive}, callerNumber=${callerNumber}, destinationNumber=${destinationNumber}, clientRequestId=${clientRequestId}`
    );

    // If call session has ended, acknowledge with empty XML
    if (isActive === "0") {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response/>`, {
        status: 200,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
        },
      });
    }

    let senderName = "";

    // 1. Direct match via clientRequestId: sos-${userId}-${phone}
    if (clientRequestId && clientRequestId.startsWith("sos-")) {
      const parts = clientRequestId.split("-");
      // Format: sos-<uuid>-<phone>
      // UUID has 5 hyphenated segments, so rejoin segments 1 through 5
      if (parts.length >= 6) {
        const potentialUserId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}-${parts[5]}`;
        const { data: user } = await supabase
          .from("users")
          .select("name")
          .eq("id", potentialUserId)
          .maybeSingle();

        if (user?.name) {
          senderName = user.name;
        }
      }
    }

    // 2. Match via recipient phone number (destinationNumber or callerNumber) against contacts table
    if (!senderName) {
      const candidateNumbers = [destinationNumber, callerNumber].filter(Boolean);
      for (const rawNum of candidateNumbers) {
        const digits = rawNum.replace(/\D/g, "");
        const last10 = digits.slice(-10);

        if (last10.length >= 7) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("user_id, phone_number")
            .limit(100);

          const matched = contacts?.find((c) => {
            if (!c.phone_number) return false;
            const cDigits = c.phone_number.replace(/\D/g, "");
            return cDigits.endsWith(last10) || digits.endsWith(cDigits.slice(-10));
          });

          if (matched?.user_id) {
            const { data: user } = await supabase
              .from("users")
              .select("name")
              .eq("id", matched.user_id)
              .maybeSingle();

            if (user?.name) {
              senderName = user.name;
              break;
            }
          }
        }
      }
    }

    // 3. Fallback: Lookup the most recently triggered SOS alert in Supabase
    if (!senderName) {
      try {
        const { data: latestAlert } = await supabase
          .from("sos_alerts")
          .select("user_id")
          .order("triggered_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestAlert?.user_id) {
          const { data: user } = await supabase
            .from("users")
            .select("name")
            .eq("id", latestAlert.user_id)
            .maybeSingle();

          if (user?.name) {
            senderName = user.name;
          }
        }
      } catch (e) {
        console.warn("Could not lookup latest SOS alert user:", e);
      }
    }

    const message = senderName
      ? `Emergency SOS Alert! Emergency SOS Alert! Your contact, ${senderName}, has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. We have dispatched their exact GPS location and Google Maps directions to your registered email address. Please check your email immediately, or reach out to ${senderName} right away!`
      : "Emergency SOS Alert! Emergency SOS Alert! Your registered contact on SafeAlert Guardian has triggered an emergency alert and may need immediate assistance. We have dispatched their exact GPS location and Google Maps directions to your registered email address. Please check your email immediately, or reach out to them right away!";

    const xmlResponse = buildVoiceXml(message);

    return new NextResponse(xmlResponse, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error) {
    console.error("Africa's Talking voice callback error:", error);
    const fallbackXml = buildVoiceXml(
      "Emergency SOS Alert! Emergency SOS Alert! A contact has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. Please check your email for their live GPS location and directions."
    );

    return new NextResponse(fallbackXml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  }
}

export async function GET() {
  const defaultXml = buildVoiceXml(
    "Emergency SOS Alert! Emergency SOS Alert! A trusted contact has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. We have dispatched their exact GPS location and directions to your registered email address. Please check your email immediately."
  );

  return new NextResponse(defaultXml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
