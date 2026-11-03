import dotenv from "dotenv";
import nodemailer from "nodemailer";
import net from "net";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function checkTcpConnectivity(host: string, port: number, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let hasResolved = false;

    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    }, timeoutMs);

    socket.connect(port, host, () => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      }
    });

    socket.on("error", () => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      }
    });
  });
}

async function diagnose() {
  console.log("====================================================");
  console.log("       NODEMAILER SMTP INTEGRATION & CONNECTIVITY   ");
  console.log("====================================================\n");

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const isPort587 = port === 587;
  const secure = isPort587 ? false : (port === 465 || process.env.SMTP_SECURE === "true");
  const requireTLS = isPort587 ? true : (process.env.SMTP_REQUIRE_TLS === "true");
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
  const configuredSender = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const sender = configuredSender && configuredSender.trim() !== "" ? configuredSender.trim() : user || "noreply@lankaairportride.com";

  // Mask user: e.g. "rat***@gmail.com" - never log credentials or passwords
  const maskedUser = user
    ? user.includes("@")
      ? `${user.split("@")[0].slice(0, 3)}***@${user.split("@")[1]}`
      : `${user.slice(0, 3)}***`
    : "(NOT CONFIGURED)";

  console.log("1. Environment & Configuration Check (.env.local):");
  console.log(`   - SMTP_HOST:          ${host}`);
  console.log(`   - SMTP_PORT:          ${port}`);
  console.log(`   - secure:             ${secure} (for port 587, strictly false)`);
  console.log(`   - requireTLS:         ${requireTLS} (for port 587, strictly true)`);
  console.log(`   - Sender Address:     ${sender} ${configuredSender ? "(from EMAIL_FROM / SMTP_FROM)" : "(derived from SMTP_USER)"}`);
  console.log(`   - SMTP_USER:          ${maskedUser}`);
  console.log(`   - SMTP_PASS:          ${pass ? `[CONFIGURED: ${pass.length} chars, masked for security]` : "(NOT CONFIGURED)"}`);
  console.log(`   - Mock Delivery:      DISABLED (production SMTP transport active)`);

  // 2. TCP Port Connectivity
  console.log(`\n2. Verifying TCP Connection to ${host}:${port}...`);
  const tcpOk = await checkTcpConnectivity(host, port, 8000);
  if (tcpOk) {
    console.log(`   ✅ Successfully established TCP socket connection to ${host}:${port}`);
  } else {
    console.error(`   ❌ Failed to connect to ${host}:${port}. Port might be blocked by firewall or network ISP.`);
    return;
  }

  // 3. Transporter Initialization & STARTTLS Handshake
  console.log("\n3. Testing Nodemailer Transporter & SMTP Handshake...");

  if (!user || !pass) {
    console.log("   ⚠️  SMTP_USER or SMTP_PASS is missing in .env.local.");
    console.log("   --> Connection to host:port is verified reachable.");
    console.log("   --> Provide SMTP_USER and SMTP_PASS in .env.local to complete authentication.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    const verified = await transporter.verify();
    console.log("   ✅ SMTP CONNECTIVITY & AUTHENTICATION VERIFIED SUCCESSFULLY!");
    console.log("   - Provider handshake response:", verified);
    console.log(`   - Sender ready: ${sender}`);
    console.log("   - Security verification: No passwords or OTP codes logged.");
  } catch (err: any) {
    console.error("   ❌ SMTP Authentication / Handshake Error:");
    console.error(`   - Code:         ${err.code || "UNKNOWN"}`);
    console.error(`   - Response:     ${err.response || "(No SMTP response)"}`);
    console.error(`   - ResponseCode: ${err.responseCode || "(None)"}`);
    console.error(`   - Message:      ${err.message}`);

    if (err.responseCode === 535 || err.code === "EAUTH") {
      console.log("\n   💡 Tip for Gmail SMTP (535 Authentication Error):");
      console.log("   Ensure 2-Step Verification is enabled and use a 16-character App Password.");
    }
  }
}

diagnose().catch((err) => {
  console.error("Diagnostic execution error:", err.message);
});
