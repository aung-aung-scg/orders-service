import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackendError } from "@/lib/api";
import { listRestaurants } from "@/lib/platform-api";
import { requirePlatform } from "@/lib/platform-auth";
import { platformLogout } from "./actions";
import { CreateRestaurantForm, RestaurantControls } from "./forms";

export default async function PlatformPage() {
  const session = await requirePlatform();
  const restaurants = await listRestaurants(session).catch(error => {
    if (error instanceof BackendError && (error.status === 401 || error.status === 403)) redirect("/platform/login");
    throw error;
  });
  const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

  return <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">Restaurants</h1>
      <form action={platformLogout}><Button variant="outline">Sign out</Button></form>
    </header>
    <Card className="gap-3 p-4 sm:p-6">
      <h2 className="font-semibold">Create restaurant</h2>
      <CreateRestaurantForm />
    </Card>
    <Card className="overflow-x-auto p-4 sm:p-6">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="p-2">Name</th><th className="p-2">Slug</th><th className="p-2">Status</th>
          <th className="p-2">Created (UTC)</th><th className="p-2">Actions</th></tr></thead>
        <tbody>
          {restaurants.map(restaurant => <tr key={restaurant.id} className="border-b align-top last:border-0">
            <td className="p-2 font-medium">{restaurant.name}</td><td className="p-2">{restaurant.slug}</td>
            <td className="p-2">{restaurant.active ? "Active" : "Suspended"}</td>
            <td className="whitespace-nowrap p-2">{date.format(new Date(restaurant.createdAt))}</td>
            <td className="p-2"><RestaurantControls id={restaurant.id} name={restaurant.name} active={restaurant.active} /></td>
          </tr>)}
          {!restaurants.length && <tr><td colSpan={5} className="p-2 text-muted-foreground">No restaurants yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  </main>;
}
