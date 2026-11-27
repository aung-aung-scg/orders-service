import { redirectLegacyRestaurantPage } from "@/lib/legacy-restaurant-route";

export default async function LegacyPage({ searchParams }: PageProps<"/my-reservations">) {
  redirectLegacyRestaurantPage("/r/default/my-reservations", await searchParams);
}
