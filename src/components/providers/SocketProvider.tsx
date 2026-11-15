"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { Wifi, WifiOff } from "lucide-react";

type ConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected";

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connectionState: ConnectionState;
  subscribeToBooking: (bookingId: string) => void;
  unsubscribeFromBooking: (bookingId: string) => void;
  subscribeToEnquiry: (enquiryId: string) => void;
  unsubscribeFromEnquiry: (enquiryId: string) => void;
  registerReconnectHandler: (handler: () => void) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  connectionState: "disconnected",
  subscribeToBooking: () => {},
  unsubscribeFromBooking: () => {},
  subscribeToEnquiry: () => {},
  unsubscribeFromEnquiry: () => {},
  registerReconnectHandler: () => () => {},
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

/**
 * Resolves the Socket.IO server URL.
 * Automatically adapts between laptop (localhost), local LAN phone (Wi-Fi IP e.g. 192.168.8.100),
 * and public tunnels (e.g. trycloudflare.com).
 */
function getSocketServerUrl(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_REALTIME_PORT || "3001";

    // 1. If accessing via localhost or private LAN IP (same Wi-Fi), connect directly to port 3001:
    const isLocalOrLan =
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    if (isLocalOrLan) {
      return `${protocol}//${host}:${port}`;
    }

    // 2. If a dedicated remote realtime URL is provided (excluding dead trycloudflare tunnels):
    const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (
      envUrl &&
      !envUrl.includes("localhost") &&
      !envUrl.includes("0.0.0.0") &&
      !envUrl.includes("trycloudflare.com")
    ) {
      return envUrl;
    }

    // 3. For public tunnels (e.g. *.trycloudflare.com) where port 3001 is NOT exposed:
    // Connect to same-origin (standard HTTPS port 443) routed through Next.js /socket.io rewrite!
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const reconnectHandlersRef = useRef<Set<() => void>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const registerReconnectHandler = useCallback((handler: () => void) => {
    reconnectHandlersRef.current.add(handler);
    return () => {
      reconnectHandlersRef.current.delete(handler);
    };
  }, []);

  const subscribeToBooking = useCallback((bookingId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("booking:subscribe", { bookingId }, (res: any) => {
        if (res && !res.success) {
          console.warn("[Realtime] Failed to subscribe to booking:", res.error);
        }
      });
    }
  }, []);

  const unsubscribeFromBooking = useCallback((bookingId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("booking:unsubscribe", { bookingId });
    }
  }, []);

  const subscribeToEnquiry = useCallback((enquiryId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("enquiry:subscribe", { enquiryId }, (res: any) => {
        if (res && !res.success) {
          console.warn("[Realtime] Failed to subscribe to enquiry:", res.error);
        }
      });
    }
  }, []);

  const unsubscribeFromEnquiry = useCallback((enquiryId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("enquiry:unsubscribe", { enquiryId });
    }
  }, []);

  useEffect(() => {
    // Completely skip realtime connection when on login or signup pages
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path === "/login" || path === "/signup" || path.startsWith("/forgot-password")) {
        return;
      }
    }

    if (sessionStatus !== "authenticated" || !session?.user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnectionState("disconnected");
      }
      return;
    }

    let isCancelled = false;

    async function initSocket() {
      try {
        setConnectionState("connecting");

        // Fetch verified socket token from Next.js server
        const res = await fetch("/api/auth/socket-token");
        if (!res.ok) {
          throw new Error("Failed to get socket authentication token");
        }
        const { token } = await res.json();

        if (isCancelled) return;

        const socketUrl = getSocketServerUrl();
        console.log(`[Realtime] Connecting to WebSocket server at: ${socketUrl}`);

        const newSocket = io(socketUrl, {
          auth: { token },
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 5000,
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on("connect", () => {
          setConnectionState("connected");
          const transport = newSocket.io?.engine?.transport?.name || "unknown";
          console.log(`[Realtime] Connected to WebSocket server: ID=${newSocket.id}, Transport=${transport}, Target=${socketUrl}`);
        });

        newSocket.on("reconnect", () => {
          setConnectionState("connected");
          console.log("[Realtime] Reconnected. Recovering missed state...");
          // Invoke all registered reconnect recovery handlers
          reconnectHandlersRef.current.forEach((handler) => {
            try {
              handler();
            } catch (e) {
              console.error("[Realtime] Error executing reconnect handler:", e);
            }
          });
        });

        newSocket.on("reconnecting", () => {
          setConnectionState("reconnecting");
        });

        newSocket.on("connect_error", (err) => {
          console.warn("[Realtime] Connection error:", err.message);
          setConnectionState("disconnected");
        });

        newSocket.on("disconnect", (reason) => {
          console.log("[Realtime] Disconnected:", reason);
          setConnectionState("disconnected");
          if (reason === "io server disconnect") {
            // Server disconnected socket (e.g. revoked session)
            newSocket.connect();
          }
        });

        newSocket.on("session:revoked", (data) => {
          console.warn("[Realtime] Session revoked by server:", data);
          window.location.href = "/login";
        });
      } catch (err: any) {
        console.warn("[Realtime] Could not establish connection:", err.message);
        setConnectionState("disconnected");
      }
    }

    initSocket();

    return () => {
      isCancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnectionState("disconnected");
      }
    };
  }, [sessionStatus, (session?.user as any)?.id]);

  const value: SocketContextValue = {
    socket,
    isConnected: connectionState === "connected",
    connectionState,
    subscribeToBooking,
    unsubscribeFromBooking,
    subscribeToEnquiry,
    unsubscribeFromEnquiry,
    registerReconnectHandler,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/**
 * Subtle indicator showing realtime WebSocket connectivity
 */
export function RealtimeIndicator() {
  const { isConnected, connectionState } = useSocket();
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border transition-all select-none"
      title={
        isConnected
          ? "Realtime connected via WebSocket"
          : connectionState === "reconnecting"
          ? "Reconnecting to realtime server... Polling fallback active"
          : "Offline from realtime. Polling fallback active"
      }
      style={{
        backgroundColor: isConnected ? "rgba(240, 253, 244, 0.9)" : "rgba(254, 242, 242, 0.9)",
        borderColor: isConnected ? "rgba(187, 247, 208, 1)" : "rgba(254, 202, 202, 1)",
        color: isConnected ? "#15803d" : "#b91c1c",
      }}
    >
      <span className="relative flex h-2 w-2">
        {isConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
        )}
      </span>
      <span className="hidden sm:inline">
        {isConnected ? "Live" : connectionState === "reconnecting" ? "Reconnecting" : "Offline"}
      </span>
    </div>
  );
}
