import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { RestaurantUnavailable } from "@/app/restaurant-unavailable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
  title: t("common.restaurantTemporarilyUnavailable"), robots: { index: false, follow: false },};
}

export default function UnavailablePage() {
  return <RestaurantUnavailable />;
}
