import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

function isCrossOriginMutation(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/api/") &&
    isCrossOriginMutation(request)
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
