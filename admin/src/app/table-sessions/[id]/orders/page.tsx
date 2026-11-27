import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderHistory } from "@/app/order-history";
import { Button } from "@/components/ui/button";
import { BackendError } from "@/lib/api";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { getTableOrderHistory } from "@/lib/pos-api";

export default async function StaffOrderHistory({ params }: PageProps<"/table-sessions/[id]/orders">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireRole(kitchenRoles, { next: `/table-sessions/${id}/orders` });
  const history = await getTableOrderHistory(id).catch(error => {
    if (error instanceof BackendError && error.status === 404) notFound();
    throw error;
  });
  return (
    <section className="max-w-3xl space-y-4">
      <Button asChild variant="outline"><Link href="/table-sessions">Back to table sessions</Link></Button>
      <h1 className="text-3xl font-semibold tracking-tight">Table {history.number} order history</h1>
      <p className="text-sm text-muted-foreground">Submitted orders from current and previous seatings.</p>
      <OrderHistory orders={history.orders} />
    </section>
  );
}
