export interface AfricasTalkingCallEntry {
  phoneNumber: string;
  status: string;
  sessionId?: string;
}

export interface AfricasTalkingCallResponse {
  entries?: AfricasTalkingCallEntry[];
  errorMessage?: string;
  status?: string;
}

export interface InitiateVoiceCallOptions {
  to: string | string[];
  clientRequestId?: string;
}

export interface AfricasTalkingCallResult {
  success: boolean;
  entries?: AfricasTalkingCallEntry[];
  error?: string;
  raw?: unknown;
}

/**
 * Initiates an outbound Voice call via Africa's Talking REST API.
 * Calls Africa's Talking Voice endpoint: https://voice.africastalking.com/call
 *
 * Requirements:
 * - AT_USERNAME: Africa's Talking app username
 * - AT_API_KEY: Africa's Talking API key (kept server-side)
 * - AT_VOICE_NUMBER: Africa's Talking registered voice phone number (E.164 format, e.g. +234XXXXXXXXXX)
 */
export async function initiateVoiceCall(
  options: InitiateVoiceCallOptions,
): Promise<AfricasTalkingCallResult> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  const from = process.env.AT_VOICE_NUMBER;

  if (!username || !apiKey || !from) {
    console.warn(
      "Africa's Talking Voice is not fully configured (missing AT_USERNAME, AT_API_KEY, or AT_VOICE_NUMBER).",
    );
    return {
      success: false,
      error: "Africa's Talking Voice credentials not configured (missing AT_USERNAME, AT_API_KEY, or AT_VOICE_NUMBER)",
    };
  }

  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const toParam = toList.filter(Boolean).join(",");

  if (!toParam) {
    return {
      success: false,
      error: "No valid recipient phone number provided",
    };
  }

  const params = new URLSearchParams();
  params.append("username", username.trim());
  params.append("from", from.trim());
  params.append("to", toParam);
  if (options.clientRequestId) {
    params.append("clientRequestId", options.clientRequestId);
  }

  try {
    const response = await fetch("https://voice.africastalking.com/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: apiKey.trim(),
        Accept: "application/json",
      },
      body: params.toString(),
    });

    const data: AfricasTalkingCallResponse = await response.json().catch(() => ({}));

    // Africa's Talking returns errorMessage: "None" when the call request is successfully queued!
    const hasRealError =
      !response.ok ||
      (Boolean(data.errorMessage) &&
        data.errorMessage?.toLowerCase() !== "none" &&
        data.errorMessage?.trim() !== "");

    if (hasRealError) {
      const errorMsg =
        data.errorMessage ||
        `Africa's Talking Voice HTTP ${response.status}: ${response.statusText || "Request failed"}`;
      console.error("Africa's Talking Voice API Error:", errorMsg, data);
      return {
        success: false,
        error: errorMsg,
        raw: data,
      };
    }

    const entries = data.entries || [];
    const hasSuccessfulEntry = entries.some((entry) => {
      const status = (entry.status || "").toLowerCase();
      return (
        status === "queued" ||
        status === "success" ||
        status === "inprogress"
      );
    });

    const failedEntry = entries.find((entry) => {
      const status = (entry.status || "").toLowerCase();
      return status !== "queued" && status !== "success" && status !== "inprogress";
    });

    return {
      success: hasSuccessfulEntry || entries.length === 0,
      entries,
      error: failedEntry ? `Entry status: ${failedEntry.status}` : undefined,
      raw: data,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Africa's Talking network error:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
