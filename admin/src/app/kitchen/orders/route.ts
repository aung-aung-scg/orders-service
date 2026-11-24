import { getTickets } from "@/lib/pos-api";
import { kitchenRoles, requireRole, staffErrorResponse } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await requireRole(kitchenRoles, { api: true }).catch(staffErrorResponse);
  if (access instanceof Response) return access;
  try {
    return Response.json(await getTickets(request.signal), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
