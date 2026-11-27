import { redirectLegacyRestaurantPage } from "@/lib/legacy-restaurant-route";

export default async function LegacyPage({ searchParams }: PageProps<"/login">) {
  redirectLegacyRestaurantPage("/r/default/login", await searchParams);
}
