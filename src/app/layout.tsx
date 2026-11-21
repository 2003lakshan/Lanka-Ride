import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Providers from "@/components/Providers";
import WhatsAppSupportButton from "@/components/whatsapp/WhatsAppSupportButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "At Your Service – Powered by Pexora | Premium Sri Lanka Travel & Transfers",
    template: "%s | At Your Service – Powered by Pexora",
  },
  description: "Official Sri Lanka airport transfers, custom multi-day island trip planning, and verified driver tour packages with real-time GPS tracking. Powered by Pexora.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
                        <body
        className={`${inter.className} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <Providers>
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
          <WhatsAppSupportButton />
        </Providers>
      </body>
    </html>
  );
}
