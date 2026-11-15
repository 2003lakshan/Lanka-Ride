import http from "http";
import { Server, Socket } from "socket.io";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { decode } from "next-auth/jwt";

// Load environment variables (.env.local has precedence over .env)
import pathModule from "path";
dotenv.config({ path: pathModule.resolve(__dirname, "../.env.local") });
dotenv.config({ path: pathModule.resolve(__dirname, "../.env") });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const PORT = parseInt(process.env.PORT || process.env.REALTIME_PORT || "3001", 10);
const HOST = process.env.REALTIME_HOST || "0.0.0.0";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lanka-airport-ride";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "local_development_secret_do_not_use_in_prod";
const INTERNAL_REALTIME_SECRET =
  process.env.INTERNAL_REALTIME_SECRET ||
  NEXTAUTH_SECRET ||
  "local_internal_realtime_secret_do_not_use_in_prod";

const rawOrigins =
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000,http://192.168.8.100:3000";
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Validates CORS origin for both HTTP management calls and WebSocket handshakes.
 * Allows exact matches from ALLOWED_ORIGINS, wildcard "*",
 * and automatically permits local private IP subnets on port 3000 in development.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Server-to-server internal calls or tools
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const isPrivateIP =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    if ((isLocalhost || isPrivateIP) && (url.port === "3000" || url.port === "3001" || !url.port)) {
      return true;
    }

    // Automatically allow Cloudflare Quick Tunnel origins in dev/testing
    if (host.endsWith(".trycloudflare.com")) {
      return true;
    }
  } catch {}

  return false;
}

// Connect to MongoDB
let dbConnected = false;
async function initDb() {
  if (dbConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log("[Realtime Server] Connected to MongoDB authoritative store");
  } catch (err: any) {
    console.error("[Realtime Server] MongoDB connection error:", err.message);
  }
}

// User schema reference for session verification
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    role: { type: String, enum: ["TOURIST", "DRIVER", "ADMIN"] },
    isApproved: Boolean,
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Booking schema reference for room access authorization
const bookingSchema = new mongoose.Schema(
  {
    bookingReference: String,
    touristId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: String,
  },
  { timestamps: true }
);
const BookingModel = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// Enquiry schema reference for chat room authorization
const enquirySchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: String,
  },
  { timestamps: true }
);
const PackageEnquiryModel = mongoose.models.PackageEnquiry || mongoose.model("PackageEnquiry", enquirySchema);

/**
 * Native HTTP server handling REST management endpoints
 */
const httpServer = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-realtime-secret");
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Helper to read JSON body
  const readJsonBody = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
          reject(new Error("Payload too large"));
        }
      });
      req.on("end", () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  };

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connectedSockets: io.engine.clientsCount,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Allow Engine.IO to handle Socket.IO requests (polling & websocket)
  if (url.pathname.startsWith("/socket.io")) {
    return;
  }

  // Authentication check for internal endpoints
  const secret = req.headers["x-realtime-secret"];
  if (secret !== INTERNAL_REALTIME_SECRET) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Forbidden: Invalid realtime secret" }));
    return;
  }

  // Broadcast endpoint
  if (req.method === "POST" && url.pathname === "/api/broadcast") {
    try {
      const { target, event, data } = await readJsonBody();

      if (!event || !target) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing event or target" }));
        return;
      }

      if (target.toUser) {
        io.to(`user:${target.toUser}`).emit(event, data);
      } else if (target.toRole) {
        io.to(`role:${target.toRole}`).emit(event, data);
      } else if (target.room) {
        io.to(target.room).emit(event, data);
      } else if (Array.isArray(target.rooms)) {
        target.rooms.forEach((r: string) => io.to(r).emit(event, data));
      } else {
        io.emit(event, data);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, event }));
      return;
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // Revoke session endpoint
  if (req.method === "POST" && url.pathname === "/api/revoke-session") {
    try {
      const { userId } = await readJsonBody();
      if (!userId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing userId" }));
        return;
      }

      const sockets = await io.in(`user:${userId}`).fetchSockets();
      for (const s of sockets) {
        s.emit("session:revoked", { message: "Your session has been terminated." });
        s.disconnect(true);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, disconnectedCount: sockets.length }));
      return;
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // Driver approval update endpoint
  if (req.method === "POST" && url.pathname === "/api/driver-approval") {
    try {
      const { driverId, isApproved } = await readJsonBody();
      if (!driverId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing driverId" }));
        return;
      }

      const sockets = await io.in(`user:${driverId}`).fetchSockets();
      for (const s of sockets) {
        s.data.user.isApproved = Boolean(isApproved);
        if (isApproved) {
          s.join("role:eligible_driver");
        } else {
          s.leave("role:eligible_driver");
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, updatedCount: sockets.length }));
      return;
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Socket.IO Server Configuration
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      console.warn(`[Realtime Server] Blocked origin: ${origin}`);
      return callback(new Error(`CORS origin ${origin} not allowed by Realtime server`));
    },
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 15000,
});

// Optional Redis Adapter for horizontal scaling
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const { Redis } = require("ioredis");
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Realtime Server] Connected Redis adapter for multi-instance scaling");
  } catch (err: any) {
    console.warn("[Realtime Server] Redis adapter initialization skipped:", err.message);
  }
} else {
  console.log("[Realtime Server] Using standalone in-memory rooms adapter");
}

/**
 * Extracts session token from handshake auth or cookies
 */
function extractToken(socket: Socket): string | null {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map((c) => {
        const parts = c.split("=");
        return [parts[0], decodeURIComponent(parts.slice(1).join("="))];
      })
    );

    const token =
      cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"];
    if (token) return token;
  }

  return null;
}

// -------------------------------------------------------------
// 1. SECURE AUTHENTICATION MIDDLEWARE
// -------------------------------------------------------------
io.use(async (socket, next) => {
  try {
    await initDb();

    const rawToken = extractToken(socket);
    if (!rawToken) {
      return next(new Error("UNAUTHORIZED: Missing session token"));
    }

    const decoded: any = await decode({
      token: rawToken,
      secret: NEXTAUTH_SECRET,
    });

    const userId = decoded?.id || decoded?.sub;
    if (!decoded || !userId) {
      return next(new Error("UNAUTHORIZED: Invalid or expired token signature"));
    }

    const dbUser: any = await UserModel.findById(userId)
      .select("name email role isApproved sessionVersion")
      .lean();

    if (!dbUser) {
      return next(new Error("UNAUTHORIZED: User account no longer exists"));
    }

    const tokenVersion = decoded.sessionVersion || 0;
    const currentVersion = dbUser.sessionVersion || 0;
    if (tokenVersion !== currentVersion) {
      return next(new Error("UNAUTHORIZED: Session has been revoked or invalidated"));
    }

    // Attach verified user data from DB
    socket.data.user = {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      isApproved: Boolean(dbUser.isApproved),
      sessionVersion: currentVersion,
    };

    next();
  } catch (err: any) {
    console.error("[Realtime Auth Error]", err.message);
    next(new Error(`UNAUTHORIZED: ${err.message}`));
  }
});

// -------------------------------------------------------------
// 2. SOCKET CONNECTION & ROOM SUBSCRIPTIONS
// -------------------------------------------------------------
io.on("connection", (socket) => {
  const user = socket.data.user;
  console.log(`[Socket Connected] User ${user.name} (${user.id}) [Role: ${user.role}] (Socket: ${socket.id})`);

  // Join private user room
  socket.join(`user:${user.id}`);

  // Join role channels based on SERVER-VERIFIED approval & role
  if (user.role === "ADMIN") {
    socket.join("role:admin");
  } else if (user.role === "DRIVER" && user.isApproved) {
    // Only approved drivers join the eligible drivers channel!
    socket.join("role:eligible_driver");
  }

  // Acknowledge connection
  socket.emit("connected", {
    userId: user.id,
    role: user.role,
    isApproved: user.isApproved,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  });

  // Client requests access to a specific booking room
  socket.on("booking:subscribe", async (payload: any, callback: any) => {
    try {
      const bookingId = typeof payload === "string" ? payload : payload?.bookingId;
      if (!bookingId) {
        if (typeof callback === "function") callback({ success: false, error: "Booking ID required" });
        return;
      }

      await initDb();
      const booking: any = await BookingModel.findById(bookingId).lean();
      if (!booking) {
        if (typeof callback === "function") callback({ success: false, error: "Booking not found" });
        return;
      }

      // Authorization check: only rider, assigned driver, or authorized admins can join
      const isRider = booking.touristId && booking.touristId.toString() === user.id;
      const isAssignedDriver = booking.driverId && booking.driverId.toString() === user.id;
      const isAdmin = user.role === "ADMIN";

      if (!isRider && !isAssignedDriver && !isAdmin) {
        console.warn(`[Access Denied] User ${user.id} denied access to booking room ${bookingId}`);
        if (typeof callback === "function") {
          callback({ success: false, error: "FORBIDDEN: You do not have permission to access this booking" });
        }
        socket.emit("error:unauthorized", { message: "Access to booking room denied" });
        return;
      }

      socket.join(`booking:${bookingId}`);
      if (typeof callback === "function") callback({ success: true, bookingId });
    } catch (err: any) {
      if (typeof callback === "function") callback({ success: false, error: err.message });
    }
  });

  // Client leaves booking room
  socket.on("booking:unsubscribe", (payload: any, callback: any) => {
    const bookingId = typeof payload === "string" ? payload : payload?.bookingId;
    if (bookingId) {
      socket.leave(`booking:${bookingId}`);
    }
    if (typeof callback === "function") callback({ success: true });
  });

  // Client requests access to an enquiry/chat room
  socket.on("enquiry:subscribe", async (payload: any, callback: any) => {
    try {
      const enquiryId = typeof payload === "string" ? payload : payload?.enquiryId;
      if (!enquiryId) {
        if (typeof callback === "function") callback({ success: false, error: "Enquiry ID required" });
        return;
      }

      await initDb();
      const enquiry: any = await PackageEnquiryModel.findById(enquiryId).lean();
      if (!enquiry) {
        if (typeof callback === "function") callback({ success: false, error: "Enquiry not found" });
        return;
      }

      const isRider = enquiry.riderId && enquiry.riderId.toString() === user.id;
      const isDriver = enquiry.driverId && enquiry.driverId.toString() === user.id;
      const isAdmin = user.role === "ADMIN";

      if (!isRider && !isDriver && !isAdmin) {
        if (typeof callback === "function") callback({ success: false, error: "FORBIDDEN" });
        return;
      }

      socket.join(`enquiry:${enquiryId}`);
      if (typeof callback === "function") callback({ success: true, enquiryId });
    } catch (err: any) {
      if (typeof callback === "function") callback({ success: false, error: err.message });
    }
  });

  socket.on("enquiry:unsubscribe", (payload: any, callback: any) => {
    const enquiryId = typeof payload === "string" ? payload : payload?.enquiryId;
    if (enquiryId) {
      socket.leave(`enquiry:${enquiryId}`);
    }
    if (typeof callback === "function") callback({ success: true });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket Disconnected] User ${user.name} (${user.id}) reason: ${reason}`);
  });
});

// Start the Realtime Server
httpServer.listen(PORT, HOST, () => {
  console.log(`[Realtime Server] Socket.IO server running on http://${HOST}:${PORT}`);
  console.log(`[Realtime Server] Network accessible at http://192.168.8.100:${PORT} and http://localhost:${PORT}`);
  console.log(`[Realtime Server] Allowed origins: ${allowedOrigins.join(", ")}`);
});
