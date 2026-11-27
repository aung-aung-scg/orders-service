import { Badge } from "@/components/ui/badge";
import { baht, orderLabels, type SubmittedOrder } from "@/lib/pos-schema";

const submittedTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: process.env.BOOKING_TZ ?? "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
});

export function OrderHistory({ orders, expandedOrderId }: { orders: SubmittedOrder[]; expandedOrderId?: string }) {
  if (!orders.length) return <p className="rounded-2xl border bg-card p-5 text-muted-foreground">No submitted orders yet.</p>;

  return (
    <ul className="space-y-3">
      {orders.map(order => (
        <li key={order.id}>
          <details open={expandedOrderId === order.id || undefined} className="rounded-2xl border bg-card shadow-sm">
            <summary className="cursor-pointer rounded-2xl p-4">
              <span className="ml-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle">
                <time dateTime={order.submittedAt} className="text-sm font-medium">{submittedTime.format(new Date(order.submittedAt))}</time>
                <Badge variant={order.status === "CANCELLED" ? "outline" : "secondary"}>{orderLabels[order.status]}</Badge>
                <span className="text-sm font-semibold tabular-nums">{baht(order.totalMinor)}</span>
              </span>
            </summary>
            <ul className="divide-y border-t px-4">
              {order.items.map(item => (
                <li key={item.id} className="grid min-w-0 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                  <p className="min-w-0 wrap-break-word font-medium">{item.quantity} × {item.nameSnapshot}</p>
                  <p className="text-muted-foreground">{baht(item.unitPriceMinor)} each</p>
                  {item.note && <p className="min-w-0 whitespace-pre-wrap wrap-break-word text-muted-foreground sm:col-span-2">{item.note}</p>}
                </li>
              ))}
            </ul>
            <p className="flex justify-between gap-2 border-t px-4 py-3 text-sm font-semibold"><span>Order subtotal</span><span>{baht(order.totalMinor)}</span></p>
          </details>
        </li>
      ))}
    </ul>
  );
}
