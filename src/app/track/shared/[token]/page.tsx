import { Metadata } from "next";
import SharedTripTrackingClient from "./SharedTripTrackingClient";

export const metadata: Metadata = {
  title: "Live Trip Tracking | At Your Service",
  description: "Secure, real-time vehicle and trip tracking powered by At Your Service – Powered by Pexora.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  referrer: "no-referrer",
};

interface SharedTrackPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedTrackPage({ params }: SharedTrackPageProps) {
  const { token } = await params;
  return <SharedTripTrackingClient token={token} />;
}

