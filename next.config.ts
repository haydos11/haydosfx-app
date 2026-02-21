// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",
      "connect-src 'self' https: wss:",
      // ✅ allow the Investing.com calendar widget hosts
      "frame-src https://sslecal2.investing.com https://ssltvc.investing.com https://*.investing.com https://investinglive.com https://*.investinglive.com",
      // who is allowed to embed *your* site
      "frame-ancestors 'self'",
      "form-action 'self' https:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
