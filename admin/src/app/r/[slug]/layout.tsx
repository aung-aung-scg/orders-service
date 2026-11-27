import { publicRestaurant } from "@/lib/restaurant-api";

export default async function RestaurantLayout({ children, params }: LayoutProps<"/r/[slug]">) {
  const { slug } = await params;
  await publicRestaurant(slug);
  return children;
}
