import { redirectLegacyRestaurantPage } from "@/lib/legacy-restaurant-route";

export default async function LegacyPage({ params, searchParams }: PageProps<"/booking/[code]/reschedule">) {
  redirectLegacyRestaurantPage("/r/default/booking/" + encodeURIComponent((await params).code) + "/reschedule", await searchParams);
}
