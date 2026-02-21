// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",

      // images/media
      "img-src 'self' data: https:",
      "media-src 'self' https:",

      // styles/scripts
      "style-src 'self' 'unsafe-inline' https:",
      // TradingView tv.js comes from s3.tradingview.com
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: https://s3.tradingview.com https://*.tradingview.com",

      // XHR/WebSocket (TradingView can use wss)
      "connect-src 'self' https: wss: https://*.tradingview.com wss://*.tradingview.com",

      // ✅ allow widgets/iframes
      "frame-src https://sslecal2.investing.com https://ssltvc.investing.com https://*.investing.com https://investinglive.com https://*.investinglive.com https://s.tradingview.com https://*.tradingview.com",

      // who is allowed to embed *your* site
      "frame-ancestors 'self'",

      "form-action 'self' https:",
      "upgrade-insecure-requests",
    ].join("; "),
  },

  // This controls who can frame YOUR site (not your iframes). Fine to keep.
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