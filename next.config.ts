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
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + TradingView (embed script uses eval + loads sub-scripts)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com",
              // Styles: self + inline (Tailwind, lightweight-charts, TradingView widget)
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs (screenshots) + Supabase + TradingView
              "img-src 'self' data: blob: https://ixechsvuamxwinqgxjbg.supabase.co https://*.tradingview.com https://static.tradingview.com https://s3-symbol-logo.tradingview.com",
              // Fonts: self + TradingView
              "font-src 'self' https://*.tradingview.com",
              // Connect: self + all APIs + TradingView live data (HTTPS + WSS)
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.twelvedata.com https://api.binance.com https://*.tradingview.com wss://*.tradingview.com https://cdn.jsdelivr.net",
              // Frames: TradingView widget iframes
              "frame-src https://*.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com",
              // Workers: TradingView uses web workers
              "worker-src 'self' blob:",
              // Child-src: for workers + frames
              "child-src 'self' blob: https://*.tradingview.com",
              "media-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
