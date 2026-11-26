import { connection } from "next/server";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getTickets } from "@/lib/pos-api";
import { KitchenBoard } from "./board";

export default async function KitchenPage() {
  await requireRole(kitchenRoles, { next: "/kitchen" });
  await connection();
  const tickets = await getTickets();
  return (
    <div data-kitchen className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-9">
      <KitchenBoard initialTickets={tickets} />
    </div>
  );
}
