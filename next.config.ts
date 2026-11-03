import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow physical mobile phone on local Wi-Fi to load dev chunks without 403 Forbidden
  allowedDevOrigins: [
    "192.168.8.100",
    "192.168.8.100:3000",
    "localhost",
    "localhost:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "192.168.8.100:3000",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
