# Lanka Airport Ride - Realtime Architecture & Setup Guide

A Next.js (v16 App Router) application paired with an authoritative MongoDB database and a high-performance, standalone Socket.IO server for real-time airport ride dispatch, live GPS driver tracking, instant notifications, and chat.

---

## 🚀 Architecture Overview

Next.js App Router and serverless deployment targets (such as Vercel) do not maintain persistent stateful WebSocket connections. To achieve low latency and robust event delivery while preserving serverless API agility, this project uses a decoupled, authoritative architecture:

```
┌─────────────────────────────────┐               ┌────────────────────────────────┐
│   Next.js Web Client (React 19) │ ◄──WebSocket─► │ Standalone Socket.IO Server    │
│   - SocketProvider              │   (Port 3001) │ (server/socket-server.ts)      │
│   - RealtimeIndicator ('Live')  │               │ - NextAuth JWT Verification    │
│   - Smart Polling Fallback      │               │ - Role & Ownership Channels    │
└────────────────┬────────────────┘               └───────────────▲────────────────┘
                 │ HTTP (Mutations)                               │ HTTP Broadcast
                 ▼                                                │ (/api/broadcast)
┌─────────────────────────────────┐                               │ (x-realtime-secret)
│ Next.js API Routes (Port 3000)  ├───────────────────────────────┘
│ - MongoDB Mutexes & Mutations   │
│ - Authoritative DB Write First  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     MongoDB Database            │
│  - Users, Bookings, Enquiries   │
└─────────────────────────────────┘
```

### Core Security & Authorization Rules
1. **Zero Client Trust**: User identity, roles (`ADMIN`, `DRIVER`, `TOURIST`), and driver approval status (`isApproved`) are verified on connection handshake via decrypted NextAuth session JWT tokens and checked against MongoDB `sessionVersion`.
2. **Private Channels**:
   - `user:<userId>`: Private channel for user-specific events (e.g. notifications, private trip alerts).
   - `role:admin`: Authorised admin dashboard room.
   - `role:eligible_driver`: Only verified, approved drivers join this channel to receive available dispatch calls.
   - `booking:<bookingId>`: Room access strictly limited to the booking's rider, assigned driver, and authorized admins.
   - `enquiry:<enquiryId>`: Chat room strictly limited to the enquiry's rider, driver, and admins.
3. **Trip Workflow Protection**:
   - Custom requests and paid trips are **hidden from drivers** until final admin approval publishes them (`booking:available`).
   - Driver acceptance is atomic; upon successful assignment in MongoDB, the trip is broadcast to rider/admin (`booking:driver_accepted`) and immediately removed from all other drivers' boards (`booking:removed`).
4. **GPS Tracking Efficiency**:
   - Reuses the existing 5-second driver location cadence without duplicating timers or watchers.
   - Live coordinates (`driver:location_updated`) are streamed to the booking room and admin live tracking dashboards.
5. **Smart Polling Fallback & Reconnect Recovery**:
   - Duplicate polling is disabled while the WebSocket is connected.
   - When offline/reconnecting, polling seamlessly activates as a fallback.
   - Upon reconnect, client components automatically trigger recovery handlers to refetch missed bookings, notifications, and chat state.

---

## 🛠️ Environment Variables

Add or verify these environment variables in `.env.local` (and your production secrets manager):

| Variable | Description | Example (Local) |
|---|---|---|
| `NEXT_PUBLIC_REALTIME_URL` | Public Socket.IO URL accessed by browser clients | `http://localhost:3001` |
| `REALTIME_PORT` | Port for the standalone Socket.IO Node server | `3001` |
| `REALTIME_INTERNAL_URL` | Optional internal URL for server-to-server HTTP broadcast | `http://localhost:3001` |
| `INTERNAL_REALTIME_SECRET` | Shared secret securing the internal `/api/broadcast` endpoint | Strong secret / same as `NEXTAUTH_SECRET` |
| `ALLOWED_ORIGINS` | Comma-separated list of CORS origins permitted to connect | `http://localhost:3000,http://127.0.0.1:3000` |
| `REDIS_URL` | *(Optional)* Redis connection string for multi-instance scaling | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | Encryption secret for NextAuth JWT session tokens | Strong random secret |
| `MONGODB_URI` | MongoDB authoritative connection string | `mongodb://localhost:27017/lanka-airport-ride` |
| `SMTP_HOST` | SMTP server host for sending password recovery emails | `smtp.mailgun.org` / `smtp.resend.com` |
| `SMTP_PORT` | SMTP server port (usually `587` for TLS, `465` for SSL) | `587` |
| `SMTP_USER` | SMTP username or API account key | `postmaster@your-domain.com` |
| `SMTP_PASS` | SMTP account password or secret key | `your_smtp_password` |
| `SMTP_SECURE` | Set `true` if connecting over port `465` | `false` |
| `EMAIL_FROM` | Sender display name and email address | `"Lanka Airport Ride <noreply@lankaairportride.com>"` |
| `ENABLE_MOCK_EMAIL` | *(Development/Testing)* Enables in-memory mock email transport | `true` |

---

## 🔐 Email OTP Password Recovery (Riders & Drivers)

Password recovery is available for both Riders and Drivers through a secure 3-step OTP recovery wizard:

1. **Anti-Enumeration & Request Cooldown**:
   - Both known and unknown email requests return the uniform response:
     *"If an account exists for this email, a verification code will be sent."*
   - Requests are rate-limited by IP and account, enforced with a strict 60-second resend cooldown.
2. **Cryptographic OTP Generation & Storage**:
   - Generates a cryptographically random 6-digit decimal code (`crypto.randomInt(100000, 1000000)`).
   - Stored in MongoDB solely as a tamper-proof HMAC-SHA256 hash linked to the user ID and `PASSWORD_RESET` purpose.
   - Expires automatically after 10 minutes.
   - Codes are strictly never logged to stdout, returned in API payloads, or exposed client-side.
3. **Attempt Limiting & Code Invalidation**:
   - Allows a maximum of 5 verification attempts per issued code.
   - At 5 failed attempts, the code is immediately invalidated and wiped from the database.
   - Issuing a new code instantly invalidates all previous codes and authorization tokens.
4. **Single-Use Reset Authorization**:
   - Upon successful OTP verification, the code is consumed immediately and a short-lived (15-min) single-use authorization token (`resetAuthToken`) is issued to that specific user.
   - Token reuse is strictly blocked on the server.
5. **Password Policy & Session Invalidation**:
   - Requires at least 8 characters and confirmation match.
   - Hashed using bcrypt with salt factor 10.
   - Increments the user's `sessionVersion` in MongoDB, instantly invalidating all active JWT sessions and disconnecting realtime WebSocket connections across all devices.
   - Sends a security confirmation email alerting the user of the password update.

```bash
# Run the OTP Recovery test suite:
npx tsx scripts/verify-otp-recovery-e2e.ts
```


### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Realtime Socket.IO Server
In your first terminal:
```bash
npm run realtime
```
The realtime server will start on `http://localhost:3001`. You can test health at:
```bash
curl http://localhost:3001/health
```

### 3. Start the Next.js App
In your second terminal:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Authenticated pages will display the subtle green **"Live"** indicator in the navigation bar.

---

## 🧪 Verification & E2E Testing

Run the automated end-to-end verification suite:
```bash
npx tsx scripts/verify-realtime-e2e.ts
```

This validates:
1. Rejection of unauthenticated & forged handshakes (`UNAUTHORIZED: Invalid Compact JWE`).
2. Authenticated connections with verified NextAuth JWT tokens for Admin, Driver, and Tourist.
3. Strict room access control (unauthorized riders blocked from booking rooms).
4. In-app notification delivery and real-time unread count badges.
5. Custom trip submissions notifying admin while remaining hidden from drivers.
6. Verified payments broadcasting to admin and rider while remaining hidden from drivers.
7. Final admin approval broadcasting `booking:available` to eligible drivers.
8. Atomic driver acceptance notifying rider/admin and removing the trip from all other drivers.
9. Driver GPS location broadcasting to booking rooms with latency & accuracy data.
10. Server-side session revocation and instant socket disconnection.

---

## 🚢 Production Deployment

### Option A: PM2 on a VPS / Virtual Machine
Run both services under PM2 process manager:

1. **Build Next.js:**
   ```bash
   npm run build
   ```

2. **Start with PM2 ecosystem file (`ecosystem.config.js`):**
   ```javascript
   module.exports = {
     apps: [
       {
         name: "lar-nextjs",
         script: "node_modules/next/dist/bin/next",
         args: "start -p 3000",
         env: {
           NODE_ENV: "production",
         },
       },
       {
         name: "lar-realtime",
         script: "server/socket-server.ts",
         interpreter: "node",
         interpreter_args: "--import tsx",
         env: {
           NODE_ENV: "production",
           REALTIME_PORT: 3001,
         },
       },
     ],
   };
   ```
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   ```

### Option B: Docker Containers
Deploy the Socket.IO server as an independent Docker container alongside the Next.js application:

```dockerfile
# Dockerfile.realtime
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm install tsx
COPY server/ ./server/
COPY src/ ./src/
COPY tsconfig.json ./
EXPOSE 3001
CMD ["npx", "tsx", "server/socket-server.ts"]
```

### Option C: Reverse Proxy (Nginx)
Configure Nginx with WebSocket upgrade headers:

```nginx
# Next.js Application
server {
    server_name lankaairportride.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO Realtime Gateway
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Horizontal Scaling (Multi-Instance with Redis)
When running multiple Socket.IO server instances behind a load balancer (e.g. AWS ALB, Cloudflare, or Nginx with ip_hash), simply configure the `REDIS_URL` environment variable:
```bash
REDIS_URL=redis://default:secret@redis-cluster:6379
```
The server automatically detects `REDIS_URL` and activates `@socket.io/redis-adapter` so room broadcasts span seamlessly across all server instances.
