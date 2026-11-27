import { adminRoles, requireRole } from "@/lib/auth";
import { listMenu } from "@/lib/menu-api";
import { WorkspaceLoadError } from "@/app/restaurant-admin/workspace-state";
import { MenuDirectory } from "./directory";

export default async function MenuPage() {
  await requireRole(adminRoles, { next: "/menu" });
  const items = await listMenu().catch(() => null);
  return items ? <MenuDirectory items={items} /> : <div className="space-y-6">
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Menu</h1>
    <WorkspaceLoadError message="Couldn’t load the menu." />
  </div>;
}
