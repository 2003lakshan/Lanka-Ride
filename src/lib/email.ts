import nodemailer from "nodemailer";

/**
 * Checks whether SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * are configured in the environment (.env.local).
 * Mock email delivery is completely disabled.
 */
export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (
    !host ||
    !port ||
    !user ||
    !pass ||
    user === "postmaster@your-domain.com" ||
    pass === "your_smtp_password_here" ||
    pass === "your_smtp_password_or_api_key"
  ) {
    return false;
  }

  return Boolean(host.trim() && port.toString().trim() && user.trim() && pass.trim());
}

/**
 * Resolves the sender address:
 * By default, uses SMTP_USER as the sender address.
 * If the project environment defines EMAIL_FROM or SMTP_FROM, that is used as an override.
 */
export function getSenderAddress(): string {
  const configuredSender = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (configuredSender && configuredSender.trim() !== "") {
    return configuredSender.trim();
  }

  const user = process.env.SMTP_USER;
  if (user && user.trim() !== "") {
    const trimmedUser = user.trim();
    if (trimmedUser.includes("<") && trimmedUser.includes(">")) {
      return trimmedUser;
    }
    return `"At Your Service" <${trimmedUser}>`;
  }

  return '"At Your Service" <noreply@lankaairportride.com>';
}

/**
 * Returns summary of email configuration for documentation and diagnostics.
 * Masks credentials to prevent credential leakage.
 */
export function getEmailConfigStatus() {
  const configured = isEmailConfigured();
  const user = process.env.SMTP_USER?.trim() || null;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;

  // Strict port 587 configuration: secure: false, requireTLS: true
  const isPort587 = port === 587;
  const secure = isPort587 ? false : (port === 465 || process.env.SMTP_SECURE === "true");
  const requireTLS = isPort587 ? true : (process.env.SMTP_REQUIRE_TLS === "true");

  return {
    configured,
    host,
    port,
    secure,
    requireTLS,
    userMasked: user
      ? user.includes("@")
        ? `${user.split("@")[0].slice(0, 3)}***@${user.split("@")[1]}`
        : `${user.slice(0, 3)}***`
      : null,
    passConfigured: Boolean(pass && pass !== "your_smtp_password_here"),
    from: getSenderAddress(),
    mockDeliveryDisabled: true,
  };
}

/**
 * Creates and returns the Nodemailer transporter configured with SMTP credentials.
 * For port 587: strictly uses secure: false and requireTLS: true.
 * Mock email delivery is completely disabled.
 */
export function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const user = process.env.SMTP_USER?.trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)?.trim();
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;

  // For port 587, use secure: false and requireTLS: true
  const isPort587 = port === 587;
  const secure = isPort587 ? false : (port === 465 || process.env.SMTP_SECURE === "true");
  const requireTLS = isPort587 ? true : (process.env.SMTP_REQUIRE_TLS === "true");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: user && pass
      ? {
          user,
          pass,
        }
      : undefined,
    // Defensive connection timeouts so requests don't hang
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.SMTP_IGNORE_TLS_ERROR !== "true",
    },
  });
}

/**
 * Verifies SMTP connection and authentication with the provider.
 * Returns sanitized diagnostic details without exposing credentials or OTPs.
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  error?: string;
  details?: {
    code?: string;
    command?: string;
    response?: string;
    responseCode?: number;
    message?: string;
  };
}> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: "SMTP credentials are incomplete. Ensure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are set in .env.local.",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "SMTP transporter could not be initialized.",
    };
  }

  try {
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    const sanitized = {
      code: err.code || "UNKNOWN",
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      message: err.message,
    };
    return {
      success: false,
      error: err.message,
      details: sanitized,
    };
  }
}

/**
 * Sends a cryptographically generated 6-digit OTP code to the user's email.
 * Note: Never log the OTP code or credentials to console or unhandled errors.
 */
export async function sendPasswordResetOtpEmail(
  toEmail: string,
  otpCode: string
): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
  accepted?: any[];
  rejected?: any[];
}> {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      success: false,
      error: "Email delivery service is not configured on this server.",
    };
  }

  const cleanTo = (toEmail || "").toLowerCase().trim();
  if (!cleanTo || !cleanTo.includes("@")) {
    return {
      success: false,
      error: "Invalid recipient email address.",
    };
  }

  const from = getSenderAddress();

  const mailOptions = {
    from,
    to: cleanTo,
    subject: "Your Lanka Airport Ride Password Reset Code",
    text: `Your password reset verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #2563eb; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Lanka Airport Ride</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 28px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 600;">Password Reset Request</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                      We received a request to reset the password for your Lanka Airport Ride account. Use the 6-digit verification code below to proceed:
                    </p>
                    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; border: 1px dashed #cbd5e1;">
                      <span style="font-family: monospace; font-size: 32px; font-weight: 700; color: #1e293b; letter-spacing: 8px;">${otpCode}</span>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
                      ⏱️ <strong>This code is valid for 10 minutes</strong> and can only be used once. You have up to 5 verification attempts.
                    </p>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
                      If you did not request this code, no action is required and your account remains secure.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} Lanka Airport Ride. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivery] Message dispatched via SMTP to ${toEmail}`);
    console.log(`- Message ID: ${info.messageId}`);
    console.log(`- Accepted: [${info.accepted.join(", ")}]`);
    console.log(`- Rejected: [${info.rejected.join(", ")}]`);
    console.log(`- Response: ${info.response}`);

    if (info.rejected && info.rejected.length > 0) {
      console.warn(`[Email Delivery Warning] Recipients rejected by SMTP server: ${info.rejected.join(", ")}`);
      return {
        success: false,
        messageId: info.messageId,
        rejected: info.rejected,
        error: `Provider rejected recipient: ${info.rejected.join(", ")}`,
      };
    }

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error: any) {
    console.error("[Email Delivery Error] Failed to dispatch reset email via SMTP:", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
      message: error.message,
    });
    return {
      success: false,
      error: `SMTP error (${error.code || error.responseCode || "FAILED"}): ${error.message}`,
    };
  }
}

/**
 * Sends confirmation email when password has been successfully updated.
 */
export async function sendPasswordChangedConfirmationEmail(
  toEmail: string,
  userName?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const transporter = getTransporter();

  if (!transporter) {
    return {
      success: false,
      error: "Email delivery service is not configured on this server.",
    };
  }

  const cleanTo = (toEmail || "").toLowerCase().trim();
  if (!cleanTo || !cleanTo.includes("@")) {
    return {
      success: false,
      error: "Invalid recipient email address.",
    };
  }

  const from = getSenderAddress();

  const mailOptions = {
    from,
    to: cleanTo,
    subject: "Security Alert: Lanka Airport Ride Password Changed",
    text: `Hello ${userName || "Valued User"},\n\nYour password for Lanka Airport Ride was successfully changed at ${new Date().toUTCString()}.\n\nAll existing login sessions have been invalidated.\n\nIf you did not make this change, please contact support immediately.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #059669; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Password Changed Successfully</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 28px;">
                    <p style="color: #0f172a; font-size: 15px; font-weight: 600; margin-top: 0;">
                      Hello ${userName || "there"},
                    </p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                      Your Lanka Airport Ride account password was updated on <strong>${new Date().toUTCString()}</strong>.
                    </p>
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; margin-bottom: 24px;">
                      <p style="color: #065f46; font-size: 13px; line-height: 1.5; margin: 0;">
                        🔒 All previous login sessions across all devices and browsers have been automatically signed out.
                      </p>
                    </div>
                    <p style="color: #dc2626; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
                      If you did not request or make this change, please contact Lanka Airport Ride support immediately to secure your account.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} Lanka Airport Ride. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivery] Password change confirmation sent to ${toEmail}, Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Email Delivery Error] Failed to dispatch password change confirmation:", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message,
    });
    return {
      success: false,
      error: `SMTP error (${error.code || error.responseCode || "FAILED"}): ${error.message}`,
    };
  }
}

/**
 * Sends a 6-digit email verification OTP code for custom trip booking contact verification.
 */
export async function sendContactVerificationOtpEmail(
  toEmail: string,
  otpCode: string
): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
  isDevMock?: boolean;
  devCode?: string;
}> {
  const isConfigured = isEmailConfigured();
  const isDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_OTP_MOCK === "true";

  if (!isConfigured) {
    if (isDev) {
      console.log(`[EMAIL_DEV_MOCK] 📧 To: ${toEmail} | Verification Code: ${otpCode}`);
      return {
        success: true,
        isDevMock: true,
        devCode: otpCode,
      };
    }
    return {
      success: false,
      error: "Email delivery service is not configured on this server. Please configure SMTP in environment variables.",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "SMTP transporter could not be initialized.",
    };
  }

  const cleanTo = (toEmail || "").toLowerCase().trim();
  if (!cleanTo || !cleanTo.includes("@")) {
    return {
      success: false,
      error: "Invalid recipient email address.",
    };
  }

  const from = getSenderAddress();
  const mailOptions = {
    from,
    to: cleanTo,
    subject: "Your Lanka Airport Ride Trip Verification Code",
    text: `Your verification code for custom trip planning is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not initiate this custom trip request, please ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trip Contact Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #2563eb; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Lanka Airport Ride</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 28px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 600;">Trip Contact Verification</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                      Please verify your email address to confirm your custom trip request. Use the 6-digit verification code below:
                    </p>
                    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b; font-family: monospace;">
                        ${otpCode}
                      </span>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 8px;">
                      ⏳ This code is single-use and will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                      If you did not request this trip, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} Lanka Airport Ride. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivery] Contact verification OTP sent to ${toEmail}, Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Email Delivery Error] Failed to send contact verification OTP:", {
      code: error.code,
      message: error.message,
    });
    return {
      success: false,
      error: `Email delivery failed: ${error.message}`,
    };
  }
}
