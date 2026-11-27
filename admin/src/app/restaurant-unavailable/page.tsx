import type { Metadata } from "next";
import { RestaurantUnavailable } from "@/app/restaurant-unavailable";

export const metadata: Metadata = {
  title: "Restaurant temporarily unavailable", robots: { index: false, follow: false },
};

export default function UnavailablePage() {
  return <RestaurantUnavailable />;
}
