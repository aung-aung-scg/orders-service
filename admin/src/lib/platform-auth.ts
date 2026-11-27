import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionSecret } from "./auth-secret";

export const platformCookie = "platform_session";
const issuer = "orders-platform";
const maxAge = 8 * 60 * 60;
const claims = z.object({
  sub: z.string().min(1), role: z.literal("SUPER_ADMIN"), credentialVersion: z.number().int().nonnegative(),
});

export async function verifyPlatformSession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      issuer, algorithms: ["HS256"], maxTokenAge: maxAge, requiredClaims: ["iat", "exp"],
    });
    return claims.parse(payload);
  } catch {
    return null;
  }
}

export async function setPlatformSession(payload: z.infer<typeof claims>) {
  const token = await new SignJWT(claims.parse(payload)).setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(sessionSecret());
  (await cookies()).set(platformCookie, token, {
    path: "/platform", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge,
  });
}

export async function requirePlatform() {
  const session = await verifyPlatformSession((await cookies()).get(platformCookie)?.value);
  if (!session) redirect("/platform/login");
  return session;
}

export function platformKeyHeaders() {
  const key = process.env.PLATFORM_API_KEY;
  if (!key) throw new Error("PLATFORM_API_KEY is required");
  return { "X-Platform-API-Key": key };
}

export function platformHeaders(session: Awaited<ReturnType<typeof requirePlatform>>) {
  return {
    ...platformKeyHeaders(),
    "X-Platform-Actor-Id": session.sub,
    "X-Platform-Actor-Version": String(session.credentialVersion),
  };
}
