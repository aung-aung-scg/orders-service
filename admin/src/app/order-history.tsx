import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { orderLabels, type SubmittedOrder } from "@/lib/pos-schema";

export function OrderHistory({ orders, expandedOrderId, timeZone }: { orders: SubmittedOrder[]; expandedOrderId?: string; timeZone: string }) {
  const t = useTranslations();
  const format = useFormatter();
  if (!orders.length) return <p className="rounded-2xl border bg-card p-5 text-muted-foreground">{t("customer.noSubmittedOrdersYet")}</p>;

  return (
    <ul className="space-y-3">
      {orders.map(order => (
        <li key={order.id}>
          <details open={expandedOrderId === order.id || undefined} className="rounded-2xl border bg-card shadow-sm">
            <summary className="cursor-pointer rounded-2xl p-4">
              <span className="ml-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle">
                <time dateTime={order.submittedAt} className="text-sm font-medium">{format.dateTime(new Date(order.submittedAt), { dateStyle: "medium", timeStyle: "short", timeZone })}</time>
                <Badge variant={order.status === "CANCELLED" ? "outline" : "secondary"}>{t(orderLabels[order.status])}</Badge>
                <span className="text-sm font-semibold tabular-nums">{format.number(order.totalMinor / 100, { style: "currency", currency: "THB" })}</span>
              </span>
            </summary>
            <ul className="divide-y border-t px-4">
              {order.items.map(item => (
                <li key={item.id} className="grid min-w-0 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                  <p className="min-w-0 wrap-break-word font-medium">{format.number(item.quantity, "quantity")} × {item.nameSnapshot}</p>
                  <p className="text-muted-foreground">{format.number(item.unitPriceMinor / 100, { style: "currency", currency: "THB" })}{" "}{t("customer.each")}</p>
                  {item.note && <p className="min-w-0 whitespace-pre-wrap wrap-break-word text-muted-foreground sm:col-span-2">{item.note}</p>}
                </li>
              ))}
            </ul>
            <p className="flex justify-between gap-2 border-t px-4 py-3 text-sm font-semibold"><span>{t("customer.orderSubtotal")}</span><span>{format.number(order.totalMinor / 100, { style: "currency", currency: "THB" })}</span></p>
          </details>
        </li>
      ))}
    </ul>
  );
}
