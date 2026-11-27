import { Card } from "@/components/ui/card";
import { adminRoles, requireRole } from "@/lib/auth";
import { listMenu } from "@/lib/menu-api";
import { baht } from "@/lib/pos-schema";
import { AvailabilitySwitch, MenuEditor } from "./controls";

export default async function MenuPage() {
  await requireRole(adminRoles, { next: "/menu" });
  const items = await listMenu().catch(() => null);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Menu</h1>
        <MenuEditor />
      </header>
      {!items ? <p role="alert" className="text-destructive">Couldn’t load the menu. Try again.</p> :
        items.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-muted-foreground">No menu items yet.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map(item => (
              <li key={item.id}>
                <Card className="gap-4 rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="min-w-0 wrap-break-word font-semibold">{item.name}</h2>
                    <p className="font-semibold tabular-nums">{baht(item.priceMinor)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <AvailabilitySwitch item={item} />
                    <MenuEditor item={item} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
