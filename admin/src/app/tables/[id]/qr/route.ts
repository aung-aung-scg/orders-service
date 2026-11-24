import { getTableQr } from "@/lib/pos-api";
import { adminRoles, requireRole, staffErrorResponse } from "@/lib/auth";

export async function GET(request: Request, context: RouteContext<"/tables/[id]/qr">) {
  const access = await requireRole(adminRoles, { api: true }).catch(staffErrorResponse);
  if (access instanceof Response) return access;
  const { id } = await context.params;
  const upstream = await getTableQr(id, request.signal).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  return new Response(upstream.body, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
