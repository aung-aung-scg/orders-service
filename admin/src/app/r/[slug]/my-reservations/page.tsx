import type { Metadata } from "next";
import { publicRestaurant } from "@/lib/restaurant-api";
import { Card } from "@/components/ui/card";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = { title: "My Reservations", referrer: "no-referrer", robots: { index: false } };

export default async function MyReservationsPage({ params }: PageProps<"/r/[slug]/my-reservations">) {
  const { slug } = await params;
  await publicRestaurant(slug);
  return (
    <section className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Card className="gap-4 rounded-2xl p-5 sm:p-7">
        <h1 className="text-2xl font-semibold">My Reservations</h1>
        <p className="text-sm text-muted-foreground">Enter your booking phone number to find upcoming reservations saved in this browser.</p>
        <LookupForm slug={slug} />
      </Card>
    </section>
  );
}
