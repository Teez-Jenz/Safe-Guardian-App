export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export async function sendBrevoEmail(options: SendEmailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "alerts@safeguardian.app";
  const senderName = process.env.BREVO_SENDER_NAME || "SafeAlert Guardian";

  if (!apiKey) {
    console.warn("Brevo is not configured (missing BREVO_API_KEY).");
    return { success: false, error: "Missing BREVO_API_KEY" };
  }

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: options.to.map((recipient) => ({
      email: recipient.email.trim(),
      name: recipient.name || recipient.email.trim(),
    })),
    subject: options.subject,
    htmlContent: options.htmlContent,
    ...(options.textContent ? { textContent: options.textContent } : {}),
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || `Brevo HTTP error ${response.status}`;
    console.error("Brevo Email Error:", data);
    return { success: false, error: errorMsg };
  }

  return { success: true, messageId: data.messageId };
}
