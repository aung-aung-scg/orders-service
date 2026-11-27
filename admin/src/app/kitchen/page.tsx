import { connection } from "next/server";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getTickets } from "@/lib/pos-api";
import { KitchenBoard } from "./board";

export default async function KitchenPage() {
  await requireRole(kitchenRoles, { next: "/kitchen" });
  await connection();
  const tickets = await getTickets();
  return (
    <div data-kitchen>
      <KitchenBoard initialTickets={tickets} />
    </div>
  );
}
