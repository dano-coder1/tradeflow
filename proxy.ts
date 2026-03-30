import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/trades");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Set CSP on page requests (not API or static assets)
  const isPageRequest =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.includes(".");

  if (isPageRequest) {
    supabaseResponse.headers.set("Content-Security-Policy", CSP);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
