import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkspaceEmpty, WorkspaceLoadError } from "@/app/restaurant-admin/workspace-state";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { listDiningSessions } from "@/lib/pos-api";
import { ResetForm } from "./reset-form";

export default async function TableSessionsPage() {
  const t = await getTranslations();
  const staff = await requireRole(kitchenRoles, { next: "/table-sessions" });
  const tables = await listDiningSessions().catch(() => null);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("tables.tableSessions")}</h1>
      <p className="text-sm text-muted-foreground">{t("tables.giveTheCurrentJoinCodeToGuests")}</p>
      {tables === null ? <WorkspaceLoadError message={t("tables.couldnTLoadTableSessions")} /> : !tables.length ? <WorkspaceEmpty title={t("tables.noActiveTables")} /> :
        <ul className="grid gap-3 sm:grid-cols-2">
          {tables.map(table => (
            <li key={table.id}>
              <Card className="gap-3 p-4">
                <h2 className="text-xl font-semibold">{t("customer.tableNumber", { number: table.number })}</h2>
                {table.session ? <p>{t("customer.joinCode")}{" "}<strong className="font-mono tracking-wider">{table.session.joinCode}</strong></p> : <p>{t("tables.noSeatingStarted")}</p>}
                {table.activeTickets > 0 && <p className="text-sm">{t("feedback.activeTickets", { count: table.activeTickets })}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline"><Link href={`/table-sessions/${table.id}/orders`}>{t("tables.orderHistory")}</Link></Button>
                  {!table.activeTickets || staff.role === "ADMIN" ? (
                    <ResetForm key={table.session?.id ?? "new"} id={table.id} current={table.session?.id ?? null} override={table.activeTickets > 0} />
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>}
    </section>
  );
}
