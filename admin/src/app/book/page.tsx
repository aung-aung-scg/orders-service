import { redirectLegacyRestaurantPage } from "@/lib/legacy-restaurant-route";

export default async function LegacyPage({ searchParams }: PageProps<"/book">) {
  redirectLegacyRestaurantPage("/r/default/book", await searchParams);
}
