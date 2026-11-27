import type { MetadataRoute } from "next";
import { publicUrl } from "@/lib/public-origin";
import { listPublicRestaurantSlugs } from "@/lib/restaurant-api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await listPublicRestaurantSlugs()).map(({ slug }) => ({ url: publicUrl("/r/" + slug).href }));
}
