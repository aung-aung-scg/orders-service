import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { publicUrl } from "@/lib/public-origin";
import { publicRestaurant } from "@/lib/restaurant-api";

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await publicRestaurant(slug);
  const title = restaurant.name;
  const description = `Book a table at ${restaurant.name} or manage an upcoming reservation.`;
  const url = publicUrl("/r/" + restaurant.slug);
  return { title, description, alternates: { canonical: url }, openGraph: { type: "website", title, description, url } };
}

export default async function RestaurantHome({ params }: PageProps<"/r/[slug]">) {
  const { slug } = await params;
  const restaurant = await publicRestaurant(slug);
  const path = "/r/" + restaurant.slug;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    url: publicUrl(path).href,
    acceptsReservations: publicUrl(path + "/book").href,
  }).replace(/</g, "\\u003c");
  return <main className="grid min-h-[65vh] place-items-center px-4">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    <Card className="w-full max-w-lg gap-5 p-6 sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight">{restaurant.name}</h1>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href={path + "/book"}>Book a table</Link></Button>
        <Button asChild variant="outline"><Link href={path + "/my-reservations"}>My Reservations</Link></Button>
      </div>
    </Card>
  </main>;
}
