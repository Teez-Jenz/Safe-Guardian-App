import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendBrevoEmail } from "@/lib/brevo";
import { initiateVoiceCall } from "@/lib/africastalking";

// In-memory de-duplication cache: tracks the timestamp of the last SOS request per user
const recentSosRequests = new Map<string, number>();
const lastSosResponses = new Map<string, unknown>();
const SOS_COOLDOWN_MS = 6_000; // 6-second cooldown per user

// Helper to normalize phone numbers to E.164 standard (e.g., 08089663211 -> +2348089663211)
function formatToE164(phone: string, defaultCountryCode = "+234"): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  const digitsAndPlus = trimmed.replace(/[^\d+]/g, "");

  if (digitsAndPlus.startsWith("+")) {
    return digitsAndPlus;
  }
  if (digitsAndPlus.startsWith("0")) {
    return `${defaultCountryCode}${digitsAndPlus.slice(1)}`;
  }
  if (digitsAndPlus.startsWith("234") && digitsAndPlus.length >= 12) {
    return `+${digitsAndPlus}`;
  }
  if (digitsAndPlus.startsWith("1") && digitsAndPlus.length === 11) {
    return `+${digitsAndPlus}`;
  }
  return `${defaultCountryCode}${digitsAndPlus}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, location } = body;

    if (!userId || !location) {
      return NextResponse.json(
        { error: "Missing userId or location" },
        { status: 400 },
      );
    }

    // Rate Limiting / De-duplication check: if triggered recently, return cached response so dashboard numbers persist
    const now = Date.now();
    const lastRequestTime = recentSosRequests.get(userId);
    if (lastRequestTime && now - lastRequestTime < SOS_COOLDOWN_MS) {
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

    const lat = typeof location.latitude === "number" ? location.latitude : Number(location.latitude) || 0;
    const lon = typeof location.longitude === "number" ? location.longitude : Number(location.longitude) || 0;
    const address = location.address || (lat !== 0 || lon !== 0 ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "Approximate location unavailable");

    // 1. Fetch the SOS sender's info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching user:", userError);
    }

    const senderName = user?.name || "Your trusted contact";

    // 2. Fetch trusted contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("name, email, phone_number, relationship")
      .eq("user_id", userId);

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: 500 },
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "No registered trusted contacts found" },
        { status: 404 },
      );
    }

    const googleMapsLink = `https://www.google.com/maps?q=${lat},${lon}`;
    const googleDirectionsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    const alertTime = new Date().toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "medium",
    });

    // 3. Send Email Alerts via Brevo
    const emailPromises = contacts
      .filter((contact) => contact.email && contact.email.trim().length > 0)
      .map(async (contact) => {
        const relationshipLabel = contact.relationship
          ? `their ${contact.relationship}`
          : "someone they trust";

        const emailResult = await sendBrevoEmail({
          to: [{ email: contact.email.trim(), name: contact.name }],
          subject: `🚨 EMERGENCY SOS ALERT: ${senderName} needs immediate assistance!`,
          htmlContent: `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>SOS Alert</title>
            </head>
            <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
              <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.15); border: 1px solid #fee2e2;">
                
                <!-- Alert Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 36px 24px; text-align: center;">
                    <div style="font-size: 40px; line-height: 1; margin-bottom: 12px;">🚨</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">EMERGENCY SOS ALERT</h1>
                    <p style="color: #fecaca; margin: 8px 0 0; font-size: 15px; font-weight: 500;">Immediate Attention Required</p>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 32px 28px;">
                    <p style="font-size: 17px; margin-top: 0; color: #111827;">Dear <strong>${contact.name}</strong>,</p>

                    <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                      You are receiving this high-priority alert because you are registered as <strong>${relationshipLabel}</strong> for <strong>${senderName}</strong> on SafeAlert Guardian.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 6px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 15px; font-weight: 600; color: #991b1b;">
                        ⚠️ <strong>${senderName}</strong> has triggered an SOS emergency signal and may be in danger. Please check their location below and contact them or emergency services immediately!
                      </p>
                    </div>

                    <!-- Location Details Box -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">
                            📍 GPS Location Information
                          </p>

                          <div style="margin-bottom: 12px;">
                            <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Approximate Address:</span>
                            <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                              ${address}
                            </p>
                          </div>

                          <div style="display: flex; gap: 16px; margin-bottom: 8px;">
                            <div style="margin-right: 20px;">
                              <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Latitude:</span>
                              <p style="margin: 2px 0 0; font-size: 14px; color: #334155; font-family: monospace;">${lat.toFixed(6)}</p>
                            </div>
                            <div>
                              <span style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Longitude:</span>
                              <p style="margin: 2px 0 0; font-size: 14px; color: #334155; font-family: monospace;">${lon.toFixed(6)}</p>
                            </div>
                          </div>

                          <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                            <span style="font-size: 12px; color: #64748b;">Timestamp: <strong>${alertTime}</strong></span>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Primary Action Buttons -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px;">
                      <tr>
                        <td align="center">
                          <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                            <tr>
                              <td align="center" style="border-radius: 8px; background-color: #dc2626;">
                                <a href="${googleMapsLink}" target="_blank" style="display: inline-block; padding: 16px 36px; font-family: sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);">
                                  🗺️ Open Location on Google Maps
                                </a>
                              </td>
                            </tr>
                          </table>

                          <div style="margin-top: 8px;">
                            <a href="${googleDirectionsLink}" target="_blank" style="font-size: 13px; color: #dc2626; font-weight: 600; text-decoration: underline;">
                              Get Turn-by-Turn Driving Directions →
                            </a>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Plain text fallback link -->
                    <div style="margin-top: 24px; padding: 12px; background-color: #f1f5f9; border-radius: 6px;">
                      <p style="margin: 0; font-size: 12px; color: #64748b; word-break: break-all;">
                        Direct Google Maps URL: <br>
                        <a href="${googleMapsLink}" style="color: #2563eb;">${googleMapsLink}</a>
                      </p>
                    </div>

                    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                      This automated emergency notification was broadcast by SafeAlert Guardian.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                      © ${new Date().getFullYear()} SafeAlert Guardian. Personal Emergency Safety Companion.
                    </p>
                  </td>
                </tr>

              </table>
            </body>
          </html>
          `,
        });

        if (!emailResult.success) {
          console.error(`Brevo Email Error for ${contact.name} (${contact.email}):`, emailResult.error);
          throw new Error(emailResult.error || "Failed to send email via Brevo");
        }

        return {
          contact: contact.name,
          email: contact.email,
          status: "sent",
          messageId: emailResult.messageId,
        };
      });

    // 4. Trigger Outbound Voice Calls via Africa's Talking REST API
    const atUsername = process.env.AT_USERNAME;
    const atApiKey = process.env.AT_API_KEY;
    const atVoiceNumber = process.env.AT_VOICE_NUMBER;
    const isAtVoiceConfigured = Boolean(atUsername && atApiKey && atVoiceNumber);

    if (!isAtVoiceConfigured) {
      console.warn(
        "Africa's Talking Voice is not fully configured (missing AT_USERNAME, AT_API_KEY, or AT_VOICE_NUMBER).",
      );
    }

    const callPromises = contacts
      .filter((contact) => contact.phone_number && contact.phone_number.trim().length > 0)
      .map(async (contact) => {
        const formattedTo = formatToE164(contact.phone_number);

        if (!isAtVoiceConfigured) {
          return {
            contact: contact.name,
            phone: formattedTo,
            status: "skipped_no_at_config",
            error: "Africa's Talking Voice credentials not configured in .env.local",
          };
        }

        const clientRequestId = `sos-${userId}-${contact.phone_number.replace(/\D/g, "")}`;
        const callResult = await initiateVoiceCall({
          to: formattedTo,
          clientRequestId,
        });

        const entry = callResult.entries?.[0];
        const statusStr = (entry?.status || "").toLowerCase();
        const isQueued =
          callResult.success &&
          (entry
            ? statusStr === "queued" ||
              statusStr === "success" ||
              statusStr === "inprogress"
            : true);

        return {
          contact: contact.name,
          phone: formattedTo,
          status: isQueued ? "queued" : "failed",
          sessionId: entry?.sessionId,
          entryStatus: entry?.status,
          error: !isQueued ? (callResult.error || entry?.status || "Call failed") : undefined,
          raw: callResult.raw,
        };
      });

    const [emailResults, callResults] = await Promise.all([
      Promise.allSettled(emailPromises),
      Promise.allSettled(callPromises),
    ]);

    const emailsSent = emailResults.filter((r) => r.status === "fulfilled").length;
    const emailsFailed = emailResults.filter((r) => r.status === "rejected").length;
    const firstEmailError = emailResults.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    const emailErrorMessage = firstEmailError
      ? firstEmailError.reason?.message || String(firstEmailError.reason)
      : undefined;

    const callsTriggered = callResults.filter(
      (r) => r.status === "fulfilled" && !(r.value as { error?: string }).error,
    ).length;

    const responsePayload = {
      success: true,
      senderName,
      location: {
        latitude: lat,
        longitude: lon,
        address,
        googleMapsLink,
      },
      notifiedContactsCount: contacts.length,
      emails: {
        sent: emailsSent,
        failed: emailsFailed,
      },
      emailError: emailErrorMessage,
      calls: {
        triggered: callsTriggered,
        total: contacts.filter((c) => c.phone_number).length,
      },
      results: {
        emails: emailResults,
        calls: callResults,
      },
    };

    lastSosResponses.set(userId, responsePayload);
    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error("SOS route error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
