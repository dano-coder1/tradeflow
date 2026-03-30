import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ixechsvuamxwinqgxjbg.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + TradingView embed (which uses eval internally)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com",
              // Styles: self + inline (Tailwind, lightweight-charts)
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs (screenshots) + Supabase storage
              "img-src 'self' data: blob: https://ixechsvuamxwinqgxjbg.supabase.co",
              // Fonts: self
              "font-src 'self'",
              // Connect: self + APIs used by the app
              "connect-src 'self' https://*.supabase.co https://api.twelvedata.com https://api.binance.com https://*.tradingview.com https://cdn.jsdelivr.net wss://*.supabase.co",
              // Frames: TradingView widget iframes
              "frame-src https://*.tradingview.com",
              // Media: none needed
              "media-src 'none'",
              // Object: none
              "object-src 'none'",
              // Base URI
              "base-uri 'self'",
              // Form action
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
