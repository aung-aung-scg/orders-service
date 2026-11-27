import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkspaceEmpty, WorkspaceLoadError } from "@/app/restaurant-admin/workspace-state";
import { kitchenRoles, requireRole } from "@/lib/auth";
import { listDiningSessions } from "@/lib/pos-api";
import { ResetForm } from "./reset-form";

export default async function TableSessionsPage() {
  const staff = await requireRole(kitchenRoles, { next: "/table-sessions" });
  const tables = await listDiningSessions().catch(() => null);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Table sessions</h1>
      <p className="text-sm text-muted-foreground">Give the current join code to guests seated at the table.</p>
      {tables === null ? <WorkspaceLoadError message="Couldn’t load table sessions." /> : !tables.length ? <WorkspaceEmpty title="No active tables" /> :
        <ul className="grid gap-3 sm:grid-cols-2">
          {tables.map(table => (
            <li key={table.id}>
              <Card className="gap-3 p-4">
                <h2 className="text-xl font-semibold">Table {table.number}</h2>
                {table.session ? <p>Join code <strong className="font-mono tracking-wider">{table.session.joinCode}</strong></p> : <p>No seating started.</p>}
                {table.activeTickets > 0 && <p className="text-sm">{table.activeTickets} active kitchen ticket(s). Finish them before normal reset.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline"><Link href={`/table-sessions/${table.id}/orders`}>Order history</Link></Button>
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
