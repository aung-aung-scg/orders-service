import { kitchenStream } from "@/lib/pos-api";
import { kitchenRoles, requireRole, staffErrorResponse } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await requireRole(kitchenRoles, { api: true }).catch(staffErrorResponse);
  if (access instanceof Response) return access;
  const expirySignal = AbortSignal.timeout(Math.max(0, access.exp * 1000 - Date.now()));
  const upstream = await kitchenStream(AbortSignal.any([request.signal, expirySignal])).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response(null, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
