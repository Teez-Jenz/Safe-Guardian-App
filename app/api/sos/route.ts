import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // 1. Fetch the SOS sender's name
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error fetching user:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 },
      );
    }

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
        { error: "No trusted contacts found" },
        { status: 404 },
      );
    }

    const googleMapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    const senderName = user?.name || "Your contact";

    // 3. Send email to each contact via Resend
    const emailPromises = contacts.map((contact) => {
      const relationshipLabel = contact.relationship
        ? `their ${contact.relationship}`
        : "someone they trust";

      return resend.emails.send({
        from: "SafeAlert Guardian <alerts@yourdomain.com>",
        to: contact.email,
        subject: `🚨 SOS Alert from your ${contact.relationship || "trusted contact"}`,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 32px;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background-color: #dc2626; padding: 32px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🚨 SOS ALERT</h1>
                  <p style="color: #fecaca; margin: 8px 0 0;">SafeAlert Guardian Emergency Notification</p>
                </div>

                <!-- Body -->
                <div style="padding: 32px;">
                  <p style="font-size: 16px; color: #111827;">Hi <strong>${contact.name}</strong>,</p>

                  <p style="font-size: 15px; color: #374151;">
                    You are receiving this alert because you are listed as <strong>${relationshipLabel}</strong> for <strong>${senderName}</strong> on SafeAlert Guardian.
                  </p>

                  <p style="font-size: 15px; color: #374151;">
                    <strong>${senderName}</strong> has triggered an SOS alert and may need immediate assistance. Please reach out to them or contact emergency services right away.
                  </p>

                  <!-- Location Box -->
                  <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0 0 8px; font-weight: bold; color: #dc2626; font-size: 15px;">📍 Last Known Location</p>
                    <p style="margin: 0 0 6px; color: #374151; font-size: 14px;">
                      ${location.address || "Address unavailable"}
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">
                      Coordinates: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
                    </p>
                  </div>

                  <!-- Map Button -->
                  <div style="text-align: center; margin: 24px 0;">
                    <a
                      href="${googleMapsLink}"
                      target="_blank"
                      style="background-color: #dc2626; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;"
                    >
                      View Location on Google Maps
                    </a>
                  </div>

                  <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 32px;">
                    This alert was sent automatically by SafeAlert Guardian. Do not reply to this email.
                  </p>
                </div>

                <!-- Footer -->
                <div style="background-color: #f3f4f6; padding: 16px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    © ${new Date().getFullYear()} SafeAlert Guardian. Your Personal Safety Companion.
                  </p>
                </div>

              </div>
            </body>
          </html>
        `,
      });
    });

    const results = await Promise.allSettled(emailPromises);

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("Some emails failed to send:", failed);
    }

    return NextResponse.json({
      success: true,
      notified: results.filter((r) => r.status === "fulfilled").length,
      failed: failed.length,
    });
  } catch (err) {
    console.error("SOS route error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
