import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s3.tradingview.com https://*.tradingview.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://ixechsvuamxwinqgxjbg.supabase.co https://*.tradingview.com https://static.tradingview.com https://s3-symbol-logo.tradingview.com",
  "font-src 'self' https://*.tradingview.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.twelvedata.com https://api.binance.com https://*.tradingview.com wss://*.tradingview.com https://cdn.jsdelivr.net",
  "frame-src https://*.tradingview.com https://www.tradingview.com https://www.tradingview-widget.com https://*.tradingview-widget.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob: https://*.tradingview.com",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Only set CSP on page/document requests, not on API routes or static assets
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return response;
  }

  response.headers.set("Content-Security-Policy", CSP);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
