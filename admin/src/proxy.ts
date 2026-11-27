import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie, verifyCurrentSession } from "@/lib/auth";
import { platformCookie, verifyPlatformSession } from "@/lib/platform-auth";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    if (pathname === "/platform/login" || await verifyPlatformSession(request.cookies.get(platformCookie)?.value)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/platform/login", request.url), 303);
  }
  const scoped = /^\/r\/([^/]+)(\/(?:kitchen|tables|reservations|table-sessions|menu)(?:\/.*)?)$/.exec(pathname);
  const staffPath = scoped?.[2] ?? pathname;
  const api = pathname.startsWith("/api/") ||
    staffPath === "/kitchen/orders" || staffPath === "/kitchen/stream" ||
    /^\/tables\/[^/]+\/qr$/.test(staffPath);
  const kitchen = /^\/(?:api\/)?kitchen(?:\/|$)/.test(staffPath) || staffPath === "/reservations" || /^\/table-sessions(?:\/|$)/.test(staffPath);
  const session = await verifyCurrentSession(request.cookies.get(sessionCookie)?.value);
  if (!session) {
    if (api) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "Login required" }, {
        status: 401, headers: { "Cache-Control": "no-store" },
      });
    }
    const login = new URL("/r/" + encodeURIComponent(scoped?.[1] ?? "default") + "/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login, 303);
  }
  if (session.mustChangePassword) {
    if (api) return NextResponse.json({ code: "PASSWORD_CHANGE_REQUIRED", message: "Change your temporary password" }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
    return NextResponse.redirect(new URL("/r/" + session.restaurantSlug + "/change-password", request.url), 303);
  }
  if (scoped && scoped[1] !== session.restaurantSlug) {
    return NextResponse.redirect(new URL("/r/" + session.restaurantSlug + staffPath + search, request.url), 303);
  }
  if (!kitchen && session.role !== "ADMIN") {
    if (api) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Access denied" }, {
        status: 403, headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.redirect(new URL("/kitchen", request.url), 303);
  }
  if (scoped) return NextResponse.redirect(new URL(staffPath + search, request.url), 303);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/kitchen/:path*", "/tables/:path*", "/api/kitchen/:path*", "/api/tables/:path*", "/reservations", "/table-sessions/:path*", "/menu",
    "/r/:slug/kitchen/:path*", "/r/:slug/tables/:path*", "/r/:slug/reservations",
    "/r/:slug/table-sessions/:path*", "/r/:slug/menu",
    "/platform/:path*", "/products", "/orders",
  ],
};
