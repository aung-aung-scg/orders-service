import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionSecret } from "./auth-secret";

export const sessionCookie = "staff_session";
export const sessionMaxAge = 8 * 60 * 60;
export const staffRole = z.enum(["ADMIN", "KITCHEN"]);
const claims = z.object({ sub: z.string().min(1), username: z.string().min(1), role: staffRole });
const verifiedClaims = claims.extend({ exp: z.number().int(), iat: z.number().int() });

export type StaffRole = z.infer<typeof staffRole>;
export const kitchenRoles = ["ADMIN", "KITCHEN"] as const;
export const adminRoles = ["ADMIN"] as const;
const issuer = "orders-admin";

export function signSession(payload: z.infer<typeof claims>) {
  return new SignJWT(claims.parse(payload))
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAge}s`)
    .sign(sessionSecret());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  const secret = sessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer,
      requiredClaims: ["exp", "iat"],
      maxTokenAge: sessionMaxAge,
    });
    return verifiedClaims.parse(payload);
  } catch {
    return null;
  }
}

export async function getSession() {
  return verifySession((await cookies()).get(sessionCookie)?.value);
}

class StaffAccessError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Login required" : "Access denied");
  }
}

export function staffErrorResponse(error: unknown) {
  if (!(error instanceof StaffAccessError)) throw error;
  return new Response(JSON.stringify({
    code: error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
    message: error.message,
  }), {
    status: error.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function requireRole(roles: readonly StaffRole[], options: { api?: boolean; next?: string } = {}) {
  const session = await getSession();
  if (!session) {
    if (options.api) throw new StaffAccessError(401);
    redirect(options.next ? "/login?" + new URLSearchParams({ next: options.next }) : "/login");
  }
  if (!roles.includes(session.role)) {
    if (options.api) throw new StaffAccessError(403);
    redirect("/kitchen");
  }
  return session;
}
