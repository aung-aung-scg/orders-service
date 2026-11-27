import { redirect } from "next/navigation";
import { BackendError } from "@/lib/api";
import { listRestaurants } from "@/lib/platform-api";
import { requirePlatform } from "@/lib/platform-auth";
import { PlatformDashboard, PlatformLoadError } from "./dashboard";
import { PlatformShell } from "./shell";

export default async function PlatformPage() {
  const session = await requirePlatform();
  const restaurants = await listRestaurants(session).catch(error => {
    if (error instanceof BackendError && (error.status === 401 || error.status === 403)) redirect("/platform/login");
    return null;
  });
  return <PlatformShell>
    {restaurants ? <PlatformDashboard restaurants={restaurants} /> : <PlatformLoadError />}
  </PlatformShell>;
}
