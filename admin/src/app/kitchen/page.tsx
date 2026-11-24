import { connection } from "next/server";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getTickets } from "@/lib/pos-api";
import { KitchenBoard } from "./board";
import "../pos.css";

export default async function KitchenPage() {
  await requireRole(kitchenRoles, { next: "/kitchen" });
  await connection();
  const tickets = await getTickets();
  return (
    <>
      <h1>Kitchen</h1>
      <KitchenBoard initialTickets={tickets} />
    </>
  );
}
