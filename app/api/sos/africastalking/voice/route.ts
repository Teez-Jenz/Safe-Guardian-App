import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Africa's Talking Voice Callback Endpoint
 *
 * Configured in Africa's Talking dashboard as:
 * https://your-domain.com/api/sos/africastalking/voice
 *
 * Africa's Talking sends an HTTP POST request to this endpoint when:
 * 1. A recipient answers the call (isActive = 1) -> responds with Voice XML (<Response><Say>...</Say></Response>)
 * 2. The call session ends (isActive = 0) -> responds with empty Voice XML (<Response/>)
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
  <Say>${safeMessage}</Say>
  <Pause length="2"/>
  <Say>Repeating: Emergency SOS Alert. Please check your email immediately for live emergency location details.</Say>
</Response>`.trim();
}

export async function POST(req: NextRequest) {
  try {
    let isActive = "1";
    let callerNumber = "";
    let sessionId = "";

    const contentType = req.headers.get("content-type") || "";

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      isActive = formData.get("isActive")?.toString() || "1";
      callerNumber = formData.get("callerNumber")?.toString() || "";
      sessionId = formData.get("sessionId")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      isActive = String(json.isActive ?? "1");
      callerNumber = json.callerNumber || "";
      sessionId = json.sessionId || "";
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      isActive = params.get("isActive") || "1";
      callerNumber = params.get("callerNumber") || "";
      sessionId = params.get("sessionId") || "";
    }

    console.log(
      `[Africa's Talking Voice] Callback received: sessionId=${sessionId}, isActive=${isActive}, callerNumber=${callerNumber}`,
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

    // Attempt to lookup sender's name via trusted contact's phone number
    let senderName = "";
    if (callerNumber) {
      try {
        const rawDigits = callerNumber.replace(/\D/g, "");
        const last10 = rawDigits.slice(-10);

        if (last10.length >= 7) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("user_id, phone_number")
            .limit(50);

          const matched = contacts?.find((c) => {
            if (!c.phone_number) return false;
            const cDigits = c.phone_number.replace(/\D/g, "");
            return cDigits.endsWith(last10) || rawDigits.endsWith(cDigits.slice(-10));
          });

          if (matched?.user_id) {
            const { data: user } = await supabase
              .from("users")
              .select("name")
              .eq("id", matched.user_id)
              .maybeSingle();

            if (user?.name) {
              senderName = user.name;
            }
          }
        }
      } catch (err) {
        console.warn("Could not lookup sender name for callerNumber:", err);
      }
    }

    const message = senderName
      ? `Emergency SOS Alert! Emergency SOS Alert! Your contact, ${senderName}, has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. We have dispatched their exact GPS location and Google Maps link to your registered email address. Please check your email immediately, or reach out to ${senderName} right away.`
      : "Emergency SOS Alert! Emergency SOS Alert! A trusted contact has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. We have dispatched their exact GPS location and Google Maps link to your registered email address. Please check your email immediately, or reach out to them right away.";

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
    // Fallback to default emergency Voice XML even if an internal error occurred
    const fallbackXml = buildVoiceXml(
      "Emergency SOS Alert! Emergency SOS Alert! A contact has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. Please check your email for their live GPS location and directions.",
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
  // Useful for verification checks or manual browser inspection
  const defaultXml = buildVoiceXml(
    "Emergency SOS Alert! Emergency SOS Alert! A trusted contact has triggered an emergency alert on SafeAlert Guardian and may need immediate assistance. We have dispatched their exact GPS location and directions to your registered email address. Please check your email immediately.",
  );

  return new NextResponse(defaultXml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
