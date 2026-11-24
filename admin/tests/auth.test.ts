import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { sessionMaxAge, signSession, verifySession } from "../src/lib/auth";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const session = { sub: "staff-id", username: "kitchen", role: "KITCHEN" } as const;
const secret = "staff-session-test-secret-00000001";

beforeEach(() => vi.stubEnv("JWT_SECRET", secret));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("signs and verifies a session", async () => {
  expect(await verifySession(await signSession(session))).toMatchObject(session);
});

test("rejects an expired session", async () => {
  vi.useFakeTimers();
  const token = await signSession(session);
  vi.setSystemTime(Date.now() + (sessionMaxAge + 1) * 1000);
  expect(await verifySession(token)).toBeNull();
});

test("rejects a tampered signature", async () => {
  const [header, payload, signature] = (await signSession(session)).split(".");
  const tampered = (signature.startsWith("A") ? "B" : "A") + signature.slice(1);
  expect(await verifySession(`${header}.${payload}.${tampered}`)).toBeNull();
});

test("rejects a token signed with a different secret", async () => {
  const token = await signSession(session);
  vi.stubEnv("JWT_SECRET", "different-staff-secret-00000000002");
  expect(await verifySession(token)).toBeNull();
});

test("rejects an unsigned token", async () => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const payload = { ...session, iss: "orders-admin", iat, exp: iat + sessionMaxAge };
  expect(await verifySession(`${encode({ alg: "none" })}.${encode(payload)}.`)).toBeNull();
});
