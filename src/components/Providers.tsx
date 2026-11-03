"use client";

import { SessionProvider } from "next-auth/react";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { NotificationSoundProvider } from "@/components/notifications/NotificationSoundProvider";
import { DriverTrackingProvider } from "@/components/providers/DriverTrackingProvider";
import { IncomingRideProvider } from "@/components/providers/DriverOfferProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SocketProvider>
        <NotificationSoundProvider>
          <DriverTrackingProvider>
            <IncomingRideProvider>
              {children}
            </IncomingRideProvider>
          </DriverTrackingProvider>
        </NotificationSoundProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
