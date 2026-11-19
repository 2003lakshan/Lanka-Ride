/**
 * SMS OTP Delivery Service
 * Supports:
 * 1. Twilio SMS (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER / TWILIO_MESSAGING_SERVICE_SID)
 * 2. Notify.lk SMS Gateway (NOTIFYLK_USER_ID, NOTIFYLK_API_KEY, NOTIFYLK_SENDER_ID)
 * 3. Generic HTTP SMS Gateway (SMS_GATEWAY_URL, SMS_API_KEY, SMS_SENDER_ID)
 * 4. Explicit Development Mode Mock (when no provider credentials are configured and NODE_ENV !== "production")
 */

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  isDevMock?: boolean;
  devCode?: string;
  isConfigured?: boolean;
}

export function isSmsConfigured(): boolean {
  // 1. Check Twilio
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (twilioSid && twilioToken && twilioFrom && !twilioSid.includes("your_")) {
    return true;
  }

  // 2. Check Notify.lk
  const notifUserId = process.env.NOTIFYLK_USER_ID?.trim();
  const notifApiKey = process.env.NOTIFYLK_API_KEY?.trim();
  if (notifUserId && notifApiKey && !notifApiKey.includes("your_")) {
    return true;
  }

  // 3. Check Generic Gateway
  const gatewayUrl = process.env.SMS_GATEWAY_URL?.trim();
  const gatewayKey = process.env.SMS_API_KEY?.trim();
  if (gatewayUrl && gatewayKey && !gatewayUrl.includes("your_")) {
    return true;
  }

  return false;
}

export function getSmsConfigStatus() {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const notifApiKey = process.env.NOTIFYLK_API_KEY?.trim();
  const gatewayUrl = process.env.SMS_GATEWAY_URL?.trim();

  let provider = "NONE";
  if (twilioSid && !twilioSid.includes("your_")) provider = "TWILIO";
  else if (notifApiKey && !notifApiKey.includes("your_")) provider = "NOTIFYLK";
  else if (gatewayUrl && !gatewayUrl.includes("your_")) provider = "GENERIC_GATEWAY";

  const isDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_OTP_MOCK === "true";

  return {
    configured: isSmsConfigured(),
    provider,
    isDevMockAllowed: isDev,
  };
}

/**
 * Sends a 6-digit phone verification OTP code via SMS.
 */
export async function sendPhoneVerificationOtpSms(
  toPhone: string,
  otpCode: string
): Promise<SmsSendResult> {
  const cleanPhone = toPhone.trim().replace(/[^\d+]/g, "");
  const messageBody = `Your Lanka Airport Ride verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code with anyone.`;

  // 1. Try Twilio if configured
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (twilioSid && twilioToken && twilioFrom && !twilioSid.includes("your_")) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", cleanPhone);
      if (twilioFrom.startsWith("MG")) {
        params.append("MessagingServiceSid", twilioFrom);
      } else {
        params.append("From", twilioFrom);
      }
      params.append("Body", messageBody);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          success: true,
          messageId: data.sid,
          provider: "TWILIO",
          isConfigured: true,
        };
      } else {
        console.error("[SMS:Twilio] Delivery error:", data.message || res.statusText);
        return {
          success: false,
          error: data.message || "Twilio SMS delivery failed.",
          provider: "TWILIO",
          isConfigured: true,
        };
      }
    } catch (err: any) {
      console.error("[SMS:Twilio] Network exception:", err.message);
      return {
        success: false,
        error: "Failed to connect to Twilio SMS service.",
        provider: "TWILIO",
        isConfigured: true,
      };
    }
  }

  // 2. Try Notify.lk if configured
  const notifUserId = process.env.NOTIFYLK_USER_ID?.trim();
  const notifApiKey = process.env.NOTIFYLK_API_KEY?.trim();
  const notifSenderId = process.env.NOTIFYLK_SENDER_ID?.trim() || "LankaRide";

  if (notifUserId && notifApiKey && !notifApiKey.includes("your_")) {
    try {
      const url = "https://app.notify.lk/api/v1/send";
      const params = new URLSearchParams();
      params.append("user_id", notifUserId);
      params.append("api_key", notifApiKey);
      params.append("sender_id", notifSenderId);
      // Notify.lk expects phone without leading + for local, or full with country code
      const formattedTo = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone;
      params.append("to", formattedTo);
      params.append("message", messageBody);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        return {
          success: true,
          messageId: data.data?.message_id,
          provider: "NOTIFYLK",
          isConfigured: true,
        };
      } else {
        return {
          success: false,
          error: data.message || "Notify.lk SMS delivery failed.",
          provider: "NOTIFYLK",
          isConfigured: true,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: "Failed to connect to Notify.lk SMS service.",
        provider: "NOTIFYLK",
        isConfigured: true,
      };
    }
  }

  // 3. Try Generic HTTP Gateway if configured
  const gatewayUrl = process.env.SMS_GATEWAY_URL?.trim();
  const gatewayKey = process.env.SMS_API_KEY?.trim();
  const gatewaySender = process.env.SMS_SENDER_ID?.trim() || "LankaRide";

  if (gatewayUrl && gatewayKey && !gatewayUrl.includes("your_")) {
    try {
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayKey}`,
        },
        body: JSON.stringify({
          to: cleanPhone,
          from: gatewaySender,
          message: messageBody,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          messageId: data.id || data.messageId,
          provider: "GENERIC_GATEWAY",
          isConfigured: true,
        };
      } else {
        return {
          success: false,
          error: `SMS Gateway failed with status ${res.status}.`,
          provider: "GENERIC_GATEWAY",
          isConfigured: true,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: "Failed to connect to custom SMS gateway.",
        provider: "GENERIC_GATEWAY",
        isConfigured: true,
      };
    }
  }

  // 4. Fallback: Development Mode Mock vs Production Missing Provider
  const isDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_OTP_MOCK === "true";

  if (isDev) {
    console.log(`[SMS_DEV_MOCK] 📱 To: ${cleanPhone} | Verification Code: ${otpCode}`);
    return {
      success: true,
      provider: "DEV_MOCK",
      isDevMock: true,
      devCode: otpCode,
      isConfigured: false,
    };
  }

  return {
    success: false,
    error: "SMS delivery service is not configured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables.",
    provider: "NONE",
    isConfigured: false,
  };
}

